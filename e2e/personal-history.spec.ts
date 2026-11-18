import { fakeApiUrl } from "./support/urls";
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const conversation = { id: "77777777-7777-4777-8777-777777777777", titulo: "Petição histórica", criadaEm: "2026-11-01T12:00:00Z", atualizadaEm: "2026-11-12T12:00:00Z" };
const user = { id: "88888888-8888-4888-8888-888888888888", nome: "Titular do histórico", email: "titular@example.test" };
const proposalId = randomUUID(); const attachmentId = randomUUID();
const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
async function historyApi(page: Page, loseDeleteResponse = false) {
  let authenticated = false; let deleted = false; let completed = false; let deletes = 0; let logins = 0; let activeReads = 0; let regularLogouts = 0; let personalLogouts = 0; let expire = false;
  let protocol: { requestId: string; conversaId: string; estado: string; autorizadaEm: string; concluidaEm: string | null; codigoErro: null; eliminadaDasCopias: false } | null = null;
  const messages = [
    { id: randomUUID(), sequencia: 1, autor: "Usuario", texto: "A contratante é Beatriz e o valor correto é R$ 750,00.", criadaEm: conversation.criadaEm, estado: "Concluida", titulo: null, contextoFornecido: "Dados fornecidos pelo titular.", propostaId: proposalId, alertas: [] },
    { id: randomUUID(), sequencia: 2, autor: "Assistente", texto: "Preparei a minuta com o valor corrigido.", criadaEm: conversation.criadaEm, estado: "Concluida", titulo: "Minuta inicial", contextoFornecido: null, propostaId: proposalId, alertas: [{ codigo: "REVIEW", mensagem: "Confira os dados informados." }] },
  ];
  await page.route(`${fakeApiUrl}/api/**`, async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === "/api/auth/logout") { regularLogouts++; return route.fulfill({ status: 204 }); }
    if (path.startsWith("/api/auth/pessoal/")) {
      expect(request.headers().authorization ?? "").toBe("");
      if (path.endsWith("login")) { expect(request.postDataJSON()).toEqual({ email: user.email, senha: "Senha-ficticia-123!" }); logins++; authenticated = true; }
      if (path.endsWith("logout")) { personalLogouts++; authenticated = false; return route.fulfill({ status: 204 }); }
      return authenticated && !expire ? route.fulfill({ json: { accessToken: "history-token", expiresIn: 900, user } }) : route.fulfill({ status: 401, json: { detail: "Sessão pessoal expirada." } });
    }
    if (!path.startsWith("/api/assistente/v2/pessoal/")) { activeReads++; return route.fulfill({ status: 403 }); }
    expect(request.headers().authorization).toBe("Bearer history-token");
    if (expire) return route.fulfill({ status: 401, json: { detail: "Sessão pessoal expirada." } });
    if (path.endsWith("/exclusoes")) return route.fulfill({ json: protocol ? [{ ...protocol, estado: completed ? "RemovidaDoAmbienteAtivo" : protocol.estado }] : [] });
    if (path.includes("/exclusoes/")) return protocol ? route.fulfill({ json: protocol }) : route.fulfill({ status: 404 });
    if (path.endsWith("/conversas")) return route.fulfill({ json: { conversas: deleted ? [] : [conversation], proximoCursor: null } });
    if (path.endsWith(`/conversas/${conversation.id}`)) {
      if (request.method() === "DELETE") {
        const body = request.postDataJSON(); expect(body.confirmarExclusao).toBe(true); expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/u);
        deletes++; deleted = true; protocol = { requestId: body.requestId, conversaId: conversation.id, estado: "Autorizada", autorizadaEm: new Date().toISOString(), concluidaEm: null, codigoErro: null, eliminadaDasCopias: false };
        if (loseDeleteResponse) return route.abort("failed");
        return route.fulfill({ status: 202, json: protocol });
      }
      return deleted ? route.fulfill({ status: 404, json: { detail: "Histórico privado não encontrado." } }) : route.fulfill({ json: conversation });
    }
    if (path.endsWith("/mensagens")) return route.fulfill({ json: messages });
    if (path.endsWith("/anexos")) return route.fulfill({ json: [{ id: attachmentId, nome: "contrato-privado.txt", tamanhoBytes: 25, criadoEm: conversation.criadaEm }] });
    if (path.endsWith("/arquivo")) return route.fulfill({ contentType: "application/octet-stream", headers: { "Content-Disposition": "attachment; filename=contrato-privado.txt" }, body: "Anexo privado histórico." });
    if (path.endsWith(`/propostas/${proposalId}`)) return route.fulfill({ json: { id: proposalId, conversaId: conversation.id, grupos: [{ id: randomUUID(), estado: "Aplicado", explicacao: "Corrigir o valor informado", original: [paragraph("Valor original: R$ 500,00.")], proposto: [paragraph("Valor corrigido: R$ 750,00.")] }] } });
    return route.fulfill({ status: 404 });
  });
  return { regularLogouts: () => regularLogouts, personalLogouts: () => personalLogouts, deletes: () => deletes, logins: () => logins, activeReads: () => activeReads, complete: () => { completed = true; }, expire: () => { expire = true; } };
}
async function login(page: Page) {
  await page.goto("/historico-assistente");
  await page.getByRole("textbox", { name: "E-mail", exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("Senha-ficticia-123!");
  await page.getByRole("button", { name: "Entrar no histórico", exact: true }).click();
  await page.getByRole("button", { name: /Petição histórica/u }).click();
}

test("histórico pessoal sem escritório permite ler conversa, proposta e anexo sem editor", async ({ page }) => {
  const state = await historyApi(page); await login(page);
  await expect(page.getByRole("region", { name: "Conversa histórica" })).toContainText("Beatriz e o valor correto é R$ 750,00.");
  await page.getByText("Contexto fornecido", { exact: true }).click(); await expect(page.getByText("Dados fornecidos pelo titular.")).toBeVisible();
  await page.getByRole("button", { name: "Consultar proposta salva", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Valor corrigido: R$ 750,00.");
  await expect(page.getByRole("button", { name: /Aprovar/u })).toHaveCount(0);
  await page.getByRole("button", { name: "Fechar proposta", exact: true }).click();
  const downloading = page.waitForEvent("download"); await page.getByRole("button", { name: "Baixar contrato-privado.txt", exact: true }).click();
  expect((await downloading).suggestedFilename()).toBe("contrato-privado.txt");
  await expect(page.locator(".ProseMirror")).toHaveCount(0); expect(state.activeReads()).toBe(0); expect(state.deletes()).toBe(0);
  await page.reload(); await expect(page.getByText("Preparei a minuta com o valor corrigido.", { exact: true })).toBeVisible(); expect(state.logins()).toBe(1);
  await page.screenshot({ path: "test-results/personal-history-readonly.png", fullPage: true });
});

test("exclusão só é enviada com confirmação e protocolo continua após reload", async ({ page }) => {
  const state = await historyApi(page); await login(page);
  await page.getByRole("button", { name: "Excluir conversa", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Não altera a Peça"); expect(state.deletes()).toBe(0);
  await page.getByRole("button", { name: "Manter conversa", exact: true }).click();
  await expect(page.getByText("Preparei a minuta com o valor corrigido.", { exact: true })).toBeVisible(); expect(state.deletes()).toBe(0);
  await page.getByRole("button", { name: "Excluir conversa", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar exclusão", exact: true }).click();
  await expect(page.getByRole("region", { name: "Exclusões autorizadas" })).toContainText("Exclusão em andamento");
  await expect(page.getByText("Preparei a minuta com o valor corrigido.", { exact: true })).toHaveCount(0); expect(state.deletes()).toBe(1);
  await page.reload(); state.complete();
  const protocols = page.getByRole("region", { name: "Exclusões autorizadas" });
  await expect(protocols).toContainText("Removida do ambiente ativo"); await protocols.getByText("Removida do ambiente ativo", { exact: true }).click();
  await expect(protocols).toContainText("A eliminação de cópias de segurança ainda não foi confirmada."); expect(state.activeReads()).toBe(0);
});

test("perda da resposta de exclusão reconcilia pelo mesmo protocolo sem outra autorização", async ({ page }) => {
  const state = await historyApi(page, true); await login(page);
  await page.getByRole("button", { name: "Excluir conversa", exact: true }).click(); await page.getByRole("button", { name: "Confirmar exclusão", exact: true }).click();
  await expect(page.getByRole("region", { name: "Exclusões autorizadas" })).toContainText("Exclusão em andamento"); expect(state.deletes()).toBe(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("sessão pessoal revogada remove conteúdo da tela e exige novo login", async ({ page }) => {
  const state = await historyApi(page); await login(page); await expect(page.getByText("Minuta inicial", { exact: true })).toBeVisible();
  state.expire(); await page.reload();
  await expect(page.getByRole("button", { name: "Entrar no histórico", exact: true })).toBeVisible();
  await expect(page.getByText("Minuta inicial", { exact: true })).toHaveCount(0); expect(state.activeReads()).toBe(0);
});


test("sair da conta encerra também a sessão pessoal de histórico", async ({ page }) => {
  const state = await historyApi(page); await login(page);
  await page.evaluate(() => sessionStorage.setItem("juridicoai.auth-session", JSON.stringify({ accessToken: "organization-token", expiresAt: Date.now() + 60000, user: { nome: "Titular", email: "titular@example.test" }, organization: { nome: "Escritório fictício" } })));
  await page.goto("/casos"); await page.getByRole("button", { name: "Abrir menu do usuário", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sair da conta", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/u);
  expect(state.regularLogouts()).toBe(1); expect(state.personalLogouts()).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem("juridicoai.personal-history-session"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("juridicoai.auth-session"))).toBeNull();
});
