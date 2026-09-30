import { consumeAssistantEventStream } from "@/features/ai-assistant/sse-parser";
import type {
  AssistantCapabilities,
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
  await consumeAssistantEventStream(response.body, handlers, response.status, signal);
}
