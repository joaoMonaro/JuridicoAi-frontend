import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { JSONContent } from "@tiptap/core";
import type { StoredMessage } from "../src/features/ai-assistant/conversation-history";
import type { StoredProposal, ReviewReceipt } from "../src/features/ai-assistant/review/persistent-api";
import type { AssistantCompletedEvent, AssistantRequest } from "../src/features/ai-assistant/types";

const caseId = "11111111-1111-1111-1111-111111111111";
const pieceId = "22222222-2222-2222-2222-222222222222";
const base = "http://127.0.0.1:5299";
const pieceUrl = `${base}/api/pecas/${pieceId}`;
const conversationId = "66666666-6666-4666-8666-666666666666";
interface FreeRequest { clientRequestId: string; texto: string; versaoPecaEsperada: number; propostaReferenciadaId: string | null; selecao: unknown }

// Model outputs are scripted fixtures here. Intent selection, permissions and
// transactional publication are exercised separately in the backend tests.
async function freeApi(page: Page, request: APIRequestContext, outputs: Array<string | null>, chatOnly = false) {
  const messages: StoredMessage[] = []; const proposals: StoredProposal[] = [];
  const sent: FreeRequest[] = []; let bridgeRegistrations = 0; let applications = 0;
  await page.route("**/api/templates-peca", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/assistente/capacidades", async (route) => {
    const response = await route.fetch(); const caps = await response.json();
    await route.fulfill({ json: { ...caps, suportaHistorico: true, suportaConversaLivre: true,
      suportaRevisaoPersistida: !chatOnly, modos: chatOnly ? ["Perguntar"] : caps.modos,
      features: chatOnly ? ["AI_ASSISTANT"] : [...caps.features, "AI_DOCUMENT_GENERATION"] } });
  });
  await page.route("**/api/assistente/v2/**", async (route) => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    if (path.endsWith("/conversa")) return route.fulfill({ json: { id: conversationId } });
    if (path.endsWith("/mensagens") && req.method() === "GET") return route.fulfill({ json: messages });
    if (path.endsWith("/propostas") && req.method() === "GET") return route.fulfill({ json: [...proposals].reverse() });
    if (path.endsWith("/propostas") && req.method() === "POST") { bridgeRegistrations++; return route.fulfill({ status: 500 }); }
    if (path.endsWith("/interacoes")) {
      const input = req.postDataJSON() as FreeRequest; sent.push(input);
      expect(input).not.toHaveProperty("modo"); expect(input).not.toHaveProperty("operacaoPreferida");
      const text = outputs.shift(); expect(text).not.toBeUndefined();
      const piece = await (await request.get(pieceUrl)).json();
      const userId = randomUUID(); const answerId = randomUUID(); const sequence = messages.length + 1;
      let proposal: StoredProposal | null = null;
      if (text !== null) {
        proposal = { id: randomUUID(), conversaId: conversationId, snapshotId: randomUUID(), revisao: 1,
          versaoDecisoes: 1, versaoPecaAplicavel: piece.versao, estado: "Pendente", documentoBase: piece.conteudoJson,
          grupos: [{ id: randomUUID(), estado: "Pendente", explicacao: "Alteração solicitada no chat", previewSha256: "f".repeat(64),
            operacoes: [{ tipo: "SpliceBlocos", startIndex: 0, deleteCount: 1,
              novosBlocos: [{ type: "paragraph", content: [{ type: "text", text: text! }] }] }] }] };
        if (input.propostaReferenciadaId) {
          const previous = proposals.find((p) => p.id === input.propostaReferenciadaId)!;
          previous.estado = "Substituida"; previous.substituidaPorId = proposal.id;
        }
        proposals.push(proposal);
      }
      const result: AssistantCompletedEvent = {
        sugestao: { id: randomUUID(), mensagemUsuarioId: userId, modo: "Perguntar",
          operacaoSugerida: proposal ? "ProporAlteracoes" : "ResponderNoPainel", titulo: proposal ? "Alterações preparadas" : "Explicação",
          texto: proposal ? "Preparei a alteração solicitada para revisão." : chatOnly ? "Posso explicar o conteúdo. A edição não está disponível nesta organização." : "Esta cláusula descreve a obrigação assumida.",
          resumo: "", alertas: [], achados: [], ancora: { from: null, to: null, posicao: null, revisaoEditor: 0, textoOriginal: null } },
        proposta: proposal, uso: { entradaTokens: 1, saidaTokens: 1 }, modelo: "fixture",
      };
      const storedRequest: AssistantRequest = { clientRequestId: input.clientRequestId, modo: "Perguntar", instrucao: input.texto,
        versaoPeca: input.versaoPecaEsperada, operacaoPreferida: "ResponderNoPainel", interacaoAutomatica: true,
        contexto: { documento: { escopo: "Nenhum", texto: null, tituloSecao: null, selecao: null, cursor: null, revisaoEditor: 0 }, contextoAdicional: null, incluirDadosCaso: false, contextoCasoIds: [] } };
      messages.push({ id: userId, sequencia: sequence, autor: "Usuario", texto: input.texto, propostaId: proposal?.id ?? null,
        clientRequestId: input.clientRequestId, criadaEm: new Date().toISOString(), estado: "Concluida", solicitacao: storedRequest },
      { id: answerId, sequencia: sequence + 1, autor: "Assistente", texto: result.sugestao.texto,
        propostaId: proposal?.id ?? null, respostaAId: userId, criadaEm: new Date().toISOString(), estado: "Concluida", resultado: result });
      return route.fulfill({ contentType: "text/event-stream", body:
        `id: ${answerId}:1\nevent: solicitacao.iniciada\ndata: ${JSON.stringify({ solicitacaoId: answerId, clientRequestId: input.clientRequestId })}\n\n` +
        `id: ${answerId}:2\nevent: solicitacao.concluida\ndata: ${JSON.stringify(result)}\n\n` });
    }
    const application = /\/propostas\/([^/]+)\/aplicacoes$/u.exec(path);
    if (application) {
      applications++;
      const proposal = proposals.find((p) => p.id === application[1])!;
      const input = req.postDataJSON(); const document: JSONContent = structuredClone(proposal.documentoBase);
      for (const op of proposal.grupos.flatMap((g) => g.operacoes).sort((a, b) => b.startIndex - a.startIndex))
        document.content!.splice(op.startIndex, op.deleteCount, ...op.novosBlocos);
      const response = await request.patch(pieceUrl, { data: { versao: input.versaoPecaEsperada, conteudoJson: document } });
      expect(response.ok()).toBeTruthy(); const saved = await response.json();
      proposal.estado = "Resolvida"; proposal.versaoPecaAplicavel = saved.versao; proposal.documentoBase = document;
      proposal.versaoDecisoes++; proposal.grupos.forEach((g) => { g.estado = "Aplicado"; });
      const receipt: ReviewReceipt = { requestId: input.requestId, propostaId: proposal.id, versaoAnterior: input.versaoPecaEsperada,
        versaoResultante: saved.versao, versaoPecaAtual: saved.versao, resultadoAindaAtual: true,
        gruposAplicados: proposal.grupos.map((g) => g.id), conteudoJson: document, dataAtualizacao: saved.dataAtualizacao, propostaRestante: proposal };
      return route.fulfill({ json: receipt });
    }
    const proposalGet = /\/propostas\/([^/]+)$/u.exec(path);
    if (proposalGet) return route.fulfill({ json: proposals.find((p) => p.id === proposalGet[1]) });
    return route.fulfill({ status: 404 });
  });
  return { sent, messages, proposals, bridgeRegistrations: () => bridgeRegistrations, applications: () => applications };
}
const composer = (page: Page) => page.getByRole("textbox", { name: "O que você quer que a IA faça?" });
async function open(page: Page) {
  await page.goto(`/casos/${caseId}`); await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(composer(page)).toBeEnabled();
}
async function send(page: Page, text: string) {
  await composer(page).fill(text); await page.getByRole("button", { name: "Enviar para IA" }).click();
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${base}/__e2e/reset`);
  await page.addInitScript(() => window.sessionStorage.setItem("juridicoai.auth-session", JSON.stringify({
    accessToken: "token-e2e-ficticio", expiresIn: 3600, expiresAt: Date.now() + 3600000,
    user: { id: "user-e2e", nome: "Usuário E2E", email: "e2e@example.test" }, organization: { id: "org-e2e", nome: "Organização E2E" }, role: "Owner",
  })));
});

test("pedido natural abre a comparação diretamente e só a aprovação altera a peça", async ({ page, request }) => {
  await request.patch(pieceUrl, { data: { versao: 1, conteudoJson: { type: "doc", content: [] } } });
  const state = await freeApi(page, request, ["Minuta inicial com os fatos informados."]);
  await open(page);
  await expect(page.getByRole("button", { name: "Reescrever", exact: true })).toHaveCount(0);
  await send(page, "Gere a minuta inicial com os fatos que relatei.");
  await expect(page.getByRole("button", { name: "Aprovar minuta", exact: true })).toBeEnabled();
  expect(state.bridgeRegistrations()).toBe(0);
  expect((await (await request.get(pieceUrl)).json()).versao).toBe(2);
  await expect(page.getByRole("button", { name: "Revisar no documento", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Aprovar minuta", exact: true }).click();
  await expect(page.locator(".ProseMirror")).toHaveText("Minuta inicial com os fatos informados.");
  await expect(page.getByText("Revisão desta proposta concluída.")).toBeVisible();
  expect(state.messages).toHaveLength(2); expect(state.applications()).toBe(1);
  await page.reload(); await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(page.getByRole("region", { name: "Proposta de alterações da IA" })).toBeVisible();
});

test("pedido informativo responde sem criar proposta nem exigir modo", async ({ page, request }) => {
  const state = await freeApi(page, request, [null]); await open(page);
  await send(page, "Explique essa cláusula.");
  await expect(page.getByText("Esta cláusula descreve a obrigação assumida.")).toBeVisible();
  expect(state.proposals).toHaveLength(0); expect(state.applications()).toBe(0);
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho original.");
});

test("ajusta uma proposta pelo chat sem aplicar a anterior", async ({ page, request }) => {
  const state = await freeApi(page, request, ["Texto longo da proposta inicial.", "Texto curto."]); await open(page);
  await send(page, "Melhore o primeiro parágrafo.");
  await expect(page.getByRole("button", { name: "Aprovar todas", exact: true })).toBeEnabled();
  await expect(composer(page)).toBeEnabled(); await send(page, "Encurte essa proposta.");
  await expect(page.locator(".assistant-review-preview")).toContainText("Texto curto.");
  expect(state.sent[1].propostaReferenciadaId).toBe(state.proposals[0].id);
  expect(state.proposals[0].estado).toBe("Substituida");
  await expect(page.locator(".ProseMirror").locator(":scope > p").first()).toHaveText("Trecho original.");
  await page.getByRole("button", { name: "Aprovar todas", exact: true }).click();
  await expect(page.locator(".ProseMirror")).toHaveText("Texto curto.");
  expect(state.messages).toHaveLength(4); expect(state.bridgeRegistrations()).toBe(0);
});

test("usuário apenas de chat recebe explicação sem controles de aplicação", async ({ page, request }) => {
  const state = await freeApi(page, request, [null], true); await open(page);
  await send(page, "Melhore a peça para mim.");
  await expect(page.getByText("Posso explicar o conteúdo. A edição não está disponível nesta organização.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar todas", exact: true })).toHaveCount(0);
  expect(state.proposals).toHaveLength(0);
});
