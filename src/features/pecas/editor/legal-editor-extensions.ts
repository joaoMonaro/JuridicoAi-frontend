import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";

import { AssistantReviewExtension } from "@/features/ai-assistant/review/extension";

export function sanitizeExternalUrl(raw: string | null | undefined, allowMailto = false): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const allowedProtocols = allowMailto ? ["https:", "http:", "mailto:"] : ["https:", "http:"];
    if (!allowedProtocols.includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** Shared schema for the actual editor and the isolated review sandbox. */
export function createLegalEditorExtensions() {
  return [
    StarterKit.configure({
      link: {
        openOnClick: false,
        autolink: true,
        isAllowedUri: (url) => Boolean(sanitizeExternalUrl(url, true)),
      },
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    AssistantReviewExtension,
  ];
}
