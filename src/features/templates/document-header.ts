import type { JSONContent } from "@tiptap/react";

export interface HeaderPresentation {
  mode: "text" | "banner" | "logo";
  imageDataUrl: string | null;
  widthMm: number;
  maxHeightMm: number;
  align: "left" | "center" | "right";
  offsetTopMm: number;
  gapMm: number;
}
export const MAX_HEADER_IMAGE_BYTES = 1024 * 1024;
export function defaultHeaderPresentation(mode: HeaderPresentation["mode"]): HeaderPresentation {
  return { mode, imageDataUrl: null, widthMm: mode === "logo" ? 40 : 150, maxHeightMm: mode === "logo" ? 50 : 30, align: mode === "logo" ? "left" : "center", offsetTopMm: 5, gapMm: 5 };
}
export function documentText(node: JSONContent | null): string {
  return node?.text ?? node?.content?.map(item => documentText(item)).filter(Boolean).join(" ") ?? "";
}
export function headerPresentation(node: JSONContent | null): HeaderPresentation | null {
  const raw = node?.presentation as Partial<HeaderPresentation> | undefined;
  if (!raw || (raw.mode !== "banner" && raw.mode !== "logo")) return null;
  if (!raw.imageDataUrl?.startsWith("data:image/png;base64,") && !raw.imageDataUrl?.startsWith("data:image/jpeg;base64,")) return null;
  return { ...defaultHeaderPresentation(raw.mode), ...raw } as HeaderPresentation;
}
export function textDocument(text: string): JSONContent {
  return { type: "doc", content: text ? [{ type: "paragraph", content: [{ type: "text", text }] }] : [{ type: "paragraph" }] };
}
export function headerDocument(text: string, presentation: HeaderPresentation | null): JSONContent {
  const node = textDocument(text);
  return presentation && presentation.mode !== "text" ? { ...node, presentation } : node;
}
export async function readHeaderImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg"].includes(file.type)) throw new Error("Escolha uma imagem PNG ou JPEG.");
  if (!file.size || file.size > MAX_HEADER_IMAGE_BYTES) throw new Error("A imagem deve ter até 1 MB.");
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Não foi possível ler a imagem.")); reader.readAsDataURL(file);
  });
  await new Promise<void>((resolve, reject) => {
    const image = new Image(); image.onerror = () => reject(new Error("Não foi possível abrir essa imagem."));
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 8192 || image.naturalHeight > 8192 || image.naturalWidth * image.naturalHeight > 16_000_000) reject(new Error("Utilize uma imagem de até 16 megapixels e 8.192 pixels por dimensão."));
      else resolve();
    }; image.src = src;
  });
  return src;
}
