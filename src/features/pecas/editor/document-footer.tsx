import type { JSONContent } from "@tiptap/react";
import type { PageConfig } from "@/features/pecas/types";
import { footerPresentation, footerText } from "@/features/templates/document-footer";

export function DocumentFooter({ value, page }: { value: JSONContent | null; page: PageConfig }) {
  const text = footerText(value);
  if (!text.trim()) return null;
  const settings = footerPresentation(value);
  return <div data-document-footer="text" style={{
    marginTop: "auto", flexShrink: 0, boxSizing: "border-box",
    minHeight: `${page.marginBottom}mm`, paddingTop: "4mm", paddingBottom: `${settings.offsetBottomMm}mm`,
    color: settings.color, fontSize: `${settings.fontSize}pt`, lineHeight: 1.3, textAlign: settings.align,
  }}>
    <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", borderTop: settings.separator ? "1px solid currentColor" : undefined, paddingTop: settings.separator ? "2mm" : undefined }}>{text}</div>
  </div>;
}
