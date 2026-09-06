import type { CasoStatusEnum } from "@/enums";

export interface CreateCaseInput {
  titulo: string;
  descricao: string;
}

export interface Case {
  id: string;
  titulo: string;
  descricao: string | null;
  status: CasoStatusEnum;
  dataCriacao: string;
  dataAtualizacao: string;
}
