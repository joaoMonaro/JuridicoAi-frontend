import type { JSONContent } from "@tiptap/react";

export interface FooterPresentation {
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  separator: boolean;
  offsetBottomMm: number;
}

export const DEFAULT_FOOTER_PRESENTATION: FooterPresentation = {
  fontSize: 9, color: "#66717d", align: "center", separator: false, offsetBottomMm: 5,
};

// Rodapés anteriores usavam 10 px e distância de 20 px da borda inferior.
const LEGACY_PRESENTATION: FooterPresentation = { ...DEFAULT_FOOTER_PRESENTATION, fontSize: 7.5, offsetBottomMm: 20 * 25.4 / 96 };

export function footerText(node: JSONContent | null): string {
  if (!node) return "";
  if (node.type === "hardBreak") return "\n";
  if (node.text !== undefined) return node.text;
  return node.content?.map(child => footerText(child)).join(node.type === "doc" ? "\n" : "") ?? "";
}

export function footerPresentation(node: JSONContent | null): FooterPresentation {
  return node?.presentation ? { ...DEFAULT_FOOTER_PRESENTATION, ...node.presentation } : { ...LEGACY_PRESENTATION };
}

export function footerDocument(text: string, presentation: FooterPresentation): JSONContent {
  return {
    type: "doc",
    content: text.split("\n").map(line => ({ type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {}) })),
    presentation: { ...presentation },
  };
}
