import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listarTemplates } from "@/features/templates/api";
import { DEFAULT_PAGE_CONFIG, DEFAULT_STYLES } from "@/features/pecas/types";
import type { TemplatePeca } from "@/features/pecas/types";
import { PecaModelSelect } from "./peca-model-select";

vi.mock("@/features/templates/api", () => ({ listarTemplates: vi.fn() }));
const model: TemplatePeca = { id: "modelo-1", nome: "Modelo do escritório", conteudoJson: { type: "doc", content: [{ type: "paragraph" }] },
  pageConfig: { ...DEFAULT_PAGE_CONFIG, marginTop: 40 }, styles: { ...DEFAULT_STYLES, fontFamily: "Arial" },
  headerJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Escritório" }] }] }, footerJson: null,
  dataCriacao: "2026-10-27", dataAtualizacao: "2026-10-27" };

beforeEach(() => { vi.mocked(listarTemplates).mockReset(); vi.mocked(listarTemplates).mockResolvedValue([model]); });

describe("seletor de modelo da peça", () => {
  it("mostra o modelo atual e aplica a apresentação sem copiar conteúdo inicial", async () => {
    const user = userEvent.setup(); const change = vi.fn();
    render(<PecaModelSelect templateId={null} disabled={false} onChange={change} />);
    const select = screen.getByRole("combobox", { name: "Modelo da peça" });
    await waitFor(() => expect(select).toBeEnabled());
    await user.selectOptions(select, model.id);
    expect(change).toHaveBeenCalledWith({ templateId: model.id, pageConfig: model.pageConfig, styles: model.styles, headerJson: model.headerJson, footerJson: null });
    expect(change.mock.calls[0][0]).not.toHaveProperty("conteudoJson");
  });
  it("permite voltar ao padrão e limpar as regiões do modelo anterior", async () => {
    const user = userEvent.setup(); const change = vi.fn();
    render(<PecaModelSelect templateId={model.id} disabled={false} onChange={change} />);
    const select = screen.getByRole("combobox", { name: "Modelo da peça" });
    await waitFor(() => expect(select).toBeEnabled()); expect(select).toHaveValue(model.id);
    await user.selectOptions(select, "");
    expect(change).toHaveBeenCalledWith({ templateId: null, pageConfig: DEFAULT_PAGE_CONFIG, styles: DEFAULT_STYLES, headerJson: null, footerJson: null });
  });
  it("mantém a indicação de um modelo excluído sem alterar a peça", async () => {
    const change = vi.fn(); render(<PecaModelSelect templateId="excluido" disabled={false} onChange={change} />);
    await screen.findByRole("option", { name: "Modelo do escritório" });
    expect(screen.getByRole("combobox")).toHaveValue("excluido"); expect(screen.getByRole("option", { name: "Modelo indisponível" })).toBeDisabled(); expect(change).not.toHaveBeenCalled();
  });
  it("exibe falha de carregamento e permite tentar novamente", async () => {
    const user = userEvent.setup(); vi.mocked(listarTemplates).mockRejectedValueOnce(new Error("Falha ao listar modelos"));
    render(<PecaModelSelect templateId={null} disabled={false} onChange={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao listar modelos");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
  });
});
