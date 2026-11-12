export type AssistantMode = "Perguntar" | "Redigir" | "Reescrever" | "Revisar";
export type AssistantOperation = "ResponderNoPainel" | "InserirNoCursor" | "InserirAposSelecao" | "SubstituirSelecao" | "CriarSecao" | "ProporAlteracoes";
export type DocumentContextScope = "Nenhum" | "Selecao" | "SecaoAtual" | "DocumentoCompleto";
export type FindingCategory = "Lacuna" | "Contradicao" | "Clareza" | "Estrutura" | "Verificacao";

export interface AssistantCapabilities {
  documentos?: { arquivoBytes: number; pdfPaginas: number; imagemMegapixels: number; anexosPorConversa: number; conversaBytes: number; ocrHabilitado: boolean } | null;
  habilitado: boolean;
  features?: string[];
  modos: AssistantMode[];
  limites: {
    instrucaoCaracteres: number;
    contextoDocumentoCaracteres: number;
    contextoAdicionalCaracteres: number;
  };
  suportaStreaming: boolean;
  suportaHistorico: boolean;
  suportaRevisaoPersistida?: boolean;
  suportaConversaLivre?: boolean;
  suportaGeracaoDuravel?: boolean;
}

export interface AssistantTransparency {
  versao: string;
  confirmado: boolean;
  confirmadoEm: string | null;
  titulo: string;
  mensagem: string;
  avisoDeRevisao: string;
  politicaDePrivacidadeUrl: string | null;
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
  interacaoAutomatica?: boolean;
  propostaReferenciadaId?: string | null;
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
  mensagemUsuarioId?: string | null;
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

export interface AssistantHistoryContext {
  versaoMemoria: number | null;
  ateSequencia: number;
  mensagensRecentes: number;
  registrosInvalidados: number;
  historicoAdicionalDisponivel: boolean;
}

export interface AssistantCompletedEvent {
  contextoHistorico?: AssistantHistoryContext | null;
  coberturaDocumental?: AssistantDocumentCoverage | null;
  proposta?: import("./review/persistent-api").StoredProposal | null;
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

export interface AssistantDocumentAnalysis {
  id: string;
  estado: "NaFila" | "Lendo" | "Consolidando" | "Pronta" | "PreparandoResposta" | "Concluida" | "Incompleta" | "Interrompida" | "Cancelada" | "Desatualizada";
  lotesConcluidos: number; trechosAnalisados: number; trechosElegiveis: number; trechosExcluidos: number;
  codigoErro: string | null;
  fontes: AssistantDocumentCoverage["fontes"];
}

export interface AssistantGeneration {
  id: string;
  estado: "NaFila" | "PreparandoContexto" | "AguardandoDocumentos" | "AguardandoAnalise" | "Executando" | "Redigindo" | "Verificando" | "Publicando" | "Concluida" | "Interrompida" | "Incompleta" | "Desatualizada" | "Cancelada";
  secoesConcluidas: number; secoesTotal: number; secoes: string[];
  codigoErro: string | null; analiseId: string | null;
}

export interface AssistantStreamHandlers {
  onGenerationQueued?: (generation: AssistantGeneration) => void;
  onWaiting?: (analysis: AssistantDocumentAnalysis) => void;
  onHistoryContext?: (context: AssistantHistoryContext) => void;
  onDocumentCoverage?: (coverage: AssistantDocumentCoverage) => void;
  onStarted?: (event: { solicitacaoId: string; clientRequestId: string }) => void;
  onDelta?: (delta: string) => void;
  onCompleted: (event: AssistantCompletedEvent) => void;
}

export interface AssistantDocumentCoverage {
  estado: "Completa" | "Parcial";
  escopoSolicitado: "Relevantes" | "Todos";
  limiteAtingido: boolean;
  fontes: { id: string; nome: string; origem: string; trechosElegiveis: number; trechosConsultados: number;
    trechosExcluidos: number; estado: string; trechosAnalisados?: number }[];
}
