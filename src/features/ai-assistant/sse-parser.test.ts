import { describe, expect, it, vi } from "vitest";

import { consumeAssistantEventStream, SseParser } from "@/features/ai-assistant/sse-parser";
import type { AssistantCompletedEvent, AssistantStreamHandlers } from "@/features/ai-assistant/types";
import { ApiError } from "@/lib/api-client";

const encoder = new TextEncoder();

const completedEvent: AssistantCompletedEvent = {
  sugestao: {
    id: "sugestao-1",
    modo: "Perguntar",
    operacaoSugerida: "ResponderNoPainel",
    titulo: "Resposta",
    texto: "Conteúdo",
    resumo: "Resumo",
    alertas: [],
    achados: [],
    ancora: {
      from: null,
      to: null,
      posicao: null,
      revisaoEditor: 1,
      textoOriginal: null,
    },
  },
  uso: {
    entradaTokens: 10,
    saidaTokens: 5,
  },
  modelo: "modelo-teste",
};

describe("SseParser", () => {
  it("remonta CRLF, UTF-8 e múltiplas linhas data divididos entre bytes", () => {
    const parser = new SseParser();
    const source = "event: conteudo.delta\r\ndata: {\r\ndata: \"delta\":\"ação\"\r\ndata: }\r\n\r\n";
    const events = Array.from(encoder.encode(source)).flatMap((byte) => parser.push(Uint8Array.of(byte)));
    events.push(...parser.finish());

    expect(events).toEqual([{
      event: "conteudo.delta",
      data: "{\n\"delta\":\"ação\"\n}",
      id: null,
    }]);
  });

  it("aceita LF, vários eventos no mesmo chunk e preserva a ordem", () => {
    const parser = new SseParser();
    const events = parser.push(encoder.encode(
      "event: primeiro\ndata: 1\n\nevent: segundo\nid: evt-2\ndata: 2\n\n",
    ));

    expect(events).toEqual([
      { event: "primeiro", data: "1", id: null },
      { event: "segundo", data: "2", id: "evt-2" },
    ]);
  });
});

describe("consumeAssistantEventStream", () => {
  it("encerra a conexão de forma válida quando o servidor assume a análise durável", async () => {
    const progress = { id: "analysis-1", estado: "NaFila", lotesConcluidos: 0, trechosAnalisados: 0,
      trechosElegiveis: 5, trechosExcluidos: 1, codigoErro: null,
      fontes: [{ id: "doc", nome: "contrato.txt", origem: "AnexoPrivado", estado: "Parcial", trechosConsultados: 0, trechosAnalisados: 0, trechosElegiveis: 5, trechosExcluidos: 1 }] };
    const waiting = vi.fn(); const done = vi.fn();
    await consumeAssistantEventStream(streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("solicitacao.aguardando", progress, 2)), { onWaiting: waiting, onCompleted: done }, 200);
    expect(waiting).toHaveBeenCalledWith(progress); expect(done).not.toHaveBeenCalled();
  });
  it("recusa cobertura de análise maior que a quantidade de trechos elegíveis", async () => {
    const progress = { id: "analysis-1", estado: "Lendo", lotesConcluidos: 1, trechosAnalisados: 6,
      trechosElegiveis: 5, trechosExcluidos: 0, codigoErro: null, fontes: [] };
    await expect(consumeAssistantEventStream(streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("solicitacao.aguardando", progress, 2)), { onCompleted: vi.fn() }, 200)).rejects.toMatchObject({ code: "AI_STREAM_INVALID" });
  });
  it("processa resumo e consulta do histórico como progresso, mantendo conclusão obrigatória", async () => {
    const context = { versaoMemoria: 2, ateSequencia: 80, mensagensRecentes: 16, registrosInvalidados: 1, historicoAdicionalDisponivel: true };
    const progress = vi.fn(); const done = vi.fn();
    await consumeAssistantEventStream(streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("contexto.historico", context, 2) + sse("solicitacao.concluida", { ...completedEvent, contextoHistorico: context }, 3)),
      { onHistoryContext: progress, onCompleted: done }, 200);
    expect(progress).toHaveBeenCalledWith(context); expect(done).toHaveBeenCalledOnce();
    await expect(consumeAssistantEventStream(streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) + sse("contexto.historico", context, 2)),
      { onCompleted: vi.fn() }, 200)).rejects.toMatchObject({ code: "AI_STREAM_INCOMPLETE" });
  });
  it.each([-1, 1.5, "2"])("recusa versão de memória inválida: %s", async version => {
    const context = { versaoMemoria: version, ateSequencia: 80, mensagensRecentes: 16, registrosInvalidados: 0, historicoAdicionalDisponivel: false };
    await expect(consumeAssistantEventStream(streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) + sse("contexto.historico", context, 2)),
      { onCompleted: vi.fn() }, 200)).rejects.toMatchObject({ code: "AI_STREAM_INVALID" });
  });
  it("processa cobertura documental como progresso antes da conclusão", async () => {
    const progress = vi.fn(); const done = vi.fn();
    const coverage = { estado: "Parcial", escopoSolicitado: "Relevantes", limiteAtingido: false,
      fontes: [{ id: "source", nome: "contrato.txt", origem: "AnexoPrivado", trechosElegiveis: 10, trechosConsultados: 2, trechosExcluidos: 0, estado: "Concluido" }] };
    await consumeAssistantEventStream(streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("contexto.documental", coverage, 2) + sse("solicitacao.concluida", { ...completedEvent, coberturaDocumental: coverage }, 3)),
    { onDocumentCoverage: progress, onCompleted: done }, 200);
    expect(progress).toHaveBeenCalledWith(coverage); expect(done).toHaveBeenCalledOnce();
    expect(progress.mock.invocationCallOrder[0]).toBeLessThan(done.mock.invocationCallOrder[0]);
  });
  it.each([-1, 11])("recusa contagem de cobertura inválida: %s", async consulted => {
    const coverage = { estado: "Parcial", escopoSolicitado: "Relevantes", limiteAtingido: false,
      fontes: [{ id: "source", nome: "contrato.txt", origem: "AnexoPrivado", trechosElegiveis: 10, trechosConsultados: consulted, trechosExcluidos: 0, estado: "Concluido" }] };
    await expect(consumeAssistantEventStream(streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) + sse("contexto.documental", coverage, 2)),
    { onCompleted: vi.fn() }, 200)).rejects.toMatchObject({ code: "AI_STREAM_INVALID" });
  });
  it("processa início, delta e conclusão em ordem", async () => {
    const calls: string[] = [];
    const handlers: AssistantStreamHandlers = {
      onStarted: (event) => calls.push(`inicio:${event.solicitacaoId}`),
      onDelta: (delta) => calls.push(`delta:${delta}`),
      onCompleted: (event) => calls.push(`fim:${event.modelo}`),
    };
    const body = streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("conteudo.delta", { delta: "Trecho" }, 2) +
      sse("solicitacao.concluida", completedEvent, 3),
    );

    await consumeAssistantEventStream(body, handlers, 200);

    expect(calls).toEqual(["inicio:sol-1", "delta:Trecho", "fim:modelo-teste"]);
  });

  it("ignora eventos desconhecidos e o marcador DONE quando existe terminal do produto", async () => {
    const onCompleted = vi.fn();
    const body = streamOf(
      "event: futuro\ndata: isto não é JSON\n\n" +
      "data: [DONE]\n\n" +
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("solicitacao.concluida", completedEvent, 2),
    );

    await consumeAssistantEventStream(body, { onCompleted }, 200);

    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("executa o callback terminal somente uma vez", async () => {
    const onCompleted = vi.fn();
    const onDelta = vi.fn();
    const body = streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("solicitacao.concluida", completedEvent, 2) +
      sse("solicitacao.concluida", completedEvent, 2) +
      sse("conteudo.delta", { delta: "tardio" }, 3),
    );

    await consumeAssistantEventStream(body, { onCompleted, onDelta }, 200);

    expect(onCompleted).toHaveBeenCalledOnce();
    expect(onDelta).not.toHaveBeenCalled();
  });

  it("ignora delta duplicado pela sequência e preserva texto igual em sequências distintas", async () => {
    const onDelta = vi.fn();
    const body = streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("conteudo.delta", { delta: "não " }, 2) +
      sse("conteudo.delta", { delta: "não " }, 2) +
      sse("conteudo.delta", { delta: "não " }, 3) +
      sse("solicitacao.concluida", completedEvent, 4),
    );

    await consumeAssistantEventStream(body, { onDelta, onCompleted: () => undefined }, 200);

    expect(onDelta.mock.calls).toEqual([["não "], ["não "]]);
  });

  it("ignora evento antigo já superado", async () => {
    const onDelta = vi.fn();
    const body = streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("conteudo.delta", { delta: "primeiro" }, 2) +
      sse("conteudo.delta", { delta: "antigo" }, 1) +
      sse("solicitacao.concluida", completedEvent, 3),
    );

    await consumeAssistantEventStream(body, { onDelta, onCompleted: () => undefined }, 200);

    expect(onDelta).toHaveBeenCalledOnce();
    expect(onDelta).toHaveBeenCalledWith("primeiro");
  });

  it("rejeita lacuna de sequência e troca de solicitação", async () => {
    const gap = streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("conteudo.delta", { delta: "trecho" }, 3),
    );
    const mixedRequest = streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("conteudo.delta", { delta: "trecho" }, 2, "sol-2"),
    );

    await expect(consumeAssistantEventStream(gap, emptyHandlers(), 200))
      .rejects.toMatchObject({ code: "AI_STREAM_INVALID" });
    await expect(consumeAssistantEventStream(mixedRequest, emptyHandlers(), 200))
      .rejects.toMatchObject({ code: "AI_STREAM_INVALID" });
  });

  it("transforma o evento de falha em erro tipado", async () => {
    const body = streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      sse("solicitacao.falhou", {
        code: "AI_PROVIDER_TIMEOUT",
        message: "A IA demorou mais que o esperado.",
        retryable: true,
        requestId: "req-1",
      }, 2),
    );

    const error = await captureError(consumeAssistantEventStream(body, emptyHandlers(), 200));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "AI_PROVIDER_TIMEOUT",
      message: "A IA demorou mais que o esperado.",
    });
  });

  it("rejeita JSON inválido com erro de protocolo controlado", async () => {
    const body = streamOf(
      sse("solicitacao.iniciada", { solicitacaoId: "sol-1", clientRequestId: "req-1" }, 1) +
      "id: sol-1:2\nevent: conteudo.delta\ndata: {invalido}\n\n",
    );

    const error = await captureError(consumeAssistantEventStream(body, emptyHandlers(), 200));

    expect(error).toMatchObject({ code: "AI_STREAM_INVALID" });
  });

  it("rejeita evento do assistente sem identidade SSE", async () => {
    const body = streamOf(sseWithoutId("solicitacao.iniciada", {
      solicitacaoId: "sol-1",
      clientRequestId: "req-1",
    }));

    const error = await captureError(consumeAssistantEventStream(body, emptyHandlers(), 200));

    expect(error).toMatchObject({ code: "AI_STREAM_INVALID" });
  });

  it("rejeita stream encerrado antes do evento terminal", async () => {
    const body = streamOf(sse("solicitacao.iniciada", {
      solicitacaoId: "sol-1",
      clientRequestId: "req-1",
    }, 1));

    const error = await captureError(consumeAssistantEventStream(body, emptyHandlers(), 200));

    expect(error).toMatchObject({ code: "AI_STREAM_INCOMPLETE" });
  });

  it("classifica evento cortado no meio como stream incompleto", async () => {
    const body = streamOf("event: conteudo.delta\ndata: {\"delta\":\"trecho");

    const error = await captureError(consumeAssistantEventStream(body, emptyHandlers(), 200));

    expect(error).toMatchObject({ code: "AI_STREAM_INCOMPLETE" });
  });

  it("não considera DONE como conclusão do produto", async () => {
    const body = streamOf("data: [DONE]\n\n");

    const error = await captureError(consumeAssistantEventStream(body, emptyHandlers(), 200));

    expect(error).toMatchObject({ code: "AI_STREAM_INCOMPLETE" });
  });

  it("cancela a leitura sem executar atualização tardia", async () => {
    let streamCancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel: () => {
        streamCancelled = true;
      },
    });
    const controller = new AbortController();
    const onCompleted = vi.fn();
    const result = consumeAssistantEventStream(body, { onCompleted }, 200, controller.signal);

    controller.abort();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(streamCancelled).toBe(true);
    expect(onCompleted).not.toHaveBeenCalled();
  });
});

function sse(event: string, data: unknown, sequence: number, requestId = "sol-1"): string {
  return `id: ${requestId}:${sequence}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseWithoutId(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function emptyHandlers(): AssistantStreamHandlers {
  return { onCompleted: () => undefined };
}

async function captureError(promise: Promise<void>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Era esperado que o stream falhasse.");
}
