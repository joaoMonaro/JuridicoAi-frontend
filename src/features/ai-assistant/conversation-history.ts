import type { AssistantCompletedEvent, AssistantDocumentCoverage, AssistantHistoryContext, AssistantMode, AssistantRequest, DocumentContextScope } from "./types";

export type ConversationTurnStatus = "sending" | "streaming" | "analyzing" | "completed" | "applied" | "rejected" | "reviewing" | "cancelled" | "error";
export interface SelectionSnapshot { from: number; to: number; text: string; editorRevision: number }
export interface RequestDraft {
  mode: AssistantMode; scope: DocumentContextScope; selectionSnapshot: SelectionSnapshot | null;
  instruction: string; additionalContext: string; includeCaseData: boolean; selectedContextIds: string[];
}
export interface ConversationTurn extends RequestDraft {
  id: string; status: ConversationTurnStatus; streamedText: string;
  completed: AssistantCompletedEvent | null; editableText: string; error: string;
  historical?: boolean; proposalId?: string | null;
  automaticContext?: boolean;
  automaticIntent?: boolean;
  analysisId?: string | null;
  coverage?: AssistantDocumentCoverage | null;
  historyContext?: AssistantHistoryContext | null;
}
export interface StoredMessage {
  id: string; sequencia: number; autor: string; texto: string; propostaId: string | null; criadaEm: string;
  clientRequestId?: string | null; respostaAId?: string | null; estado?: string; codigoErro?: string | null;
  solicitacao?: AssistantRequest | null; resultado?: AssistantCompletedEvent | null;
  analiseDocumentalId?: string | null;
  coberturaDocumental?: AssistantDocumentCoverage | null;
  contextoHistorico?: AssistantHistoryContext | null;
}

export function historyTurns(messages: StoredMessage[]): ConversationTurn[] {
  const ordered = [...messages].sort((a, b) => a.sequencia - b.sequencia);
  return ordered.filter((message) => message.autor === "Usuario").map((user) => {
    const response = ordered.find((message) => message.respostaAId === user.id) ??
      (user.propostaId ? ordered.find((message) => message.autor === "Assistente" && message.propostaId === user.propostaId) : undefined);
    const request = user.solicitacao;
    const selection = request?.contexto.documento.selecao;
    const result = response?.resultado ?? null;
    const state = response?.estado ?? "Concluida";
    const status = state === "AguardandoAnalise" ? "analyzing" : state === "Gerando" ? "streaming" : state === "Cancelada" ? "cancelled" :
      ["Falhou", "Interrompida"].includes(state) ? "error" : state === "Rejeitada" ? "rejected" : user.propostaId && result ? "reviewing" : "completed";
    return {
      id: user.clientRequestId ?? user.id, historical: true, proposalId: user.propostaId,
      automaticContext: Boolean(request),
      automaticIntent: request?.interacaoAutomatica === true,
      historyContext: result?.contextoHistorico ?? response?.contextoHistorico,
      analysisId: response?.analiseDocumentalId,
      coverage: result?.coberturaDocumental ?? response?.coberturaDocumental,
      mode: request?.modo ?? "Perguntar", scope: request?.contexto.documento.escopo ?? "Nenhum",
      selectionSnapshot: selection ? { from: selection.from, to: selection.to, text: selection.textoOriginal,
        editorRevision: request!.contexto.documento.revisaoEditor } : null,
      instruction: user.texto, additionalContext: request?.contexto.contextoAdicional ?? "",
      includeCaseData: request?.contexto.incluirDadosCaso ?? false, selectedContextIds: request?.contexto.contextoCasoIds ?? [],
      status, completed: result, streamedText: response?.texto ?? "", editableText: result?.sugestao.texto ?? response?.texto ?? "",
      error: state === "Cancelada" ? "Pedido cancelado. A mensagem foi preservada." : state === "Interrompida" ? "Pedido interrompido antes de concluir. A mensagem foi preservada." :
        state === "Falhou" ? response?.analiseDocumentalId && response.texto ? response.texto : "Não foi possível concluir este pedido. A mensagem foi preservada." : "",
    };
  });
}

export function mergeHistory(messages: StoredMessage[], live: ConversationTurn[]): ConversationTurn[] {
  const saved = historyTurns(messages);
  const map = new Map(saved.map((turn) => [turn.id, turn]));
  for (const turn of live) {
    const persisted = map.get(turn.id);
    if (persisted && turn.analysisId) { map.set(turn.id, persisted); continue; }
    // A durable completion wins over a transport error or a cancelled local stream.
    if (persisted?.status === "rejected" || persisted?.completed && ["error", "cancelled"].includes(turn.status)) continue;
    map.set(turn.id, { ...turn, coverage: turn.coverage ?? persisted?.coverage, historyContext: turn.historyContext ?? persisted?.historyContext });
  }
  return [...map.values()];
}
