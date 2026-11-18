import { AlertTriangle, CircleAlert, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssistantMonthlyLimit } from "@/features/ai-assistant/types";

interface Props {
  limit: AssistantMonthlyLimit | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

function clampPct(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function formatPct(value: number | null | undefined): string {
  const clamped = clampPct(value);
  return Number.isInteger(clamped)
    ? `${clamped}%`
    : `${clamped.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function MonthlyLimitBanner({ limit, loading, error, onRetry }: Props) {
  if (error) {
    return (
      <div role="alert" className="mb-2 flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
        <div className="flex items-start gap-2">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <p className="font-medium">Não foi possível consultar o limite mensal.</p>
            <p className="mt-0.5 text-[11px] opacity-90">{error}</p>
          </div>
        </div>
        <Button type="button" size="xs" variant="outline" onClick={onRetry}>
          <RotateCcw className="size-3" />
          Atualizar
        </Button>
      </div>
    );
  }

  if (loading && !limit) {
    return (
      <div role="status" className="mb-2 flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <LoaderCircle className="size-3 animate-spin" />
        Consultando limite mensal...
      </div>
    );
  }

  if (!limit) return null;

  if (limit.estado === "Indisponivel") {
    return (
      <div role="alert" className="mb-2 flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
        <div className="flex items-start gap-2">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{limit.mensagemStatus || "O controle de limite mensal está indisponível no momento."}</span>
        </div>
        <Button type="button" size="xs" variant="outline" disabled={loading} onClick={onRetry}>
          <RotateCcw className="size-3" />
          Atualizar
        </Button>
      </div>
    );
  }

  const usedPct = clampPct(limit.percentualUtilizado);
  const reservedPct = clampPct(limit.percentualReservado);
  const availablePct = clampPct(limit.percentualDisponivel);
  const reservedWidth = Math.min(100 - usedPct, reservedPct);

  const isBlocked = limit.bloqueadoParaNovasChamadas || limit.estado === "Atingido";
  const isCritical = limit.estado === "Critico90";
  const isAttention = limit.estado === "Atencao70";

  const headline = limit.estado === "Atingido"
    ? "Limite mensal atingido"
    : isBlocked
      ? (limit.mensagemStatus || "Limite disponível insuficiente para esta operação.")
      : isCritical
        ? (limit.mensagemStatus || `Restam ${formatPct(availablePct)} do limite mensal`)
        : isAttention
          ? (limit.mensagemStatus || `Você utilizou ${formatPct(usedPct)} do limite mensal`)
          : `Limite mensal: ${formatPct(usedPct)} utilizado`;

  const containerClass = isBlocked
    ? "border-destructive/35 bg-destructive/10 text-destructive"
    : isCritical || isAttention
      ? "border-warning/40 bg-warning/10 text-foreground"
      : "border-border bg-muted/30 text-foreground";

  return (
    <section
      aria-label="Consumo do limite mensal"
      role={isBlocked || isCritical || isAttention ? "status" : undefined}
      className={`mb-2 rounded-md border px-2.5 py-2 text-[11px] ${containerClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium">
          {isBlocked ? <CircleAlert className="size-3.5 shrink-0" /> : isCritical || isAttention ? <AlertTriangle className="size-3.5 shrink-0 text-warning" /> : null}
          {headline}
        </span>
        <span className="shrink-0 text-[10px]">
          Restam {formatPct(availablePct)}
        </span>
      </div>

      <div
        className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-background/60"
        role="progressbar"
        aria-label="Percentual do limite mensal utilizado"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={usedPct}
      >
        <div className={isBlocked ? "bg-destructive" : isCritical || isAttention ? "bg-warning" : "bg-primary"} style={{ width: `${usedPct}%` }} />
        {reservedWidth > 0 ? <div className="bg-primary/40" style={{ width: `${reservedWidth}%` }} title="Reservado em andamento" /> : null}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>Utilizado: {formatPct(usedPct)}</span>
          {limit.possuiReservasEmAndamento && reservedPct > 0 ? <span>· Reservado em andamento: {formatPct(reservedPct)}</span> : null}
          <span>· Disponível: {formatPct(availablePct)}</span>
        </div>
        {isBlocked ? (
          <Button type="button" size="xs" variant="outline" className="h-5 px-1.5 text-[10px]" disabled={loading} onClick={onRetry}>
            <RotateCcw className="size-2.5" />
            Atualizar
          </Button>
        ) : null}
      </div>
    </section>
  );
}
