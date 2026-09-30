import type { Editor } from "@tiptap/react";
import { AlertTriangle, Check, CircleAlert, Copy, LoaderCircle, RotateCcw, Send, ShieldCheck, Sparkles, Square, WandSparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamAssistantRequest, getAssistantCapabilities } from "@/features/ai-assistant/api";
import {
  applySuggestion,
  canApplySuggestion,
  captureEditorContext,
  isSuggestionAnchorValid,
} from "@/features/ai-assistant/editor";
import type {
  AssistantCapabilities,
  AssistantCompletedEvent,
  AssistantMode,
  AssistantOperation,
  AssistantRequest,
  DocumentContextScope,
} from "@/features/ai-assistant/types";
import { listarContextos } from "@/features/contextos/api";
import { CONTEXTO_TIPO_LABELS } from "@/features/contextos/contexto-options";
import type { ContextoCaso } from "@/features/contextos/types";
import type { Peca, SaveState } from "@/features/pecas/types";
import { ApiError } from "@/lib/api-client";

interface Props {
  open: boolean;
  editor: Editor | null;
  peca: Peca;
  editorRevision: number;
  saveState: SaveState;
  onClose: () => void;
}

type RequestPhase = "idle" | "sending" | "streaming" | "completed" | "applied" | "error";

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
};

export function AssistantPanel({ open, editor, peca, editorRevision, saveState, onClose }: Props) {
  const [capabilities, setCapabilities] = useState<AssistantCapabilities | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState("");
  const [contexts, setContexts] = useState<ContextoCaso[] | null>(null);
  const [contextsError, setContextsError] = useState("");
  const [mode, setMode] = useState<AssistantMode>("Perguntar");
  const [scope, setScope] = useState<DocumentContextScope>("SecaoAtual");
  const [instruction, setInstruction] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [includeCaseData, setIncludeCaseData] = useState(false);
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<RequestPhase>("idle");
  const [streamedText, setStreamedText] = useState("");
  const [completed, setCompleted] = useState<AssistantCompletedEvent | null>(null);
  const [editableText, setEditableText] = useState("");
  const [error, setError] = useState("");
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const requestController = useRef<AbortController | null>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (!open || capabilities || capabilitiesError) return;
    const controller = new AbortController();
    getAssistantCapabilities(controller.signal)
      .then(setCapabilities)
      .catch((requestError) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setCapabilitiesError(requestError instanceof Error ? requestError.message : "Não foi possível consultar o assistente.");
      });
    return () => controller.abort();
  }, [open, capabilities, capabilitiesError]);

  useEffect(() => {
    if (!open || contexts !== null || contextsError) return;
    const controller = new AbortController();
    listarContextos(peca.casoId, controller.signal)
      .then(setContexts)
      .catch((requestError) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setContextsError(requestError instanceof Error ? requestError.message : "Não foi possível carregar os contextos do caso.");
      });
    return () => controller.abort();
  }, [open, contexts, contextsError, peca.casoId]);

  useEffect(() => () => requestController.current?.abort(), []);

  useEffect(() => {
    if (!open || !capabilities?.habilitado) return;
    const frame = requestAnimationFrame(() => instructionRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [capabilities?.habilitado, open]);

  useEffect(() => {
    let frame: number | undefined;
    if (wasOpen.current && !open) frame = requestAnimationFrame(() => editor?.commands.focus());
    wasOpen.current = open;
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [editor, open]);

  const busy = phase === "sending" || phase === "streaming";
  const suggestion = completed?.sugestao ?? null;
  const anchorValid = useMemo(
    () => Boolean(editor && suggestion && isSuggestionAnchorValid(editor, suggestion, editorRevision)),
    [editor, suggestion, editorRevision],
  );
  const canApply = Boolean(editor && suggestion && phase !== "applied" &&
    canApplySuggestion(editor, suggestion, editableText, editorRevision, saveState));

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (busy) requestController.current?.abort();
      else onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [busy, onClose, open]);

  function changeMode(nextMode: AssistantMode) {
    setMode(nextMode);
    if (nextMode === "Reescrever") setScope("Selecao");
    else if (nextMode === "Redigir" && !editor?.getText().trim()) setScope("Nenhum");
    else if (scope === "Selecao" && editor?.state.selection.empty) setScope("SecaoAtual");
  }

  function quickAction(nextMode: AssistantMode, nextInstruction: string, nextScope?: DocumentContextScope) {
    changeMode(nextMode);
    setInstruction(nextInstruction);
    if (nextScope) setScope(nextScope);
  }

  function preferredOperation(snapshot: ReturnType<typeof captureEditorContext>): AssistantOperation {
    if (mode === "Perguntar" || mode === "Revisar") return "ResponderNoPainel";
    if (mode === "Reescrever") return "SubstituirSelecao";
    return snapshot.selection ? "InserirAposSelecao" : "InserirNoCursor";
  }

  async function submit() {
    if (!editor || !capabilities?.habilitado || !instruction.trim() || busy) return;
    setError("");
    let snapshot: ReturnType<typeof captureEditorContext>;
    try {
      snapshot = captureEditorContext(editor, scope, editorRevision);
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : "Não foi possível capturar o contexto do editor.");
      setPhase("error");
      return;
    }

    const request: AssistantRequest = {
      clientRequestId: crypto.randomUUID(),
      modo: mode,
      instrucao: instruction.trim(),
      versaoPeca: peca.versao,
      operacaoPreferida: preferredOperation(snapshot),
      contexto: {
        documento: {
          escopo: snapshot.scope,
          texto: snapshot.scope === "Nenhum" ? null : snapshot.text,
          tituloSecao: snapshot.sectionTitle,
          selecao: snapshot.selection ? {
            from: snapshot.selection.from,
            to: snapshot.selection.to,
            textoOriginal: snapshot.selection.originalText,
          } : null,
          cursor: snapshot.cursorPosition === null ? null : { posicao: snapshot.cursorPosition },
          revisaoEditor: snapshot.editorRevision,
        },
        contextoAdicional: additionalContext.trim() || null,
        incluirDadosCaso: includeCaseData,
        contextoCasoIds: selectedContextIds,
      },
    };

    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setPhase("sending");
    setStreamedText("");
    setCompleted(null);
    setEditableText("");
    try {
      await streamAssistantRequest(peca.id, request, {
        onStarted: () => setPhase("streaming"),
        onDelta: (delta) => setStreamedText((current) => current + delta),
        onCompleted: (event) => {
          setCompleted(event);
          setEditableText(event.sugestao.texto);
          setPhase("completed");
        },
      }, controller.signal);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") {
        setError("Solicitação cancelada.");
        setPhase("idle");
      } else {
        setError(requestError instanceof ApiError ? requestError.message : "Não foi possível concluir a solicitação.");
        setPhase("error");
      }
    } finally {
      if (requestController.current === controller) requestController.current = null;
    }
  }

  function cancel() {
    requestController.current?.abort();
  }

  function close() {
    requestController.current?.abort();
    onClose();
  }

  function reject() {
    setCompleted(null);
    setEditableText("");
    setStreamedText("");
    setPhase("idle");
    setError("");
  }

  function apply() {
    if (!editor || !suggestion || !canApply) return;
    if (applySuggestion(editor, suggestion, editableText, editorRevision, saveState)) setPhase("applied");
    else setError("Não foi possível aplicar a sugestão no destino original.");
  }

  async function copySuggestion() {
    try {
      await navigator.clipboard.writeText(editableText || streamedText);
    } catch {
      setError("Não foi possível copiar a sugestão.");
    }
  }

  function developFinding(title: string, description: string) {
    changeMode("Redigir");
    setInstruction(`Desenvolva um trecho jurídico para a seguinte melhoria: ${title}.`);
    setAdditionalContext(description);
    if (scope === "Nenhum") setScope("SecaoAtual");
    setCompleted(null);
    setEditableText("");
    setStreamedText("");
    setPhase("idle");
  }

  function toggleContext(id: string) {
    setSelectedContextIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  if (!open) return null;

  return <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[390px] shrink-0 flex-col border-l bg-card shadow-2xl xl:static xl:z-auto xl:w-[380px] xl:shadow-none" aria-label="Assistente de IA">
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <span className="grid size-7 place-items-center rounded-md bg-primary/15 text-primary"><Sparkles className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Assistente de IA</h2><p className="truncate text-[10px] text-muted-foreground">A IA sugere; você decide o que aplicar</p></div>
      <Button type="button" size="icon-sm" variant="ghost" onClick={close} aria-label="Fechar assistente"><X /></Button>
    </header>

    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {!capabilities && !capabilitiesError ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" />Consultando disponibilidade...</div> : null}
      {capabilitiesError ? <div><ErrorBox message={capabilitiesError} /><Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setCapabilitiesError("")}><RotateCcw />Tentar novamente</Button></div> : null}
      {capabilities && !capabilities.habilitado ? <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"><div className="flex items-center gap-2 font-medium text-warning"><AlertTriangle className="size-4" />Assistente desabilitado</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Configure o provider, o modelo e a chave no backend para habilitar esta funcionalidade.</p></div> : null}

      {capabilities?.habilitado ? <>
        <section aria-labelledby="assistant-actions-title">
          <h3 id="assistant-actions-title" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ações rápidas</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button type="button" size="xs" variant="outline" onClick={() => quickAction("Reescrever", "Reescreva o trecho preservando o sentido jurídico e os fatos.", "Selecao")}>Reescrever</Button>
            <Button type="button" size="xs" variant="outline" onClick={() => quickAction("Reescrever", "Expanda o trecho com maior clareza e fundamentação, sem inventar fatos.", "Selecao")}>Expandir</Button>
            <Button type="button" size="xs" variant="outline" onClick={() => quickAction("Revisar", "Identifique lacunas, contradições e melhorias possíveis nesta parte da peça.")}>Revisar</Button>
            <Button type="button" size="xs" variant="outline" onClick={() => quickAction("Redigir", "Redija um novo trecho jurídico conforme o contexto informado.")}>Novo trecho</Button>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="text-xs font-medium">Modo<select className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs" value={mode} disabled={busy} onChange={(event) => changeMode(event.target.value as AssistantMode)}>{capabilities.modos.map((item) => <option key={item} value={item}>{modeLabels[item]}</option>)}</select></label>
          <label className="text-xs font-medium">Contexto<select className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs" value={scope} disabled={busy} onChange={(event) => setScope(event.target.value as DocumentContextScope)}>{Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>

        <label className="mt-3 block text-xs font-medium">O que você quer que a IA faça?<Textarea ref={instructionRef} className="mt-1 min-h-28 resize-y" value={instruction} disabled={busy} maxLength={capabilities.limites.instrucaoCaracteres} onChange={(event) => setInstruction(event.target.value)} placeholder="Ex.: crie um tópico sobre tutela de urgência considerando o bloqueio da conta..." /></label>
        <div className="mt-1 text-right text-[10px] text-muted-foreground">{instruction.length}/{capabilities.limites.instrucaoCaracteres}</div>

        <details className="mt-3 rounded-md border bg-background/40 p-2.5">
          <summary className="cursor-pointer text-xs font-medium">Contexto adicional e dados do caso</summary>
          <label className="mt-3 flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 accent-primary" checked={includeCaseData} disabled={busy} onChange={(event) => setIncludeCaseData(event.target.checked)} /><span><span className="font-medium">Incluir dados do caso</span><span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">Envia título, descrição e dados essenciais dos envolvidos. Documentos pessoais não são incluídos.</span></span></label>
          {contexts?.length ? <fieldset className="mt-3"><legend className="text-[11px] font-medium">Contextos selecionados</legend><div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">{contexts.map((item) => <label key={item.id} className="flex items-start gap-2 rounded px-1 py-1 text-xs hover:bg-muted"><input type="checkbox" className="mt-0.5 accent-primary" checked={selectedContextIds.includes(item.id)} disabled={busy} onChange={() => toggleContext(item.id)} /><span className="min-w-0"><span className="block truncate">{item.titulo || CONTEXTO_TIPO_LABELS[item.tipo]}</span><span className="text-[10px] text-muted-foreground">{CONTEXTO_TIPO_LABELS[item.tipo]}</span></span></label>)}</div></fieldset> : null}
          {contextsError ? <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-destructive"><span>{contextsError}</span><Button type="button" size="xs" variant="outline" onClick={() => setContextsError("")}><RotateCcw />Tentar novamente</Button></div> : null}
          <label className="mt-3 block text-[11px] font-medium">Informação apenas para este pedido<Textarea className="mt-1 min-h-20 text-xs" value={additionalContext} disabled={busy} maxLength={capabilities.limites.contextoAdicionalCaracteres} onChange={(event) => setAdditionalContext(event.target.value)} placeholder="Fatos ou instruções que não devem entrar automaticamente na peça." /></label>
        </details>

        <div className="mt-3 flex items-center gap-2">
          {busy ? <Button type="button" variant="outline" className="flex-1" onClick={cancel}><Square className="size-3 fill-current" />Cancelar</Button> : <Button type="button" className="flex-1" disabled={!editor || !instruction.trim()} onClick={() => void submit()}><Send />Enviar para IA</Button>}
          <span className="text-[10px] text-muted-foreground">{scopeLabels[scope]}</span>
        </div>

        {error ? <div className="mt-3"><ErrorBox message={error} /></div> : null}
        {(phase === "sending" || phase === "streaming") ? <div className="mt-4 rounded-md border bg-background/40 p-3"><div className="flex items-center gap-2 text-xs font-medium" aria-live="polite" aria-busy="true"><LoaderCircle className="size-4 animate-spin text-primary" />{phase === "sending" ? "Preparando contexto..." : "A IA está elaborando a resposta..."}</div>{streamedText ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{streamedText}</p> : null}</div> : null}
        {completed && suggestion ? <>
          <p role="status" className="sr-only">Resposta da IA concluída.</p>
          <SuggestionResult
            completed={completed}
            editableText={editableText}
            phase={phase}
            anchorValid={anchorValid}
            canApply={canApply}
            saveState={saveState}
            onTextChange={setEditableText}
            onApply={apply}
            onReject={reject}
            onRetry={() => void submit()}
            onCopy={() => void copySuggestion()}
            onDevelop={developFinding}
          />
        </> : null}
      </> : null}
    </div>
  </aside>;
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
  onDevelop: (title: string, description: string) => void;
}

function SuggestionResult({ completed, editableText, phase, anchorValid, canApply, saveState, onTextChange, onApply, onReject, onRetry, onCopy, onDevelop }: ResultProps) {
  const { sugestao } = completed;
  const canWrite = sugestao.operacaoSugerida !== "ResponderNoPainel";
  const saveBlockingMessage = saveState === "SALVO" ? null
    : saveState === "SALVANDO" ? "Aguarde a sincronização da Peça antes de aplicar a sugestão."
      : saveState === "CONFLITO" ? "Resolva o conflito da Peça antes de aplicar a sugestão."
        : "Não foi possível salvar a Peça. Suas alterações continuam neste dispositivo, mas sugestões da IA não podem ser aplicadas até que a sincronização seja restabelecida.";
  return <section className="mt-4 border-t pt-4" aria-labelledby="assistant-result-title">
    <div className="flex items-start gap-2"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/15 text-primary"><WandSparkles className="size-4" /></span><div className="min-w-0"><h3 id="assistant-result-title" className="text-sm font-semibold">{sugestao.titulo || "Sugestão da IA"}</h3><p className="mt-0.5 text-[10px] text-muted-foreground">{operationLabels[sugestao.operacaoSugerida]} · {completed.modelo}</p></div></div>
    {sugestao.resumo ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{sugestao.resumo}</p> : null}

    {sugestao.operacaoSugerida === "SubstituirSelecao" && sugestao.ancora.textoOriginal ? <div className="mt-3 grid gap-2"><div className="rounded-md border border-destructive/25 bg-destructive/5 p-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">Original</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5">{sugestao.ancora.textoOriginal}</p></div><div className="rounded-md border border-success/25 bg-success/5 p-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-success">Proposta</p><Textarea aria-label="Texto proposto pela IA" className="mt-1 min-h-32 bg-transparent text-xs leading-5" value={editableText} onChange={(event) => onTextChange(event.target.value)} /></div></div> : editableText || canWrite ? <Textarea aria-label="Texto sugerido" className="mt-3 min-h-40 text-xs leading-5" value={editableText} onChange={(event) => onTextChange(event.target.value)} /> : null}

    {sugestao.achados.length ? <div className="mt-3 space-y-2"><h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pontos encontrados</h4>{sugestao.achados.map((finding) => <article key={finding.id} className="rounded-md border bg-background/50 p-2.5"><div className="flex items-start justify-between gap-2"><div><span className="text-[10px] font-medium text-primary">{finding.categoria}</span><h5 className="mt-0.5 text-xs font-semibold">{finding.titulo}</h5></div><Button type="button" size="xs" variant="outline" onClick={() => onDevelop(finding.titulo, finding.descricao)}>Desenvolver</Button></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{finding.descricao}</p></article>)}</div> : null}

    {sugestao.alertas.length ? <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-2.5"><h4 className="flex items-center gap-1.5 text-xs font-medium text-warning"><AlertTriangle className="size-3.5" />Verifique antes de usar</h4><ul className="mt-1.5 space-y-1 text-[11px] leading-4 text-muted-foreground">{sugestao.alertas.map((alert, index) => <li key={`${alert.codigo}-${index}`}>• {alert.mensagem}</li>)}</ul></div> : null}

    {canWrite && !anchorValid && phase !== "applied" ? <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><span>O documento mudou desde o envio. A aplicação no destino original foi bloqueada; gere novamente a sugestão.</span></div> : null}
    {canWrite && saveBlockingMessage && phase !== "applied" ? <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{saveBlockingMessage}</div> : null}
    {phase === "applied" ? <div className="mt-3 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-2.5 text-xs text-success"><Check className="size-3.5" />Sugestão aplicada. Você ainda pode desfazer no editor.</div> : null}

    <div className="mt-3 flex flex-wrap gap-1.5">
      {canWrite ? <Button type="button" size="sm" disabled={!canApply} onClick={onApply}><ShieldCheck />{operationLabels[sugestao.operacaoSugerida]}</Button> : null}
      <Button type="button" size="sm" variant="outline" onClick={onCopy} disabled={!editableText}><Copy />Copiar</Button>
      <Button type="button" size="sm" variant="ghost" onClick={onRetry}><RotateCcw />Tentar novamente</Button>
      <Button type="button" size="sm" variant="ghost" onClick={onReject}>Rejeitar</Button>
    </div>
  </section>;
}

function ErrorBox({ message }: { message: string }) {
  return <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{message}</div>;
}
