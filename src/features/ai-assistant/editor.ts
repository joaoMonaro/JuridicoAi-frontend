import type { Editor, JSONContent } from "@tiptap/react";

import type {
  AssistantOperation,
  AssistantSuggestion,
  DocumentContextScope,
  EditorRequestSnapshot,
} from "@/features/ai-assistant/types";
import type { SaveState } from "@/features/pecas/types";

export function captureEditorContext(
  editor: Editor,
  scope: DocumentContextScope,
  editorRevision: number,
): EditorRequestSnapshot {
  const { from, to, empty } = editor.state.selection;
  const selectedText = empty ? "" : editor.state.doc.textBetween(from, to, "\n");
  const selection = empty ? null : { from, to, originalText: selectedText };
  const cursorPosition = empty ? from : to;

  if (scope === "Nenhum") {
    return { scope, text: "", sectionTitle: null, selection, cursorPosition, editorRevision };
  }
  if (scope === "Selecao") {
    if (!selection || !selectedText.trim()) throw new Error("Selecione um trecho antes de usar esse escopo.");
    return { scope, text: selectedText, sectionTitle: null, selection, cursorPosition, editorRevision };
  }
  if (scope === "DocumentoCompleto") {
    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n\n");
    if (!text.trim()) throw new Error("O documento está vazio. Use o contexto ‘Somente meu pedido’.");
    return {
      scope,
      text,
      sectionTitle: null,
      selection,
      cursorPosition,
      editorRevision,
    };
  }

  let headingStart: number | null = null;
  let headingLevel: number | null = null;
  let headingTitle: string | null = null;
  const topLevel: Array<{ offset: number; type: string; level: number | null }> = [];
  editor.state.doc.forEach((node, offset) => {
    const level = node.type.name === "heading" ? Number(node.attrs.level) : null;
    topLevel.push({ offset, type: node.type.name, level });
    if (node.type.name === "heading" && offset <= from) {
      headingStart = offset;
      headingLevel = level;
      headingTitle = node.textContent || null;
    }
  });

  if (headingStart !== null) {
    let sectionEnd = editor.state.doc.content.size;
    for (const node of topLevel) {
      if (node.offset > headingStart && node.type === "heading" &&
          node.level !== null && headingLevel !== null && node.level <= headingLevel) {
        sectionEnd = node.offset;
        break;
      }
    }
    const text = editor.state.doc.textBetween(headingStart, sectionEnd, "\n\n");
    if (!text.trim()) throw new Error("A seção atual está vazia. Use o contexto ‘Somente meu pedido’.");
    return {
      scope,
      text,
      sectionTitle: headingTitle,
      selection,
      cursorPosition,
      editorRevision,
    };
  }

  const text = editor.state.selection.$from.parent.textContent;
  if (!text.trim()) throw new Error("O bloco atual está vazio. Use o contexto ‘Somente meu pedido’.");
  return {
    scope,
    text,
    sectionTitle: null,
    selection,
    cursorPosition,
    editorRevision,
  };
}

export function isSuggestionAnchorValid(
  editor: Editor,
  suggestion: AssistantSuggestion,
  editorRevision: number,
) {
  const { ancora, operacaoSugerida } = suggestion;
  if (ancora.revisaoEditor !== editorRevision) return false;
  if (operacaoSugerida === "ResponderNoPainel") return true;

  if (isSelectionOperation(operacaoSugerida)) {
    if (ancora.from === null || ancora.to === null || ancora.textoOriginal === null) return false;
    if (ancora.from < 0 || ancora.to > editor.state.doc.content.size || ancora.to <= ancora.from) return false;
    return editor.state.doc.textBetween(ancora.from, ancora.to, "\n") === ancora.textoOriginal;
  }

  return ancora.posicao !== null && ancora.posicao >= 0 && ancora.posicao <= editor.state.doc.content.size;
}

export function canApplySuggestion(
  editor: Editor,
  suggestion: AssistantSuggestion,
  text: string,
  editorRevision: number,
  saveState: SaveState,
) {
  return saveState === "SALVO" && suggestion.operacaoSugerida !== "ResponderNoPainel" &&
    Boolean(text.trim()) && isSuggestionAnchorValid(editor, suggestion, editorRevision);
}

export function applySuggestion(
  editor: Editor,
  suggestion: AssistantSuggestion,
  text: string,
  editorRevision: number,
  saveState: SaveState,
) {
  if (!canApplySuggestion(editor, suggestion, text, editorRevision, saveState)) return false;
  const content = textToTiptap(text);
  if (!content.length) return false;
  const { ancora, operacaoSugerida } = suggestion;

  if (operacaoSugerida === "SubstituirSelecao" && ancora.from !== null && ancora.to !== null) {
    return editor.chain().focus().insertContentAt({ from: ancora.from, to: ancora.to }, content).run();
  }
  if (operacaoSugerida === "InserirAposSelecao" && ancora.to !== null) {
    return editor.chain().focus().insertContentAt(ancora.to, content).run();
  }
  if ((operacaoSugerida === "InserirNoCursor" || operacaoSugerida === "CriarSecao") && ancora.posicao !== null) {
    return editor.chain().focus().insertContentAt(ancora.posicao, content).run();
  }
  return false;
}

function isSelectionOperation(operation: AssistantOperation) {
  return operation === "SubstituirSelecao" || operation === "InserirAposSelecao";
}

function textToTiptap(text: string): JSONContent[] {
  return text.trim().split(/\n\s*\n/u).filter(Boolean).map((paragraph) => {
    const lines = paragraph.split("\n");
    const content: JSONContent[] = [];
    lines.forEach((line, index) => {
      if (index > 0) content.push({ type: "hardBreak" });
      if (line) content.push({ type: "text", text: line });
    });
    return { type: "paragraph", content: content.length ? content : undefined };
  });
}
