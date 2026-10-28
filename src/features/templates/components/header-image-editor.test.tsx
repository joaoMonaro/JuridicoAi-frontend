import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderImageEditor } from "./header-image-editor";
import type { HeaderPresentation } from "../document-header";
import { readHeaderImage } from "../document-header";

vi.mock("../document-header", async importOriginal => ({ ...await importOriginal<typeof import("../document-header")>(), readHeaderImage: vi.fn() }));
function Harness() {
  const [value, setValue] = useState<HeaderPresentation | null>(null);
  return <><HeaderImageEditor value={value} onChange={setValue} /><button type="button" disabled={Boolean(value && !value.imageDataUrl)}>Salvar cabeçalho</button></>;
}
beforeEach(() => { vi.mocked(readHeaderImage).mockReset(); vi.mocked(readHeaderImage).mockResolvedValue("data:image/png;base64,teste"); });
describe("configuração de imagem de cabeçalho", () => {
  it("oferece marca completa e logotipo e exige arquivo antes de salvar", async () => {
    const user = userEvent.setup(); render(<Harness />);
    const mode = screen.getByRole("combobox", { name: "Tipo de cabeçalho" }); expect(mode).toHaveValue("text");
    await user.selectOptions(mode, "banner"); expect(screen.getByRole("button", { name: "Salvar cabeçalho" })).toBeDisabled();
    await user.upload(screen.getByLabelText("Imagem do cabeçalho"), new File(["imagem"], "marca.png", { type: "image/png" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar cabeçalho" })).toBeEnabled());
    await user.selectOptions(mode, "logo");
    expect(screen.getByRole("combobox", { name: "Posição da imagem" })).toHaveValue("left");
    await user.selectOptions(screen.getByRole("combobox", { name: "Posição da imagem" }), "right");
    expect(screen.getByRole("combobox", { name: "Posição da imagem" })).toHaveValue("right");
    await user.click(screen.getByRole("button", { name: "Remover imagem" }));
    expect(screen.getByRole("button", { name: "Salvar cabeçalho" })).toBeDisabled();
    await user.selectOptions(mode, "text"); expect(screen.getByRole("button", { name: "Salvar cabeçalho" })).toBeEnabled();
  });
  it("mostra erro de leitura sem disponibilizar uma imagem inválida", async () => {
    const user = userEvent.setup(); vi.mocked(readHeaderImage).mockRejectedValue(new Error("Arquivo inválido")); render(<Harness />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo de cabeçalho" }), "logo");
    await user.upload(screen.getByLabelText("Imagem do cabeçalho"), new File(["erro"], "marca.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Arquivo inválido");
    expect(screen.getByRole("button", { name: "Salvar cabeçalho" })).toBeDisabled();
  });
});
