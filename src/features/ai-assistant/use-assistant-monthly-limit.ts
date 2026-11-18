import { useCallback, useEffect, useRef, useState } from "react";
import { getAssistantMonthlyLimit } from "@/features/ai-assistant/api";
import type { AssistantMonthlyLimit } from "@/features/ai-assistant/types";

const reservationPollMs = 2500;
const maxTimeoutMs = 2_147_483_647;

function currentUtcPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function msUntilNextUtcMonth(): number {
  const now = new Date();
  const nextMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 1);
  return Math.min(maxTimeoutMs, Math.max(1000, nextMonthStart - now.getTime()));
}

export function useAssistantMonthlyLimit(enabled: boolean, activeDurable: boolean) {
  const [limit, setLimit] = useState<AssistantMonthlyLimit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError("");
    try {
      const data = await getAssistantMonthlyLimit(abort.signal);
      if (abort.signal.aborted || seq !== requestSeq.current) return;
      setLimit(data);
    } catch (failure) {
      if (abort.signal.aborted || seq !== requestSeq.current) return;
      setLimit(null);
      setError(failure instanceof Error ? failure.message : "Não foi possível consultar o limite mensal.");
    } finally {
      if (!abort.signal.aborted && seq === requestSeq.current) setLoading(false);
      if (controller.current === abort) controller.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      controller.current?.abort();
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
      controller.current?.abort();
    };
  }, [enabled, refresh]);

  const hasRemoteReservations = Boolean(limit?.possuiReservasEmAndamento);
  const periodChanged = Boolean(limit?.periodoReferencia && limit.periodoReferencia !== currentUtcPeriod());

  useEffect(() => {
    if (!enabled || (!activeDurable && !hasRemoteReservations)) return;
    const timer = window.setInterval(() => {
      if (!controller.current || controller.current.signal.aborted) void refresh();
    }, reservationPollMs);
    return () => { window.clearInterval(timer); };
  }, [enabled, activeDurable, hasRemoteReservations, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => { void refresh(); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    if (periodChanged) {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) void refresh();
      });
      return () => { cancelled = true; };
    }
    let cancelled = false;
    let timer: ReturnType<typeof window.setTimeout>;
    const referencePeriod = limit?.periodoReferencia ?? currentUtcPeriod();
    const checkPeriod = () => {
      if (cancelled) return;
      if (referencePeriod !== currentUtcPeriod()) void refresh();
      else timer = window.setTimeout(checkPeriod, msUntilNextUtcMonth());
    };
    timer = window.setTimeout(checkPeriod, msUntilNextUtcMonth());
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [enabled, periodChanged, limit?.periodoReferencia, refresh]);

  return { limit, loading, error, refresh };
}
