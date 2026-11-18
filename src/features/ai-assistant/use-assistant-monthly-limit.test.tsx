import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAssistantMonthlyLimit } from "./api";
import type { AssistantMonthlyLimit } from "./types";
import { useAssistantMonthlyLimit } from "./use-assistant-monthly-limit";

vi.mock("./api", () => ({ getAssistantMonthlyLimit: vi.fn() }));

const getLimit = vi.mocked(getAssistantMonthlyLimit);

function summary(used = 10, reserved = 10): AssistantMonthlyLimit {
  return {
    periodoReferencia: new Date().toISOString().slice(0, 7),
    estado: "Disponivel",
    percentualUtilizado: used,
    percentualReservado: reserved,
    percentualDisponivel: 100 - used - reserved,
    possuiReservasEmAndamento: reserved > 0,
    bloqueadoParaNovasChamadas: false,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
  getLimit.mockReset();
});

afterEach(() => { vi.useRealTimers(); });

describe("consulta do limite mensal", () => {
  it("aguarda uma consulta lenta em vez de cancelá-la a cada intervalo", async () => {
    let resolveSlow!: (value: AssistantMonthlyLimit) => void;
    let slowSignal: AbortSignal | undefined;
    const slowResponse = new Promise<AssistantMonthlyLimit>((resolve) => { resolveSlow = resolve; });
    getLimit.mockResolvedValue(summary())
      .mockResolvedValueOnce(summary())
      .mockImplementationOnce((signal) => {
        slowSignal = signal;
        return slowResponse;
      });

    const { result } = renderHook(() => useAssistantMonthlyLimit(true, true));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(getLimit).toHaveBeenCalledTimes(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(7500); });
    expect(getLimit).toHaveBeenCalledTimes(2);
    expect(slowSignal?.aborted).toBe(false);

    await act(async () => { resolveSlow(summary(20, 0)); });
    expect(result.current.limit?.percentualUtilizado).toBe(20);
  });

  it("renova o temporizador até a virada real de um mês maior que o limite do navegador", async () => {
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    getLimit.mockImplementation(async () => summary(new Date().getUTCMonth() === 10 ? 100 : 0, 0));
    const { result } = renderHook(() => useAssistantMonthlyLimit(true, false));
    await act(async () => { await Promise.resolve(); });
    expect(getLimit).toHaveBeenCalledTimes(1);

    const maxBrowserTimeout = 2_147_483_647;
    await act(async () => { await vi.advanceTimersByTimeAsync(maxBrowserTimeout); });
    expect(getLimit).toHaveBeenCalledTimes(1);

    const remaining = Date.parse("2026-12-01T00:00:02Z") - Date.now();
    await act(async () => { await vi.advanceTimersByTimeAsync(remaining); });
    expect(getLimit).toHaveBeenCalledTimes(2);
    expect(result.current.limit?.periodoReferencia).toBe("2026-12");
    expect(result.current.limit?.percentualUtilizado).toBe(0);
  });
});
