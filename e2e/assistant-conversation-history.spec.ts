import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { StoredMessage } from "../src/features/ai-assistant/conversation-history";
import type { AssistantCompletedEvent, AssistantRequest } from "../src/features/ai-assistant/types";

const caseId = "11111111-1111-1111-1111-111111111111";
const pieceId = "22222222-2222-2222-2222-222222222222";
const conversationId = "66666666-6666-4666-8666-666666666666";
const base = "http://127.0.0.1:5299";

async function historyApi(page: Page, request: APIRequestContext, seed: StoredMessage[] = []) {
  const messages = [...seed];
  const sent: AssistantRequest[] = [];
  let historyError = false;
  let failNextMessage = false;
  await page.route("**/api/templates-peca", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/assistente/capacidades", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), suportaHistorico: true, suportaRevisaoPersistida: true } });
  });
  await page.route("**/api/assistente/v2/**", async (route) => {
    const req = route.request(); const url = new URL(req.url());
    if (url.pathname.endsWith("/conversa")) return route.fulfill({ json: { id: conversationId } });
    if (url.pathname.endsWith("/propostas")) return route.fulfill({ json: [] });
    if (url.pathname.endsWith("/rejeicao")) {
      const id = url.pathname.split("/").at(-2);
      const response = messages.find((message) => message.respostaAId === id);
      if (response) response.estado = "Rejeitada";
      return route.fulfill({ status: 204 });
    }
    if (url.pathname.endsWith("/mensagens") && req.method() === "GET") {
      if (historyError) return route.fulfill({ status: 503, json: { detail: "Histórico temporariamente indisponível." } });
      const before = Number(url.searchParams.get("antes") ?? Number.MAX_SAFE_INTEGER);
      const limit = Number(url.searchParams.get("limite"));
      return route.fulfill({ json: messages.filter((m) => m.sequencia < before).slice(-limit) });
    }
    if (url.pathname.endsWith("/mensagens") && req.method() === "POST") {
      const input = req.postDataJSON() as AssistantRequest; sent.push(input);
      const userId = `user-${messages.length}`;
      if (failNextMessage) {
        failNextMessage = false;
        const sequence = messages.length + 1;
        messages.push({ id: userId, sequencia: sequence, autor: "Usuario", texto: input.instrucao, propostaId: null,
          criadaEm: "2026-11-11T14:00:00Z", clientRequestId: input.clientRequestId, solicitacao: input, estado: "Concluida" },
        { id: `answer-${sequence}`, sequencia: sequence + 1, autor: "Assistente", texto: "", propostaId: null,
          criadaEm: "2026-11-11T14:00:00Z", respostaAId: userId, estado: "Falhou", codigoErro: "AI_UNAVAILABLE" });
        return route.fulfill({ status: 503, json: { detail: "Falha sintética do provedor." } });
      }
      const response = await request.post(`${base}/api/pecas/${pieceId}/assistente/solicitacoes`, { data: input });
      const events = await response.text();
      const match = /event: solicitacao.concluida\r?\ndata: ([^\r\n]+)/u.exec(events);
      expect(match).not.toBeNull();
      const result = JSON.parse(match![1]) as AssistantCompletedEvent;
      result.sugestao.mensagemUsuarioId = userId;
      const sequence = messages.length + 1;
      messages.push({ id: userId, sequencia: sequence, autor: "Usuario", texto: input.instrucao, propostaId: null,
        criadaEm: "2026-11-11T14:00:00Z", clientRequestId: input.clientRequestId, solicitacao: input, estado: "Concluida" },
      { id: `answer-${sequence}`, sequencia: sequence + 1, autor: "Assistente", texto: result.sugestao.texto,
        propostaId: null, criadaEm: "2026-11-11T14:00:00Z", respostaAId: userId, estado: "Concluida", resultado: result });
      const streamId = `stream-${sequence}`;
      return route.fulfill({ contentType: "text/event-stream", body:
        `id: ${streamId}:1\nevent: solicitacao.iniciada\ndata: ${JSON.stringify({ solicitacaoId: streamId, clientRequestId: input.clientRequestId })}\n\n` +
        `id: ${streamId}:2\nevent: solicitacao.concluida\ndata: ${JSON.stringify(result)}\n\n` });
    }
    return route.fulfill({ status: 404, json: { detail: "Rota de histórico não configurada." } });
  });
  return { messages, sent, fail: (value: boolean) => { historyError = value; }, failNext: () => { failNextMessage = true; } };
}

async function openChat(page: Page) {
  await page.goto(`/casos/${caseId}`);
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(page.getByText("Conversa individual salva.", { exact: false })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "O que você quer que a IA faça?" })).toBeEnabled();
}
const composer = (page: Page) => page.getByRole("textbox", { name: "O que você quer que a IA faça?" });

test.beforeEach(async ({ page, request }) => {
  await request.post(`${base}/__e2e/reset`);
  await page.addInitScript(() => window.sessionStorage.setItem("juridicoai.auth-session", JSON.stringify({
    accessToken: "token-e2e-ficticio", expiresIn: 3600, expiresAt: Date.now() + 3600000,
    user: { id: "user-e2e", nome: "Usuário E2E", email: "e2e@example.test" },
    organization: { id: "org-e2e", nome: "Organização E2E" }, role: "Owner",
  })));
});

test("perguntas e correções permanecem após reload sem disparar outra geração", async ({ page, request }) => {
  const state = await historyApi(page, request);
  await openChat(page);
  await composer(page).fill("A contratante se chama Ana e o valor é R$ 500.");
  await page.getByRole("button", { name: "Enviar para IA" }).click();
  await expect(page.getByRole("heading", { name: "Resposta da IA" })).toHaveCount(1);
  await expect(composer(page)).toBeEnabled();
  await composer(page).fill("Corrigindo: o nome correto é Beatriz.");
  await page.getByRole("button", { name: "Enviar para IA" }).click();
  await expect(page.getByRole("heading", { name: "Resposta da IA" })).toHaveCount(2);
  await page.reload();
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(page.getByText("A contratante se chama Ana e o valor é R$ 500.", { exact: true })).toBeVisible();
  await expect(page.getByText("Corrigindo: o nome correto é Beatriz.", { exact: true })).toBeVisible();
  expect(state.sent).toHaveLength(2);
  expect(state.messages).toHaveLength(4);
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho original.");
});

test("sincroniza a peça antes de enviar uma mensagem persistida", async ({ page, request }) => {
  const state = await historyApi(page, request);
  await page.goto(`/casos/${caseId}`);
  const editor = page.locator(".ProseMirror");
  await editor.click(); await page.keyboard.press("End"); await page.keyboard.type(" Alteração manual.");
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(composer(page)).toBeEnabled();
  await composer(page).fill("Analise a versão que acabei de editar.");
  await page.getByRole("button", { name: "Enviar para IA" }).click();
  await expect(page.getByRole("heading", { name: "Resposta da IA" })).toBeVisible();
  expect(state.sent[0].versaoPeca).toBe(2);
  const saved = await (await request.get(`${base}/api/pecas/${pieceId}`)).json();
  expect(saved.conteudoJson.content[0].content[0].text).toContain("Alteração manual.");
});

test("carrega mensagens antigas e bloqueia aplicação de âncora recuperada", async ({ page, request }) => {
  const seed: StoredMessage[] = [];
  for (let index = 0; index < 28; index++) {
    seed.push({ id: `u${index}`, sequencia: index * 2 + 1, autor: "Usuario", texto: `Fato anterior ${index}`,
      propostaId: null, criadaEm: "2026-11-11T14:00:00Z", clientRequestId: `r${index}` },
    { id: `a${index}`, sequencia: index * 2 + 2, autor: "Assistente", texto: `Rascunho ${index}`,
      propostaId: null, criadaEm: "2026-11-11T14:00:00Z", respostaAId: `u${index}`, estado: "Concluida", resultado: {
        sugestao: { id: `s${index}`, modo: "Redigir", operacaoSugerida: "InserirNoCursor", titulo: `Resposta anterior ${index}`,
          texto: `Rascunho ${index}`, resumo: "", alertas: [], achados: [], ancora: { from: null, to: null, posicao: 1, revisaoEditor: 0, textoOriginal: null } },
        uso: { entradaTokens: 1, saidaTokens: 1 }, modelo: "fake",
      } });
  }
  await historyApi(page, request, seed);
  await openChat(page);
  await page.getByRole("button", { name: "Carregar mensagens anteriores" }).click();
  await expect(page.getByText("Fato anterior 0", { exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Revisar no documento" }).first()).toBeDisabled();
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho original.");
});

test("falha ao recuperar histórico bloqueia envio até a recuperação", async ({ page, request }) => {
  const state = await historyApi(page, request); state.fail(true);
  await page.goto(`/casos/${caseId}`);
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(page.getByText("Histórico temporariamente indisponível.")).toBeVisible();
  await expect(composer(page)).toBeDisabled();
  state.fail(false);
  await page.getByRole("button", { name: "Recuperar conversa" }).click();
  await expect(composer(page)).toBeEnabled();
  expect(state.sent).toHaveLength(0);
});

test("rejeição de resposta é recuperada ao reabrir a conversa", async ({ page, request }) => {
  const state = await historyApi(page, request);
  await openChat(page);
  await composer(page).fill("Analise o fato que informei.");
  await page.getByRole("button", { name: "Enviar para IA" }).click();
  await page.getByRole("button", { name: "Rejeitar", exact: true }).click();
  await expect(page.getByText("Sugestão rejeitada. A Peça não foi alterada.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(page.getByText("Sugestão rejeitada. A Peça não foi alterada.", { exact: true })).toBeVisible();
  expect(state.messages).toHaveLength(2);
  expect(state.sent).toHaveLength(1);
});

test("pedido que falhou permanece no histórico e pode ser reenviado explicitamente", async ({ page, request }) => {
  const state = await historyApi(page, request); state.failNext();
  await openChat(page);
  await composer(page).fill("Preserve este relato após a falha.");
  await page.getByRole("button", { name: "Enviar para IA" }).click();
  await expect(page.getByText("Falha sintética do provedor.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(page.getByText("Preserve este relato após a falha.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reenviar pedido" }).click();
  await expect(page.getByRole("heading", { name: "Resposta da IA" })).toBeVisible();
  expect(state.sent).toHaveLength(2);
  expect(state.sent[0].clientRequestId).not.toBe(state.sent[1].clientRequestId);
});
