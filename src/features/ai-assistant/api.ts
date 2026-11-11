import { consumeAssistantEventStream } from "@/features/ai-assistant/sse-parser";
import type {
  AssistantCapabilities,
  AssistantRequest,
  AssistantStreamHandlers,
  AssistantTransparency,
} from "@/features/ai-assistant/types";
import { ApiError, apiFetch, apiRequest } from "@/lib/api-client";

export const getAssistantCapabilities = (signal?: AbortSignal) =>
  apiRequest<AssistantCapabilities>("/assistente/capacidades", { signal });

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

export async function streamAssistantRequest(
  pecaId: string,
  request: AssistantRequest,
  handlers: AssistantStreamHandlers,
  signal: AbortSignal,
  conversationId?: string | null,
  free?: { propostaReferenciadaId?: string | null; anexoIds?: string[] },
) {
  const path = conversationId ? `/assistente/v2/conversas/${conversationId}/${free ? "interacoes" : "mensagens"}` : `/pecas/${pecaId}/assistente/solicitacoes`;
  const body = free ? {
    clientRequestId: request.clientRequestId, texto: request.instrucao, versaoPecaEsperada: request.versaoPeca,
    selecao: request.contexto.documento.selecao, propostaReferenciadaId: free.propostaReferenciadaId ?? null,
    contextoAdicional: request.contexto.contextoAdicional, incluirDadosCaso: request.contexto.incluirDadosCaso, contextoCasoIds: request.contexto.contextoCasoIds,
    anexoIds: free.anexoIds,
  } : request;
  const response = await apiFetch(path, {
    method: "POST",
    headers: { Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.body) throw new ApiError("O servidor não iniciou o fluxo da IA.", response.status);
  await consumeAssistantEventStream(response.body, handlers, response.status, signal);
}
