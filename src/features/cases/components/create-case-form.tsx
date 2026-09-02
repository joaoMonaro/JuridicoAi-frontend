import { CircleAlert, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { navigate } from "@/app/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { createCase } from "@/features/cases/api/create-case";
import type { CreateCaseInput } from "@/features/cases/types/case";

const TITLE_MAX_LENGTH = 120;
const TITLE_MIN_LENGTH = 5;
const DESCRIPTION_MAX_LENGTH = 1000;

type FormErrors = Partial<Record<keyof CreateCaseInput, string>>;

function validate(values: CreateCaseInput): FormErrors {
  const errors: FormErrors = {};
  const title = values.titulo.trim();
  const description = values.descricao.trim();

  if (!title) errors.titulo = "Informe um título para o caso.";
  else if (title.length < TITLE_MIN_LENGTH) errors.titulo = `Use pelo menos ${TITLE_MIN_LENGTH} caracteres.`;
  if (!description) errors.descricao = "Informe uma breve descrição do caso.";

  return errors;
}

export function CreateCaseForm() {
  const [values, setValues] = useState<CreateCaseInput>({ titulo: "", descricao: "" });
  const [touched, setTouched] = useState<Record<keyof CreateCaseInput, boolean>>({ titulo: false, descricao: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const errors = useMemo(() => validate(values), [values]);
  const isValid = Object.keys(errors).length === 0;

  function resetForm() {
    setValues({ titulo: "", descricao: "" });
    setTouched({ titulo: false, descricao: false });
    setSubmitError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ titulo: true, descricao: true });
    if (!isValid || submitting) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      const createdCase = await createCase({ titulo: values.titulo.trim(), descricao: values.descricao.trim() });
      navigate(`/casos/${createdCase.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível criar o caso.");
    } finally {
      setSubmitting(false);
    }
  }

  const titleError = touched.titulo ? errors.titulo : undefined;
  const descriptionError = touched.descricao ? errors.descricao : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-lg border bg-card shadow-sm">
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="case-title" className="text-sm font-medium">Título do caso <span className="text-primary" aria-hidden="true">*</span></label>
            <span className="text-xs tabular-nums text-muted-foreground">{values.titulo.length}/{TITLE_MAX_LENGTH}</span>
          </div>
          <Input
            id="case-title"
            name="titulo"
            autoFocus
            maxLength={TITLE_MAX_LENGTH}
            placeholder="Ex.: Negativação indevida - João da Silva"
            value={values.titulo}
            onChange={(event) => setValues((current) => ({ ...current, titulo: event.target.value }))}
            onBlur={() => setTouched((current) => ({ ...current, titulo: true }))}
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? "case-title-help case-title-error" : "case-title-help"}
          />
          <p id="case-title-help" className="text-xs text-muted-foreground">Identificação breve e clara do caso para facilitar a organização.</p>
          {titleError && <p id="case-title-error" role="alert" className="text-xs text-destructive">{titleError}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="case-description" className="text-sm font-medium">Descrição <span className="text-primary" aria-hidden="true">*</span></label>
            <span className="text-xs tabular-nums text-muted-foreground">{values.descricao.length}/{DESCRIPTION_MAX_LENGTH}</span>
          </div>
          <Textarea
            id="case-description"
            name="descricao"
            rows={6}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder="Ex.: Cliente relata dívida desconhecida."
            value={values.descricao}
            onChange={(event) => setValues((current) => ({ ...current, descricao: event.target.value }))}
            onBlur={() => setTouched((current) => ({ ...current, descricao: true }))}
            aria-invalid={Boolean(descriptionError)}
            aria-describedby={descriptionError ? "case-description-help case-description-error" : "case-description-help"}
          />
          <p id="case-description-help" className="text-xs text-muted-foreground">Descreva resumidamente o caso e o problema relatado pelo cliente.</p>
          {descriptionError && <p id="case-description-error" role="alert" className="text-xs text-destructive">{descriptionError}</p>}
        </div>

        {submitError && (
          <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {submitError}
          </div>
        )}
      </div>

      <Separator />
      <div className="flex items-center justify-end gap-2 px-6 py-4">
        <Button type="button" variant="ghost" onClick={resetForm} disabled={submitting}>Cancelar</Button>
        <Button type="submit" disabled={!isValid || submitting} className="min-w-28">
          {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {submitting ? "Criando..." : "Criar caso"}
        </Button>
      </div>
    </form>
  );
}
