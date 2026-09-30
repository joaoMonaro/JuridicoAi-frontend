import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, Link as LinkIcon, List, ListOrdered, Maximize2, Minimize2, Quote, Redo2, Sparkles, Strikethrough, Sun, Underline as UnderlineIcon, Undo2 } from "lucide-react";
import type { Editor } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { assistantShortcutLabel } from "@/features/ai-assistant/keyboard";
import type { EditorTheme } from "@/features/pecas/editor/editor-theme";
import type { EditorZoom } from "@/features/pecas/editor/editor-view";
import { cn } from "@/lib/utils";

interface Props { editor: Editor | null; theme: EditorTheme; onToggleTheme: () => void; zoom: EditorZoom; effectiveZoom: number; onZoomChange: (zoom: EditorZoom) => void; focusMode: boolean; onToggleFocusMode: () => void; assistantOpen: boolean; onToggleAssistant: () => void }
export function EditorToolbar({ editor, theme, onToggleTheme, zoom, effectiveZoom, onZoomChange, focusMode, onToggleFocusMode, assistantOpen, onToggleAssistant }: Props) {
  if (!editor) return <div className="h-11 border-b" />;
  const assistantShortcut = assistantShortcutLabel();
  const command = (label: string, active: boolean, icon: typeof Bold, run: () => void, disabled = false) => {
    const Icon = icon;
    return <Button type="button" size="icon-sm" variant="ghost" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={run} className={cn(active && "bg-primary/15 text-primary")}><Icon /></Button>;
  };
  return <div className="flex h-11 min-w-0 items-center border-b bg-card">
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2">
      <select aria-label="Estilo do texto" className="h-7 shrink-0 rounded-md border bg-background px-2 text-xs" value={editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p"} onChange={(e) => e.target.value === "p" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().toggleHeading({ level: e.target.value === "h2" ? 2 : 3 }).run()}><option value="p">Normal</option><option value="h2">Título</option><option value="h3">Subtítulo</option></select>
      <Separator orientation="vertical" className="mx-1 h-5" />
      {command("Negrito (Ctrl+B)", editor.isActive("bold"), Bold, () => editor.chain().focus().toggleBold().run())}
      {command("Itálico (Ctrl+I)", editor.isActive("italic"), Italic, () => editor.chain().focus().toggleItalic().run())}
      {command("Sublinhado (Ctrl+U)", editor.isActive("underline"), UnderlineIcon, () => editor.chain().focus().toggleUnderline().run())}
      {command("Tachado", editor.isActive("strike"), Strikethrough, () => editor.chain().focus().toggleStrike().run())}
      <Separator orientation="vertical" className="mx-1 h-5" />
      {command("Lista com marcadores", editor.isActive("bulletList"), List, () => editor.chain().focus().toggleBulletList().run())}
      {command("Lista numerada", editor.isActive("orderedList"), ListOrdered, () => editor.chain().focus().toggleOrderedList().run())}
      {command("Citação", editor.isActive("blockquote"), Quote, () => editor.chain().focus().toggleBlockquote().run())}
      <Separator orientation="vertical" className="mx-1 h-5" />
      {command("Alinhar à esquerda", editor.isActive({ textAlign: "left" }), AlignLeft, () => editor.chain().focus().setTextAlign("left").run())}
      {command("Centralizar", editor.isActive({ textAlign: "center" }), AlignCenter, () => editor.chain().focus().setTextAlign("center").run())}
      {command("Alinhar à direita", editor.isActive({ textAlign: "right" }), AlignRight, () => editor.chain().focus().setTextAlign("right").run())}
      {command("Justificar", editor.isActive({ textAlign: "justify" }), AlignJustify, () => editor.chain().focus().setTextAlign("justify").run())}
      {command("Inserir link", editor.isActive("link"), LinkIcon, () => { const href = window.prompt("Endereço do link"); if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run(); })}
    </div>
    <div className="flex shrink-0 items-center gap-1 border-l bg-card px-2 shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.8)]">
      <Button
        type="button"
        size="sm"
        variant={assistantOpen ? "secondary" : "ghost"}
        title={`Abrir assistente de IA (${assistantShortcut})`}
        aria-label="Abrir assistente de IA"
        aria-pressed={assistantOpen}
        onClick={onToggleAssistant}
        className={cn("hidden lg:inline-flex", assistantOpen && "text-sidebar-primary")}
      >
        <Sparkles />IA
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant={assistantOpen ? "secondary" : "ghost"}
        title={`Abrir assistente de IA (${assistantShortcut})`}
        aria-label="Abrir assistente de IA"
        aria-pressed={assistantOpen}
        onClick={onToggleAssistant}
        className={cn("lg:hidden", assistantOpen && "text-sidebar-primary")}
      >
        <Sparkles />
      </Button>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <select
        aria-label="Zoom do documento"
        title="Zoom do documento"
        className="h-7 w-[82px] rounded-md border bg-background px-1.5 text-xs"
        value={String(zoom)}
        onChange={(event) => onZoomChange(event.target.value === "fit" ? "fit" : Number(event.target.value) as EditorZoom)}
      >
        <option value="fit">Ajustar</option>
        <option value="0.75">75%</option>
        <option value="0.9">90%</option>
        <option value="1">100%</option>
        <option value="1.25">125%</option>
      </select>
      <span className="hidden w-9 text-right text-[10px] tabular-nums text-muted-foreground 2xl:inline" aria-hidden="true">{Math.round(effectiveZoom * 100)}%</span>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title={theme === "light" ? "Usar tema escuro no documento" : "Usar tema claro no documento"}
        aria-label={theme === "light" ? "Usar tema escuro no documento" : "Usar tema claro no documento"}
        aria-pressed={theme === "light"}
        onClick={onToggleTheme}
        className={cn(theme === "light" && "bg-primary/15 text-primary")}
      >
        <Sun />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title={focusMode ? "Sair do modo foco (Esc)" : "Ativar modo foco"}
        aria-label={focusMode ? "Sair do modo foco" : "Ativar modo foco"}
        aria-pressed={focusMode}
        onClick={onToggleFocusMode}
        className={cn(focusMode && "bg-primary/15 text-primary")}
      >
        {focusMode ? <Minimize2 /> : <Maximize2 />}
      </Button>
      <Separator orientation="vertical" className="mx-1 h-5" />
      {command("Desfazer", false, Undo2, () => editor.chain().focus().undo().run(), !editor.can().undo())}
      {command("Refazer", false, Redo2, () => editor.chain().focus().redo().run(), !editor.can().redo())}
    </div>
  </div>;
}
