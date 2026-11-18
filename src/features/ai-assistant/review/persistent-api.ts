import type { JSONContent } from "@tiptap/core";
import { apiRequest } from "@/lib/api-client";

export interface StoredGroup {
  id: string;
  estado: "Pendente" | "Aplicado" | "Rejeitado";
  explicacao: string;
  previewSha256: string;
  operacoes: Array<{ tipo: "SpliceBlocos"; startIndex: number; deleteCount: number; novosBlocos: JSONContent[] }>;
}
export interface StoredProposal {
  id: string; conversaId: string; snapshotId: string;
  revisao: number; versaoDecisoes: number; versaoPecaAplicavel: number;
  estado: string; documentoBase: JSONContent; grupos: StoredGroup[];
  substituidaPorId?: string | null;
}
export interface ApprovalCommand {
  requestId: string; revisaoProposta: number; versaoDecisoes: number; versaoPecaEsperada: number;
  grupos: Array<{ id: string; previewSha256: string }>;
}
export interface ReviewReceipt {
  requestId: string; propostaId: string; versaoAnterior: number; versaoResultante: number;
  versaoPecaAtual: number; resultadoAindaAtual: boolean; gruposAplicados: string[];
  conteudoJson: JSONContent; dataAtualizacao: string; propostaRestante: StoredProposal;
}
const root = "/assistente/v2";
export const openReviewConversation = (pecaId: string, signal?: AbortSignal) =>
  apiRequest<{ id: string }>(`${root}/pecas/${pecaId}/conversa`, { method: "POST", signal });
export const listReviewProposals = (id: string, signal?: AbortSignal) =>
  apiRequest<StoredProposal[]>(`${root}/conversas/${id}/propostas`, { signal });
export const getReviewProposal = (id: string) => apiRequest<StoredProposal>(`${root}/propostas/${id}`);
export const registerReviewProposal = (id: string, body: unknown) =>
  apiRequest<StoredProposal>(`${root}/conversas/${id}/propostas`, { method: "POST", body: JSON.stringify(body) });
export const approveStoredGroups = (id: string, body: ApprovalCommand) =>
  apiRequest<ReviewReceipt>(`${root}/propostas/${id}/aplicacoes`, { method: "POST", body: JSON.stringify(body) });
export const getReviewReceipt = (conversationId: string, requestId: string) =>
  apiRequest<ReviewReceipt>(`${root}/conversas/${conversationId}/aplicacoes/${requestId}`);
export const rejectStoredGroups = (proposal: StoredProposal, grupos: string[]) =>
  apiRequest<StoredProposal>(`${root}/propostas/${proposal.id}/rejeicoes`, {
    method: "POST", body: JSON.stringify({ revisaoProposta: proposal.revisao, versaoDecisoes: proposal.versaoDecisoes, grupos }),
  });
