import { CircleAlert, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TipoContextoCasoEnum } from "@/enums";
import { atualizarContexto, criarContexto } from "@/features/contextos/api";
import { CONTEXTO_TIPO_OPTIONS } from "@/features/contextos/contexto-options";
import type { ContextoCaso, ContextoCasoInput } from "@/features/contextos/types";

const TITLE_MAX_LENGTH = 200;
const CONTENT_MAX_LENGTH = 50_000;

interface Props {
  casoId: string;
  contexto?: ContextoCaso;
  onClose: () => void;
  onSaved: (contexto: ContextoCaso) => void;
}

export function ContextoFormDialog({ casoId, contexto, onClose, onSaved }: Props) {
  const [values, setValues] = useState<ContextoCasoInput>({
    tipo: contexto?.tipo ?? "RelatoInicial",
    titulo: contexto?.titulo ?? "",
    conteudo: contexto?.conteudo ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const contentLength = values.conteudo.length;
  const isValid = useMemo(() => values.conteudo.trim().length > 0 && contentLength <= CONTENT_MAX_LENGTH, [contentLength, values.conteudo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError("");
    const input = {
      tipo: values.tipo,
      titulo: values.titulo.trim(),
      conteudo: values.conteudo.trim(),
    };

    try {
      const saved = contexto
        ? await atualizarContexto(casoId, contexto.id, input)
        : await criarContexto(casoId, input);
      onSaved(saved);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar o contexto.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={contexto ? "Editar contexto" : "Novo contexto"}
      description="Registre informações que poderão apoiar a análise e a elaboração das peças do caso."
    >
      <form onSubmit={submit} noValidate className="space-y-5 p-5">
        <label className="block space-y-2 text-sm">
          <span>Tipo <b className="text-primary" aria-hidden="true">*</b></span>
          <select
            autoFocus
            value={values.tipo}
            onChange={(event) => setValues((current) => ({ ...current, tipo: event.target.value as TipoContextoCasoEnum }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            {CONTEXTO_TIPO_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <label className="block space-y-2 text-sm">
          <span className="flex items-center justify-between gap-4">
            <span>Título <span className="text-xs text-muted-foreground">(opcional)</span></span>
            <span className="text-xs tabular-nums text-muted-foreground">{values.titulo.length}/{TITLE_MAX_LENGTH}</span>
          </span>
          <Input
            value={values.titulo}
            maxLength={TITLE_MAX_LENGTH}
            onChange={(event) => setValues((current) => ({ ...current, titulo: event.target.value }))}
            placeholder="Ex.: Relato do cliente"
          />
        </label>

        <label className="block space-y-2 text-sm">
          <span className="flex items-center justify-between gap-4">
            <span>Conteúdo <b className="text-primary" aria-hidden="true">*</b></span>
            <span className="text-xs tabular-nums text-muted-foreground">{contentLength.toLocaleString("pt-BR")}/{CONTENT_MAX_LENGTH.toLocaleString("pt-BR")}</span>
          </span>
          <Textarea
            value={values.conteudo}
            maxLength={CONTENT_MAX_LENGTH}
            rows={10}
            onChange={(event) => setValues((current) => ({ ...current, conteudo: event.target.value }))}
            placeholder="Descreva os fatos, observações ou informações relevantes para o caso."
            aria-invalid={contentLength > 0 && !values.conteudo.trim()}
          />
          <span className="block text-xs text-muted-foreground">O conteúdo é obrigatório e deve possuir pelo menos um caractere.</span>
        </label>

        {error ? <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{error}</span></div> : null}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="submit" disabled={!isValid || submitting} className="min-w-24">
            {submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {submitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
