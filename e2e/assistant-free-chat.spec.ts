import { fakeApiUrl } from "./support/urls";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { JSONContent } from "@tiptap/core";
import type { StoredMessage } from "../src/features/ai-assistant/conversation-history";
import type { StoredProposal, ReviewReceipt } from "../src/features/ai-assistant/review/persistent-api";
import type { AssistantCompletedEvent, AssistantDocumentCoverage, AssistantHistoryContext, AssistantDocumentAnalysis, AssistantGeneration, AssistantRequest } from "../src/features/ai-assistant/types";

const caseId = "11111111-1111-1111-1111-111111111111";
const pieceId = "22222222-2222-2222-2222-222222222222";
const base = fakeApiUrl;
const pieceUrl = `${base}/api/pecas/${pieceId}`;
const conversationId = "66666666-6666-4666-8666-666666666666";
interface FreeRequest { clientRequestId: string; texto: string; versaoPecaEsperada: number; propostaReferenciadaId: string | null; selecao: unknown; anexoIds?: string[] }

// Model outputs are scripted fixtures here. Intent selection, permissions and
// transactional publication are exercised separately in the backend tests.
async function freeApi(page: Page, request: APIRequestContext, outputs: Array<string | null>, chatOnly = false, withDocuments = false, coverage?: AssistantDocumentCoverage, historyContext?: AssistantHistoryContext, withAnalysis = false, withGeneration = false) {
  const messages: StoredMessage[] = []; const proposals: StoredProposal[] = [];
  const sent: FreeRequest[] = []; let bridgeRegistrations = 0; let applications = 0; let resumes = 0;
  const analysis: AssistantDocumentAnalysis = { id: randomUUID(), estado: "NaFila", lotesConcluidos: 0, trechosAnalisados: 0,
    trechosElegiveis: 5, trechosExcluidos: 0, codigoErro: null,
    fontes: [{ id: randomUUID(), nome: "contrato-extenso.txt", origem: "AnexoPrivado", estado: "Concluido", trechosConsultados: 0, trechosElegiveis: 5, trechosExcluidos: 0, trechosAnalisados: 0 }] };
  const generation: AssistantGeneration = { id: randomUUID(), estado: "NaFila", secoesConcluidas: 0, secoesTotal: 3, secoes: ["Fatos", "Fundamentos", "Pedidos"], codigoErro: null, analiseId: null };
  let pendingResult: AssistantCompletedEvent | null = null;
  let pendingProposal: StoredProposal | null = null;
  const completeAnalysis = () => {
    analysis.estado = "Concluida"; analysis.lotesConcluidos = 2; analysis.trechosAnalisados = 5; analysis.fontes[0].trechosAnalisados = 5;
    const response = messages.find(m => withGeneration ? m.geracaoId === generation.id : m.analiseDocumentalId === analysis.id)!;
    if (withGeneration) generation.estado = "Concluida";
    response.estado = "Concluida"; response.resultado = pendingResult; response.texto = pendingResult!.sugestao.texto;
    response.propostaId = pendingProposal?.id ?? null;
    messages.find(m => m.id === response.respostaAId)!.propostaId = pendingProposal?.id ?? null;
    if (pendingProposal) proposals.push(pendingProposal);
  };
  await page.route("**/api/templates-peca", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/assistente/capacidades", async (route) => {
    const response = await route.fetch(); const caps = await response.json();
    await route.fulfill({ json: { ...caps, suportaHistorico: true, suportaConversaLivre: true, suportaGeracaoDuravel: withGeneration,
      suportaRevisaoPersistida: !chatOnly, modos: chatOnly ? ["Perguntar"] : caps.modos,
      documentos: withDocuments ? { arquivoBytes: 20 * 1024 * 1024, pdfPaginas: 100, imagemMegapixels: 25, anexosPorConversa: 50, conversaBytes: 500 * 1024 * 1024, ocrHabilitado: false } : null,
      features: chatOnly ? ["AI_ASSISTANT"] : [...caps.features, "AI_DOCUMENT_GENERATION"] } });
  });
  await page.route("**/api/assistente/v2/**", async (route) => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    if (path.includes(`/geracoes/${generation.id}`)) {
      const response = messages.find(m => m.geracaoId === generation.id);
      if (path.endsWith("/cancelamento")) { generation.estado = "Cancelada"; if (response) response.estado = "Cancelada"; return route.fulfill({ status: 204 }); }
      if (path.endsWith("/retomada")) { resumes++; generation.estado = "Redigindo"; if (response) response.estado = "AguardandoGeracao"; return route.fulfill({ status: 202 }); }
      return route.fulfill({ json: generation });
    }
    if (path.includes(`/analises/${analysis.id}`)) {
      const response = messages.find(m => m.analiseDocumentalId === analysis.id);
      if (path.endsWith("/cancelamento")) { analysis.estado = "Cancelada"; if (response) response.estado = "Cancelada"; return route.fulfill({ status: 204 }); }
      if (path.endsWith("/retomada")) { resumes++; analysis.estado = "Lendo"; if (response) response.estado = "AguardandoAnalise"; return route.fulfill({ status: 202 }); }
      return route.fulfill({ json: analysis });
    }
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
        if (!withAnalysis && !withGeneration) proposals.push(proposal);
      }
      const result: AssistantCompletedEvent = {
        sugestao: { id: randomUUID(), mensagemUsuarioId: userId, modo: "Perguntar",
          operacaoSugerida: proposal ? "ProporAlteracoes" : "ResponderNoPainel", titulo: proposal ? "Alterações preparadas" : "Explicação",
          texto: proposal ? "Preparei a alteração solicitada para revisão." : chatOnly ? "Posso explicar o conteúdo. A edição não está disponível nesta organização." : "Esta cláusula descreve a obrigação assumida.",
          resumo: "", alertas: [], achados: [], ancora: { from: null, to: null, posicao: null, revisaoEditor: 0, textoOriginal: null } },
        proposta: proposal, uso: { entradaTokens: 1, saidaTokens: 1 }, modelo: "fixture",
        coberturaDocumental: withAnalysis ? { estado: "Completa", escopoSolicitado: "Todos", limiteAtingido: false,
          fontes: analysis.fontes.map(source => ({ ...source, trechosAnalisados: source.trechosElegiveis })) } : coverage, contextoHistorico: historyContext,
      };
      const storedRequest: AssistantRequest = { clientRequestId: input.clientRequestId, modo: "Perguntar", instrucao: input.texto,
        versaoPeca: input.versaoPecaEsperada, operacaoPreferida: "ResponderNoPainel", interacaoAutomatica: true,
        contexto: { documento: { escopo: "Nenhum", texto: null, tituloSecao: null, selecao: null, cursor: null, revisaoEditor: 0 }, contextoAdicional: null, incluirDadosCaso: false, contextoCasoIds: [] } };
      messages.push({ id: userId, sequencia: sequence, autor: "Usuario", texto: input.texto, propostaId: proposal?.id ?? null,
        clientRequestId: input.clientRequestId, criadaEm: new Date().toISOString(), estado: "Concluida", solicitacao: storedRequest },
      { id: answerId, sequencia: sequence + 1, autor: "Assistente", texto: result.sugestao.texto,
        propostaId: proposal?.id ?? null, respostaAId: userId, criadaEm: new Date().toISOString(), estado: "Concluida", resultado: result });
      if (withAnalysis || withGeneration) {
        pendingResult = result; pendingProposal = proposal;
        const response = messages[messages.length - 1]; response.estado = "AguardandoAnalise";
        response.resultado = null; response.propostaId = null; response.texto = ""; if (withGeneration) { response.geracaoId = generation.id; response.estado = "AguardandoGeracao"; } else response.analiseDocumentalId = analysis.id;
        messages[messages.length - 2].propostaId = null;
        return route.fulfill({ contentType: "text/event-stream", body:
          `id: ${answerId}:1\nevent: solicitacao.iniciada\ndata: ${JSON.stringify({ solicitacaoId: answerId, clientRequestId: input.clientRequestId })}\n\n` +
          `id: ${answerId}:2\nevent: ${withGeneration ? "solicitacao.enfileirada" : "solicitacao.aguardando"}\ndata: ${JSON.stringify(withGeneration ? generation : analysis)}\n\n` });
      }
      const events = [
        ["solicitacao.iniciada", { solicitacaoId: answerId, clientRequestId: input.clientRequestId }],
        ...(coverage ? [["contexto.documental", coverage]] : []),
        ...(historyContext ? [["contexto.historico", historyContext]] : []),
        ["solicitacao.concluida", result],
      ];
      return route.fulfill({ contentType: "text/event-stream", body: events.map(([name, data], index) =>
        `id: ${answerId}:${index + 1}\nevent: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("") });
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
  return { sent, messages, proposals, analysis, generation, completeAnalysis, resumes: () => resumes, bridgeRegistrations: () => bridgeRegistrations, applications: () => applications };
}
const composer = (page: Page) => page.getByRole("textbox", { name: "O que você quer que a IA faça?" });
test("consulta seletiva mostra cobertura por arquivo e recupera após reload", async ({ page, request }) => {
  const coverage: AssistantDocumentCoverage = { estado: "Parcial", escopoSolicitado: "Relevantes", limiteAtingido: false,
    fontes: [{ id: randomUUID(), nome: "contrato-extenso.txt", origem: "DocumentoCaso", trechosElegiveis: 40, trechosConsultados: 2, trechosExcluidos: 0, estado: "Concluido" }] };
  await freeApi(page, request, [null], false, false, coverage);
  await open(page); await send(page, "Qual é o prazo previsto no contrato?");
  const panel = page.getByRole("region", { name: "Cobertura da consulta documental" });
  await expect(panel).toContainText("Consulta documental parcial · 2/40 trechos");
  await panel.getByText("Ver cobertura por arquivo", { exact: true }).click();
  await expect(panel).toContainText("contrato-extenso.txt");
  await page.reload(); await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(page.getByRole("region", { name: "Cobertura da consulta documental" })).toContainText("2/40 trechos");
});
test("leitura integral incompleta sinaliza limite e não oferece aprovação", async ({ page, request }) => {
  const coverage: AssistantDocumentCoverage = { estado: "Parcial", escopoSolicitado: "Todos", limiteAtingido: true,
    fontes: [{ id: randomUUID(), nome: "processo-extenso.txt", origem: "AnexoPrivado", trechosElegiveis: 90, trechosConsultados: 8, trechosExcluidos: 1, estado: "Parcial" }] };
  const state = await freeApi(page, request, [null], false, false, coverage);
  const before = await (await request.get(pieceUrl)).json();
  await open(page); await send(page, "Considere todos os documentos e gere a minuta.");
  const panel = page.getByRole("region", { name: "Cobertura da consulta documental" });
  await expect(panel).toContainText("Pedido de leitura de todos os documentos.");
  await expect(panel).toContainText("A consulta atingiu o limite desta etapa.");
  expect(state.proposals).toHaveLength(0); expect(state.applications()).toBe(0);
  expect((await (await request.get(pieceUrl)).json()).versao).toBe(before.versao);
});
test("anexo privado aguarda processamento e segue no pedido natural sem outra confirmação", async ({ page, request }) => {
  const state = await freeApi(page, request, [null], false, true);
  const id = randomUUID(); let uploaded = false; let ready = false;
  await page.route("**/api/assistente/v2/conversas/*/anexos", async route => {
    if (route.request().method() === "POST") {
      expect(route.request().headers()["content-type"]).toContain("multipart/form-data"); uploaded = true;
      return route.fulfill({ status: 202, json: { id } });
    }
    return route.fulfill({ json: uploaded ? [{ id, nome: "relato.txt", origem: "AnexoPrivado", formato: "txt", tamanhoBytes: 30,
      estado: ready ? "Concluido" : "Processando", paginasTotal: null, paginasConcluidas: 0,
      trechosConfiaveis: ready ? 1 : 0, trechosExcluidos: 0, codigoErro: null, problemas: [], vinculado: false }] : [] });
  });
  await open(page);
  await page.getByLabel("Arquivo para o chat").setInputFiles({ name: "relato.txt", mimeType: "text/plain", buffer: Buffer.from("Beatriz pagou o valor informado.") });
  await expect(page.getByText("Lendo documento", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar para IA" })).toBeDisabled();
  ready = true;
  await expect(page.getByText("Leitura concluída", { exact: true })).toBeVisible();
  await send(page, "Explique os fatos do documento.");
  await expect(page.getByRole("heading", { name: "Explicação", exact: true })).toBeVisible();
  expect(state.sent[0].anexoIds).toEqual([id]); expect(state.applications()).toBe(0);
});

test("leitura parcial mostra a região excluída e mantém a conversa disponível", async ({ page, request }) => {
  await freeApi(page, request, [null], false, true);
  await page.route("**/api/assistente/v2/conversas/*/anexos", route => route.fulfill({ json: [{
    id: randomUUID(), nome: "prova.pdf", origem: "DocumentoCaso", formato: "pdf", tamanhoBytes: 100,
    estado: "Parcial", paginasTotal: 2, paginasConcluidas: 2, trechosConfiaveis: 1, trechosExcluidos: 1,
    codigoErro: null, vinculado: true, problemas: [{ pagina: 2, localizador: "página 2", codigo: "OCR_NOT_CALIBRATED" }],
  }] }));
  await open(page);
  await expect(page.getByText("Leitura parcial · 2/2 páginas", { exact: true })).toBeVisible();
  await page.getByText("Problemas de leitura", { exact: true }).click();
  await expect(page.getByText("página 2: A leitura de imagens ainda não está habilitada neste ambiente.", { exact: true })).toBeVisible();
  await expect(composer(page)).toBeEnabled();
  await expect(page.getByRole("button", { name: "Anexar documento" })).toBeEnabled();
});

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


test("contexto resumido fica visível e persiste ao reabrir sem confirmação adicional", async ({ page, request }) => {
  const context: AssistantHistoryContext = { versaoMemoria: 2, ateSequencia: 80, mensagensRecentes: 16,
    registrosInvalidados: 1, historicoAdicionalDisponivel: true };
  const state = await freeApi(page, request, [null], false, false, undefined, context);
  await open(page); await send(page, "Continue considerando a correção que informei.");
  await expect(page.getByText("Esta cláusula descreve a obrigação assumida.")).toBeVisible();
  await page.getByText("Contexto da conversa", { exact: true }).click();
  await expect(page.getByText(/O histórico completo continua salvo/u)).toBeVisible();
  await expect(page.getByText(/Parte do resumo foi desconsiderada/u)).toBeVisible();
  await expect(page.getByText(/Há mensagens antigas ainda fora do resumo/u)).toBeVisible();
  expect(state.applications()).toBe(0); expect(state.proposals).toHaveLength(0);
  expect((await (await request.get(pieceUrl)).json()).versao).toBe(1);
  await page.reload(); await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await page.getByText("Contexto da conversa", { exact: true }).click();
  await expect(page.getByText(/O histórico completo continua salvo/u)).toBeVisible();
  await page.screenshot({ path: "test-results/assistant-history-memory.png", fullPage: true });
});

test("resumo automático preserva revisão visual como única aprovação de alterações", async ({ page, request }) => {
  const context: AssistantHistoryContext = { versaoMemoria: 3, ateSequencia: 100, mensagensRecentes: 8,
    registrosInvalidados: 0, historicoAdicionalDisponivel: false };
  const state = await freeApi(page, request, ["Minuta com o valor corrigido para R$ 750,00."], false, false, undefined, context);
  await open(page); await send(page, "Gere a minuta com o valor corrigido.");
  await expect(page.getByRole("button", { name: "Aprovar todas", exact: true })).toBeEnabled();
  await expect(page.locator(".ProseMirror").locator(":scope > p").first()).toHaveText("Trecho original.");
  const savedBefore = await (await request.get(pieceUrl)).json();
  expect(savedBefore.versao).toBe(1);
  expect(savedBefore.conteudoJson.content[0].content[0].text).toBe("Trecho original.");
  expect(state.applications()).toBe(0);
  await page.getByRole("button", { name: "Aprovar todas", exact: true }).click();
  await expect(page.locator(".ProseMirror")).toHaveText("Minuta com o valor corrigido para R$ 750,00.");
  expect(state.applications()).toBe(1);
});


test("análise continua ao reabrir e prepara a revisão sem outro pedido do usuário", async ({ page, request }) => {
  const state = await freeApi(page, request, ["Minuta após análise de todos os documentos."], false, false, undefined, undefined, true);
  await open(page); await send(page, "Analise todos os documentos e prepare a minuta.");
  await expect(page.getByText("Análise documental na fila", { exact: true })).toBeVisible();
  await expect(page.getByText(/Você pode fechar esta tela/u)).toBeVisible();
  expect(state.sent).toHaveLength(1); expect(state.applications()).toBe(0);
  await page.reload(); await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(page.getByText("Análise documental na fila", { exact: true })).toBeVisible();
  state.analysis.estado = "Lendo"; state.analysis.trechosAnalisados = 2; state.analysis.lotesConcluidos = 1; state.analysis.fontes[0].trechosAnalisados = 2;
  await expect(page.getByText(/2\/5 trechos analisados/u)).toBeVisible();
  await page.screenshot({ path: "test-results/assistant-durable-analysis.png", fullPage: true });
  state.completeAnalysis();
  await expect(page.getByRole("button", { name: "Aprovar todas", exact: true })).toBeEnabled();
  expect(state.sent).toHaveLength(1); expect(state.applications()).toBe(0);
  const before = await (await request.get(pieceUrl)).json(); expect(before.versao).toBe(1);
  expect(before.conteudoJson.content[0].content[0].text).toBe("Trecho original.");
  await page.getByRole("button", { name: "Aprovar todas", exact: true }).click();
  await expect(page.locator(".ProseMirror")).toHaveText("Minuta após análise de todos os documentos.");
  expect(state.applications()).toBe(1);
});

test("cancelar análise preserva o pedido e libera a conversa sem aplicar a peça", async ({ page, request }) => {
  const state = await freeApi(page, request, [null], false, false, undefined, undefined, true);
  await open(page); await send(page, "Analise todos os documentos.");
  await page.getByRole("button", { name: "Cancelar análise", exact: true }).click();
  await expect(page.getByText("Análise documental cancelada", { exact: true })).toBeVisible();
  await expect(composer(page)).toBeEnabled();
  expect(state.messages).toHaveLength(2); expect(state.applications()).toBe(0); expect(state.sent).toHaveLength(1);
});

test("retomada de análise interrompida reaproveita o pedido sem reenviar a mensagem", async ({ page, request }) => {
  const state = await freeApi(page, request, [null], false, false, undefined, undefined, true);
  await open(page); await send(page, "Analise todos os documentos.");
  await expect(page.getByText("Análise documental na fila", { exact: true })).toBeVisible();
  state.analysis.estado = "Interrompida"; state.analysis.codigoErro = "AI_ANALYSIS_CALL_UNCERTAIN";
  state.messages[1].estado = "Interrompida";
  await page.getByRole("button", { name: "Retomar análise", exact: true }).click();
  await expect(page.getByText("Analisando documentos por etapas", { exact: true })).toBeVisible();
  expect(state.resumes()).toBe(1); expect(state.sent).toHaveLength(1);
});


test("geração por seções continua ao reabrir e só a proposta final permite aprovação", async ({ page, request }) => {
  const state = await freeApi(page, request, ["Minuta completa após revisão das seções."], false, false, undefined, undefined, false, true);
  await open(page); await send(page, "Gere a minuta completa com os fatos apresentados.");
  const progress = page.getByRole("region", { name: "Progresso do pedido" });
  await expect(progress).toContainText("Pedido salvo; aguardando processamento");
  await expect(page.getByRole("button", { name: "Aprovar todas", exact: true })).toHaveCount(0);
  state.generation.estado = "Redigindo"; state.generation.secoesConcluidas = 1; state.messages[1].estado = "Gerando";
  await expect(progress).toContainText("1/3 seções redigidas");
  await progress.getByText("Ver plano da minuta", { exact: true }).click(); await expect(progress).toContainText("Fundamentos");
  await page.reload(); await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(progress).toContainText("1/3 seções redigidas");
  state.generation.estado = "Verificando"; state.generation.secoesConcluidas = 3;
  await expect(progress).toContainText("Revisando a completude e a coerência da minuta");
  expect(state.sent).toHaveLength(1); expect(state.applications()).toBe(0);
  await page.screenshot({ path: "test-results/assistant-durable-generation.png", fullPage: true });
  state.completeAnalysis();
  await expect(page.getByRole("button", { name: "Aprovar todas", exact: true })).toBeEnabled();
  expect((await (await request.get(pieceUrl)).json()).versao).toBe(1);
  await page.getByRole("button", { name: "Aprovar todas", exact: true }).click();
  await expect(page.locator(".ProseMirror")).toHaveText("Minuta completa após revisão das seções.");
  expect(state.sent).toHaveLength(1); expect(state.applications()).toBe(1);
});

test("retoma geração interrompida no mesmo pedido e cancela sem aplicar a peça", async ({ page, request }) => {
  const state = await freeApi(page, request, [null], false, false, undefined, undefined, false, true);
  await open(page); await send(page, "Gere uma minuta.");
  await expect(page.getByText("Pedido salvo; aguardando processamento", { exact: true })).toBeVisible();
  state.generation.estado = "Interrompida"; state.messages[1].estado = "Interrompida";
  await page.getByRole("button", { name: "Retomar processamento", exact: true }).click();
  await expect(page.getByText("Redigindo a minuta por seções", { exact: true })).toBeVisible();
  expect(state.sent).toHaveLength(1); expect(state.resumes()).toBe(1);
  await page.getByRole("button", { name: "Cancelar processamento", exact: true }).click();
  await expect(page.getByRole("region", { name: "Progresso do pedido" })).toContainText("Pedido cancelado");
  expect(state.applications()).toBe(0); expect(state.messages).toHaveLength(2);
  await expect(composer(page)).toBeEnabled();
});
