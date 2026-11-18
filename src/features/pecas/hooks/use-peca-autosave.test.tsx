import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { atualizarPeca } from "@/features/pecas/api";
import { DEFAULT_PAGE_CONFIG, DEFAULT_STYLES } from "@/features/pecas/types";
import { usePecaAutosave } from "./use-peca-autosave";
import { ApiError } from "@/lib/api-client";

vi.mock("@/features/pecas/api", () => ({ atualizarPeca: vi.fn() }));
const presentation = { templateId: "modelo", pageConfig: DEFAULT_PAGE_CONFIG, styles: DEFAULT_STYLES, headerJson: null, footerJson: null };
beforeEach(() => { vi.mocked(atualizarPeca).mockReset(); });
afterEach(() => vi.useRealTimers());

describe("troca de modelo no autosave", () => {
  it("adota commit externo sem PATCH duplicado e salva o undo na versão seguinte", async () => {
    const persisted = vi.fn();
    const { result } = renderHook(() => usePecaAutosave({ pecaId: "peça", initialVersion: 7, onPersisted: persisted }));
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Aprovado" }] }] };
    act(() => result.current.beginExternalCommit());
    await act(async () => { expect(await result.current.ensurePersisted()).toBe(7); });
    act(() => { result.current.adoptExternalCommit(8, "agora", content); result.current.endExternalCommit(); });
    expect(atualizarPeca).not.toHaveBeenCalled();
    expect(persisted).toHaveBeenCalledWith(8, "agora", { conteudoJson: content });
    vi.mocked(atualizarPeca).mockResolvedValue({ id: "peça", versao: 9, dataAtualizacao: "depois" });
    act(() => result.current.contentChanged({ type: "doc", content: [{ type: "paragraph" }] }));
    await act(async () => { await result.current.flush(); });
    expect(atualizarPeca).toHaveBeenCalledTimes(1);
    expect(atualizarPeca).toHaveBeenCalledWith("peça", 8, { conteudoJson: { type: "doc", content: [{ type: "paragraph" }] } });
  });

  it("recusa adoção de commit externo enquanto há edição pendente ou versão inesperada", () => {
    const { result } = renderHook(() => usePecaAutosave({ pecaId: "peça", initialVersion: 7, onPersisted: vi.fn() }));
    act(() => { result.current.change({ titulo: "Pendente" }); result.current.beginExternalCommit(); });
    expect(() => result.current.adoptExternalCommit(8, "agora", { type: "doc" })).toThrow("reconciliar");
    expect(atualizarPeca).not.toHaveBeenCalled();
  });
  it("aguarda gravação em andamento e drena edições posteriores antes de fornecer a versão para exportar", async () => {
    let finish!: (value: Awaited<ReturnType<typeof atualizarPeca>>) => void;
    vi.mocked(atualizarPeca).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    vi.mocked(atualizarPeca).mockResolvedValue({ id: "peça", versao: 3, dataAtualizacao: "agora" });
    const { result } = renderHook(() => usePecaAutosave({ pecaId: "peça", initialVersion: 1, onPersisted: vi.fn() }));
    let exporting!: Promise<number>;
    act(() => { result.current.change({ titulo: "Antes" }); void result.current.flush(); });
    act(() => { result.current.change({ templateId: "modelo" }); exporting = result.current.prepareExport(); });
    expect(atualizarPeca).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ id: "peça", versao: 2, dataAtualizacao: "agora" }); expect(await exporting).toBe(3); });
    expect(atualizarPeca).toHaveBeenLastCalledWith("peça", 2, { templateId: "modelo" });
    expect(result.current.state).toBe("SALVO");
  });

  it.each([new Error("Sem rede"), new ApiError("Conflito", 409)])("bloqueia exportação quando não consegue salvar: %s", async error => {
    vi.mocked(atualizarPeca).mockRejectedValue(error);
    const { result } = renderHook(() => usePecaAutosave({ pecaId: "peça", initialVersion: 1, onPersisted: vi.fn() }));
    act(() => result.current.change({ titulo: "Não salvo" }));
    await act(async () => { await expect(result.current.prepareExport()).rejects.toThrow("Não foi possível salvar"); });
    expect(result.current.state).toBe(error instanceof ApiError ? "CONFLITO" : "ERRO");
  });

  it("exporta a versão existente sem gravar quando não há alterações", async () => {
    const { result } = renderHook(() => usePecaAutosave({ pecaId: "peça", initialVersion: 7, onPersisted: vi.fn() }));
    expect(await result.current.prepareExport()).toBe(7); expect(atualizarPeca).not.toHaveBeenCalled();
  });

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
