import type {
  AssistantCompletedEvent,
  AssistantFailureEvent,
  AssistantStreamHandlers,
} from "@/features/ai-assistant/types";
import { ApiError } from "@/lib/api-client";

export interface SseEvent {
  event: string;
  data: string;
  id: string | null;
}

export class SseParser {
  private readonly decoder = new TextDecoder();
  private buffer = "";
  private eventLines: string[] = [];
  private ended = false;

  push(chunk: Uint8Array): SseEvent[] {
    if (this.ended) return [];
    this.buffer += this.decoder.decode(chunk, { stream: true });
    return this.drain(false);
  }

  finish(): SseEvent[] {
    if (this.ended) return [];
    this.ended = true;
    this.buffer += this.decoder.decode();
    return this.drain(true);
  }

  private drain(final: boolean): SseEvent[] {
    const events: SseEvent[] = [];

    while (true) {
      const nextLine = takeLine(this.buffer, final);
      if (!nextLine) break;
      this.buffer = this.buffer.slice(nextLine.consumed);

      if (nextLine.line === "") {
        const event = parseEvent(this.eventLines);
        this.eventLines = [];
        if (event) events.push(event);
      } else {
        this.eventLines.push(nextLine.line);
      }
    }

    return events;
  }
}

export async function consumeAssistantEventStream(
  body: ReadableStream<Uint8Array>,
  handlers: AssistantStreamHandlers,
  responseStatus: number,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const parser = new SseParser();
  let terminalReceived = false;
  let streamRequestId: string | null = null;
  let lastSequence = 0;

  const abortReader = () => {
    void reader.cancel(signal?.reason).catch(() => undefined);
  };
  signal?.addEventListener("abort", abortReader, { once: true });

  const processEvent = (event: SseEvent) => {
    if (terminalReceived || event.data.trim() === "[DONE]") return;
    if (!isAssistantEvent(event.event)) return;

    const identity = parseEventIdentity(event.id);
    if (!identity) throw invalidStream(responseStatus);
    if (streamRequestId === null) {
      if (event.event !== "solicitacao.iniciada" || identity.sequence !== 1)
        throw invalidStream(responseStatus);
      streamRequestId = identity.requestId;
    } else if (identity.requestId !== streamRequestId) {
      throw invalidStream(responseStatus);
    }
    if (identity.sequence <= lastSequence) return;
    if (identity.sequence !== lastSequence + 1) throw invalidStream(responseStatus);
    lastSequence = identity.sequence;

    const data = parseJson(event.data, responseStatus);
    if (event.event === "solicitacao.iniciada") {
      if (!isRecord(data) || typeof data.solicitacaoId !== "string" || typeof data.clientRequestId !== "string")
        throw invalidStream(responseStatus);
      handlers.onStarted?.({
        solicitacaoId: data.solicitacaoId,
        clientRequestId: data.clientRequestId,
      });
      return;
    }

    if (event.event === "conteudo.delta") {
      if (!isRecord(data) || typeof data.delta !== "string") throw invalidStream(responseStatus);
      handlers.onDelta?.(data.delta);
      return;
    }

    terminalReceived = true;
    if (event.event === "solicitacao.concluida") {
      if (!isCompletedEvent(data)) throw invalidStream(responseStatus);
      handlers.onCompleted(data);
      return;
    }

    if (!isFailureEvent(data)) throw invalidStream(responseStatus);
    throw new ApiError(data.message, responseStatus, data.code);
  };

  try {
    signal?.throwIfAborted();
    while (true) {
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      for (const event of done ? parser.finish() : parser.push(value)) processEvent(event);
      if (terminalReceived) return;
      if (done) break;
    }

    if (!terminalReceived)
      throw new ApiError(
        "A resposta da IA terminou antes da conclusão.",
        responseStatus,
        "AI_STREAM_INCOMPLETE",
      );
  } finally {
    signal?.removeEventListener("abort", abortReader);
    if (terminalReceived) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function takeLine(buffer: string, final: boolean): { line: string; consumed: number } | null {
  for (let index = 0; index < buffer.length; index += 1) {
    const character = buffer[index];
    if (character === "\n") return { line: buffer.slice(0, index), consumed: index + 1 };
    if (character !== "\r") continue;
    if (index + 1 === buffer.length && !final) return null;
    const consumesLf = buffer[index + 1] === "\n";
    return { line: buffer.slice(0, index), consumed: index + (consumesLf ? 2 : 1) };
  }

  if (final && buffer.length > 0) return { line: buffer, consumed: buffer.length };
  return null;
}

function parseEvent(lines: string[]): SseEvent | null {
  let event = "message";
  let id: string | null = null;
  let hasData = false;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value || "message";
    else if (field === "data") {
      hasData = true;
      dataLines.push(value);
    } else if (field === "id" && !value.includes("\0")) id = value;
  }

  return hasData ? { event, data: dataLines.join("\n"), id } : null;
}

function isAssistantEvent(event: string): boolean {
  return event === "solicitacao.iniciada" || event === "conteudo.delta" ||
    event === "solicitacao.concluida" || event === "solicitacao.falhou";
}

function parseEventIdentity(value: string | null): { requestId: string; sequence: number } | null {
  if (!value) return null;
  const separator = value.lastIndexOf(":");
  if (separator <= 0 || separator === value.length - 1) return null;
  const requestId = value.slice(0, separator);
  const sequence = Number(value.slice(separator + 1));
  if (!Number.isSafeInteger(sequence) || sequence <= 0) return null;
  return { requestId, sequence };
}

function parseJson(value: string, responseStatus: number): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw invalidStream(responseStatus);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCompletedEvent(value: unknown): value is AssistantCompletedEvent {
  return isRecord(value) && isRecord(value.sugestao) && isRecord(value.uso) && typeof value.modelo === "string";
}

function isFailureEvent(value: unknown): value is AssistantFailureEvent {
  return isRecord(value) && typeof value.code === "string" && typeof value.message === "string" &&
    typeof value.retryable === "boolean";
}

function invalidStream(responseStatus: number): ApiError {
  return new ApiError(
    "A resposta da IA possui um formato inválido.",
    responseStatus,
    "AI_STREAM_INVALID",
  );
}
