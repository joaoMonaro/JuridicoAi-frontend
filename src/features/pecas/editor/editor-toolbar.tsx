import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Redo2, Strikethrough, Underline as UnderlineIcon, Undo2, AlignLeft, AlignCenter, AlignRight, AlignJustify, Quote } from "lucide-react";
import type { Editor } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Props { editor: Editor | null }
export function EditorToolbar({ editor }: Props) {
  if (!editor) return <div className="h-11 border-b" />;
  const command = (label: string, active: boolean, icon: typeof Bold, run: () => void, disabled = false) => {
    const Icon = icon;
    return <Button type="button" size="icon-sm" variant="ghost" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={run} className={cn(active && "bg-primary/15 text-primary")}><Icon /></Button>;
  };
  return <div className="flex h-11 items-center gap-1 overflow-x-auto border-b bg-card px-2">
    <select aria-label="Estilo do texto" className="h-7 border bg-background px-2 text-xs" value={editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p"} onChange={(e) => e.target.value === "p" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().toggleHeading({ level: e.target.value === "h2" ? 2 : 3 }).run()}><option value="p">Normal</option><option value="h2">Título</option><option value="h3">Subtítulo</option></select>
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
    <span className="ml-auto flex gap-1">{command("Desfazer", false, Undo2, () => editor.chain().focus().undo().run(), !editor.can().undo())}{command("Refazer", false, Redo2, () => editor.chain().focus().redo().run(), !editor.can().redo())}</span>
  </div>;
}
