export interface CreateCaseInput {
  titulo: string;
  descricao: string;
}

export interface Case {
  id: string;
  titulo: string;
  descricao: string | null;
  status: "Ativo" | "Arquivado";
  dataCriacao: string;
  dataAtualizacao: string;
}
