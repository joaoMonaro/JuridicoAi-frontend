import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.JURIDICOAI_E2E_API_PORT ?? 5299);
const caseId = "11111111-1111-1111-1111-111111111111";
const pecaId = "22222222-2222-2222-2222-222222222222";
const secondPecaId = "22222222-2222-2222-2222-222222222223";
let pecas = initialPecas();
let scenario = initialScenario();
let conversations = new Map();
let proposals = new Map();
let receipts = new Map();
let sentMessages = [];
let applications = 0;

const server = createServer(async (request, response) => {
  setCorsHeaders(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (request.method === "GET" && url.pathname === "/__e2e/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }
  if (request.method === "POST" && url.pathname === "/__e2e/reset") {
    pecas = initialPecas();
    scenario = initialScenario();
    conversations = new Map(); proposals = new Map(); receipts = new Map(); sentMessages = []; applications = 0;
    sendJson(response, 200, { reset: true });
    return;
  }
  if (request.method === "POST" && url.pathname === "/__e2e/scenario") {
    scenario = { ...scenario, ...await readJson(request) };
    sendJson(response, 200, scenario);
    return;
  }
  if (request.method === "GET" && url.pathname === "/__e2e/state") {
    sendJson(response, 200, { sentMessages, applications }); return;
  }
  if (request.method === "GET" && url.pathname === "/api/templates-peca") {
    sendJson(response, 200, []); return;
  }
  const openConversation = url.pathname.match(/^\/api\/assistente\/v2\/pecas\/([0-9a-f-]+)\/conversa$/u);
  if (request.method === "POST" && openConversation && pecas.has(openConversation[1])) {
    let conversation = [...conversations.values()].find(item => item.pecaId === openConversation[1]);
    if (!conversation) { conversation = { id: randomUUID(), pecaId: openConversation[1], messages: [] }; conversations.set(conversation.id, conversation); }
    sendJson(response, 200, { id: conversation.id, pecaId: conversation.pecaId }); return;
  }
  const chatRoute = url.pathname.match(/^\/api\/assistente\/v2\/conversas\/([0-9a-f-]+)\/(mensagens|interacoes|propostas|anexos)$/u);
  if (chatRoute && conversations.has(chatRoute[1])) {
    const conversation = conversations.get(chatRoute[1]);
    if (request.method === "GET" && chatRoute[2] === "mensagens") {
      const before = Number(url.searchParams.get("antes") ?? Number.MAX_SAFE_INTEGER);
      const limit = Number(url.searchParams.get("limite") ?? 50);
      sendJson(response, 200, conversation.messages.filter(item => item.sequencia < before).slice(-limit)); return;
    }
    if (request.method === "GET" && chatRoute[2] === "propostas") {
      sendJson(response, 200, [...proposals.values()].filter(item => item.conversaId === conversation.id).reverse()); return;
    }
    if (request.method === "GET" && chatRoute[2] === "anexos") { sendJson(response, 200, []); return; }
    if (request.method === "POST" && chatRoute[2] === "interacoes") {
      const caps = assistantCapabilities(scenario.capabilities);
      if (!caps.habilitado || !caps.suportaConversaLivre || (scenario.reply === "edit" && !caps.features.includes("AI_EDIT"))) {
        sendJson(response, 403, { code: "AI_FEATURE_NOT_ENABLED", detail: "Esta operação de IA não está habilitada para a organização." }); return;
      }
      if (scenario.transparency !== "acknowledged") {
        sendJson(response, 428, { code: "AI_TRANSPARENCY_ACK_REQUIRED", detail: "Leia e confirme o aviso de uso da inteligência artificial antes de continuar." }); return;
      }
      const input = await readJson(request); sentMessages.push(input);
      const piece = structuredClone(pecas.get(conversation.pecaId));
      if (input.versaoPecaEsperada !== piece.versao) { sendJson(response, 409, { code: "AI_DOCUMENT_STALE", detail: "A Peça mudou." }); return; }
      if (scenario.assistant === "error") { sendJson(response, 503, { code: "AI_UNAVAILABLE", detail: "O provedor de IA está temporariamente indisponível." }); return; }
      // Responses are explicit fixtures. This fake does not infer model intent from prompts.
      await sendFreeSuggestion(response, conversation, piece, input, scenario.reply === "edit", scenario.assistant === "slow"); return;
    }
  }
  const proposalRoute = url.pathname.match(/^\/api\/assistente\/v2\/propostas\/([0-9a-f-]+)(?:\/(aplicacoes|rejeicoes))?$/u);
  if (proposalRoute && proposals.has(proposalRoute[1])) {
    const proposal = proposals.get(proposalRoute[1]);
    const piece = pecas.get(proposal.pecaId);
    if (request.method === "GET") {
      sendJson(response, 200, { ...proposal, estado: piece.versao !== proposal.versaoPecaAplicavel ? "Desatualizada" : proposal.estado }); return;
    }
    if (request.method === "POST" && proposalRoute[2] === "aplicacoes") {
      const input = await readJson(request);
      if (receipts.has(input.requestId)) { sendJson(response, 200, receipts.get(input.requestId)); return; }
      if (input.versaoPecaEsperada !== piece.versao || proposal.versaoPecaAplicavel !== piece.versao) { sendJson(response, 409, { code: "AI_DOCUMENT_STALE", detail: "A Peça mudou." }); return; }
      const selected = proposal.grupos.filter(group => input.grupos.some(item => item.id === group.id) && group.estado === "Pendente");
      if (!selected.length) { sendJson(response, 409, { code: "AI_PROPOSAL_REVISION_CONFLICT", detail: "Proposta já resolvida." }); return; }
      const document = structuredClone(piece.conteudoJson);
      for (const operation of selected.flatMap(group => group.operacoes).sort((a, b) => b.startIndex - a.startIndex)) document.content.splice(operation.startIndex, operation.deleteCount, ...operation.novosBlocos);
      const previousVersion = piece.versao;
      piece.conteudoJson = document; piece.versao++; piece.dataAtualizacao = new Date().toISOString();
      selected.forEach(group => { group.estado = "Aplicado"; }); proposal.versaoDecisoes++; proposal.versaoPecaAplicavel = piece.versao; proposal.estado = "Resolvida"; proposal.documentoBase = document; applications++;
      const receipt = { requestId: input.requestId, propostaId: proposal.id, versaoAnterior: previousVersion, versaoResultante: piece.versao, versaoPecaAtual: piece.versao, resultadoAindaAtual: true,
        gruposAplicados: selected.map(group => group.id), conteudoJson: document, dataAtualizacao: piece.dataAtualizacao, propostaRestante: proposal };
      receipts.set(input.requestId, receipt); sendJson(response, 200, receipt); return;
    }
    if (request.method === "POST" && proposalRoute[2] === "rejeicoes") {
      proposal.grupos.forEach(group => { group.estado = "Rejeitado"; }); proposal.estado = "Resolvida"; proposal.versaoDecisoes++; sendJson(response, 200, proposal); return;
    }
  }
  const receiptRoute = url.pathname.match(/^\/api\/assistente\/v2\/conversas\/[0-9a-f-]+\/aplicacoes\/([0-9a-f-]+)$/u);
  if (request.method === "GET" && receiptRoute && receipts.has(receiptRoute[1])) { sendJson(response, 200, receipts.get(receiptRoute[1])); return; }
  const rejectionRoute = url.pathname.match(/^\/api\/assistente\/v2\/conversas\/([0-9a-f-]+)\/mensagens\/([0-9a-f-]+)\/rejeicao$/u);
  if (request.method === "POST" && rejectionRoute && conversations.has(rejectionRoute[1])) {
    const item = conversations.get(rejectionRoute[1]).messages.find(message => message.respostaAId === rejectionRoute[2]);
    if (item) item.estado = "Rejeitada"; response.writeHead(204); response.end(); return;
  }
  if (request.method === "GET" && url.pathname === `/api/casos/${caseId}`) {
    sendJson(response, 200, {
      id: caseId,
      titulo: "Caso E2E",
      descricao: "Caso fictício para teste automatizado.",
      status: "Ativo",
      dataCriacao: "2026-09-30T00:00:00Z",
      dataAtualizacao: "2026-09-30T00:00:00Z",
    });
    return;
  }
  if (request.method === "GET" && url.pathname === `/api/casos/${caseId}/pecas`) {
    sendJson(response, 200, [...pecas.values()].map(toSummary));
    return;
  }
  const pecaRoute = url.pathname.match(/^\/api\/pecas\/([0-9a-f-]+)$/u);
  if (request.method === "GET" && pecaRoute) {
    const peca = pecas.get(pecaRoute[1]);
    if (!peca) {
      sendJson(response, 404, { detail: "Peça não encontrada." });
      return;
    }
    sendJson(response, 200, peca);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/assistente/capacidades") {
    if (scenario.capabilities === "error") {
      sendJson(response, 503, { code: "AI_UNAVAILABLE", detail: "O assistente está temporariamente indisponível." });
      return;
    }
    sendJson(response, 200, assistantCapabilities(scenario.capabilities));
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/assistente/transparencia") {
    sendJson(response, 200, transparencyNotice(scenario.transparency === "acknowledged"));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/assistente/transparencia/confirmacoes") {
    const input = await readJson(request);
    if (input?.versao !== "ai-transparency-v1") {
      sendJson(response, 409, {
        code: "AI_TRANSPARENCY_NOTICE_OUTDATED",
        detail: "O aviso de uso da IA foi atualizado.",
      });
      return;
    }
    scenario.transparency = "acknowledged";
    sendJson(response, 200, transparencyNotice(true));
    return;
  }
  if (request.method === "GET" && url.pathname === `/api/casos/${caseId}/contextos`) {
    sendJson(response, 200, []);
    return;
  }
  const assistantRoute = url.pathname.match(/^\/api\/pecas\/([0-9a-f-]+)\/assistente\/solicitacoes$/u);
  if (request.method === "POST" && assistantRoute && pecas.has(assistantRoute[1])) {
    const capabilities = assistantCapabilities(scenario.capabilities);
    if (!capabilities.habilitado) {
      sendJson(response, 403, {
        code: "AI_FEATURE_NOT_ENABLED",
        detail: "O assistente de IA não está habilitado para esta organização.",
      });
      return;
    }
    if (scenario.transparency !== "acknowledged") {
      sendJson(response, 428, {
        code: "AI_TRANSPARENCY_ACK_REQUIRED",
        detail: "Leia e confirme o aviso de uso da inteligência artificial antes de continuar.",
      });
      return;
    }
    const input = await readJson(request);
    if (!capabilities.modos.includes(input?.modo)) {
      sendJson(response, 403, {
        code: "AI_FEATURE_NOT_ENABLED",
        detail: "Esta operação de IA não está habilitada para a organização.",
      });
      return;
    }
    if (scenario.assistant === "error") {
      sendJson(response, 503, { code: "AI_UNAVAILABLE", detail: "O provedor de IA está temporariamente indisponível." });
      return;
    }
    await sendFragmentedSuggestion(response, input, scenario.assistant === "slow");
    return;
  }
  if (request.method === "PATCH" && pecaRoute) {
    const currentPeca = pecas.get(pecaRoute[1]);
    if (!currentPeca) {
      sendJson(response, 404, { detail: "Peça não encontrada." });
      return;
    }
    const patch = await readJson(request);
    if (scenario.autosave === "error") {
      sendJson(response, 500, { detail: "Falha simulada ao salvar a Peça." });
      return;
    }
    if (scenario.autosave === "conflict" || patch.versao !== currentPeca.versao) {
      sendJson(response, 409, { detail: "Conflito de versão." });
      return;
    }
    const updatedPeca = {
      ...currentPeca,
      ...patch,
      id: currentPeca.id,
      casoId: currentPeca.casoId,
      versao: currentPeca.versao + 1,
      dataAtualizacao: new Date().toISOString(),
    };
    pecas.set(updatedPeca.id, updatedPeca);
    sendJson(response, 200, {
      id: updatedPeca.id,
      versao: updatedPeca.versao,
      dataAtualizacao: updatedPeca.dataAtualizacao,
    });
    return;
  }

  sendJson(response, 404, { detail: `Rota fake não configurada: ${request.method} ${url.pathname}` });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Fake API E2E em http://127.0.0.1:${port}\n`);
});

async function sendFreeSuggestion(response, conversation, piece, input, editing, slow) {
  const userId = randomUUID(); const answerId = randomUUID(); const sequence = conversation.messages.length + 1;
  const user = { id: userId, sequencia: sequence, autor: "Usuario", texto: input.texto, clientRequestId: input.clientRequestId, criadaEm: new Date().toISOString(), estado: "Concluida",
    solicitacao: { clientRequestId: input.clientRequestId, modo: "Perguntar", instrucao: input.texto, versaoPeca: input.versaoPecaEsperada, operacaoPreferida: "ResponderNoPainel", interacaoAutomatica: true,
      contexto: { documento: { escopo: "Nenhum", texto: null, selecao: null, cursor: null, revisaoEditor: 0 }, contextoAdicional: null, incluirDadosCaso: false, contextoCasoIds: [] } } };
  const answer = { id: answerId, sequencia: sequence + 1, autor: "Assistente", texto: "", respostaAId: userId, criadaEm: new Date().toISOString(), estado: "Gerando" };
  conversation.messages.push(user, answer);
  const proposal = editing ? { id: randomUUID(), conversaId: conversation.id, pecaId: piece.id, snapshotId: randomUUID(), revisao: 1, versaoDecisoes: 1, versaoPecaAplicavel: piece.versao, estado: "Pendente", documentoBase: piece.conteudoJson,
    grupos: [{ id: randomUUID(), estado: "Pendente", explicacao: "Alteração solicitada na conversa", previewSha256: "f".repeat(64), operacoes: [{ tipo: "SpliceBlocos", startIndex: 0, deleteCount: 1, novosBlocos: [{ type: "paragraph", content: [{ type: "text", text: "Trecho jurídico revisado pela IA." }] }] }] }] } : null;
  const completed = { sugestao: { id: randomUUID(), mensagemUsuarioId: userId, modo: "Perguntar", operacaoSugerida: editing ? "ProporAlteracoes" : "ResponderNoPainel", titulo: editing ? "Trecho revisado" : "Resposta da IA",
    texto: editing ? "Preparei a alteração solicitada para revisão." : "A peça apresenta uma fundamentação inicial que deve ser revisada pelo profissional responsável.", resumo: "", alertas: [], achados: [], ancora: { from: null, to: null, posicao: null, revisaoEditor: 0, textoOriginal: null } },
    proposta: proposal, uso: { entradaTokens: 120, saidaTokens: 30 }, modelo: "fixture-e2e" };
  response.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-store", Connection: "keep-alive" });
  await writeFragmented(response, event("solicitacao.iniciada", { solicitacaoId: answerId, clientRequestId: input.clientRequestId }, `${answerId}:1`));
  if (slow) await delay(1500);
  if (response.destroyed) { answer.estado = "Cancelada"; return; }
  if (proposal) {
    const previous = proposals.get(input.propostaReferenciadaId);
    if (previous) { previous.estado = "Substituida"; previous.substituidaPorId = proposal.id; }
    proposals.set(proposal.id, proposal); user.propostaId = proposal.id; answer.propostaId = proposal.id;
  }
  answer.estado = "Concluida"; answer.texto = completed.sugestao.texto; answer.resultado = completed;
  await writeFragmented(response, event("solicitacao.concluida", completed, `${answerId}:2`)); response.end();
}

async function sendFragmentedSuggestion(response, input, slow) {
  const selection = input?.contexto?.documento?.selecao;
  const cursor = input?.contexto?.documento?.cursor;
  const revision = input?.contexto?.documento?.revisaoEditor ?? 0;
  const operation = input?.operacaoPreferida ?? "ResponderNoPainel";
  const isAnswer = operation === "ResponderNoPainel";
  const suggestedText = isAnswer
    ? "A peça apresenta uma fundamentação inicial que deve ser revisada pelo profissional responsável."
    : "Trecho jurídico revisado pela IA.";
  const started = {
    solicitacaoId: "33333333-3333-3333-3333-333333333333",
    clientRequestId: input?.clientRequestId,
    correlationId: "44444444-4444-4444-4444-444444444444",
  };
  const completed = {
    sugestao: {
      id: "55555555-5555-5555-5555-555555555555",
      modo: input?.modo ?? "Perguntar",
      operacaoSugerida: operation,
      titulo: isAnswer ? "Resposta da IA" : "Trecho revisado",
      texto: suggestedText,
      resumo: isAnswer
        ? "Análise limitada ao contexto fornecido."
        : "Reescrita técnica preservando os fatos fornecidos.",
      alertas: [],
      achados: [],
      ancora: {
        from: operation === "SubstituirSelecao" || operation === "InserirAposSelecao" ? selection?.from ?? null : null,
        to: operation === "SubstituirSelecao" || operation === "InserirAposSelecao" ? selection?.to ?? null : null,
        posicao: operation === "InserirNoCursor" || operation === "CriarSecao" ? cursor?.posicao ?? null : null,
        revisaoEditor: revision,
        textoOriginal: operation === "SubstituirSelecao" ? selection?.textoOriginal ?? null : null,
      },
    },
    uso: { entradaTokens: 120, saidaTokens: 30 },
    modelo: "fake-e2e",
  };
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-store",
    Connection: "keep-alive",
  });

  await writeFragmented(response, event("solicitacao.iniciada", started, `${started.solicitacaoId}:1`));
  if (slow) await delay(1_500);
  await writeFragmented(response, [
    event("conteudo.delta", { delta: suggestedText }, `${started.solicitacaoId}:2`),
    event("solicitacao.concluida", completed, `${started.solicitacaoId}:3`),
  ].join(""));
  response.end();
}

async function writeFragmented(response, payload) {
  const bytes = Buffer.from(payload, "utf8");
  for (let offset = 0; offset < bytes.length && !response.destroyed; offset += 11) {
    response.write(bytes.subarray(offset, Math.min(offset + 11, bytes.length)));
    await delay(5);
  }
}

function event(name, data, id) {
  return `id: ${id}\r\nevent: ${name}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
}

function initialPecas() {
  return new Map([
    [pecaId, initialPeca(pecaId, "Petição inicial E2E", "Trecho original.")],
    [secondPecaId, initialPeca(secondPecaId, "Contestação E2E", "Conteúdo da segunda peça.")],
  ]);
}

function initialPeca(id, titulo, texto) {
  return {
    id,
    casoId: caseId,
    titulo,
    status: "Rascunho",
    versao: 1,
    templateId: null,
    conteudoJson: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: texto }] }],
    },
    pageConfig: { format: "A4", marginTop: 25, marginBottom: 20, marginLeft: 30, marginRight: 20 },
    headerJson: null,
    footerJson: null,
    styles: { fontFamily: "Times New Roman", fontSize: 12, lineHeight: 1.5, textAlign: "justify" },
    dataCriacao: "2026-09-30T00:00:00Z",
    dataAtualizacao: "2026-09-30T00:00:00Z",
  };
}

function initialScenario() {
  return {
    assistant: "success",
    reply: "answer",
    autosave: "success",
    capabilities: "all",
    transparency: "acknowledged",
  };
}

function assistantCapabilities(profile) {
  const modes = profile === "disabled" ? []
    : profile === "chat" ? ["Perguntar"]
      : profile === "edit" ? ["Perguntar", "Redigir", "Reescrever"]
        : profile === "review" ? ["Perguntar", "Revisar"]
          : ["Perguntar", "Redigir", "Reescrever", "Revisar"];
  const features = profile === "disabled" ? []
    : profile === "chat" ? ["AI_ASSISTANT"]
      : profile === "edit" ? ["AI_ASSISTANT", "AI_EDIT"]
        : profile === "review" ? ["AI_ASSISTANT", "AI_REVIEW"]
          : ["AI_ASSISTANT", "AI_EDIT", "AI_REVIEW"];
  return {
    habilitado: profile !== "disabled",
    features,
    modos: modes,
    limites: {
      instrucaoCaracteres: 4_000,
      contextoDocumentoCaracteres: 60_000,
      contextoAdicionalCaracteres: 8_000,
    },
    suportaStreaming: true,
    suportaHistorico: true,
    suportaRevisaoPersistida: profile !== "chat",
    suportaConversaLivre: profile !== "legacy",
    suportaGeracaoDuravel: false,
  };
}

function transparencyNotice(confirmed) {
  return {
    versao: "ai-transparency-v1",
    confirmado: confirmed,
    confirmadoEm: confirmed ? "2026-10-01T03:30:00Z" : null,
    titulo: "Uso de inteligência artificial",
    mensagem: "Algumas informações do caso poderão ser processadas por provedores de inteligência artificial para gerar, revisar ou analisar conteúdo jurídico.",
    avisoDeRevisao: "As respostas geradas por inteligência artificial podem conter erros e devem ser revisadas pelo profissional responsável.",
    politicaDePrivacidadeUrl: null,
  };
}

function toSummary(document) {
  return {
    id: document.id,
    titulo: document.titulo,
    status: document.status,
    versao: document.versao,
    templateId: document.templateId,
    dataAtualizacao: document.dataAtualizacao,
  };
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", `http://127.0.0.1:${process.env.JURIDICOAI_E2E_FRONTEND_PORT ?? 4173}`);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, X-Correlation-ID");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
}

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
