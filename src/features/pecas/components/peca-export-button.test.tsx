import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportarPeca } from "@/features/pecas/api";
import { PecaExportButton } from "./peca-export-button";

vi.mock("@/features/pecas/api", () => ({ exportarPeca: vi.fn() }));
beforeEach(() => {
  vi.mocked(exportarPeca).mockReset();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  URL.createObjectURL = vi.fn(() => "blob:arquivo");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function chooseWord() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Exportar" }), { button: 0, ctrlKey: false, pointerType: "mouse" });
  await userEvent.click(await screen.findByRole("menuitem", { name: "Word (.docx)" }));
}

describe("download da peça", () => {
  it("aguarda o salvamento antes de pedir o arquivo e desabilita novo pedido enquanto prepara", async () => {
    let finish!: (version: number) => void;
    const prepare = vi.fn(() => new Promise<number>(resolve => { finish = resolve; }));
    vi.mocked(exportarPeca).mockResolvedValue({ blob: new Blob(["docx"]), name: "Peça.docx" });
    render(<PecaExportButton pecaId="peça" disabled={false} prepareExport={prepare} />);
    await chooseWord(); expect(prepare).toHaveBeenCalledOnce(); expect(exportarPeca).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Preparando arquivo…" })).toBeDisabled();
    await act(async () => finish(7));
    await waitFor(() => expect(exportarPeca).toHaveBeenCalledWith("peça", 7, "docx", expect.any(AbortSignal)));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it("mostra falha de salvamento sem solicitar uma versão anterior", async () => {
    render(<PecaExportButton pecaId="peça" disabled={false} prepareExport={async () => { throw new Error("Conflito na peça"); }} />);
    await chooseWord(); expect(await screen.findByRole("alert")).toHaveTextContent("Conflito na peça");
    expect(exportarPeca).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Exportar" })).toBeEnabled();
  });

  it("cancela o download quando sai do editor", async () => {
    let signal!: AbortSignal;
    vi.mocked(exportarPeca).mockImplementation((_id, _version, _format, abort) => { signal = abort; return new Promise(() => {}); });
    const { unmount } = render(<PecaExportButton pecaId="peça" disabled={false} prepareExport={async () => 1} />);
    await chooseWord(); await waitFor(() => expect(exportarPeca).toHaveBeenCalledOnce());
    unmount(); expect(signal.aborted).toBe(true); expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
});
