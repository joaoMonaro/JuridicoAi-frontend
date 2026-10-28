import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { listarTemplates } from "@/features/templates/api";
import { DEFAULT_PAGE_CONFIG, DEFAULT_STYLES } from "@/features/pecas/types";
import type { PecaApresentacao, TemplatePeca } from "@/features/pecas/types";

interface Props {
  templateId: string | null;
  disabled: boolean;
  onChange: (apresentacao: PecaApresentacao) => void;
  actions?: ReactNode;
}

export function PecaModelSelect({ templateId, disabled, onChange, actions }: Props) {
  const [models, setModels] = useState<TemplatePeca[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    void listarTemplates(controller.signal).then(items => {
      if (!controller.signal.aborted) { setModels(items); setError(""); }
    }).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível carregar os modelos.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, []);

  useEffect(() => { load(); return () => request.current?.abort(); }, [load]);
  const missing = templateId && !models.some(model => model.id === templateId);

  return <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
    <label className="flex items-center gap-2">
      <span className="text-muted-foreground">Modelo</span>
      <select aria-label="Modelo da peça" className="h-8 max-w-64 rounded-md border bg-background px-2 text-xs"
        value={templateId ?? ""} disabled={disabled || loading || Boolean(error)} onFocus={load}
        onChange={event => {
          const model = models.find(item => item.id === event.target.value);
          onChange({ templateId: model?.id ?? null, pageConfig: { ...(model?.pageConfig ?? DEFAULT_PAGE_CONFIG) },
            styles: { ...(model?.styles ?? DEFAULT_STYLES) }, headerJson: model?.headerJson ?? null, footerJson: model?.footerJson ?? null });
        }}>
        <option value="">{loading ? "Carregando modelos…" : "Sem modelo"}</option>
        {missing ? <option value={templateId} disabled>Modelo indisponível</option> : null}
        {models.map(model => <option key={model.id} value={model.id}>{model.nome}</option>)}
      </select>
    </label>
    {error ? <><span role="alert" className="text-destructive">{error}</span><Button type="button" size="xs" variant="ghost" onClick={load}>Tentar novamente</Button></> : null}
    {actions && <div className="ml-auto">{actions}</div>}
  </div>;
}
