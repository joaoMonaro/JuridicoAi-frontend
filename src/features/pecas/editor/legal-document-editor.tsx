import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AlertTriangle, Check, CloudOff, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getAssistantCapabilities } from "@/features/ai-assistant/api";
import { AssistantPanel } from "@/features/ai-assistant/components/assistant-panel";
import { isAssistantShortcut } from "@/features/ai-assistant/keyboard";
import type { AssistantCapabilities } from "@/features/ai-assistant/types";
import { getEditorTheme, saveEditorTheme } from "@/features/pecas/editor/editor-theme";
import type { EditorTheme } from "@/features/pecas/editor/editor-theme";
import { EditorToolbar } from "@/features/pecas/editor/editor-toolbar";
import { getEditorZoom, saveEditorZoom } from "@/features/pecas/editor/editor-view";
import type { EditorZoom } from "@/features/pecas/editor/editor-view";
import { mmToPx, useDocumentPagination } from "@/features/pecas/editor/use-document-pagination";
import { usePecaAutosave } from "@/features/pecas/hooks/use-peca-autosave";
import type { Peca, PecaPatch } from "@/features/pecas/types";
import { cn } from "@/lib/utils";

interface Props { peca: Peca; onChanged: (peca: Peca) => void; onReload: () => void; focusMode: boolean; onToggleFocusMode: () => void }

function documentText(json: Peca["headerJson"]) {
  const pieces: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const item = node as { text?: string; content?: unknown[] };
    if (item.text) pieces.push(item.text);
    item.content?.forEach(walk);
  };
  walk(json);
  return pieces.join(" ");
}

export function LegalDocumentEditor({ peca, onChanged, onReload, focusMode, onToggleFocusMode }: Props) {
  const [stats, setStats] = useState({ words: 0, characters: 0 });
  const [editorTheme, setEditorTheme] = useState<EditorTheme>(getEditorTheme);
  const [zoom, setZoom] = useState<EditorZoom>(getEditorZoom);
  const [fitZoom, setFitZoom] = useState(1);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantCapabilities, setAssistantCapabilities] = useState<AssistantCapabilities | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const capabilitiesControllerRef = useRef<AbortController | null>(null);
  const pecaRef = useRef(peca);
  useEffect(() => { pecaRef.current = peca; }, [peca]);
  const persisted = useCallback((version: number, updatedAt: string, patch: PecaPatch) => onChanged({ ...pecaRef.current, ...patch, versao: version, dataAtualizacao: updatedAt }), [onChanged]);
  const autosave = usePecaAutosave({ pecaId: peca.id, initialVersion: peca.versao, onPersisted: persisted });
  const assistantAvailable = assistantCapabilities?.habilitado === true;

  const refreshAssistantCapabilities = useCallback(() => {
    capabilitiesControllerRef.current?.abort();
    const controller = new AbortController();
    capabilitiesControllerRef.current = controller;
    getAssistantCapabilities(controller.signal)
      .then((result) => {
        setAssistantCapabilities(result);
        if (!result.habilitado) setAssistantOpen(false);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setAssistantCapabilities(null);
        setAssistantOpen(false);
      })
      .finally(() => {
        if (capabilitiesControllerRef.current === controller) capabilitiesControllerRef.current = null;
      });
  }, []);

  useEffect(() => {
    refreshAssistantCapabilities();
    window.addEventListener("focus", refreshAssistantCapabilities);
    return () => {
      window.removeEventListener("focus", refreshAssistantCapabilities);
      capabilitiesControllerRef.current?.abort();
    };
  }, [refreshAssistantCapabilities]);

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: true } }), TextAlign.configure({ types: ["heading", "paragraph"] })],
    content: peca.conteudoJson,
    editorProps: { attributes: { class: "legal-editor-content focus:outline-none" } },
    onCreate: ({ editor: current }) => {
      const text = current.getText();
      setStats({ characters: text.length, words: text.trim() ? text.trim().split(/\s+/u).length : 0 });
    },
    onUpdate: ({ editor: current }) => {
      autosave.contentChanged(current.getJSON());
      setEditorRevision((revision) => revision + 1);
      const text = current.getText();
      setStats({ characters: text.length, words: text.trim() ? text.trim().split(/\s+/u).length : 0 });
    },
  }, [peca.id]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void autosave.flush(); }
      if (assistantAvailable && isAssistantShortcut(event)) { event.preventDefault(); setAssistantOpen((current) => !current); }
    };
    const manualSave = () => void autosave.flush();
    const patch = (event: Event) => autosave.change((event as CustomEvent<PecaPatch>).detail);
    window.addEventListener("keydown", keydown);
    window.addEventListener("peca:save", manualSave);
    window.addEventListener("peca:patch", patch);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("peca:save", manualSave); window.removeEventListener("peca:patch", patch); };
  }, [assistantAvailable, autosave]);

  useEffect(() => {
    if (autosave.state === "SALVO") return;
    const protectUnsavedChanges = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectUnsavedChanges);
    return () => window.removeEventListener("beforeunload", protectUnsavedChanges);
  }, [autosave.state]);

  const pageCount = useDocumentPagination(editor, peca.pageConfig);
  const header = useMemo(() => documentText(peca.headerJson), [peca.headerJson]);
  const footer = useMemo(() => documentText(peca.footerJson), [peca.footerJson]);
  const pageStyle = {
    width: `${mmToPx(210)}px`, minHeight: `${mmToPx(297)}px`,
    padding: `${mmToPx(peca.pageConfig.marginTop)}px ${mmToPx(peca.pageConfig.marginRight)}px ${mmToPx(peca.pageConfig.marginBottom)}px ${mmToPx(peca.pageConfig.marginLeft)}px`,
    fontFamily: peca.styles.fontFamily, fontSize: `${peca.styles.fontSize}pt`, lineHeight: peca.styles.lineHeight, textAlign: peca.styles.textAlign,
  } as const;
  const effectiveZoom = zoom === "fit" ? fitZoom : zoom;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateFitZoom = () => {
      const horizontalPadding = canvas.clientWidth < 640 ? 32 : 48;
      const nextZoom = Math.min(1, Math.max(0.4, (canvas.clientWidth - horizontalPadding) / mmToPx(210)));
      setFitZoom(nextZoom);
    };
    updateFitZoom();
    const observer = new ResizeObserver(updateFitZoom);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const status = autosave.state === "SALVANDO" ? <><LoaderCircle className="animate-spin" />Salvando...</> : autosave.state === "SALVO" ? <><Check />Salvo</> : autosave.state === "ERRO" ? <><CloudOff />Erro ao salvar</> : autosave.state === "CONFLITO" ? <><AlertTriangle />Conflito de versão</> : <><span className="size-1.5 rounded-full bg-warning" />Não salvo</>;

  function toggleEditorTheme() {
    setEditorTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      saveEditorTheme(next);
      return next;
    });
  }

  function changeZoom(nextZoom: EditorZoom) {
    setZoom(nextZoom);
    saveEditorZoom(nextZoom);
  }

  return <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
    <EditorToolbar editor={editor} theme={editorTheme} onToggleTheme={toggleEditorTheme} zoom={zoom} effectiveZoom={effectiveZoom} onZoomChange={changeZoom} focusMode={focusMode} onToggleFocusMode={onToggleFocusMode} assistantAvailable={assistantAvailable} assistantOpen={assistantOpen} onToggleAssistant={() => setAssistantOpen((current) => !current)} />
    {autosave.state === "CONFLITO" && <div className="flex items-center justify-between border-b border-warning/40 bg-warning/10 px-4 py-2 text-xs text-warning"><span>Esta peça foi alterada em outra sessão. Recarregue para evitar sobrescrever a versão mais recente.</span><Button size="sm" variant="outline" onClick={onReload}><RefreshCw />Recarregar versão mais recente</Button></div>}
    <div className="relative flex min-h-0 flex-1">
      <div ref={canvasRef} className={cn("min-h-0 min-w-0 flex-1 overflow-auto px-4 py-5 transition-colors sm:px-6 sm:py-6 2xl:px-8 2xl:py-7", editorTheme === "light" ? "bg-[#cfd4da]" : "bg-[#0a1118]")}>
        <div
          data-editor-theme={editorTheme}
          className={cn(
            "legal-editor-page relative mx-auto border shadow-xl transition-colors",
            editorTheme === "light" ? "border-[#b7bec6] bg-white text-[#20242a]" : "border-[#33404d] bg-[#131d26] text-[#dce4eb]",
          )}
          style={{ ...pageStyle, zoom: effectiveZoom }}
        >
          {header && <div className={cn("absolute inset-x-0 top-5 px-12 text-center text-[10px]", editorTheme === "light" ? "text-[#66717d]" : "text-muted-foreground")}>{header}</div>}
          <EditorContent editor={editor} />
          {footer && <div className={cn("absolute inset-x-0 bottom-5 px-12 text-center text-[10px]", editorTheme === "light" ? "text-[#66717d]" : "text-muted-foreground")}>{footer}</div>}
        </div>
      </div>
      {assistantCapabilities ? <AssistantPanel
        open={assistantOpen && assistantAvailable}
        capabilities={assistantCapabilities}
        editor={editor}
        peca={peca}
        editorRevision={editorRevision}
        saveState={autosave.state}
        onCapabilitiesInvalidated={refreshAssistantCapabilities}
        onClose={() => setAssistantOpen(false)}
      /> : null}
    </div>
    <footer className="flex h-9 items-center border-t bg-card px-3 text-xs text-muted-foreground">
      <span>Palavras: {stats.words.toLocaleString("pt-BR")}</span><span className="mx-3">Caracteres: {stats.characters.toLocaleString("pt-BR")}</span><span>{pageCount} {pageCount === 1 ? "página" : "páginas"}</span>
      <span className="ml-auto flex items-center gap-1.5">{status}</span>
      {(autosave.state === "ERRO" || autosave.state === "NAO_SALVO") && <Button size="sm" variant="ghost" className="ml-2 h-7" onClick={() => void autosave.retry()}><Save />Salvar</Button>}
    </footer>
  </section>;
}
