import { DOMSerializer, type Node as ProseMirrorNode, type Schema } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration } from "@tiptap/pm/view";
import { diffWordsWithSpace } from "diff";

import type { ReviewGroup, ReviewOperation } from "./types";

interface Range { from: number; to: number }
type Decide = (view: EditorView, ids: string[]) => void;
const previewKeys = new WeakMap<ReviewOperation, number>();
let nextPreviewKey = 0;

function textLength(node: ProseMirrorNode): number {
  if (node.isText) return node.text!.length;
  if (node.type.name === "hardBreak") return 1;
  let length = 0;
  node.forEach((child) => { length += textLength(child); });
  return length;
}

function operationDiff(operation: ReviewOperation, groupId: string) {
  const removed: Decoration[] = [];
  const added: Range[] = [];
  let formattingChanged = false;
  const attrs = { "data-review-group": groupId };
  function compare(before: ProseMirrorNode, after: ProseMirrorNode, position: number, textStart: number) {
    if (before.eq(after)) return;
    if (before.isTextblock && after.isTextblock && before.type === after.type) {
      const changes = diffWordsWithSpace(
        before.textBetween(0, before.content.size, undefined, "\n"),
        after.textBetween(0, after.content.size, undefined, "\n"),
        { timeout: 50, maxEditLength: 2000 },
      );
      if (changes) {
        let oldOffset = 0;
        let newOffset = textStart;
        for (const change of changes) {
          if (change.removed) removed.push(Decoration.inline(position + 1 + oldOffset,
            position + 1 + oldOffset + change.value.length, { class: "assistant-review-removed", ...attrs }));
          else if (change.added) added.push({ from: newOffset, to: newOffset + change.value.length });
          if (!change.added) oldOffset += change.value.length;
          if (!change.removed) newOffset += change.value.length;
        }
        if (!before.sameMarkup(after) || hasMarkChanges(before, after)) {
          formattingChanged = true;
          removed.push(Decoration.node(position, position + before.nodeSize, { class: "assistant-review-format", ...attrs }));
        }
        return;
      }
    }
    if (!before.isTextblock && before.sameMarkup(after) && before.childCount === after.childCount) {
      let offset = textStart;
      before.forEach((child, childOffset, index) => {
        const replacement = after.child(index);
        compare(child, replacement, position + 1 + childOffset, offset);
        offset += textLength(replacement);
      });
      return;
    }
    removed.push(Decoration.node(position, position + before.nodeSize, { class: "assistant-review-removed-block", ...attrs }));
    if (textLength(after)) added.push({ from: textStart, to: textStart + textLength(after) });
  }
  if (operation.original.childCount === operation.replacement.childCount) {
    let textStart = 0;
    operation.original.forEach((before, offset, index) => {
      const after = operation.replacement.child(index);
      compare(before, after, operation.from + offset, textStart);
      textStart += textLength(after);
    });
  } else {
    operation.original.forEach((node, offset) => {
      removed.push(Decoration.node(operation.from + offset, operation.from + offset + node.nodeSize,
        { class: "assistant-review-removed-block", ...attrs }));
    });
    let length = 0;
    operation.replacement.forEach((node) => { length += textLength(node); });
    if (length) added.push({ from: 0, to: length });
  }
  return { removed, added, formattingChanged };
}

function hasMarkChanges(before: ProseMirrorNode, after: ProseMirrorNode) {
  const marks = (node: ProseMirrorNode) => {
    const result: string[] = [];
    node.descendants((child) => {
      if (child.isText) result.push(JSON.stringify(child.marks.map((mark) => mark.toJSON())));
    });
    return result.join("|");
  };
  return marks(before) !== marks(after);
}

function highlightText(root: HTMLElement, ranges: Range[]) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const texts: Array<{ node: Text; start: number }> = [];
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      texts.push({ node: node as Text, start: offset });
      offset += node.textContent?.length ?? 0;
    } else if ((node as Element).tagName === "BR") offset += 1;
  }
  for (const { node, start } of texts) {
    const value = node.data;
    const overlaps = ranges.filter((range) => range.from < start + value.length && range.to > start);
    if (!overlaps.length) continue;
    const fragment = root.ownerDocument.createDocumentFragment();
    let cursor = 0;
    for (const range of overlaps) {
      const from = Math.max(0, range.from - start);
      const to = Math.min(value.length, range.to - start);
      fragment.append(root.ownerDocument.createTextNode(value.slice(cursor, from)));
      const inserted = root.ownerDocument.createElement("ins");
      inserted.className = "assistant-review-added";
      inserted.textContent = value.slice(from, to);
      fragment.append(inserted);
      cursor = to;
    }
    fragment.append(root.ownerDocument.createTextNode(value.slice(cursor)));
    node.replaceWith(fragment);
  }
}

export function operationDecorations(
  operation: ReviewOperation,
  group: ReviewGroup,
  ordinal: number,
  active: boolean,
  schema: Schema,
  operationIndex: number,
  approve: Decide,
  reject: Decide,
  locked = false,
): Decoration[] {
  if (!previewKeys.has(operation)) previewKeys.set(operation, ++nextPreviewKey);
  const diff = operationDiff(operation, group.id);
  const result = diff.removed;
  result.push(Decoration.widget(operation.to, (view) => {
    const document = view.dom.ownerDocument;
    const wrapper = document.createElement("div");
    wrapper.className = `assistant-review-preview${active ? " is-active" : ""}`;
    wrapper.contentEditable = "false";
    wrapper.dataset.reviewGroup = group.id;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", `Alteração ${ordinal}`);
    const label = document.createElement("p");
    label.className = "assistant-review-label";
    label.textContent = `Alteração ${ordinal} · ${operation.replacement.size ? "Versão proposta — inclusões destacadas" : "Remoção proposta"}`;
    wrapper.append(label);
    if (diff.formattingChanged) {
      const formatLabel = document.createElement("p");
      formatLabel.className = "assistant-review-label";
      formatLabel.textContent = "Confira também a formatação do trecho.";
      wrapper.append(formatLabel);
    }
    const body = document.createElement("div");
    body.className = "assistant-review-proposed-content";
    body.append(DOMSerializer.fromSchema(schema).serializeFragment(operation.replacement, { document }));
    highlightText(body, diff.added);
    if (!operation.replacement.size) body.textContent = "O trecho riscado será removido do documento.";
    wrapper.append(body);
    if (operationIndex === 0) {
      const explanation = document.createElement("p");
      explanation.className = "assistant-review-explanation";
      explanation.textContent = group.explanation;
      wrapper.append(explanation);
      const actions = document.createElement("div");
      actions.className = "assistant-review-actions";
      for (const [text, decide] of [["Aprovar", approve], ["Rejeitar", reject]] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.disabled = locked;
        button.textContent = text;
        button.setAttribute("aria-label", `${text} alteração ${ordinal}`);
        button.addEventListener("click", (event) => {
          event.preventDefault();
          decide(view, [group.id]);
          view.dom.ownerDocument.querySelector<HTMLElement>("[data-review-toolbar-focus]")?.focus();
        });
        actions.append(button);
      }
      wrapper.append(actions);
    }
    // Proposed links retain their appearance without navigating away from review.
    wrapper.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
    });
    return wrapper;
  }, { side: -1, key: `${previewKeys.get(operation)}:${active}:${locked}`, stopEvent: () => true, ignoreSelection: true }));
  return result;
}
