import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AlertTriangle, Check, CloudOff, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getEditorTheme, saveEditorTheme } from "@/features/pecas/editor/editor-theme";
import type { EditorTheme } from "@/features/pecas/editor/editor-theme";
import { EditorToolbar } from "@/features/pecas/editor/editor-toolbar";
import { mmToPx, useDocumentPagination } from "@/features/pecas/editor/use-document-pagination";
import { usePecaAutosave } from "@/features/pecas/hooks/use-peca-autosave";
import type { Peca, PecaPatch } from "@/features/pecas/types";
import { cn } from "@/lib/utils";

interface Props { peca: Peca; onChanged: (peca: Peca) => void; onReload: () => void }

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

export function LegalDocumentEditor({ peca, onChanged, onReload }: Props) {
  const [stats, setStats] = useState({ words: 0, characters: 0 });
  const [editorTheme, setEditorTheme] = useState<EditorTheme>(getEditorTheme);
  const pecaRef = useRef(peca);
  useEffect(() => { pecaRef.current = peca; }, [peca]);
  const persisted = useCallback((version: number, updatedAt: string, patch: PecaPatch) => onChanged({ ...pecaRef.current, ...patch, versao: version, dataAtualizacao: updatedAt }), [onChanged]);
  const autosave = usePecaAutosave({ pecaId: peca.id, initialVersion: peca.versao, onPersisted: persisted });

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextAlign.configure({ types: ["heading", "paragraph"] }), Link.configure({ openOnClick: false, autolink: true })],
    content: peca.conteudoJson,
    editorProps: { attributes: { class: "legal-editor-content focus:outline-none" } },
    onCreate: ({ editor: current }) => {
      const text = current.getText();
      setStats({ characters: text.length, words: text.trim() ? text.trim().split(/\s+/u).length : 0 });
    },
    onUpdate: ({ editor: current }) => {
      autosave.contentChanged(current.getJSON());
      const text = current.getText();
      setStats({ characters: text.length, words: text.trim() ? text.trim().split(/\s+/u).length : 0 });
    },
  }, [peca.id]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void autosave.flush(); }
    };
    const manualSave = () => void autosave.flush();
    const patch = (event: Event) => autosave.change((event as CustomEvent<PecaPatch>).detail);
    window.addEventListener("keydown", keydown);
    window.addEventListener("peca:save", manualSave);
    window.addEventListener("peca:patch", patch);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("peca:save", manualSave); window.removeEventListener("peca:patch", patch); };
  }, [autosave]);

  const pageCount = useDocumentPagination(editor, peca.pageConfig);
  const header = useMemo(() => documentText(peca.headerJson), [peca.headerJson]);
  const footer = useMemo(() => documentText(peca.footerJson), [peca.footerJson]);
  const pageStyle = {
    width: `${mmToPx(210)}px`, minHeight: `${mmToPx(297)}px`,
    padding: `${mmToPx(peca.pageConfig.marginTop)}px ${mmToPx(peca.pageConfig.marginRight)}px ${mmToPx(peca.pageConfig.marginBottom)}px ${mmToPx(peca.pageConfig.marginLeft)}px`,
    fontFamily: peca.styles.fontFamily, fontSize: `${peca.styles.fontSize}pt`, lineHeight: peca.styles.lineHeight, textAlign: peca.styles.textAlign,
  } as const;

  const status = autosave.state === "SALVANDO" ? <><LoaderCircle className="animate-spin" />Salvando...</> : autosave.state === "SALVO" ? <><Check />Salvo</> : autosave.state === "ERRO" ? <><CloudOff />Erro ao salvar</> : autosave.state === "CONFLITO" ? <><AlertTriangle />Conflito de versão</> : <><span className="size-1.5 rounded-full bg-warning" />Não salvo</>;

  function toggleEditorTheme() {
    setEditorTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      saveEditorTheme(next);
      return next;
    });
  }

  return <section className="flex min-w-0 flex-1 flex-col bg-card">
    <EditorToolbar editor={editor} theme={editorTheme} onToggleTheme={toggleEditorTheme} />
    {autosave.state === "CONFLITO" && <div className="flex items-center justify-between border-b border-warning/40 bg-warning/10 px-4 py-2 text-xs text-warning"><span>Esta peça foi alterada em outra sessão. Recarregue para evitar sobrescrever a versão mais recente.</span><Button size="sm" variant="outline" onClick={onReload}><RefreshCw />Recarregar versão mais recente</Button></div>}
    <div className={cn("min-h-0 flex-1 overflow-auto px-8 py-7 transition-colors", editorTheme === "light" ? "bg-[#cfd4da]" : "bg-[#0a1118]")}>
      <div
        data-editor-theme={editorTheme}
        className={cn(
          "legal-editor-page relative mx-auto border shadow-xl transition-colors",
          editorTheme === "light" ? "border-[#b7bec6] bg-white text-[#20242a]" : "border-[#33404d] bg-[#131d26] text-[#dce4eb]",
        )}
        style={pageStyle}
      >
        {header && <div className={cn("absolute inset-x-0 top-5 px-12 text-center text-[10px]", editorTheme === "light" ? "text-[#66717d]" : "text-muted-foreground")}>{header}</div>}
        <EditorContent editor={editor} />
        {footer && <div className={cn("absolute inset-x-0 bottom-5 px-12 text-center text-[10px]", editorTheme === "light" ? "text-[#66717d]" : "text-muted-foreground")}>{footer}</div>}
      </div>
    </div>
    <footer className="flex h-9 items-center border-t bg-card px-3 text-[11px] text-muted-foreground">
      <span>Palavras: {stats.words.toLocaleString("pt-BR")}</span><span className="mx-3">Caracteres: {stats.characters.toLocaleString("pt-BR")}</span><span>{pageCount} {pageCount === 1 ? "página" : "páginas"}</span>
      <span className="ml-auto flex items-center gap-1.5">{status}</span>
      {(autosave.state === "ERRO" || autosave.state === "NAO_SALVO") && <Button size="sm" variant="ghost" className="ml-2 h-7" onClick={() => void autosave.retry()}><Save />Salvar</Button>}
    </footer>
  </section>;
}
