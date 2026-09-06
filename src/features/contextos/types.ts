import type { TipoContextoCasoEnum } from "@/enums";

export interface ContextoCasoInput {
  tipo: TipoContextoCasoEnum;
  titulo: string;
  conteudo: string;
}

export interface ContextoCaso {
  id: string;
  casoId: string;
  tipo: TipoContextoCasoEnum;
  titulo: string | null;
  conteudo: string;
  dataCriacao: string;
  dataAtualizacao: string;
}
