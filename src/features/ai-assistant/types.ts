export type AssistantMode = "Perguntar" | "Redigir" | "Reescrever" | "Revisar";
export type AssistantOperation = "ResponderNoPainel" | "InserirNoCursor" | "InserirAposSelecao" | "SubstituirSelecao" | "CriarSecao";
export type DocumentContextScope = "Nenhum" | "Selecao" | "SecaoAtual" | "DocumentoCompleto";
export type FindingCategory = "Lacuna" | "Contradicao" | "Clareza" | "Estrutura" | "Verificacao";

export interface AssistantCapabilities {
  habilitado: boolean;
  modos: AssistantMode[];
  limites: {
    instrucaoCaracteres: number;
    contextoDocumentoCaracteres: number;
    contextoAdicionalCaracteres: number;
  };
  suportaStreaming: boolean;
  suportaHistorico: boolean;
}

export interface EditorRequestSnapshot {
  scope: DocumentContextScope;
  text: string;
  sectionTitle: string | null;
  selection: {
    from: number;
    to: number;
    originalText: string;
  } | null;
  cursorPosition: number | null;
  editorRevision: number;
}

export interface AssistantRequest {
  clientRequestId: string;
  modo: AssistantMode;
  instrucao: string;
  versaoPeca: number;
  operacaoPreferida: AssistantOperation;
  contexto: {
    documento: {
      escopo: DocumentContextScope;
      texto: string | null;
      tituloSecao: string | null;
      selecao: {
        from: number;
        to: number;
        textoOriginal: string;
      } | null;
      cursor: { posicao: number } | null;
      revisaoEditor: number;
    };
    contextoAdicional: string | null;
    incluirDadosCaso: boolean;
    contextoCasoIds: string[];
  };
}

export interface AssistantAlert {
  codigo: string;
  mensagem: string;
}

export interface AssistantFinding {
  id: string;
  categoria: FindingCategory;
  titulo: string;
  descricao: string;
  alertas: AssistantAlert[];
}

export interface AssistantSuggestion {
  id: string;
  modo: AssistantMode;
  operacaoSugerida: AssistantOperation;
  titulo: string;
  texto: string;
  resumo: string;
  alertas: AssistantAlert[];
  achados: AssistantFinding[];
  ancora: {
    from: number | null;
    to: number | null;
    posicao: number | null;
    revisaoEditor: number;
    textoOriginal: string | null;
  };
}

export interface AssistantCompletedEvent {
  sugestao: AssistantSuggestion;
  uso: {
    entradaTokens: number | null;
    saidaTokens: number | null;
  };
  modelo: string;
}

export interface AssistantFailureEvent {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string | null;
}

export interface AssistantStreamHandlers {
  onStarted?: (event: { solicitacaoId: string; clientRequestId: string }) => void;
  onDelta?: (delta: string) => void;
  onCompleted: (event: AssistantCompletedEvent) => void;
}
