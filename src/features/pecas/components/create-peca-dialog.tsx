import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarPeca } from "@/features/pecas/api";
import type { Peca } from "@/features/pecas/types";
import { listarTemplates } from "@/features/templates/api";
import type { TemplatePeca } from "@/features/pecas/types";

interface Props { casoId: string; open: boolean; onClose: () => void; onCreated: (peca: Peca) => void }

export function CreatePecaDialog({ casoId, open, onClose, onCreated }: Props) {
  const [titulo, setTitulo] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templates, setTemplates] = useState<TemplatePeca[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    // A abertura do diálogo inicia uma nova consulta externa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingTemplates(true);
    listarTemplates(controller.signal).then(setTemplates).catch(() => setError("Não foi possível carregar os modelos." )).finally(() => setLoadingTemplates(false));
    return () => controller.abort();
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!titulo.trim()) return;
    setSubmitting(true); setError("");
    try { const result = await criarPeca(casoId, titulo.trim(), templateId); onCreated(result); setTitulo(""); setTemplateId(""); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar a peça."); }
    finally { setSubmitting(false); }
  }

  return <Modal open={open} onClose={onClose} title="Nova Peça" description="Crie um documento vazio ou use um modelo do escritório.">
    <form onSubmit={submit} className="space-y-5 p-5">
      <label className="block space-y-2 text-sm"><span>Título <b className="text-primary">*</b></span><Input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} placeholder="Ex.: Petição inicial" /></label>
      <label className="block space-y-2 text-sm"><span>Modelo</span>
        <select className="h-9 w-full border bg-background px-3 text-sm outline-none focus:border-ring" value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={loadingTemplates}>
          <option value="">{loadingTemplates ? "Carregando modelos..." : "Sem modelo"}</option>
          {templates.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
        {!loadingTemplates && templates.length === 0 && <span className="text-xs text-muted-foreground">Nenhum modelo disponível. A peça usará a configuração padrão.</span>}
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!titulo.trim() || submitting}>{submitting && <LoaderCircle className="animate-spin" />}{submitting ? "Criando..." : "Criar Peça"}</Button></div>
    </form>
  </Modal>;
}
