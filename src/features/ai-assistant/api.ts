import type {
  AssistantCapabilities,
  AssistantCompletedEvent,
  AssistantFailureEvent,
  AssistantRequest,
  AssistantStreamHandlers,
} from "@/features/ai-assistant/types";
import { ApiError, apiFetch, apiRequest } from "@/lib/api-client";

export const getAssistantCapabilities = (signal?: AbortSignal) =>
  apiRequest<AssistantCapabilities>("/assistente/capacidades", { signal });

export async function streamAssistantRequest(
  pecaId: string,
  request: AssistantRequest,
  handlers: AssistantStreamHandlers,
  signal: AbortSignal,
) {
  const response = await apiFetch(`/pecas/${pecaId}/assistente/solicitacoes`, {
    method: "POST",
    headers: { Accept: "text/event-stream" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.body) throw new ApiError("O servidor não iniciou o fluxo da IA.", response.status);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  const processBlock = (block: string) => {
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    const data = JSON.parse(dataLines.join("\n")) as unknown;
    if (eventName === "solicitacao.iniciada") {
      handlers.onStarted?.(data as { solicitacaoId: string; clientRequestId: string });
      return;
    }
    if (eventName === "conteudo.delta") {
      handlers.onDelta?.((data as { delta: string }).delta);
      return;
    }
    if (eventName === "solicitacao.concluida") {
      finished = true;
      handlers.onCompleted(data as AssistantCompletedEvent);
      return;
    }
    if (eventName === "solicitacao.falhou") {
      finished = true;
      const failure = data as AssistantFailureEvent;
      throw new ApiError(failure.message, response.status, failure.code);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    buffer = buffer.replaceAll("\r\n", "\n");
    let separator = buffer.indexOf("\n\n");
    while (separator >= 0) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      if (block.trim()) processBlock(block);
      separator = buffer.indexOf("\n\n");
    }
    if (done) break;
  }

  if (buffer.trim()) processBlock(buffer);
  if (!finished) throw new ApiError("A resposta da IA terminou antes da conclusão.", response.status, "AI_STREAM_INCOMPLETE");
}
