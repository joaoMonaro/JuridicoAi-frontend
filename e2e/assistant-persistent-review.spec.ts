import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { StoredProposal, ReviewReceipt } from "../src/features/ai-assistant/review/persistent-api";

const caseId = "11111111-1111-1111-1111-111111111111";
const pieceUrl = "http://127.0.0.1:5299/api/pecas/22222222-2222-2222-2222-222222222222";
const conversationId = "66666666-6666-4666-8666-666666666666";

// These browser tests exercise the editor/API boundary. Transactional behavior is
// tested separately against a real PostgreSQL database in the backend suite.
async function persistentReview(page: Page, request: APIRequestContext, dropReceipt = false) {
  let proposal: StoredProposal | null = null;
  let receipt: ReviewReceipt | null = null;
  let applications = 0;
  let browserPatches = 0;
  page.on("request", (req) => { if (req.method() === "PATCH" && req.url() === pieceUrl) browserPatches++; });
  await page.route("**/api/templates-peca", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/assistente/capacidades", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), suportaRevisaoPersistida: true } });
  });
  await page.route("**/api/assistente/v2/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.endsWith("/conversa")) return route.fulfill({ json: { id: conversationId } });
    if (path.endsWith("/propostas") && req.method() === "GET")
      return route.fulfill({ json: proposal ? [proposal] : [] });
    if (path.endsWith("/propostas") && req.method() === "POST") {
      const input = req.postDataJSON();
      const piece = await (await request.get(pieceUrl)).json();
      proposal = {
        id: "77777777-7777-4777-8777-777777777777", conversaId: conversationId,
        snapshotId: "88888888-8888-4888-8888-888888888888", revisao: 1, versaoDecisoes: 1,
        versaoPecaAplicavel: input.versaoPecaEsperada, estado: "Pendente", documentoBase: piece.conteudoJson,
        grupos: input.grupos.map((group: { explicacao: string; operacoes: unknown[] }, i: number) => ({
          ...group, id: `group-${i}`, estado: "Pendente", previewSha256: "opaque-server-hash",
          operacoes: group.operacoes.map((op) => ({ ...(op as object), tipo: "SpliceBlocos" })),
        })),
      };
      return route.fulfill({ json: proposal });
    }
    if (path.includes("/aplicacoes/") && req.method() === "GET")
      return receipt ? route.fulfill({ json: receipt }) : route.fulfill({ status: 404, json: { detail: "Recibo não encontrado." } });
    if (path.endsWith("/aplicacoes") && req.method() === "POST" && proposal) {
      applications++;
      const input = req.postDataJSON();
      const document = structuredClone(proposal.documentoBase);
      const selected = proposal.grupos.filter((group) => input.grupos.some((item: { id: string }) => item.id === group.id));
      for (const op of selected.flatMap((group) => group.operacoes).sort((a, b) => b.startIndex - a.startIndex))
        document.content!.splice(op.startIndex, op.deleteCount, ...op.novosBlocos);
      const response = await request.patch(pieceUrl, { data: { versao: input.versaoPecaEsperada, conteudoJson: document } });
      expect(response.ok()).toBeTruthy();
      const saved = await response.json();
      proposal = { ...proposal, documentoBase: document, estado: "Resolvida", versaoDecisoes: 2,
        versaoPecaAplicavel: saved.versao, grupos: proposal.grupos.map((group) => ({ ...group, estado: "Aplicado" })) };
      receipt = { requestId: input.requestId, propostaId: proposal.id, versaoAnterior: input.versaoPecaEsperada,
        versaoResultante: saved.versao, versaoPecaAtual: saved.versao, resultadoAindaAtual: true,
        gruposAplicados: selected.map((group) => group.id), conteudoJson: document,
        dataAtualizacao: saved.dataAtualizacao, propostaRestante: proposal };
      if (dropReceipt) { dropReceipt = false; return route.abort("connectionreset"); }
      return route.fulfill({ json: receipt });
    }
    if (path.endsWith("/rejeicoes") && proposal) {
      proposal = { ...proposal, estado: "Resolvida", versaoDecisoes: 2,
        grupos: proposal.grupos.map((group) => ({ ...group, estado: "Rejeitado" })) };
      return route.fulfill({ json: proposal });
    }
    return route.fulfill({ status: 404, json: { detail: "Rota de revisão não configurada." } });
  });
  return { applications: () => applications, browserPatches: () => browserPatches };
}

async function generateProposal(page: Page) {
  await page.goto(`/casos/${caseId}`);
  const editor = page.locator(".ProseMirror");
  await expect(editor).toContainText("Trecho original.");
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await page.getByRole("button", { name: "Reescrever", exact: true }).click();
  await page.getByRole("button", { name: "Enviar para IA" }).click();
  await page.getByRole("button", { name: "Revisar no documento" }).click();
  await expect(page.getByRole("region", { name: "Revisão das alterações" })).toBeVisible();
  await expect(page.getByText("Paginação de revisão", { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const source = await editor.locator(":scope > p").first().boundingBox();
    const canvas = await page.locator("[data-review-scroll-container]").boundingBox();
    return Boolean(source && canvas && source.y >= canvas.y && source.y + source.height <= canvas.y + canvas.height);
  }).toBe(true);
}

test.beforeEach(async ({ page, request }) => {
  await request.post("http://127.0.0.1:5299/__e2e/reset");
  await page.addInitScript(() => window.sessionStorage.setItem("juridicoai.auth-session", JSON.stringify({
    accessToken: "token-e2e-ficticio", expiresIn: 3_600, expiresAt: Date.now() + 3_600_000,
    user: { id: "user-e2e", nome: "Usuário E2E", email: "e2e@example.test" },
    organization: { id: "org-e2e", nome: "Organização E2E" }, role: "Owner",
  })));
});

test("reabre proposta pendente e aprova sem um segundo autosave", async ({ page, request }) => {
  const state = await persistentReview(page, request);
  await generateProposal(page);
  await page.screenshot({ path: "test-results/assistant-persistent-review.png", fullPage: true });
  expect((await (await request.get(pieceUrl)).json()).versao).toBe(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Aprovar todas", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Aprovar todas", exact: true }).click();
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho jurídico revisado pela IA.");
  await expect(page.getByText("Revisão concluída.", { exact: true })).toBeVisible();
  expect(state.applications()).toBe(1);
  expect(state.browserPatches()).toBe(0);
  expect((await (await request.get(pieceUrl)).json()).versao).toBe(2);
  await page.reload();
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho jurídico revisado pela IA.");
});

test("recupera recibo após perda de resposta sem pedir nova aprovação", async ({ page, request }) => {
  const state = await persistentReview(page, request, true);
  await generateProposal(page);
  await page.getByRole("button", { name: "Aprovar todas", exact: true }).click();
  await expect(page.getByRole("button", { name: "Renomear peça", exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Status da peça", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Verificar resultado", exact: true }).click();
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho jurídico revisado pela IA.");
  await expect(page.getByText("Revisão concluída.", { exact: true })).toBeVisible();
  expect(state.applications()).toBe(1);
  expect(state.browserPatches()).toBe(0);
});

test("rejeita sem modificar a peça", async ({ page, request }) => {
  await persistentReview(page, request);
  await generateProposal(page);
  await page.getByRole("button", { name: "Rejeitar todas", exact: true }).click();
  await expect(page.getByText("Revisão concluída.", { exact: true })).toBeVisible();
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho original.");
  expect((await (await request.get(pieceUrl)).json()).versao).toBe(1);
});

test("desfazer após aprovação salva a reversão sobre a versão confirmada", async ({ page, request }) => {
  const state = await persistentReview(page, request);
  await generateProposal(page);
  await page.getByRole("button", { name: "Aprovar todas", exact: true }).click();
  await expect(page.getByText("Revisão concluída.", { exact: true })).toBeVisible();
  await page.locator(".ProseMirror").click();
  const saved = page.waitForResponse((response) => response.url() === pieceUrl && response.request().method() === "PATCH");
  await page.keyboard.press("Control+z");
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho original.");
  expect((await saved).status()).toBe(200);
  expect(state.applications()).toBe(1);
  expect(state.browserPatches()).toBe(1);
  expect((await (await request.get(pieceUrl)).json()).versao).toBe(3);
  await page.reload();
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho original.");
});
