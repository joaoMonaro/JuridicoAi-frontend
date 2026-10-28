import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { DocumentFooter } from "@/features/pecas/editor/document-footer";
import { DEFAULT_PAGE_CONFIG } from "@/features/pecas/types";
import { DEFAULT_FOOTER_PRESENTATION, footerDocument, footerPresentation, footerText } from "./document-footer";

describe("rodapé textual", () => {
  it("mantém linhas vazias, aspas e apresentação ao salvar e reabrir", () => {
    const text = 'Escritório "Teste"\n\nRua Exemplo · contato@example.test\n';
    const settings = { ...DEFAULT_FOOTER_PRESENTATION, color: "#163255", align: "right" as const, separator: true, offsetBottomMm: 8 };
    const saved = JSON.parse(JSON.stringify(footerDocument(text, settings)));
    expect(footerText(saved)).toBe(text);
    expect(footerPresentation(saved)).toEqual(settings);
    render(createElement(DocumentFooter, { value: saved, page: DEFAULT_PAGE_CONFIG }));
    const footer = screen.getByText(/Escritório/).parentElement;
    expect(footer).toHaveStyle({ textAlign: "right", fontSize: "9pt", paddingBottom: "8mm" });
    expect(screen.getByText(/Escritório/)).toHaveStyle({ whiteSpace: "pre-wrap", borderTopStyle: "solid", borderTopWidth: "1px" });
  });

  it("lê documentos antigos sem inserir espaços nas marcas e preserva quebras explícitas", () => {
    const legacy = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "contato" }, { type: "text", text: "@example.test", marks: [{ type: "bold" }] }, { type: "hardBreak" }, { type: "text", text: "Telefone" }] },
      { type: "paragraph", content: [{ type: "text", text: "Endereço" }] },
    ] };
    expect(footerText(legacy)).toBe("contato@example.test\nTelefone\nEndereço");
    expect(footerPresentation(legacy)).toMatchObject({ fontSize: 7.5, align: "center", separator: false });
    expect(footerPresentation({ type: "doc", presentation: { align: "left" } })).toEqual({ ...DEFAULT_FOOTER_PRESENTATION, align: "left" });
  });

  it("não reserva uma área de rodapé para texto vazio", () => {
    const { container } = render(createElement(DocumentFooter, { value: footerDocument("\n  ", DEFAULT_FOOTER_PRESENTATION), page: DEFAULT_PAGE_CONFIG }));
    expect(container).toBeEmptyDOMElement();
  });
});
