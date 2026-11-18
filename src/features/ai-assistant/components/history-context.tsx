import type { AssistantHistoryContext } from "../types";

export function HistoryContext({ context }: { context: AssistantHistoryContext }) {
  if (!context.versaoMemoria && !context.registrosInvalidados && !context.historicoAdicionalDisponivel) return null;
  return <details className="mt-3 rounded-md border bg-muted/30 p-2 text-xs">
    <summary className="cursor-pointer font-medium">Contexto da conversa</summary>
    <p className="mt-2">{context.versaoMemoria ? "O chat usou um resumo das mensagens antigas e as mensagens recentes." : "O chat usou as mensagens recentes e pode consultar as anteriores."} O histórico completo continua salvo.</p>
    <p className="mt-1 text-muted-foreground">O resumo é seletivo. O chat pode consultar as mensagens originais para recuperar detalhes.</p>
    {context.registrosInvalidados > 0 ? <p className="mt-1">Parte do resumo foi desconsiderada porque as fontes ou decisões mudaram.</p> : null}
    {context.historicoAdicionalDisponivel ? <p className="mt-1">Há mensagens antigas ainda fora do resumo, disponíveis para consulta.</p> : null}
  </details>;
}
