import { describe, expect, it } from "vitest";
import { defaultHeaderPresentation, documentText, headerDocument, headerPresentation, readHeaderImage, textDocument } from "./document-header";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAvsAAAAASUVORK5CYII=";
describe("cabeçalho do modelo", () => {
  it("preserva texto legado com aspas e caracteres escapados", () => {
    const text = 'Escritório "Marca" \\ Assessoria';
    expect(documentText(textDocument(text))).toBe(text);
    expect(headerPresentation(textDocument(text))).toBeNull();
  });
  it("mantém imagem, posicionamento e texto ao reabrir o modelo", () => {
    const settings = { ...defaultHeaderPresentation("logo"), imageDataUrl: png, align: "right" as const, widthMm: 35 };
    const saved = JSON.parse(JSON.stringify(headerDocument("Marca", settings)));
    expect(headerPresentation(saved)).toEqual(settings);
    expect(documentText(saved)).toBe("Marca");
  });
  it("retornar ao modo textual remove a imagem do documento salvo", () => {
    const saved = headerDocument("Texto preservado", { ...defaultHeaderPresentation("text"), imageDataUrl: png });
    expect(headerPresentation(saved)).toBeNull(); expect(saved).not.toHaveProperty("presentation");
    expect(documentText(saved)).toBe("Texto preservado");
  });
  it("recusa formatos executáveis e arquivos acima do limite antes de ler", async () => {
    await expect(readHeaderImage(new File(["<svg/>"], "marca.svg", { type: "image/svg+xml" }))).rejects.toThrow("PNG ou JPEG");
    await expect(readHeaderImage(new File([new Uint8Array(1024 * 1024 + 1)], "grande.png", { type: "image/png" }))).rejects.toThrow("1 MB");
  });
});
