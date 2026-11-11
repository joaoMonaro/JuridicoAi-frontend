import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode, type Schema } from "@tiptap/pm/model";
import { closeHistory } from "@tiptap/pm/history";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Transform } from "@tiptap/pm/transform";
import type { EditorView } from "@tiptap/pm/view";
import { DecorationSet } from "@tiptap/pm/view";

import { operationDecorations } from "./preview";
import type { LocalReviewProposal, ReviewGroup, ReviewSession } from "./types";
import "./review.css";
import { normalizeLegalDocument } from "@/features/pecas/editor/normalize-document";

export const reviewKey = new PluginKey<ReviewSession | null>("assistantReview");
type Action =
  | { type: "clear" }
  | { type: "load"; session: ReviewSession }
  | { type: "visibility"; visible: boolean }
  | { type: "select"; id: string }
  | { type: "lock"; locked: boolean }
  | { type: "invalidate" }
  | { type: "reject"; ids: string[] }
  | { type: "apply"; ids: string[] };

export function getReviewSession(editor: Editor): ReviewSession | null {
  return reviewKey.getState(editor.state) ?? null;
}

function checkNode(node: ProseMirrorNode) {
  node.check();
  const inspect = (child: ProseMirrorNode) => {
    if (child.attrs.textAlign && !["left", "center", "right", "justify"].includes(child.attrs.textAlign))
      throw new Error("Alinhamento inválido na proposta.");
    for (const mark of child.marks) {
      if (mark.type.name === "link" && !/^(https?:\/\/|mailto:)/iu.test(mark.attrs.href ?? ""))
        throw new Error("A proposta contém um link não permitido.");
    }
  };
  inspect(node);
  node.descendants(inspect);
}

function compileProposal(proposal: LocalReviewProposal, doc: ProseMirrorNode, schema: Schema): ReviewSession {
  const base = schema.nodeFromJSON(normalizeLegalDocument(proposal.baseDocument));
  if (!base.eq(doc)) throw new Error("O documento mudou desde a preparação da proposta.");
  if (!proposal.id || !proposal.groups.length || proposal.groups.length > 100)
    throw new Error("A proposta não contém grupos válidos.");
  const boundaries: number[] = [];
  doc.forEach((_node, offset) => boundaries.push(offset));
  boundaries.push(doc.content.size);
  const ids = new Set<string>();
  const occupied: Array<{ from: number; to: number }> = [];
  const groups: ReviewGroup[] = proposal.groups.map((group) => {
    if (!group.id || ids.has(group.id) || !group.operations.length || group.operations.length > 100)
      throw new Error("A proposta contém grupos inválidos ou repetidos.");
    ids.add(group.id);
    const operations = group.operations.map((operation) => {
      const { startIndex, deleteCount } = operation;
      if (!Number.isInteger(startIndex) || !Number.isInteger(deleteCount) || startIndex < 0 ||
          deleteCount < 0 || startIndex + deleteCount > doc.childCount)
        throw new Error("A proposta aponta para blocos inexistentes.");
      const from = boundaries[startIndex];
      const to = boundaries[startIndex + deleteCount];
      if (occupied.some((range) =>
        (from < range.to && to > range.from) ||
        (from === to && (from === range.from || (from > range.from && from < range.to))) ||
        (range.from === range.to && range.from >= from && range.from < to)))
        throw new Error("Alterações sobrepostas devem pertencer a uma única operação.");
      occupied.push({ from, to });
      const original = doc.slice(from, to).content;
      const nodes = operation.newBlocks.map((json) => {
        const node = schema.nodeFromJSON(json);
        checkNode(node);
        if (!node.isBlock || node.type === schema.topNodeType) throw new Error("A proposta contém um bloco inválido.");
        return node;
      });
      const replacement = Fragment.fromArray(nodes);
      if (original.eq(replacement)) throw new Error("A proposta contém uma alteração sem diferenças.");
      return { from, to, original, replacement };
    });
    return { id: group.id, explanation: group.explanation, status: "pending", operations };
  });
  // Check the whole resulting document, including deletion of the last paragraph.
  const validation = new Transform(doc);
  for (const op of groups.flatMap((group) => group.operations).sort((a, b) => b.from - a.from))
    validation.replaceWith(op.from, op.to, op.replacement);
  validation.doc.check();
  return { proposalId: proposal.id, expectedDocument: doc, groups, activeGroupId: groups[0].id, visible: true, stale: false };
}

export function loadReviewProposal(editor: Editor, proposal: LocalReviewProposal): { ok: true } | { ok: false; message: string } {
  try {
    const session = compileProposal(proposal, editor.state.doc, editor.schema);
    editor.view.dispatch(editor.state.tr.setMeta(reviewKey, { type: "load", session } satisfies Action));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Proposta inválida." };
  }
}

export function setReviewVisible(editor: Editor, visible: boolean) {
  const session = getReviewSession(editor);
  if (!session || session.stale || session.locked) return;
  editor.view.dispatch(editor.state.tr.setMeta(reviewKey, { type: "visibility", visible } satisfies Action));
}

export function selectReviewGroup(editor: Editor, id: string) {
  const session = getReviewSession(editor);
  if (!session?.groups.some((group) => group.id === id && group.status === "pending")) return;
  editor.view.dispatch(editor.state.tr.setMeta(reviewKey, { type: "select", id } satisfies Action));
  scrollReviewGroup(editor, id);
}

export function scrollReviewGroup(editor: Editor, id: string, behavior: ScrollBehavior = "smooth") {
  if (editor.isDestroyed) return;
  const group = getReviewSession(editor)?.groups.find((item) => item.id === id);
  if (!group) return;
  const preview = Array.from(editor.view.dom.querySelectorAll<HTMLElement>(".assistant-review-preview"))
    .find((element) => element.dataset.reviewGroup === id);
  const source = editor.view.nodeDOM(group.operations[0].from);
  const target = source instanceof HTMLElement ? source : preview;
  const container = editor.view.dom.closest<HTMLElement>("[data-review-scroll-container]");
  if (target && container) {
    const top = container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 16;
    container.scrollTo?.({ top: Math.max(0, top), behavior });
  } else target?.scrollIntoView?.({ behavior, block: "start" });
}

function applyToView(view: EditorView, ids: string[], expectedDocument?: ProseMirrorNode, commitId?: string): boolean {
  const session = reviewKey.getState(view.state);
  if (!session || session.stale || !session.visible || (session.locked && !commitId) || !session.expectedDocument.eq(view.state.doc) ||
      !ids.length || new Set(ids).size !== ids.length) return false;
  const groups = ids.map((id) => session.groups.find((group) => group.id === id && group.status === "pending"));
  if (groups.some((group) => !group)) return false;
  const operations = groups.flatMap((group) => group!.operations).sort((a, b) => b.from - a.from);
  const tr = closeHistory(view.state.tr);
  try {
    for (const operation of operations) {
      if (!view.state.doc.slice(operation.from, operation.to).content.eq(operation.original)) return false;
      tr.replaceWith(operation.from, operation.to, operation.replacement);
    }
    tr.doc.check();
    if (expectedDocument && !tr.doc.eq(expectedDocument)) return false;
    if (commitId) tr.setMeta("assistantExternalCommit", commitId);
    tr.setMeta(reviewKey, { type: "apply", ids } satisfies Action);
    view.dispatch(tr);
    view.dispatch(closeHistory(view.state.tr));
    return true;
  } catch {
    return false;
  }
}

function rejectInView(view: EditorView, ids: string[]) {
  const session = reviewKey.getState(view.state);
  if (!session || session.stale || session.locked || !ids.length || new Set(ids).size !== ids.length ||
      ids.some((id) => !session.groups.some((group) => group.id === id && group.status === "pending"))) return false;
  view.dispatch(view.state.tr.setMeta(reviewKey, { type: "reject", ids } satisfies Action));
  return true;
}

/** Local E0 application only; never use this as a replacement for server approval. */
export const applyReviewGroups = (editor: Editor, ids: string[]) => applyToView(editor.view, ids);
export const rejectReviewGroups = (editor: Editor, ids: string[]) => rejectInView(editor.view, ids);

export function lockReview(editor: Editor, locked: boolean) {
  editor.view.dispatch(editor.state.tr.setMeta(reviewKey, { type: "lock", locked } satisfies Action));
}
export function invalidateReview(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(reviewKey, { type: "invalidate" } satisfies Action));
}
export function clearReview(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(reviewKey, { type: "clear" } satisfies Action));
}
export function acceptServerReviewRejection(editor: Editor, ids: string[]) {
  editor.view.dispatch(editor.state.tr.setMeta(reviewKey, { type: "reject", ids } satisfies Action));
}
export function acceptServerReviewCommit(editor: Editor, ids: string[], document: LocalReviewProposal["baseDocument"], requestId: string) {
  return applyToView(editor.view, ids, editor.schema.nodeFromJSON(document), requestId);
}
interface ReviewHandlers { approve: (ids: string[]) => void; reject: (ids: string[]) => void }
const decisionHandlers = new WeakMap<EditorView, ReviewHandlers>();
export function setReviewDecisionHandlers(editor: Editor, handlers: ReviewHandlers) {
  const view = editor.view;
  decisionHandlers.set(view, handlers);
  return () => { decisionHandlers.set(view, { approve: () => {}, reject: () => {} }); };
}

export const AssistantReviewExtension = Extension.create({
  name: "assistantReview",
  addProseMirrorPlugins() {
    return [new Plugin<ReviewSession | null>({
      key: reviewKey,
      state: {
        init: () => null,
        apply(tr, previous) {
          const action = tr.getMeta(reviewKey) as Action | undefined;
          if (action?.type === "clear") return null;
          if (action?.type === "load") return action.session;
          if (!previous) return null;
          if (action?.type === "lock") return { ...previous, locked: action.locked };
          if (action?.type === "invalidate") return { ...previous, stale: true, visible: false };
          if (action?.type === "visibility") return { ...previous, visible: action.visible };
          if (action?.type === "select") return { ...previous, activeGroupId: action.id };
          if (action?.type === "apply" || action?.type === "reject") {
            const groups = previous.groups.map((group): ReviewGroup => {
              if (action.ids.includes(group.id)) return { ...group, status: action.type === "apply" ? "applied" : "rejected" };
              if (action.type !== "apply" || group.status !== "pending") return group;
              return { ...group, operations: group.operations.map((op) => ({ ...op,
                from: tr.mapping.map(op.from, 1), to: tr.mapping.map(op.to, -1),
              })) };
            });
            const pending = groups.filter((group) => group.status === "pending");
            return { ...previous, groups, expectedDocument: tr.doc,
              activeGroupId: pending.some((group) => group.id === previous.activeGroupId) ? previous.activeGroupId : pending[0]?.id ?? null,
              visible: previous.visible && pending.length > 0,
            };
          }
          if (tr.docChanged) return { ...previous, visible: false, stale: true };
          return previous;
        },
      },
      filterTransaction(tr, state) {
        const session = reviewKey.getState(state);
        const action = tr.getMeta(reviewKey) as Action | undefined;
        return !(tr.docChanged && (session?.locked || session?.visible && !session.stale) && action?.type !== "apply");
      },
      props: {
        editable: (state) => !reviewKey.getState(state)?.visible && !reviewKey.getState(state)?.locked,
        decorations(state) {
          const session = reviewKey.getState(state);
          if (!session || !session.visible || session.stale) return DecorationSet.empty;
          const decorations = session.groups.flatMap((group, index) => group.status !== "pending" ? [] :
            group.operations.flatMap((operation, operationIndex) => operationDecorations(
              operation, group, index + 1, group.id === session.activeGroupId, state.schema,
              operationIndex,
              (view, ids) => { if (!reviewKey.getState(view.state)?.locked) { const handlers = decisionHandlers.get(view); if (handlers) handlers.approve(ids); else applyToView(view, ids); } },
              (view, ids) => { if (!reviewKey.getState(view.state)?.locked) { const handlers = decisionHandlers.get(view); if (handlers) handlers.reject(ids); else rejectInView(view, ids); } },
              Boolean(session.locked),
            )));
          return DecorationSet.create(state.doc, decorations);
        },
      },
    })];
  },
});
