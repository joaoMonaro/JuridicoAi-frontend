import { describe, expect, it } from "vitest";
import { historyTurns, mergeHistory, type StoredMessage } from "./conversation-history";

const messages: StoredMessage[] = [
  { id: "u1", sequencia: 1, autor: "Usuario", texto: "A contratante é Ana", propostaId: null, criadaEm: "hoje", clientRequestId: "request-1" },
  { id: "a1", sequencia: 2, autor: "Assistente", texto: "Primeira resposta", propostaId: null, criadaEm: "hoje", respostaAId: "u1", estado: "Concluida", resultado: {
    sugestao: { id: "s1", modo: "Redigir", operacaoSugerida: "InserirNoCursor", titulo: "Resposta", texto: "Primeira resposta", resumo: "", alertas: [], achados: [], ancora: { from: null, to: null, posicao: 1, revisaoEditor: 0, textoOriginal: null } },
    uso: { entradaTokens: 1, saidaTokens: 1 }, modelo: "fake",
  } },
];

describe("histórico da conversa", () => {
  it("recupera análise em andamento e deixa a conclusão persistida substituir o estado local", () => {
    const pending = [messages[0], { ...messages[1], estado: "AguardandoAnalise", resultado: null, analiseDocumentalId: "analysis-1" }];
    const [turn] = historyTurns(pending);
    expect(turn.status).toBe("analyzing"); expect(turn.analysisId).toBe("analysis-1");
    const saved = [messages[0], { ...messages[1], analiseDocumentalId: "analysis-1" }];
    const [done] = mergeHistory(saved, [turn]);
    expect(done.status).toBe("completed"); expect(done.completed?.sugestao.texto).toBe("Primeira resposta");
  });
  it("recupera a versão de contexto mesmo quando a geração foi interrompida", () => {
    const context = { versaoMemoria: 2, ateSequencia: 80, mensagensRecentes: 16, registrosInvalidados: 1, historicoAdicionalDisponivel: false };
    const stored = [messages[0], { ...messages[1], estado: "Interrompida", resultado: null, contextoHistorico: context }];
    const [turn] = historyTurns(stored);
    expect(turn.status).toBe("error"); expect(turn.historyContext).toEqual(context);
    expect(mergeHistory(stored, [{ ...turn, historyContext: null }])[0].historyContext).toEqual(context);
  });
  it("recupera cobertura parcial de resposta interrompida sem resultado final", () => {
    const coverage = { estado: "Parcial" as const, escopoSolicitado: "Todos" as const, limiteAtingido: false,
      fontes: [{ id: "source", nome: "contrato.txt", origem: "AnexoPrivado", trechosElegiveis: 10, trechosConsultados: 2, trechosExcluidos: 0, estado: "Concluido" }] };
    const [turn] = historyTurns([messages[0], { ...messages[1], resultado: null, estado: "Interrompida", coberturaDocumental: coverage }]);
    expect(turn.status).toBe("error"); expect(turn.coverage).toEqual(coverage);
  });
  it("recupera resultado estruturado com estado histórico, sem reaproveitar autorização de edição", () => {
    const [turn] = historyTurns([...messages].reverse());
    expect(turn.instruction).toBe("A contratante é Ana");
    expect(turn.completed?.sugestao.texto).toBe("Primeira resposta");
    expect(turn.historical).toBe(true);
    expect(turn.id).toBe("request-1");
  });
  it("mantém resposta persistida quando a confirmação local se perdeu", () => {
    const [turn] = historyTurns(messages);
    const result = mergeHistory(messages, [{ ...turn, completed: null, status: "error", error: "Sem rede" }]);
    expect(result).toHaveLength(1);
    expect(result[0].completed).not.toBeNull();
    expect(result[0].status).toBe("completed");
  });
  it("preserva o rascunho local editável quando o resultado também está salvo", () => {
    const [turn] = historyTurns(messages);
    const result = mergeHistory(messages, [{ ...turn, historical: false, editableText: "Edição privada antes de revisar" }]);
    expect(result[0].historical).toBe(false);
    expect(result[0].editableText).toBe("Edição privada antes de revisar");
  });
  it("recupera pares do bridge anterior e pedidos interrompidos", () => {
    const legacy = messages.map((m) => ({ ...m, respostaAId: null, resultado: null, propostaId: "p1" }));
    expect(historyTurns(legacy)[0].streamedText).toBe("Primeira resposta");
    expect(historyTurns([messages[0], { ...messages[1], estado: "Interrompida", resultado: null }])[0].error).toContain("interrompido");
  });
});
