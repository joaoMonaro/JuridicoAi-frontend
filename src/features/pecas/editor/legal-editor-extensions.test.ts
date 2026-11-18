import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { createLegalEditorExtensions, sanitizeExternalUrl } from "./legal-editor-extensions";

describe("sanitizeExternalUrl", () => {
  it("aceita URLs https e http válidas", () => {
    expect(sanitizeExternalUrl("https://www.stj.jus.br/processo")).toBe("https://www.stj.jus.br/processo");
    expect(sanitizeExternalUrl("  http://exemplo.com.br/doc  ")).toBe("http://exemplo.com.br/doc");
  });

  it("controla a permissão do esquema mailto conforme o parâmetro allowMailto", () => {
    expect(sanitizeExternalUrl("mailto:contato@escritorio.com.br", false)).toBeNull();
    expect(sanitizeExternalUrl("mailto:contato@escritorio.com.br", true)).toBe("mailto:contato@escritorio.com.br");
  });

  it("rejeita esquemas não permitidos", () => {
    expect(sanitizeExternalUrl("ftp://arquivos.exemplo.com", true)).toBeNull();
    expect(sanitizeExternalUrl("custom-scheme://acao", true)).toBeNull();
    expect(sanitizeExternalUrl("file:///caminho/local", true)).toBeNull();
    expect(sanitizeExternalUrl("", true)).toBeNull();
    expect(sanitizeExternalUrl(null, true)).toBeNull();
  });

  it("bloqueia a criação de links com protocolos não autorizados na instância do editor TipTap", () => {
    const editor = new Editor({
      extensions: createLegalEditorExtensions(),
      content: "<p>Referência jurisprudencial</p>",
    });

    editor.commands.selectAll();
    editor.commands.setLink({ href: "custom-scheme://nao-autorizado" });
    expect(editor.getHTML()).not.toContain("<a ");

    editor.commands.setLink({ href: "https://www.stj.jus.br" });
    expect(editor.getHTML()).toContain('href="https://www.stj.jus.br"');

    editor.destroy();
  });
});
