import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { createLegalEditorExtensions } from "@/features/pecas/editor/legal-editor-extensions";
import { normalizeLegalDocument } from "@/features/pecas/editor/normalize-document";
import { acceptServerReviewCommit, applyReviewGroups, getReviewSession, loadReviewProposal, rejectReviewGroups, setReviewVisible, setReviewDecisionHandlers } from "./extension";
import { createReviewFixture, reviewDocument } from "./fixtures";
import type { LocalReviewProposal } from "./types";

const editors: Editor[] = [];
afterEach(() => { editors.splice(0).forEach((editor) => editor.destroy()); });
function setup() {
  const editor = new Editor({ extensions: createLegalEditorExtensions(), content: reviewDocument });
  editors.push(editor);
  const original = editor.getJSON();
  const proposal = createReviewFixture(original);
  return { editor, proposal, original };
}
function load(editor: Editor, proposal: LocalReviewProposal) {
  expect(loadReviewProposal(editor, proposal)).toEqual({ ok: true });
}

describe("revisão de propostas no editor", () => {
  it("reconcilia a primeira proposta de uma Peça vazia com o parágrafo implícito do servidor", () => {
    const empty = { type: "doc", content: [] };
    const editor = new Editor({ extensions: createLegalEditorExtensions(), content: normalizeLegalDocument(empty) });
    editors.push(editor);
    const original = editor.getJSON();
    const paragraph = { type: "paragraph", content: [{ type: "text", text: "Minuta inicial" }] };
    load(editor, { id: "empty", baseDocument: empty, groups: [{ id: "draft", explanation: "Minuta", operations: [{ startIndex: 0, deleteCount: 1, newBlocks: [paragraph] }] }] });
    expect(editor.getJSON()).toEqual(original);
    expect(acceptServerReviewCommit(editor, ["draft"], { type: "doc", content: [paragraph] }, "receipt-1")).toBe(true);
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.getText()).toBe("Minuta inicial");
    editor.commands.undo();
    expect(editor.getJSON()).toEqual(original);
  });
  it("encaminha aprovação do widget ao handler persistido sem mutação local antecipada", () => {
    const { editor, proposal, original } = setup();
    let selected: string[] = [];
    setReviewDecisionHandlers(editor, { approve: (ids) => { selected = ids; }, reject: () => {} });
    load(editor, proposal);
    editor.view.dom.querySelector<HTMLButtonElement>('[aria-label="Aprovar alteração 1"]')!.click();
    expect(selected).toEqual(["fatos"]);
    expect(editor.getJSON()).toEqual(original);
    expect(getReviewSession(editor)?.groups[0].status).toBe("pending");
  });
  it("mostra o diff sem alterar JSON, documento ou histórico de undo", () => {
    const { editor, proposal, original } = setup();
    let updates = 0;
    editor.on("update", () => { updates++; });
    load(editor, proposal);
    expect(editor.getJSON()).toEqual(original);
    expect(editor.getHTML()).not.toContain("assistant-review");
    expect(editor.view.dom.querySelectorAll(".assistant-review-preview")).toHaveLength(4);
    expect(editor.view.dom.querySelector(".assistant-review-removed")).not.toBeNull();
    expect(editor.view.dom.querySelector("ins")?.textContent).toBeTruthy();
    expect(editor.view.dom.querySelector(".assistant-review-proposed-content em")?.closest("ins")).toBeNull();
    expect(editor.view.dom.querySelector(".assistant-review-removed-block em")).toBeNull();
    expect(editor.can().undo()).toBe(false);
    expect(updates).toBe(0);
    expect(editor.isEditable).toBe(false);
  });

  it("aprova uma mudança preservando marks, data, valor e blocos fora do alvo", () => {
    const { editor, proposal, original } = setup();
    load(editor, proposal);
    expect(applyReviewGroups(editor, ["fatos"])).toBe(true);
    const result = editor.getJSON();
    expect(result.content![1].content![0]).toEqual(original.content![1].content![0]);
    expect(result.content!.slice(2)).toEqual(original.content!.slice(2));
    expect(editor.getText()).toContain("contatou a empresa repetidamente");
    expect(editor.getText()).toContain("R$ 850,00");
    expect(getReviewSession(editor)?.groups[0].status).toBe("applied");
    expect(editor.view.dom.querySelectorAll(".assistant-review-preview")).toHaveLength(3);
    expect(applyReviewGroups(editor, ["fatos"])).toBe(false);
  });

  it("remapeia inserção, exclusão e lista após aprovações parciais em ordem diferente", () => {
    const { editor, proposal } = setup();
    load(editor, proposal);
    for (const id of ["organizacao", "repeticao", "pedidos", "fatos"])
      expect(applyReviewGroups(editor, [id])).toBe(true);
    expect(editor.getText()).toContain("Do pagamento");
    expect(editor.getText()).not.toContain("Em outras palavras");
    expect(editor.getText()).toContain("Restituição de R$ 850,00");
    expect(editor.getHTML()).toContain("<em>Preservar os documentos apresentados</em>");
    expect(editor.getHTML()).toContain('href="https://example.test/documento"');
    expect(editor.view.dom.querySelectorAll(".assistant-review-preview")).toHaveLength(0);
    expect(getReviewSession(editor)?.stale).toBe(false);
    expect(editor.isEditable).toBe(true);
  });

  it("aplica todas em uma transação de documento e desfaz/refaz um único lote", () => {
    const { editor, proposal, original } = setup();
    load(editor, proposal);
    let changed = 0;
    editor.on("transaction", ({ transaction }) => { if (transaction.docChanged) changed++; });
    expect(applyReviewGroups(editor, proposal.groups.map((group) => group.id))).toBe(true);
    const applied = editor.getJSON();
    expect(changed).toBe(1);
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getJSON()).toEqual(original);
    expect(editor.commands.redo()).toBe(true);
    expect(editor.getJSON()).toEqual(applied);
    expect(applyReviewGroups(editor, ["fatos"])).toBe(false);
  });

  it("rejeita um grupo sem editar o documento e mantém os demais aprováveis", () => {
    const { editor, proposal, original } = setup();
    load(editor, proposal);
    expect(rejectReviewGroups(editor, ["fatos"])).toBe(true);
    expect(editor.getJSON()).toEqual(original);
    expect(editor.can().undo()).toBe(false);
    expect(applyReviewGroups(editor, ["pedidos"])).toBe(true);
    expect(editor.getJSON().content![1]).toEqual(original.content![1]);
    expect(applyReviewGroups(editor, ["fatos"])).toBe(false);
  });

  it("bloqueia edição durante preview e expira propostas após editar manualmente", () => {
    const { editor, proposal, original } = setup();
    load(editor, proposal);
    editor.commands.insertContentAt(1, "Tentativa durante revisão.");
    expect(editor.getJSON()).toEqual(original);
    setReviewVisible(editor, false);
    expect(editor.isEditable).toBe(true);
    editor.commands.insertContentAt(1, "Edição manual. ");
    const manuallyEdited = editor.getJSON();
    expect(getReviewSession(editor)?.stale).toBe(true);
    expect(applyReviewGroups(editor, ["fatos"])).toBe(false);
    expect(editor.getJSON()).toEqual(manuallyEdited);
    setReviewVisible(editor, true);
    expect(getReviewSession(editor)?.visible).toBe(false);
  });

  it("desfazer uma aplicação parcial invalida as pendências sem reaplicar a decisão anterior", () => {
    const { editor, proposal } = setup();
    load(editor, proposal);
    applyReviewGroups(editor, ["fatos"]);
    setReviewVisible(editor, false);
    editor.commands.undo();
    expect(getReviewSession(editor)?.stale).toBe(true);
    expect(getReviewSession(editor)?.groups[0].status).toBe("applied");
    expect(applyReviewGroups(editor, ["pedidos"])).toBe(false);
  });

  it("separa o undo da digitação posterior ao lote aprovado", () => {
    const { editor, proposal } = setup();
    load(editor, proposal);
    applyReviewGroups(editor, proposal.groups.map((group) => group.id));
    const approved = editor.getJSON();
    editor.commands.insertContentAt(1, "Texto digitado depois. ");
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getJSON()).toEqual(approved);
  });

  it("recusa base desatualizada, IDs duplicados, intervalos inválidos e sobreposição", () => {
    const { editor, proposal, original } = setup();
    const wrongBase = structuredClone(proposal);
    wrongBase.baseDocument.content = [{ type: "paragraph" }];
    expect(loadReviewProposal(editor, wrongBase).ok).toBe(false);
    const duplicate = structuredClone(proposal);
    duplicate.groups[1].id = duplicate.groups[0].id;
    expect(loadReviewProposal(editor, duplicate).ok).toBe(false);
    const invalid = structuredClone(proposal);
    invalid.groups[0].operations[0].startIndex = 100;
    expect(loadReviewProposal(editor, invalid).ok).toBe(false);
    const overlapping = structuredClone(proposal);
    overlapping.groups[1].operations = structuredClone(overlapping.groups[0].operations);
    expect(loadReviewProposal(editor, overlapping).ok).toBe(false);
    expect(editor.getJSON()).toEqual(original);
    expect(getReviewSession(editor)).toBeNull();
  });

  it("rejeita nó inválido e link executável sem alterar o documento", () => {
    const { editor, proposal, original } = setup();
    const unsafe = structuredClone(proposal);
    unsafe.groups[0].operations[0].newBlocks = [{ type: "paragraph", content: [
      { type: "text", text: "Clique", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
    ] }];
    expect(loadReviewProposal(editor, unsafe).ok).toBe(false);
    unsafe.groups[0].operations[0].newBlocks = [{ type: "unknown" }];
    expect(loadReviewProposal(editor, unsafe).ok).toBe(false);
    expect(editor.getJSON()).toEqual(original);
  });

  it("recusa lote com ID inexistente, repetido ou rejeitado sem aplicação parcial", () => {
    const { editor, proposal, original } = setup();
    load(editor, proposal);
    expect(applyReviewGroups(editor, ["fatos", "ausente"])).toBe(false);
    expect(applyReviewGroups(editor, ["fatos", "fatos"])).toBe(false);
    rejectReviewGroups(editor, ["fatos"]);
    expect(applyReviewGroups(editor, ["fatos", "pedidos"])).toBe(false);
    expect(editor.getJSON()).toEqual(original);
  });

  it("renderiza HTML como texto e não mistura widgets com o conteúdo exportável", () => {
    const { editor, proposal } = setup();
    const literal = '<img src=x onerror="alert(1)">';
    proposal.groups = [{ id: "literal", explanation: "Texto literal.", operations: [
      { startIndex: 1, deleteCount: 1, newBlocks: [{ type: "paragraph", content: [{ type: "text", text: literal }] }] },
    ] }];
    load(editor, proposal);
    expect(editor.view.dom.querySelector("img")).toBeNull();
    expect(editor.view.dom.textContent).toContain(literal);
    expect(editor.getText()).not.toContain(literal);
    applyReviewGroups(editor, ["literal"]);
    expect(editor.getHTML()).toContain("&lt;img");
    expect(editor.getHTML()).not.toContain("assistant-review");
  });

  it("permite criar uma minuta em documento vazio e desfazer", () => {
    const { editor } = setup();
    editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] });
    editor.commands.clearContent();
    const empty = editor.getJSON();
    const newBlocks: JSONContent[] = [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "MINUTA" }] },
      { type: "paragraph", content: [{ type: "text", text: "Conteúdo fictício." }] },
    ];
    load(editor, { id: "minuta", baseDocument: empty, groups: [{ id: "criar", explanation: "Criar minuta.", operations: [
      { startIndex: 0, deleteCount: 1, newBlocks },
    ] }] });
    expect(applyReviewGroups(editor, ["criar"])).toBe(true);
    expect(editor.getText()).toContain("MINUTA");
    editor.commands.undo();
    expect(editor.getJSON()).toEqual(empty);
  });
});
