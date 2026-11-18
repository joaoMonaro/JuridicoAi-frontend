import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";

import { AssistantReviewExtension } from "@/features/ai-assistant/review/extension";

/** Shared schema for the actual editor and the isolated review sandbox. */
export function createLegalEditorExtensions() {
  return [
    StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    AssistantReviewExtension,
  ];
}
