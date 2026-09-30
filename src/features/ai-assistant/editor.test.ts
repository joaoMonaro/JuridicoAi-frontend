import { Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

import {
  applySuggestion,
  canApplySuggestion,
  captureEditorContext,
  isSuggestionAnchorValid,
} from "@/features/ai-assistant/editor";
import type { AssistantOperation, AssistantSuggestion } from "@/features/ai-assistant/types";
import type { SaveState } from "@/features/pecas/types";

const editors: Editor[] = [];

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

describe("captureEditorContext", () => {
  it("captura seleção, posições, texto original e revisão", () => {
    const editor = createEditor();
    const range = findText(editor, "Primeiro fato.");
    editor.commands.setTextSelection(range);

    const snapshot = captureEditorContext(editor, "Selecao", 7);

    expect(snapshot).toEqual({
      scope: "Selecao",
      text: "Primeiro fato.",
      sectionTitle: null,
      selection: { ...range, originalText: "Primeiro fato." },
      cursorPosition: range.to,
      editorRevision: 7,
    });
  });

  it("captura o cursor sem exigir seleção quando o escopo é Nenhum", () => {
    const editor = createEditor();
    const position = findText(editor, "Primeiro fato.").from;
    editor.commands.setTextSelection(position);

    const snapshot = captureEditorContext(editor, "Nenhum", 3);

    expect(snapshot.selection).toBeNull();
    expect(snapshot.cursorPosition).toBe(position);
    expect(snapshot.text).toBe("");
  });

  it("rejeita escopo Seleção quando não existe texto selecionado", () => {
    const editor = createEditor();

    expect(() => captureEditorContext(editor, "Selecao", 1))
      .toThrow("Selecione um trecho antes de usar esse escopo.");
  });

  it("extrai somente a seção atual delimitada por headings", () => {
    const editor = createEditor();
    editor.commands.setTextSelection(findText(editor, "Segundo fato.").from);

    const snapshot = captureEditorContext(editor, "SecaoAtual", 2);

    expect(snapshot.sectionTitle).toBe("DOS FATOS");
    expect(snapshot.text).toContain("DOS FATOS");
    expect(snapshot.text).toContain("Primeiro fato.");
    expect(snapshot.text).toContain("Segundo fato.");
    expect(snapshot.text).not.toContain("DO DIREITO");
  });

  it("serializa o documento completo de forma determinística", () => {
    const editor = createEditor();

    const first = captureEditorContext(editor, "DocumentoCompleto", 1);
    const second = captureEditorContext(editor, "DocumentoCompleto", 1);

    expect(first.text).toBe(second.text);
    expect(first.text).toContain("DOS FATOS\n\nPrimeiro fato.");
    expect(first.text).toContain("DO DIREITO\n\nFundamentação.");
  });
});

describe("isSuggestionAnchorValid", () => {
  it("aceita seleção que ainda aponta para o mesmo texto e revisão", () => {
    const editor = createEditor();
    const range = findText(editor, "Primeiro fato.");
    const suggestion = createSuggestion("SubstituirSelecao", 4, range, "Primeiro fato.");

    expect(isSuggestionAnchorValid(editor, suggestion, 4)).toBe(true);
  });

  it("expira quando o texto muda na mesma posição", () => {
    const editor = createEditor();
    const range = findText(editor, "Primeiro fato.");
    const suggestion = createSuggestion("SubstituirSelecao", 4, range, "Primeiro fato.");
    editor.commands.insertContentAt(range, "Fato modificado.");

    expect(isSuggestionAnchorValid(editor, suggestion, 4)).toBe(false);
  });

  it("expira após edição fora da seleção ou troca de Peça alterar a revisão", () => {
    const editor = createEditor();
    const range = findText(editor, "Primeiro fato.");
    const suggestion = createSuggestion("SubstituirSelecao", 4, range, "Primeiro fato.");

    expect(isSuggestionAnchorValid(editor, suggestion, 5)).toBe(false);
  });

  it("rejeita posições fora dos limites e intervalos vazios", () => {
    const editor = createEditor();
    const size = editor.state.doc.content.size;

    expect(isSuggestionAnchorValid(
      editor,
      createSuggestion("SubstituirSelecao", 1, { from: 3, to: size + 1 }, "texto"),
      1,
    )).toBe(false);
    expect(isSuggestionAnchorValid(
      editor,
      createSuggestion("SubstituirSelecao", 1, { from: 3, to: 3 }, "texto"),
      1,
    )).toBe(false);
    expect(isSuggestionAnchorValid(
      editor,
      createSuggestion("InserirNoCursor", 1, null, null, size + 1),
      1,
    )).toBe(false);
  });
});

describe("applySuggestion", () => {
  it("substitui em uma transação e integra undo e redo", () => {
    const editor = createEditor();
    const range = findText(editor, "Primeiro fato.");
    const suggestion = createSuggestion("SubstituirSelecao", 2, range, "Primeiro fato.");
    let changedTransactions = 0;
    editor.on("transaction", ({ transaction }) => {
      if (transaction.docChanged) changedTransactions += 1;
    });

    expect(applySuggestion(editor, suggestion, "Fato reescrito.", 2, "SALVO")).toBe(true);
    expect(changedTransactions).toBe(1);
    expect(editor.getText()).toContain("Fato reescrito.");
    expect(editor.getText()).not.toContain("Primeiro fato.");

    expect(editor.commands.undo()).toBe(true);
    expect(editor.getText()).toContain("Primeiro fato.");
    expect(editor.commands.redo()).toBe(true);
    expect(editor.getText()).toContain("Fato reescrito.");
  });

  it("insere após a seleção sem substituir o texto original", () => {
    const editor = createEditor();
    const range = findText(editor, "Primeiro fato.");
    const suggestion = createSuggestion("InserirAposSelecao", 2, range, "Primeiro fato.");

    expect(applySuggestion(editor, suggestion, "Complemento.", 2, "SALVO")).toBe(true);
    expect(editor.getText()).toContain("Primeiro fato.");
    expect(editor.getText()).toContain("Complemento.");
  });

  it("converte texto em parágrafos e nunca interpreta HTML", () => {
    const editor = createEditor();
    const position = editor.state.doc.content.size;
    const suggestion = createSuggestion("InserirNoCursor", 1, null, null, position);

    expect(applySuggestion(
      editor,
      suggestion,
      "<strong>Texto literal</strong>\ncontinuação\n\nSegundo parágrafo.",
      1,
      "SALVO",
    )).toBe(true);
    expect(editor.getText()).toContain("<strong>Texto literal</strong>\ncontinuação");
    expect(editor.getText()).toContain("Segundo parágrafo.");
    expect(editor.getHTML()).toContain("&lt;strong&gt;Texto literal&lt;/strong&gt;");
    expect(editor.getHTML()).not.toContain("<strong>Texto literal</strong>");
  });

  it.each<SaveState>(["SALVANDO", "NAO_SALVO", "ERRO", "CONFLITO"])(
    "bloqueia aplicação e não cria transação quando o autosave está em %s",
    (saveState) => {
      const editor = createEditor();
      const range = findText(editor, "Primeiro fato.");
      const suggestion = createSuggestion("SubstituirSelecao", 2, range, "Primeiro fato.");
      let changedTransactions = 0;
      editor.on("transaction", ({ transaction }) => {
        if (transaction.docChanged) changedTransactions += 1;
      });

      expect(canApplySuggestion(editor, suggestion, "Fato reescrito.", 2, saveState)).toBe(false);
      expect(applySuggestion(editor, suggestion, "Fato reescrito.", 2, saveState)).toBe(false);
      expect(changedTransactions).toBe(0);
      expect(editor.getText()).toContain("Primeiro fato.");
    },
  );

  it("não cria transação quando a âncora está expirada", () => {
    const editor = createEditor();
    const range = findText(editor, "Primeiro fato.");
    const suggestion = createSuggestion("SubstituirSelecao", 2, range, "Primeiro fato.");
    let changedTransactions = 0;
    editor.on("transaction", ({ transaction }) => {
      if (transaction.docChanged) changedTransactions += 1;
    });

    expect(applySuggestion(editor, suggestion, "Fato reescrito.", 3, "SALVO")).toBe(false);
    expect(changedTransactions).toBe(0);
  });

  it("não aplica resposta destinada somente ao painel", () => {
    const editor = createEditor();
    const suggestion = createSuggestion("ResponderNoPainel", 1);

    expect(canApplySuggestion(editor, suggestion, "Resposta", 1, "SALVO")).toBe(false);
    expect(applySuggestion(editor, suggestion, "Resposta", 1, "SALVO")).toBe(false);
  });
});

function createEditor(content: JSONContent = legalDocument): Editor {
  const editor = new Editor({
    extensions: [StarterKit],
    content,
  });
  editors.push(editor);
  return editor;
}

function findText(editor: Editor, text: string): { from: number; to: number } {
  let result: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, position) => {
    if (result || !node.isText || !node.text) return;
    const index = node.text.indexOf(text);
    if (index >= 0) result = { from: position + index, to: position + index + text.length };
  });
  if (!result) throw new Error(`Texto não encontrado no editor: ${text}`);
  return result;
}

function createSuggestion(
  operation: AssistantOperation,
  revision: number,
  range: { from: number; to: number } | null = null,
  originalText: string | null = null,
  position: number | null = null,
): AssistantSuggestion {
  return {
    id: "sugestao-1",
    modo: operation === "SubstituirSelecao" ? "Reescrever" : "Redigir",
    operacaoSugerida: operation,
    titulo: "Sugestão",
    texto: "Texto sugerido",
    resumo: "Resumo",
    alertas: [],
    achados: [],
    ancora: {
      from: range?.from ?? null,
      to: range?.to ?? null,
      posicao: position,
      revisaoEditor: revision,
      textoOriginal: originalText,
    },
  };
}

const legalDocument: JSONContent = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "DOS FATOS" }] },
    { type: "paragraph", content: [{ type: "text", text: "Primeiro fato." }] },
    { type: "paragraph", content: [{ type: "text", text: "Segundo fato." }] },
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "DO DIREITO" }] },
    { type: "paragraph", content: [{ type: "text", text: "Fundamentação." }] },
  ],
};
