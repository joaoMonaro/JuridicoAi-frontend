import { describe, expect, it } from "vitest";

import { sanitizeExternalUrl } from "./legal-editor-extensions";

describe("sanitizeExternalUrl", () => {
  it("aceita URLs https e http válidas", () => {
    expect(sanitizeExternalUrl("https://www.stj.jus.br/processo")).toBe("https://www.stj.jus.br/processo");
    expect(sanitizeExternalUrl("  http://exemplo.com.br/doc  ")).toBe("http://exemplo.com.br/doc");
  });

  it("controla a permissão do esquema mailto conforme o parâmetro allowMailto", () => {
    expect(sanitizeExternalUrl("mailto:contato@escritorio.com.br", false)).toBeNull();
    expect(sanitizeExternalUrl("mailto:contato@escritorio.com.br", true)).toBe("mailto:contato@escritorio.com.br");
  });

  it("rejeita esquemas executáveis ou inseguros (javascript, data, vbscript, file)", () => {
    expect(sanitizeExternalUrl("javascript:alert(1)", true)).toBeNull();
    expect(sanitizeExternalUrl("JAVASCRIPT:alert(document.cookie)", true)).toBeNull();
    expect(sanitizeExternalUrl("data:text/html,<script>alert(1)</script>", true)).toBeNull();
    expect(sanitizeExternalUrl("vbscript:msgbox(1)", true)).toBeNull();
    expect(sanitizeExternalUrl("file:///etc/passwd", true)).toBeNull();
    expect(sanitizeExternalUrl("", true)).toBeNull();
    expect(sanitizeExternalUrl(null, true)).toBeNull();
  });
});
