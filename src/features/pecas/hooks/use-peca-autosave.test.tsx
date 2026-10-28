import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { atualizarPeca } from "@/features/pecas/api";
import { DEFAULT_PAGE_CONFIG, DEFAULT_STYLES } from "@/features/pecas/types";
import { usePecaAutosave } from "./use-peca-autosave";

vi.mock("@/features/pecas/api", () => ({ atualizarPeca: vi.fn() }));
const presentation = { templateId: "modelo", pageConfig: DEFAULT_PAGE_CONFIG, styles: DEFAULT_STYLES, headerJson: null, footerJson: null };
beforeEach(() => { vi.mocked(atualizarPeca).mockReset(); });
afterEach(() => vi.useRealTimers());

describe("troca de modelo no autosave", () => {
  it("salva o texto pendente junto do modelo, adota a resposta e mantém a edição durante a requisição", async () => {
    vi.useFakeTimers(); const persisted = vi.fn();
    let finish!: (value: Awaited<ReturnType<typeof atualizarPeca>>) => void;
    vi.mocked(atualizarPeca).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    vi.mocked(atualizarPeca).mockResolvedValue({ id: "peça", versao: 3, dataAtualizacao: "agora" });
    const { result } = renderHook(() => usePecaAutosave({ pecaId: "peça", initialVersion: 1, onPersisted: persisted }));
    const first = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Texto antes" }] }] };
    const second = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Texto depois" }] }] };
    act(() => { result.current.contentChanged(first); result.current.change({ templateId: "modelo" }); void result.current.flush(); });
    expect(atualizarPeca).toHaveBeenCalledWith("peça", 1, { conteudoJson: first, templateId: "modelo" });
    act(() => result.current.contentChanged(second));
    await act(async () => finish({ id: "peça", versao: 2, dataAtualizacao: "agora", apresentacao: presentation }));
    expect(persisted).toHaveBeenCalledWith(2, "agora", { conteudoJson: first, ...presentation });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(atualizarPeca).toHaveBeenLastCalledWith("peça", 2, { conteudoJson: second });
    expect(result.current.state).toBe("SALVO");
  });
  it("não atualiza outra peça quando a resposta chega após sair do editor", async () => {
    let finish!: (value: Awaited<ReturnType<typeof atualizarPeca>>) => void;
    vi.mocked(atualizarPeca).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const persisted = vi.fn(); const { result, unmount } = renderHook(() => usePecaAutosave({ pecaId: "peça", initialVersion: 1, onPersisted: persisted }));
    act(() => { result.current.change({ templateId: "modelo" }); void result.current.flush(); });
    unmount(); await act(async () => finish({ id: "peça", versao: 2, dataAtualizacao: "agora", apresentacao: presentation }));
    expect(persisted).not.toHaveBeenCalled();
  });
});
