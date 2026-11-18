import type { Editor } from "@tiptap/react";
import { AlertTriangle, Check, CircleAlert, Copy, LoaderCircle, Maximize2, Minimize2, MoveHorizontal, RotateCcw, Send, ShieldCheck, Sparkles, Square, WandSparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmAssistantTransparency,
  getAssistantTransparency,
  streamAssistantInteraction,
  rejectAssistantResponse,
} from "@/features/ai-assistant/api";
import {
  applySuggestion,
  canApplySuggestion,
  isSuggestionAnchorValid,
} from "@/features/ai-assistant/editor";
import type {
  AssistantCapabilities,
  AssistantCompletedEvent,
  AssistantMode,
  AssistantOperation,
  AssistantInteractionRequest,
  AssistantTransparency,
  DocumentContextScope,
  AssistantSuggestion,
} from "@/features/ai-assistant/types";
import type { Peca, SaveState } from "@/features/pecas/types";
import { ApiError } from "@/lib/api-client";
import { mergeHistory } from "../conversation-history";
import type { ConversationTurn } from "../conversation-history";
import { useAssistantHistory } from "../use-assistant-history";
import type { StoredProposal } from "../review/persistent-api";
import { AutomaticProposalResult } from "./automatic-proposal-result";
import { useAssistantDocuments } from "../use-assistant-documents";
import { AssistantDocuments } from "./assistant-documents";
import { GenerationProgress } from "./generation-progress";
import { DocumentAnalysis } from "./document-analysis";
import { HistoryContext } from "./history-context";
import { DocumentCoverage } from "./document-coverage";
import { sanitizeExternalUrl } from "@/features/pecas/editor/legal-editor-extensions";

interface Props {
  open: boolean;
  capabilities: AssistantCapabilities;
  editor: Editor | null;
  peca: Peca;
  editorRevision: number;
  saveState: SaveState;
  onCapabilitiesInvalidated: () => void;
  onClose: () => void;
  onReviewSuggestion?: (suggestion: AssistantSuggestion, text: string, instruction: string) => Promise<void>;
  ensurePersisted?: () => Promise<number>;
  blocked?: boolean;
  proposalReferenceId?: string;
  currentProposal?: StoredProposal | null;
  onPreparedProposal?: (proposal: StoredProposal) => void;
  onOpenProposal?: (id: string) => Promise<StoredProposal>;
}

type RequestPhase = "completed" | "applied" | "rejected" | "reviewing" | "historical";

const modeLabels: Record<AssistantMode, string> = {
  Perguntar: "Perguntar",
  Redigir: "Redigir trecho",
  Reescrever: "Reescrever seleção",
  Revisar: "Sugerir melhorias",
};

const scopeLabels: Record<DocumentContextScope, string> = {
  Nenhum: "Somente meu pedido",
  Selecao: "Texto selecionado",
  SecaoAtual: "Seção atual",
  DocumentoCompleto: "Documento completo",
};

const operationLabels: Record<AssistantOperation, string> = {
  ResponderNoPainel: "Resposta no painel",
  InserirNoCursor: "Inserir no cursor",
  InserirAposSelecao: "Inserir após a seleção",
  SubstituirSelecao: "Substituir seleção",
  CriarSecao: "Criar seção",
  ProporAlteracoes: "Alterações propostas",
};

export function AssistantPanel({ open, capabilities, editor, peca, editorRevision, saveState, onCapabilitiesInvalidated, onClose, onReviewSuggestion, ensurePersisted,
  blocked = false, proposalReferenceId, currentProposal, onPreparedProposal, onOpenProposal }: Props) {
  const [transparency, setTransparency] = useState<AssistantTransparency | null>(null);
  const [transparencyError, setTransparencyError] = useState("");
  const [confirmingTransparency, setConfirmingTransparency] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [conversations, setConversations] = useState<Record<string, ConversationTurn[]>>({});
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [composerError, setComposerError] = useState("");
  const [wide, setWide] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const initiallyFocusedPiece = useRef<string | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const requestController = useRef<AbortController | null>(null);
  const wasOpen = useRef(open);
  const sending = useRef(false);
  const preparationCancelled = useRef(false);
  const olderScroll = useRef<{ top: number; height: number } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const history = useAssistantHistory(open && capabilities.suportaHistorico && transparency?.confirmado === true, peca.id);

  const turns = useMemo(() => capabilities.suportaHistorico ? mergeHistory(history.messages, conversations[peca.id] ?? []) : conversations[peca.id] ?? [], [conversations, peca.id, capabilities.suportaHistorico, history.messages]);
  const activeTurn = activeTurnId ? turns.find((turn) => turn.id === activeTurnId) : null;
  const pendingAnalyses = useRef(new Set<string>());
  const openedAnalyses = useRef(new Set<string>());
  useEffect(() => {
    if (!open) return;
    for (const turn of turns) {
      const jobId = turn.generationId ?? turn.analysisId;
      if (!jobId) continue;
      if (turn.status === "analyzing") pendingAnalyses.current.add(jobId);
      if (turn.completed?.proposta && pendingAnalyses.current.has(jobId) && !openedAnalyses.current.has(jobId)) {
        openedAnalyses.current.add(jobId);
        onPreparedProposal?.(turn.completed.proposta);
      }
    }
  }, [open, turns, onPreparedProposal]);
  const busy = preparing || activeTurn?.status === "sending" || activeTurn?.status === "streaming";
  const historyBlocked = capabilities.suportaHistorico && (history.loading || Boolean(history.error) || !history.conversationId || history.generating);
  const free = capabilities.suportaConversaLivre === true;
  const documents = useAssistantDocuments(open && free && Boolean(capabilities.documentos) && transparency?.confirmado === true, history.conversationId);
  const documentsBlocked = Boolean(capabilities.documentos) && (documents.loading || documents.uploading || (!capabilities.suportaGeracaoDuravel && documents.processing) || Boolean(documents.error));

  useEffect(() => {
    if (!open || !capabilities.habilitado || transparency || transparencyError) return;
    const controller = new AbortController();
    getAssistantTransparency(controller.signal)
      .then(setTransparency)
      .catch((requestError) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setTransparencyError(requestError instanceof Error ? requestError.message : "Não foi possível consultar o aviso de uso da IA.");
      });
    return () => controller.abort();
  }, [open, capabilities.habilitado, transparency, transparencyError]);

  useEffect(() => () => { preparationCancelled.current = true; requestController.current?.abort(); }, []);

  useEffect(() => {
    if (!open) { initiallyFocusedPiece.current = null; return; }
    if (!free || !capabilities.habilitado || !transparency?.confirmado || historyBlocked || documentsBlocked || blocked || busy || initiallyFocusedPiece.current === peca.id) return;
    const frame = requestAnimationFrame(() => {
      const composer = instructionRef.current;
      if (!composer || composer.disabled) return;
      composer.focus();
      initiallyFocusedPiece.current = peca.id;
    });
    return () => cancelAnimationFrame(frame);
  }, [blocked, busy, capabilities.habilitado, documentsBlocked, free, historyBlocked, open, peca.id, transparency?.confirmado]);

  useEffect(() => {
    let frame: number | undefined;
    if (wasOpen.current && !open) frame = requestAnimationFrame(() => editor?.commands.focus());
    wasOpen.current = open;
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [editor, open]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!open || !list) return;
    const frame = requestAnimationFrame(() => {
      if (olderScroll.current) {
        list.scrollTop = olderScroll.current.top + list.scrollHeight - olderScroll.current.height;
        olderScroll.current = null;
      } else list.scrollTop = list.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, turns]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (busy) { preparationCancelled.current = true; requestController.current?.abort(); }
      else onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [busy, onClose, open]);

  function updateTurn(turnId: string, update: (turn: ConversationTurn) => ConversationTurn) {
    setConversations((current) => ({
      ...current,
      [peca.id]: (current[peca.id] ?? []).map((turn) => turn.id === turnId ? update(turn) : turn),
    }));
  }

  async function submit(previousTurn?: Pick<ConversationTurn, "instruction">) {
    // Historical retries contribute only the message to the new interaction.
    const text = (previousTurn?.instruction ?? instruction).trim();
    const conversationId = history.conversationId;
    if (!free || !editor || !conversationId || !capabilities.habilitado || !capabilities.modos.includes("Perguntar") || !text || busy || sending.current || historyBlocked || documentsBlocked || blocked) return;
    setComposerError("");

    let version: number;
    {
      sending.current = true; setPreparing(true);
      preparationCancelled.current = false;
      const source = editor.state.doc;
      try {
        if (!ensurePersisted) throw new Error("Sincronização da Peça indisponível.");
        version = await ensurePersisted();
        if (preparationCancelled.current) throw new Error("Envio cancelado. O texto do pedido foi preservado.");
        if (!source.eq(editor.state.doc)) throw new Error("A Peça mudou durante a sincronização. Confira o pedido antes de enviar.");
      } catch (failure) {
        setComposerError(failure instanceof Error ? failure.message : "Não foi possível sincronizar a Peça.");
        sending.current = false; setPreparing(false); return;
      }
      setPreparing(false);
    }
    const clientRequestId = crypto.randomUUID();
    const request: AssistantInteractionRequest = {
      clientRequestId,
      texto: text,
      versaoPecaEsperada: version,
      propostaReferenciadaId: proposalReferenceId ?? null,
      anexoIds: capabilities.documentos ? documents.selected : undefined,
    };

    const turn: ConversationTurn = {
      instruction: text,
      // Presentation metadata remains compatible with historical turns.
      mode: "Perguntar", scope: "Nenhum", selectionSnapshot: null,
      additionalContext: "", includeCaseData: false, selectedContextIds: [],
      id: clientRequestId,
      automaticContext: capabilities.suportaHistorico,
      automaticIntent: free,
      status: "sending",
      streamedText: "",
      completed: null,
      editableText: "",
      error: "",
    };
    setConversations((current) => ({
      ...current,
      [peca.id]: [...(current[peca.id] ?? []), turn],
    }));
    setActiveTurnId(clientRequestId);

    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    try {
      await streamAssistantInteraction(conversationId, request, {
        onStarted: () => updateTurn(clientRequestId, (current) => ({ ...current, status: "streaming" })),
        onDelta: (delta) => updateTurn(clientRequestId, (current) => ({
          ...current,
          streamedText: current.streamedText + delta,
        })),
        onGenerationQueued: generation => {
          pendingAnalyses.current.add(generation.id);
          updateTurn(clientRequestId, current => ({ ...current, status: "analyzing", generationId: generation.id }));
          if (!previousTurn) { setInstruction(""); }
        },
        onWaiting: analysis => {
          pendingAnalyses.current.add(analysis.id);
          updateTurn(clientRequestId, current => ({ ...current, status: "analyzing", analysisId: analysis.id }));
          if (!previousTurn) { setInstruction(""); }
        },
        onHistoryContext: historyContext => updateTurn(clientRequestId, current => ({ ...current, historyContext })),
        onDocumentCoverage: coverage => updateTurn(clientRequestId, current => ({ ...current, coverage })),
        onCompleted: (event) => {
          updateTurn(clientRequestId, (current) => ({
            ...current,
            status: event.proposta ? "reviewing" : "completed",
            completed: event,
            editableText: event.sugestao.texto,
          }));
          if (event.proposta) onPreparedProposal?.(event.proposta);
          if (capabilities.documentos) void documents.refresh();
          if (!previousTurn) {
            setInstruction("");
          }
        },
      }, controller.signal);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") {
        updateTurn(clientRequestId, (current) => ({
          ...current,
          status: "cancelled",
          error: "Solicitação cancelada.",
        }));
      } else {
        if (requestError instanceof ApiError && requestError.code === "AI_TRANSPARENCY_ACK_REQUIRED") {
          setTransparency(null);
          setTransparencyError("");
        }
        if (requestError instanceof ApiError &&
          (requestError.code === "AI_FEATURE_NOT_ENABLED" || requestError.code === "AI_UNAVAILABLE")) {
          onCapabilitiesInvalidated();
        }
        updateTurn(clientRequestId, (current) => ({
          ...current,
          status: "error",
          error: requestError instanceof ApiError ? requestError.message : "Não foi possível concluir a solicitação.",
        }));
      }
    } finally {
      sending.current = false;
      if (capabilities.suportaHistorico) void history.refresh();
      if (requestController.current === controller) requestController.current = null;
      setActiveTurnId((current) => current === clientRequestId ? null : current);
      requestAnimationFrame(() => instructionRef.current?.focus());
    }
  }

  function cancel() {
    preparationCancelled.current = true;
    requestController.current?.abort();
  }

  function close() {
    preparationCancelled.current = true;
    requestController.current?.abort();
    onClose();
  }

  async function reject(turnId: string) {
    const turn = turns.find((item) => item.id === turnId);
    if (capabilities.suportaHistorico && history.conversationId && turn?.completed?.sugestao.mensagemUsuarioId) {
      try { await rejectAssistantResponse(history.conversationId, turn.completed.sugestao.mensagemUsuarioId); }
      catch (failure) {
        updateTurn(turnId, (current) => ({ ...current, error: failure instanceof Error ? failure.message : "Não foi possível registrar a rejeição." }));
        return;
      }
      void history.refresh();
    }
    updateTurn(turnId, (turn) => ({ ...turn, status: "rejected" }));
  }

  async function apply(turnId: string) {
    const turn = turns.find((item) => item.id === turnId);
    const suggestion = turn?.completed?.sugestao;
    if (!editor || !turn || !suggestion || turn.status === "applied") return;
    if (onReviewSuggestion) {
      try {
        await onReviewSuggestion(suggestion, turn.editableText, turn.instruction);
        updateTurn(turnId, (current) => ({ ...current, status: "reviewing", error: "" }));
      } catch (failure) {
        updateTurn(turnId, (current) => ({ ...current, error: failure instanceof Error ? failure.message : "Não foi possível preparar a revisão." }));
      }
      return;
    }
    if (applySuggestion(editor, suggestion, turn.editableText, editorRevision, saveState)) {
      updateTurn(turnId, (current) => ({ ...current, status: "applied" }));
    } else {
      updateTurn(turnId, (current) => ({
        ...current,
        error: "Não foi possível aplicar a sugestão no destino original.",
      }));
    }
  }

  async function openProposal(turnId: string) {
    const proposal = turns.find((turn) => turn.id === turnId)?.completed?.proposta;
    if (!proposal || !onOpenProposal) return;
    try {
      const current = await onOpenProposal(proposal.id);
      updateTurn(turnId, (turn) => ({ ...turn, completed: turn.completed ? { ...turn.completed, proposta: current } : null, error: "" }));
    } catch (failure) {
      updateTurn(turnId, (turn) => ({ ...turn, error: failure instanceof Error ? failure.message : "Não foi possível recuperar a proposta." }));
    }
  }

  async function copySuggestion(turnId: string) {
    const turn = turns.find((item) => item.id === turnId);
    try {
      await navigator.clipboard.writeText(turn?.editableText || turn?.streamedText || "");
    } catch {
      updateTurn(turnId, (current) => ({ ...current, error: "Não foi possível copiar a sugestão." }));
    }
  }

  async function confirmTransparency() {
    if (!transparency || confirmingTransparency) return;
    setConfirmingTransparency(true);
    setTransparencyError("");
    try {
      setTransparency(await confirmAssistantTransparency(transparency.versao));
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.code === "AI_TRANSPARENCY_NOTICE_OUTDATED") {
        setTransparency(null);
        setTransparencyError("");
        return;
      }
      setTransparencyError(requestError instanceof Error
        ? requestError.message
        : "Não foi possível registrar a confirmação.");
    } finally {
      setConfirmingTransparency(false);
    }
  }

  if (!open) return null;

  const transparencyPending = Boolean(capabilities.habilitado && transparency && !transparency.confirmado);

  const panelClassName = expanded
    ? "fixed inset-y-4 right-4 z-40 flex w-[min(720px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
    : `absolute inset-y-0 right-0 z-30 flex w-full max-w-[480px] shrink-0 flex-col border-l border-border bg-card shadow-xl xl:static xl:z-auto ${wide ? "xl:w-[500px]" : "xl:w-[380px]"} xl:shadow-none`;

  return <>
  <aside
    className={panelClassName}
    aria-label="Assistente de IA"
    aria-hidden={transparencyPending || undefined}
    inert={transparencyPending || undefined}
  >
    <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <span className="grid size-6 place-items-center rounded-md bg-accent text-accent-foreground"><Sparkles className="size-3.5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h2 className="text-xs font-semibold">Assistente</h2><p className="truncate text-[10px] text-muted-foreground">Converse sobre esta Peça; você decide o que aplicar</p></div>
      {!expanded ? <Button type="button" size="icon-sm" variant="ghost" onClick={() => setWide((current) => !current)} aria-label={wide ? "Reduzir largura do assistente" : "Aumentar largura do assistente"} aria-pressed={wide}><MoveHorizontal /></Button> : null}
      <Button type="button" size="icon-sm" variant="ghost" onClick={() => setExpanded((current) => !current)} aria-label={expanded ? "Restaurar assistente" : "Expandir assistente"} aria-expanded={expanded}>{expanded ? <Minimize2 /> : <Maximize2 />}</Button>
      <Button type="button" size="icon-sm" variant="ghost" onClick={close} aria-label="Fechar assistente"><X /></Button>
    </header>

    <div ref={messageListRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4" role="log" aria-label="Conversa com o assistente" aria-live="polite" aria-busy={busy}>
      {capabilities.habilitado && !transparency && !transparencyError ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" />Consultando disponibilidade...</div> : null}
      {transparencyError && !transparency ? <div><ErrorBox message={transparencyError} /><Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setTransparencyError("")}><RotateCcw />Tentar novamente</Button></div> : null}
      {capabilities.suportaHistorico && transparency?.confirmado ? <div className="mb-4 space-y-2 text-xs text-muted-foreground">
        <p>Conversa individual salva. A IA recebe o histórico disponível e a versão atual da Peça.</p>
        {history.loading ? <p role="status">Carregando conversa...</p> : null}
        {history.error ? <><ErrorBox message={history.error} /><Button size="sm" variant="outline" onClick={() => { void history.refresh(); }}>Recuperar conversa</Button></> : null}
        {history.hasOlder ? <Button size="sm" variant="outline" disabled={history.loading} onClick={() => {
          const list = messageListRef.current;
          if (list) olderScroll.current = { top: list.scrollTop, height: list.scrollHeight };
          void history.loadOlder();
        }}>Carregar mensagens anteriores</Button> : null}
      </div> : null}

      {capabilities.habilitado && transparency?.confirmado && turns.length === 0 ? <ConversationEmptyState /> : null}
      {capabilities.habilitado && transparency?.confirmado ? <div className="space-y-5">
        {turns.map((turn) => <ConversationTurnView
          key={turn.id}
          turn={turn}
          conversationId={history.conversationId}
          onRefreshHistory={history.refresh}
          editor={editor}
          editorRevision={editorRevision}
          saveState={saveState}
          onTextChange={(value) => updateTurn(turn.id, (current) => ({ ...current, editableText: value }))}
          onApply={() => { void apply(turn.id); }}
          reviewInDocument={Boolean(onReviewSuggestion)}
          onReject={() => { void reject(turn.id); }}
          onRetry={() => void submit(turn)}
          onCopy={() => void copySuggestion(turn.id)}
          currentProposal={currentProposal}
          onOpenProposal={() => { void openProposal(turn.id); }}
        />)}
      </div> : null}
    </div>

    {capabilities.habilitado && transparency?.confirmado && !free ? <p role="status" className="border-t p-3 text-xs text-muted-foreground">O assistente está indisponível neste ambiente. O histórico permanece disponível para consulta.</p> : null}
    {capabilities.habilitado && transparency?.confirmado && free ? <footer className="shrink-0 border-t bg-card p-3">
      {capabilities.documentos && free ? <AssistantDocuments documents={documents} limits={capabilities.documentos} disabled={busy || blocked || historyBlocked} /> : null}
      {composerError ? <div className="mb-2"><ErrorBox message={composerError} /></div> : null}
      <label className="sr-only" htmlFor="assistant-composer">O que você quer que a IA faça?</label>
      <div className="rounded-lg border border-input bg-popover shadow-2xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
        <Textarea
          id="assistant-composer"
          ref={instructionRef}
          className="min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          value={instruction}
          disabled={busy || historyBlocked || documentsBlocked || blocked}
          maxLength={capabilities.limites.instrucaoCaracteres}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Pergunte ou peça uma alteração..."
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <span className="text-[10px] text-muted-foreground">Peça salva e conversa</span>
          {busy ? <Button type="button" size="icon-sm" variant="outline" onClick={cancel} aria-label="Cancelar"><Square className="size-3 fill-current" /></Button> : <Button type="button" size="icon-sm" disabled={!editor || !instruction.trim() || historyBlocked || documentsBlocked || blocked} onClick={() => void submit()} aria-label="Enviar para IA"><Send /></Button>}
        </div>
      </div>
    </footer> : null}
  </aside>
  {transparencyPending && transparency ? <AssistantTransparencyDialog
    notice={transparency}
    confirming={confirmingTransparency}
    error={transparencyError}
    onConfirm={() => void confirmTransparency()}
    onClose={close}
  /> : null}
  </>;
}

function ConversationEmptyState() {
  return <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-12 text-center">
    <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></span>
    <h3 className="mt-3 text-sm font-semibold">Converse sobre esta Peça</h3>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">Faça uma pergunta ou peça uma alteração. Nada será aplicado ao documento sem sua confirmação.</p>
  </div>;
}

interface ConversationTurnProps {
  conversationId: string | null;
  onRefreshHistory: () => Promise<void>;
  turn: ConversationTurn;
  editor: Editor | null;
  editorRevision: number;
  saveState: SaveState;
  reviewInDocument: boolean;
  onTextChange: (value: string) => void;
  onApply: () => void;
  onReject: () => void;
  onRetry: () => void;
  onCopy: () => void;
  currentProposal?: StoredProposal | null;
  onOpenProposal: () => void;
}

function ConversationTurnView({ turn, conversationId, onRefreshHistory, editor, editorRevision, saveState, reviewInDocument, onTextChange, onApply, onReject, onRetry, onCopy, currentProposal, onOpenProposal }: ConversationTurnProps) {
  const suggestion = turn.completed?.sugestao ?? null;
  const anchorValid = useMemo(
    () => Boolean(editor && suggestion && isSuggestionAnchorValid(editor, suggestion, editorRevision)),
    [editor, suggestion, editorRevision],
  );
  const canApply = Boolean(!turn.historical && editor && suggestion && turn.status === "completed" &&
    canApplySuggestion(editor, suggestion, turn.editableText, editorRevision, saveState));
  return <article className="space-y-3" aria-label="Troca com o assistente">
    <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-primary px-3 py-2.5 text-primary-foreground">
      <p className="whitespace-pre-wrap text-sm leading-5">{turn.instruction}</p>
      <details className="mt-1.5 text-[10px] opacity-80">
        <summary className="cursor-pointer">{turn.automaticIntent ? "Conversa" : modeLabels[turn.mode]} · {turn.scope === "Selecao" && turn.selectionSnapshot ? `Seleção · ${turn.selectionSnapshot.text.length} caracteres` : turn.scope === "Nenhum" && turn.automaticContext ? "Peça atual e conversa" : scopeLabels[turn.scope]}</summary>
        <ul className="mt-1 space-y-0.5">
          {turn.includeCaseData ? <li>Dados essenciais do Caso</li> : null}
          {turn.selectedContextIds.length ? <li>{turn.selectedContextIds.length} contextos do Caso informados neste pedido</li> : null}
          {turn.additionalContext ? <li>Informação adicional para este pedido</li> : null}
        </ul>
      </details>
    </div>

    <div className="max-w-[96%] rounded-xl rounded-bl-xs border border-border bg-popover px-3.5 py-3 shadow-2xs">
      {turn.status === "sending" || turn.status === "streaming" ? <>
        <div className="flex items-center gap-2 text-xs font-medium" aria-busy="true"><LoaderCircle className="size-4 animate-spin text-primary" />{turn.status === "sending" ? "Preparando contexto..." : "A IA está elaborando a resposta..."}</div>
        {turn.streamedText ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{turn.streamedText}</p> : null}
      </> : null}
      {turn.status === "cancelled" || turn.status === "error" ? <ErrorBox message={turn.error} /> : null}
      {turn.historical && !turn.generationId && (turn.status === "cancelled" || turn.status === "error") ? <Button size="sm" variant="outline" onClick={onRetry}>Reenviar pedido</Button> : null}
      {turn.historical && !turn.completed && turn.status === "completed" ? <p className="whitespace-pre-wrap text-sm leading-6">{turn.streamedText}</p> : null}
      {turn.error && turn.status !== "cancelled" && turn.status !== "error" ? <div className="mb-3"><ErrorBox message={turn.error} /></div> : null}
      {turn.completed && suggestion ? <>
        <p role="status" className="sr-only">Resposta da IA concluída.</p>
        {turn.completed.proposta ? <AutomaticProposalResult completed={turn.completed}
          proposal={currentProposal?.id === turn.completed.proposta.id ? currentProposal : turn.completed.proposta}
          knownCurrent={!turn.historical || currentProposal?.id === turn.completed.proposta.id} onOpen={onOpenProposal} /> : <SuggestionResult
          completed={turn.completed}
          editableText={turn.editableText}
          phase={turn.status === "rejected" ? "rejected" : turn.historical ? "historical" : turn.status === "applied" ? "applied" : turn.status === "reviewing" ? "reviewing" : "completed"}
          reviewInDocument={reviewInDocument}
          anchorValid={anchorValid}
          canApply={canApply}
          saveState={saveState}
          onTextChange={onTextChange}
          onApply={onApply}
          onReject={onReject}
          onRetry={onRetry}
          onCopy={onCopy}
        />}
      </> : null}
      {turn.generationId && conversationId ? <GenerationProgress conversationId={conversationId} generationId={turn.generationId} onTerminal={onRefreshHistory} /> : null}
      {!turn.generationId && turn.analysisId && conversationId ? <DocumentAnalysis conversationId={conversationId} analysisId={turn.analysisId} onTerminal={onRefreshHistory} /> : null}
      {turn.completed?.contextoHistorico || turn.historyContext ? <HistoryContext
        context={(turn.completed?.contextoHistorico ?? turn.historyContext)!} /> : null}
      {turn.completed?.coberturaDocumental || turn.coverage ? <DocumentCoverage
        coverage={(turn.completed?.coberturaDocumental ?? turn.coverage)!}
        running={turn.status === "sending" || turn.status === "streaming"} /> : null}
    </div>
  </article>;
}

interface TransparencyDialogProps {
  notice: AssistantTransparency;
  confirming: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}

function AssistantTransparencyDialog({
  notice,
  confirming,
  error,
  onConfirm,
  onClose,
}: TransparencyDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    confirmRef.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => dialog.removeEventListener("keydown", trapFocus);
  }, [onClose]);

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="presentation">
    <section
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-transparency-title"
      aria-describedby="assistant-transparency-description assistant-transparency-review"
      className="w-full max-w-lg rounded-lg border bg-popover shadow-2xl"
    >
      <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <h2 id="assistant-transparency-title" className="font-semibold">{notice.titulo}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Leia este aviso antes de usar o assistente.</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar aviso"><X /></Button>
      </header>
      <div className="space-y-3 px-5 py-4 text-sm leading-6">
        <p id="assistant-transparency-description">{notice.mensagem}</p>
        <p id="assistant-transparency-review" className="rounded-md border border-warning/30 bg-warning/10 p-3">
          {notice.avisoDeRevisao}
        </p>
        <p className="text-xs text-muted-foreground">
          Esta confirmação registra que o aviso foi apresentado. Ela não autoriza alterações automáticas na Peça.
        </p>
        {(() => {
          const safePrivacyUrl = sanitizeExternalUrl(notice.politicaDePrivacidadeUrl, false);
          return safePrivacyUrl ? <a
            className="inline-flex text-xs font-medium text-primary underline underline-offset-4"
            href={safePrivacyUrl}
            target="_blank"
            rel="noreferrer"
          >Consultar Política de Privacidade</a> : null;
        })()}
        {error ? <ErrorBox message={error} /> : null}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
        <Button type="button" variant="ghost" onClick={onClose} disabled={confirming}>Agora não</Button>
        <Button ref={confirmRef} type="button" onClick={onConfirm} disabled={confirming}>
          {confirming ? <><LoaderCircle className="animate-spin" />Registrando...</> : "Entendi e continuar"}
        </Button>
      </footer>
    </section>
  </div>;
}

interface ResultProps {
  completed: AssistantCompletedEvent;
  editableText: string;
  phase: RequestPhase;
  anchorValid: boolean;
  canApply: boolean;
  saveState: SaveState;
  onTextChange: (value: string) => void;
  onApply: () => void;
  onReject: () => void;
  onRetry: () => void;
  onCopy: () => void;
  reviewInDocument: boolean;
}

function SuggestionResult({ completed, editableText, phase, anchorValid, canApply, saveState, onTextChange, onApply, onReject, onRetry, onCopy, reviewInDocument }: ResultProps) {
  const { sugestao } = completed;
  const canWrite = sugestao.operacaoSugerida !== "ResponderNoPainel";
  const saveBlockingMessage = saveState === "SALVO" ? null
    : saveState === "SALVANDO" ? "Aguarde a sincronização da Peça antes de aplicar a sugestão."
      : saveState === "CONFLITO" ? "Resolva o conflito da Peça antes de aplicar a sugestão."
        : "Não foi possível salvar a Peça. Suas alterações continuam neste dispositivo, mas sugestões da IA não podem ser aplicadas até que a sincronização seja restabelecida.";
  return <section aria-label={sugestao.titulo || "Sugestão da IA"}>
    <div className="flex items-start gap-2"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/15 text-primary"><WandSparkles className="size-4" /></span><div className="min-w-0"><h3 className="text-sm font-semibold">{sugestao.titulo || "Sugestão da IA"}</h3><p className="mt-0.5 text-[10px] text-muted-foreground">{operationLabels[sugestao.operacaoSugerida]} · {completed.modelo}</p></div></div>
    {sugestao.resumo ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{sugestao.resumo}</p> : null}

    {sugestao.operacaoSugerida === "SubstituirSelecao" && sugestao.ancora.textoOriginal ? <div className="mt-3 grid gap-2"><details className="rounded-md border bg-muted/30 p-2.5"><summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ver texto original</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-5">{sugestao.ancora.textoOriginal}</p></details><div className="rounded-md border border-success/25 bg-success/5 p-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-success">Alteração sugerida</p><Textarea aria-label="Texto proposto pela IA" className="mt-1 min-h-32 bg-transparent text-xs leading-5" value={editableText} disabled={phase !== "completed"} onChange={(event) => onTextChange(event.target.value)} /></div></div> : canWrite ? <Textarea aria-label="Texto sugerido" className="mt-3 min-h-40 text-xs leading-5" value={editableText} disabled={phase !== "completed"} onChange={(event) => onTextChange(event.target.value)} /> : <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{editableText}</p>}

    {sugestao.achados.length ? <div className="mt-3 space-y-2"><h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pontos encontrados</h4>{sugestao.achados.map((finding) => <article key={finding.id} className="rounded-md border bg-background/50 p-2.5"><div className="flex items-start justify-between gap-2"><div><span className="text-[10px] font-medium text-primary">{finding.categoria}</span><h5 className="mt-0.5 text-xs font-semibold">{finding.titulo}</h5></div></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{finding.descricao}</p></article>)}</div> : null}

    {sugestao.alertas.length ? <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-2.5"><h4 className="flex items-center gap-1.5 text-xs font-medium text-warning"><AlertTriangle className="size-3.5" />Verifique antes de usar</h4><ul className="mt-1.5 space-y-1 text-[11px] leading-4 text-muted-foreground">{sugestao.alertas.map((alert, index) => <li key={`${alert.codigo}-${index}`}>• {alert.mensagem}</li>)}</ul></div> : null}

    {canWrite && !anchorValid && phase !== "applied" ? <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><span>O documento mudou desde o envio. A aplicação no destino original foi bloqueada; gere novamente a sugestão.</span></div> : null}
    {canWrite && saveBlockingMessage && phase !== "applied" ? <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{saveBlockingMessage}</div> : null}
    {phase === "historical" ? <p className="mt-3 text-xs text-muted-foreground">Resposta do histórico. Para editar a Peça atual, faça um novo pedido ou abra uma proposta salva.</p> : null}
    {phase === "reviewing" ? <p role="status" className="mt-3 text-xs text-muted-foreground">Proposta salva. Revise as alterações no documento para aprovar ou rejeitar.</p> : null}
    {phase === "applied" ? <div className="mt-3 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-2.5 text-xs text-success"><Check className="size-3.5" />Sugestão aplicada. Você ainda pode desfazer no editor.</div> : null}
    {phase === "rejected" ? <div className="mt-3 flex items-center gap-2 rounded-md border bg-muted/50 p-2.5 text-xs text-muted-foreground"><X className="size-3.5" />Sugestão rejeitada. A Peça não foi alterada.</div> : null}

    <div className="mt-3 flex flex-wrap gap-1.5">
      {canWrite ? <Button type="button" size="sm" disabled={!canApply} onClick={onApply}><ShieldCheck />{reviewInDocument ? "Revisar no documento" : operationLabels[sugestao.operacaoSugerida]}</Button> : null}
      <Button type="button" size="sm" variant="outline" onClick={onCopy} disabled={!editableText}><Copy />Copiar</Button>
      <Button type="button" size="sm" variant="ghost" onClick={onRetry}><RotateCcw />Tentar novamente</Button>
      <Button type="button" size="sm" variant="ghost" onClick={onReject} disabled={phase !== "completed"}>Rejeitar</Button>
    </div>
  </section>;
}

function ErrorBox({ message }: { message: string }) {
  return <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{message}</div>;
}
