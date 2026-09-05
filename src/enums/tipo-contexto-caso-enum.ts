export const TIPOS_CONTEXTO_CASO = [
  "RelatoInicial",
  "ResumoDosFatos",
  "Cronologia",
  "Observacao",
  "Estrategia",
  "Outro",
] as const;

export type TipoContextoCasoEnum = typeof TIPOS_CONTEXTO_CASO[number];
