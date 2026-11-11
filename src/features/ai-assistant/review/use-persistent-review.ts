import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantSuggestion } from "@/features/ai-assistant/types";
import type { usePecaAutosave } from "@/features/pecas/hooks/use-peca-autosave";
import { ApiError } from "@/lib/api-client";
import { acceptServerReviewCommit, acceptServerReviewRejection, clearReview, getReviewSession, invalidateReview, loadReviewProposal, lockReview, scrollReviewGroup } from "./extension";
import { prepareLegacyProposal } from "./legacy-proposal";
import { approveStoredGroups, getReviewReceipt, getReviewProposal, listReviewProposals, openReviewConversation, registerReviewProposal, rejectStoredGroups } from "./persistent-api";
import type { ApprovalCommand, ReviewReceipt, StoredProposal } from "./persistent-api";

interface Options {
  editor: Editor | null; enabled: boolean; pecaId: string; editorRevision: number;
  autosave: ReturnType<typeof usePecaAutosave>;
}
interface PendingCommit { proposal: StoredProposal; command: ApprovalCommand }

export function usePersistentReview(options: Options) {
  const context = useRef(options);
  useEffect(() => { context.current = options; });
  const [proposal, setProposal] = useState<StoredProposal | null>(null);
  const [saved, setSaved] = useState<StoredProposal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const proposalRef = useRef<StoredProposal | null>(null);
  const conversation = useRef<string | null>(null);
  const working = useRef(false);
  const pending = useRef<PendingCommit | null>(null);
  const registration = useRef<{ signature: string; requestId: string } | null>(null);
  const alive = useRef(true);

  const update = useCallback((value: StoredProposal) => {
    proposalRef.current = value;
    setProposal(value);
    setSaved((items) => [value, ...items.filter((item) => item.id !== value.id)]);
  }, []);
  const show = useCallback((value: StoredProposal) => {
    const editor = context.current.editor;
    if (!editor || editor.isDestroyed || working.current) return;
    if (!["Pendente", "ParcialmenteResolvida"].includes(value.estado)) {
      update(value); invalidateReview(editor);
      setError(value.estado === "Desatualizada" ? "A Peça mudou. Peça ao assistente para atualizar esta proposta." :
        value.estado === "Substituida" ? "Esta proposta foi substituída por uma revisão posterior." : "Esta proposta já foi resolvida.");
      return;
    }
    const result = loadReviewProposal(editor, {
      id: value.id, baseDocument: value.documentoBase,
      groups: value.grupos.filter((group) => group.estado === "Pendente").map((group) => ({
        id: group.id, explanation: group.explicacao, operations: group.operacoes.map((op) => ({
          startIndex: op.startIndex, deleteCount: op.deleteCount, newBlocks: op.novosBlocos,
        })),
      })),
    });
    if (!result.ok) { setError(result.message); return; }
    update(value);
    setError("");
    // Wait for the review toolbar and pagination layout before framing the source.
    requestAnimationFrame(() => {
      if (alive.current && !editor.isDestroyed && getReviewSession(editor)?.proposalId === value.id) {
        const first = value.grupos.find((group) => group.estado === "Pendente");
        if (first) scrollReviewGroup(editor, first.id, "instant");
      }
    });
  }, [update]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    // Rollback removes the preview, without deleting the saved proposal or
    // abandoning an application whose outcome still needs reconciliation.
    const editor = options.editor;
    if (!options.enabled && !working.current && editor && !editor.isDestroyed && getReviewSession(editor)) clearReview(editor);
  }, [options.enabled, options.editor, busy, uncertain]);
  useEffect(() => {
    if (!options.enabled || !options.editor) return;
    const controller = new AbortController();
    openReviewConversation(options.pecaId, controller.signal).then(async (result) => {
      const items = await listReviewProposals(result.id, controller.signal);
      if (controller.signal.aborted) return;
      conversation.current = result.id;
      setSaved(items);
      const latest = items.find((p) => ["Pendente", "ParcialmenteResolvida"].includes(p.estado));
      if (latest) show(latest);
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível recuperar as propostas.");
    });
    return () => controller.abort();
  }, [options.enabled, options.editor, options.pecaId, show]);

  function release() {
    const { editor, autosave } = context.current;
    autosave.endExternalCommit();
    if (editor && !editor.isDestroyed) lockReview(editor, false);
    working.current = false;
    if (alive.current) setBusy(false);
  }
  function adopt(receipt: ReviewReceipt) {
    const { editor, autosave } = context.current;
    if (!editor || editor.isDestroyed || !alive.current) return;
    if (!receipt.resultadoAindaAtual) throw new Error("A Peça já avançou de versão. Recarregue para conferir o resultado salvo.");
    const expected = editor.schema.nodeFromJSON(receipt.conteudoJson);
    if (!editor.state.doc.eq(expected) && !acceptServerReviewCommit(editor, receipt.gruposAplicados, receipt.conteudoJson, receipt.requestId))
      throw new Error("O resultado foi salvo, mas o editor precisa ser recarregado para sincronizar.");
    autosave.adoptExternalCommit(receipt.versaoResultante, receipt.dataAtualizacao, editor.getJSON());
    update(receipt.propostaRestante);
    pending.current = null;
    setUncertain(false);
    setError("");
    release();
  }

  async function approve(ids: string[]) {
    const value = proposalRef.current;
    const { editor, autosave } = context.current;
    if (!value || !editor || working.current) return;
    working.current = true; setBusy(true); setError("");
    let submitted = false;
    try {
      autosave.beginExternalCommit();
      lockReview(editor, true);
      const version = await autosave.ensurePersisted();
      if (version !== value.versaoPecaAplicavel) throw new Error("A versão mudou. Gere uma nova proposta.");
      const command: ApprovalCommand = { requestId: crypto.randomUUID(), revisaoProposta: value.revisao,
        versaoDecisoes: value.versaoDecisoes, versaoPecaEsperada: version,
        grupos: ids.map((id) => ({ id, previewSha256: value.grupos.find((g) => g.id === id)!.previewSha256 })),
      };
      pending.current = { proposal: value, command };
      submitted = true;
      adopt(await approveStoredGroups(value.id, command));
    } catch (failure) {
      if (!alive.current) return;
      const unknown = submitted && (!(failure instanceof ApiError) || failure.status === 0 || failure.status >= 500);
      if (unknown) {
        setUncertain(true); setBusy(false);
        setError("Não foi possível confirmar a aplicação. Verifique o resultado antes de continuar.");
      } else {
        pending.current = null;
        if (editor && !editor.isDestroyed && failure instanceof ApiError && failure.status === 409) invalidateReview(editor);
        setError(failure instanceof Error ? failure.message : "Não foi possível aplicar.");
        release();
      }
    }
  }

  async function retry() {
    const value = pending.current;
    if (!value || busy) return;
    setBusy(true);
    try {
      let receipt: ReviewReceipt;
      try { receipt = await getReviewReceipt(value.proposal.conversaId, value.command.requestId); }
      catch (failure) {
        if (!(failure instanceof ApiError) || failure.status !== 404) throw failure;
        receipt = await approveStoredGroups(value.proposal.id, value.command);
      }
      adopt(receipt);
    } catch (failure) {
      if (alive.current) { setBusy(false); setError(failure instanceof Error ? failure.message : "O resultado ainda não pôde ser confirmado."); }
    }
  }

  async function reject(ids: string[]) {
    const value = proposalRef.current;
    const editor = context.current.editor;
    if (!value || !editor || working.current) return;
    working.current = true; setBusy(true); lockReview(editor, true);
    try {
      const result = await rejectStoredGroups(value, ids);
      if (!alive.current || editor.isDestroyed) return;
      acceptServerReviewRejection(editor, ids);
      update(result); setError("");
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : "Não foi possível rejeitar.");
    } finally { release(); }
  }

  async function prepare(suggestion: AssistantSuggestion, text: string, instruction: string) {
    const { editor, autosave, pecaId, editorRevision } = context.current;
    if (!editor || working.current) throw new Error("Aguarde a operação atual.");
    working.current = true; setBusy(true);
    try {
      const documentBefore = editor.state.doc;
      const version = await autosave.ensurePersisted();
      if (!documentBefore.eq(editor.state.doc)) throw new Error("O documento mudou. Gere uma nova sugestão.");
      const grupos = prepareLegacyProposal(editor, suggestion, text, context.current.editorRevision ?? editorRevision);
      const ownConversation = conversation.current ?? (await openReviewConversation(pecaId)).id;
      conversation.current = ownConversation;
      const body = { versaoPecaEsperada: version, instrucao: instruction, textoResposta: text, grupos,
        ...(suggestion.mensagemUsuarioId ? { mensagemUsuarioId: suggestion.mensagemUsuarioId } : {}) };
      const signature = JSON.stringify(body);
      if (registration.current?.signature !== signature) registration.current = { signature, requestId: crypto.randomUUID() };
      const result = await registerReviewProposal(ownConversation, { clientRequestId: registration.current.requestId, ...body });
      if (!alive.current || editor.isDestroyed) return;
      working.current = false;
      show(result);
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function open(id: string) {
    if (working.current) throw new Error("Aguarde a conclusão da operação atual.");
    const value = await getReviewProposal(id);
    show(value);
    return value;
  }
  return { proposal, saved, busy, uncertain, error, show, open, prepare, approve, reject, retry };
}
