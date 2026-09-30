import { createServer } from "node:http";

const port = 5299;
const caseId = "11111111-1111-1111-1111-111111111111";
const pecaId = "22222222-2222-2222-2222-222222222222";
let peca = initialPeca();
let scenario = initialScenario();

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
    peca = initialPeca();
    scenario = initialScenario();
    sendJson(response, 200, { reset: true });
    return;
  }
  if (request.method === "POST" && url.pathname === "/__e2e/scenario") {
    scenario = { ...scenario, ...await readJson(request) };
    sendJson(response, 200, scenario);
    return;
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
    sendJson(response, 200, [toSummary(peca)]);
    return;
  }
  if (request.method === "GET" && url.pathname === `/api/pecas/${pecaId}`) {
    sendJson(response, 200, peca);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/assistente/capacidades") {
    sendJson(response, 200, {
      habilitado: true,
      modos: ["Perguntar", "Redigir", "Reescrever", "Revisar"],
      limites: {
        instrucaoCaracteres: 4_000,
        contextoDocumentoCaracteres: 60_000,
        contextoAdicionalCaracteres: 8_000,
      },
      suportaStreaming: true,
      suportaHistorico: false,
    });
    return;
  }
  if (request.method === "GET" && url.pathname === `/api/casos/${caseId}/contextos`) {
    sendJson(response, 200, []);
    return;
  }
  if (request.method === "POST" && url.pathname === `/api/pecas/${pecaId}/assistente/solicitacoes`) {
    const input = await readJson(request);
    if (scenario.assistant === "error") {
      sendJson(response, 503, { detail: "O provedor de IA está temporariamente indisponível." });
      return;
    }
    await sendFragmentedSuggestion(response, input, scenario.assistant === "slow");
    return;
  }
  if (request.method === "PATCH" && url.pathname === `/api/pecas/${pecaId}`) {
    const patch = await readJson(request);
    if (scenario.autosave === "error") {
      sendJson(response, 500, { detail: "Falha simulada ao salvar a Peça." });
      return;
    }
    if (scenario.autosave === "conflict" || patch.versao !== peca.versao) {
      sendJson(response, 409, { detail: "Conflito de versão." });
      return;
    }
    peca = {
      ...peca,
      ...patch,
      id: peca.id,
      casoId: peca.casoId,
      versao: peca.versao + 1,
      dataAtualizacao: new Date().toISOString(),
    };
    sendJson(response, 200, {
      id: peca.id,
      versao: peca.versao,
      dataAtualizacao: peca.dataAtualizacao,
    });
    return;
  }

  sendJson(response, 404, { detail: `Rota fake não configurada: ${request.method} ${url.pathname}` });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Fake API E2E em http://127.0.0.1:${port}\n`);
});

async function sendFragmentedSuggestion(response, input, slow) {
  const selection = input?.contexto?.documento?.selecao;
  const revision = input?.contexto?.documento?.revisaoEditor ?? 0;
  const suggestedText = "Trecho jurídico revisado pela IA.";
  const started = {
    solicitacaoId: "33333333-3333-3333-3333-333333333333",
    clientRequestId: input?.clientRequestId,
    correlationId: "44444444-4444-4444-4444-444444444444",
  };
  const completed = {
    sugestao: {
      id: "55555555-5555-5555-5555-555555555555",
      modo: "Reescrever",
      operacaoSugerida: "SubstituirSelecao",
      titulo: "Trecho revisado",
      texto: suggestedText,
      resumo: "Reescrita técnica preservando os fatos fornecidos.",
      alertas: [],
      achados: [],
      ancora: {
        from: selection?.from ?? null,
        to: selection?.to ?? null,
        posicao: null,
        revisaoEditor: revision,
        textoOriginal: selection?.textoOriginal ?? null,
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

  await writeFragmented(response, event("solicitacao.iniciada", started));
  if (slow) await delay(1_500);
  await writeFragmented(response, [
    event("conteudo.delta", { delta: suggestedText }),
    event("solicitacao.concluida", completed),
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

function event(name, data) {
  return `event: ${name}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
}

function initialPeca() {
  return {
    id: pecaId,
    casoId: caseId,
    titulo: "Petição inicial E2E",
    status: "Rascunho",
    versao: 1,
    templateId: null,
    conteudoJson: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Trecho original." }] }],
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
    autosave: "success",
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
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:4173");
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
