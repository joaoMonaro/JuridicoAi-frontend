import { consumeAssistantEventStream } from "@/features/ai-assistant/sse-parser";
import type {
  AssistantCapabilities,
  AssistantInteractionRequest,
  AssistantMonthlyLimit,
  AssistantStreamHandlers,
  AssistantTransparency,
} from "@/features/ai-assistant/types";
import { ApiError, apiFetch, apiRequest } from "@/lib/api-client";

export const getAssistantCapabilities = (signal?: AbortSignal) =>
  apiRequest<AssistantCapabilities>("/assistente/capacidades", { signal });

export const getAssistantMonthlyLimit = (signal?: AbortSignal) =>
  apiRequest<AssistantMonthlyLimit>("/assistente/limite-mensal", { signal });

export const getAssistantTransparency = (signal?: AbortSignal) =>
  apiRequest<AssistantTransparency>("/assistente/transparencia", { signal });

export const confirmAssistantTransparency = (version: string, signal?: AbortSignal) =>
  apiRequest<AssistantTransparency>("/assistente/transparencia/confirmacoes", {
    method: "POST",
    body: JSON.stringify({ versao: version }),
    signal,
  });

export const rejectAssistantResponse = (conversationId: string, userMessageId: string) =>
  apiRequest<void>(`/assistente/v2/conversas/${conversationId}/mensagens/${userMessageId}/rejeicao`, { method: "POST" });

export async function streamAssistantInteraction(
  conversationId: string,
  request: AssistantInteractionRequest,
  handlers: AssistantStreamHandlers,
  signal: AbortSignal,
) {
  if (!conversationId.trim()) throw new ApiError("A conversa precisa estar identificada para enviar o pedido.", 400, "AI_CONVERSATION_REQUIRED");
  const response = await apiFetch(`/assistente/v2/conversas/${encodeURIComponent(conversationId)}/interacoes`, {
    method: "POST",
    headers: { Accept: "text/event-stream" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.body) throw new ApiError("O servidor não iniciou o fluxo da IA.", response.status);
  await consumeAssistantEventStream(response.body, handlers, response.status, signal);
}
