import type { JSONContent } from "@tiptap/react";
import { documentText, headerPresentation } from "@/features/templates/document-header";
import type { PageConfig } from "@/features/pecas/types";

export function DocumentHeader({ value, page, dark = false }: { value: JSONContent | null; page: PageConfig; dark?: boolean }) {
  const image = headerPresentation(value); const text = documentText(value);
  if (!image) return text ? <div className="absolute inset-x-0 top-5 px-12 text-center text-[10px]" style={{ color: dark ? "#9aa9b7" : "#66717d" }}>{text}</div> : null;
  const usableWidth = Math.max(1, 210 - page.marginLeft - page.marginRight);
  return <div data-document-header="image" style={{ marginTop: `${image.offsetTopMm - page.marginTop}mm`, minHeight: `${Math.max(0, page.marginTop - image.offsetTopMm)}mm`, paddingBottom: `${image.gapMm}mm`, textAlign: image.align, boxSizing: "border-box" }}>
    <img src={image.imageDataUrl ?? undefined} alt={image.mode === "logo" ? "Logotipo do modelo" : "Imagem de cabeçalho do modelo"}
      style={{ display: "inline-block", width: `${Math.min(100, image.widthMm / usableWidth * 100)}%`, height: "auto", maxHeight: `${image.maxHeightMm}mm`, maxWidth: "100%", objectFit: "contain", objectPosition: `${image.align} top`, verticalAlign: "top" }} />
    {text ? <div className="mt-1 text-[10px]" style={{ color: dark ? "#9aa9b7" : "#66717d", whiteSpace: "pre-wrap" }}>{text}</div> : null}
  </div>;
}
