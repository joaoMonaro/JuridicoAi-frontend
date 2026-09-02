export interface CreateCaseInput {
  titulo: string;
  descricao: string;
}

export type CaseStatus = "Ativo" | "Arquivado";

export interface Case {
  id: string;
  titulo: string;
  descricao: string | null;
  status: CaseStatus;
  dataCriacao: string;
  dataAtualizacao: string;
}
