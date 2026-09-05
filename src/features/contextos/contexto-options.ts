import { TIPOS_CONTEXTO_CASO } from "@/enums";
import type { TipoContextoCasoEnum } from "@/enums";

export const CONTEXTO_TIPO_LABELS: Record<TipoContextoCasoEnum, string> = {
  RelatoInicial: "Relato inicial",
  ResumoDosFatos: "Resumo dos fatos",
  Cronologia: "Cronologia",
  Observacao: "Observação",
  Estrategia: "Estratégia",
  Outro: "Outro",
};

export const CONTEXTO_TIPO_OPTIONS = TIPOS_CONTEXTO_CASO.map((value) => ({
  value,
  label: CONTEXTO_TIPO_LABELS[value],
}));
