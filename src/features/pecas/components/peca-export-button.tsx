import { Download, LoaderCircle } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { exportarPeca } from "@/features/pecas/api";
import type { ExportFormat } from "@/features/pecas/api";

interface Props { pecaId: string; disabled: boolean; prepareExport: () => Promise<number> }

export function PecaExportButton({ pecaId, disabled, prepareExport }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function download(format: ExportFormat) {
    if (request.current || disabled) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    try {
      const version = await prepareExport();
      if (controller.signal.aborted) return;
      const file = await exportarPeca(pecaId, version, format, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível exportar a peça. Tente novamente.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (request.current === controller) request.current = null;
    }
  }

  return <div className="flex flex-wrap items-center justify-end gap-2">
    {error && <span role="alert" className="max-w-80 text-xs text-destructive">{error}</span>}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild><Button type="button" size="sm" variant="outline" disabled={disabled || busy}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Download />}{busy ? <span role="status">Preparando arquivo…</span> : "Exportar"}
      </Button></DropdownMenu.Trigger>
      <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-44 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md">
        <DropdownMenu.Item onSelect={() => void download("docx")} className="cursor-pointer rounded px-3 py-2 outline-none focus:bg-accent">Word (.docx)</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => void download("pdf")} className="cursor-pointer rounded px-3 py-2 outline-none focus:bg-accent">PDF (.pdf)</DropdownMenu.Item>
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>
  </div>;
}
