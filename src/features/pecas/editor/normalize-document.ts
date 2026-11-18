import type { JSONContent } from "@tiptap/core";

// Older empty Peças store content: [], while the editor schema requires a block.
// Normalize in memory, consistently with the backend patch compiler, without
// creating an autosave just for opening the document.
export function normalizeLegalDocument(document: JSONContent): JSONContent {
  if (document.type === "doc" && !document.content?.length)
    return { ...document, content: [{ type: "paragraph" }] };
  return document;
}
