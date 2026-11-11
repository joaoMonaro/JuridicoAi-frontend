import type { Editor } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { Transform } from "@tiptap/pm/transform";
import { canApplySuggestion, textToTiptap } from "@/features/ai-assistant/editor";
import type { AssistantSuggestion } from "@/features/ai-assistant/types";

/** Compile an existing suggestion without dispatching a document transaction. */
export function prepareLegacyProposal(editor: Editor, suggestion: AssistantSuggestion, text: string, revision: number) {
  if (!canApplySuggestion(editor, suggestion, text, revision, "SALVO")) throw new Error("O destino mudou. Gere uma nova sugestão.");
  const { ancora, operacaoSugerida } = suggestion;
  const from = operacaoSugerida === "SubstituirSelecao" ? ancora.from! :
    operacaoSugerida === "InserirAposSelecao" ? ancora.to! : ancora.posicao!;
  const to = operacaoSugerida === "SubstituirSelecao" ? ancora.to! : from;
  const original = editor.state.doc;
  const tr = new Transform(original);
  const content = Fragment.fromArray(textToTiptap(text).map((node) => editor.schema.nodeFromJSON(node)));
  tr.replaceRange(from, to, new Slice(content, 0, 0));
  tr.doc.check();
  let start = 0;
  while (start < original.childCount && start < tr.doc.childCount && original.child(start).eq(tr.doc.child(start))) start++;
  let oldEnd = original.childCount;
  let newEnd = tr.doc.childCount;
  while (oldEnd > start && newEnd > start && original.child(oldEnd - 1).eq(tr.doc.child(newEnd - 1))) { oldEnd--; newEnd--; }
  if (start === oldEnd && start === newEnd) throw new Error("A sugestão não contém diferenças.");
  return [{ explicacao: suggestion.titulo, operacoes: [{ startIndex: start, deleteCount: oldEnd - start,
    novosBlocos: Array.from({ length: newEnd - start }, (_, index) => tr.doc.child(start + index).toJSON()),
  }] }];
}
