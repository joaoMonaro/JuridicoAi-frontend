import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultHeaderPresentation, readHeaderImage } from "../document-header";
import type { HeaderPresentation } from "../document-header";

interface Props { value: HeaderPresentation | null; onChange: (value: HeaderPresentation | null) => void; preview?: ReactNode }
export function HeaderImageEditor({ value, onChange, preview }: Props) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const upload = useRef(0);
  useEffect(() => () => { upload.current++; }, []);
  const set = <K extends keyof HeaderPresentation>(key: K, next: HeaderPresentation[K]) => { if (value) onChange({ ...value, [key]: next }); };
  return <fieldset disabled={busy} className="space-y-3 rounded border p-3">
    <legend className="px-1 text-xs font-semibold">Cabeçalho</legend>
    <label className="grid gap-1 text-xs"><span>Tipo de cabeçalho</span><select className="h-9 rounded border bg-background px-2" value={value?.mode ?? "text"} disabled={busy} onChange={event => {
      const mode = event.target.value as HeaderPresentation["mode"]; setError("");
      onChange(mode === "text" ? null : { ...defaultHeaderPresentation(mode), imageDataUrl: value?.imageDataUrl ?? null });
    }}><option value="text">Apenas texto</option><option value="banner">Imagem de cabeçalho</option><option value="logo">Logotipo</option></select></label>
    {value ? <>
      <p className="text-xs text-muted-foreground">{value.mode === "banner" ? "Envie a composição pronta da marca, com nome e demais elementos." : "Envie o símbolo ou logotipo e escolha sua posição na página."} A proporção da imagem será preservada.</p>
      <label className="grid gap-2 text-xs"><span>{busy ? "Lendo imagem…" : "Arquivo PNG ou JPEG · até 1 MB"}</span><input type="file" aria-label="Imagem do cabeçalho" accept="image/png,image/jpeg" disabled={busy} onChange={event => {
        const file = event.target.files?.[0]; if (!file) return;
        const request = ++upload.current; setBusy(true); setError("");
        onChange({ ...value, imageDataUrl: null });
        void readHeaderImage(file).then(imageDataUrl => { if (upload.current === request) onChange({ ...value, imageDataUrl }); })
          .catch(e => { if (upload.current === request) setError(e instanceof Error ? e.message : "Não foi possível ler a imagem."); })
          .finally(() => { if (upload.current === request) setBusy(false); });
        event.target.value = "";
      }} /></label>
      {value.imageDataUrl ? <Button type="button" variant="ghost" size="xs" onClick={() => set("imageDataUrl", null)}>Remover imagem</Button> : <p className="text-xs text-muted-foreground">Escolha uma imagem para salvar este cabeçalho.</p>}
      {preview}
      <label className="grid gap-1 text-xs"><span>Largura (mm)</span><Input type="number" min={5} max={210} step="0.5" value={value.widthMm} onChange={event => set("widthMm", Number(event.target.value))} /></label>
      <label className="grid gap-1 text-xs"><span>Posição da imagem</span><select className="h-9 rounded border bg-background px-2" value={value.align} onChange={event => set("align", event.target.value as HeaderPresentation["align"])}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
      <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Ajustar altura e espaçamento</summary><div className="mt-3 grid grid-cols-2 gap-3">
        {([["maxHeightMm", "Altura máxima (mm)", 5, 50], ["offsetTopMm", "Distância do topo (mm)", 0, 30], ["gapMm", "Distância do texto da peça (mm)", 0, 20]] as const).map(([key, label, min, max]) => <label key={key} className="grid gap-1"><span>{label}</span><Input type="number" min={min} max={max} step="0.5" value={value[key]} onChange={event => set(key, Number(event.target.value))} /></label>)}
      </div></details>
    </> : null}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </fieldset>;
}
