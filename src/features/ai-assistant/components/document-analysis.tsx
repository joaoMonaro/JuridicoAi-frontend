import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { isDocumentAnalysis } from "../sse-parser";
import type { AssistantDocumentAnalysis } from "../types";

const labels: Record<AssistantDocumentAnalysis["estado"], string> = {
  NaFila: "Análise documental na fila", Lendo: "Analisando documentos por etapas", Consolidando: "Consolidando a análise",
  Pronta: "Análise pronta; preparando resposta", PreparandoResposta: "Preparando a resposta com os documentos",
  Concluida: "Análise documental concluída", Incompleta: "Análise documental incompleta", Interrompida: "Análise documental interrompida",
  Cancelada: "Análise documental cancelada", Desatualizada: "As fontes ou a Peça mudaram",
};
const active = (state: string) => ["NaFila", "Lendo", "Consolidando", "Pronta", "PreparandoResposta"].includes(state);

export function DocumentAnalysis({ conversationId, analysisId, onTerminal }: {
  conversationId: string; analysisId: string; onTerminal: () => Promise<void>;
}) {
  const [analysis, setAnalysis] = useState<AssistantDocumentAnalysis | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  const terminal = useRef<string | null>(null);
  const url = `/assistente/v2/conversas/${conversationId}/analises/${analysisId}`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const value = await apiRequest<unknown>(url, { signal });
      if (signal?.aborted) return;
      if (!isDocumentAnalysis(value)) throw new Error("Não foi possível interpretar o andamento da análise.");
      setAnalysis(value); setError("");
      if (!active(value.estado) && terminal.current !== value.estado) { terminal.current = value.estado; await onTerminal(); }
      return active(value.estado);
    } catch (failure) {
      if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível consultar a análise.");
    }
  }, [url, onTerminal]);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const running = await refresh(controller.signal);
      if (running && !controller.signal.aborted) timer = setTimeout(() => { void poll(); }, 1500);
    }
    queueMicrotask(() => { if (!controller.signal.aborted) void poll(); });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh, epoch]);
  const action = async (name: "cancelamento" | "retomada") => {
    setWorking(true);
    try { await apiFetch(`${url}/${name}`, { method: "POST" }); terminal.current = null; await refresh(); setEpoch(current => current + 1); await onTerminal(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível atualizar a análise."); }
    finally { setWorking(false); }
  };
  return <section aria-label="Análise documental por etapas" className="mt-3 rounded-md border bg-muted/30 p-3 text-xs">
    <p role="status" className="font-medium">{analysis ? labels[analysis.estado] : "Recuperando análise documental..."}</p>
    {analysis ? <>
      <p className="mt-1">{analysis.trechosAnalisados}/{analysis.trechosElegiveis} trechos analisados · {analysis.lotesConcluidos} {analysis.lotesConcluidos === 1 ? "etapa concluída" : "etapas concluídas"}</p>
      {active(analysis.estado) ? <p className="mt-1">Você pode fechar esta tela. O servidor continuará a análise e preparará o resultado para revisão.</p> : null}
      {analysis.trechosExcluidos > 0 ? <p className="mt-1">{analysis.trechosExcluidos} trechos excluídos por leitura incompleta ou duvidosa.</p> : null}
      {analysis.trechosExcluidos === 0 && analysis.fontes.some(source => source.estado !== "Concluido") ? <p className="mt-1">Há arquivos com leitura incompleta. Somente os trechos elegíveis entraram na análise.</p> : null}
      {analysis.estado === "Interrompida" ? <p className="mt-1">As etapas concluídas foram preservadas. Retomar pode fazer uma nova chamada à IA para a etapa sem confirmação de conclusão.</p> : null}
      {analysis.estado === "Incompleta" ? <p className="mt-1">O limite desta execução foi atingido. Há etapas ainda pendentes; nenhuma alteração incompleta foi aplicada.</p> : null}
      {analysis.estado === "Desatualizada" ? <p className="mt-1">Faça um novo pedido com as fontes e a versão atual da Peça. O trabalho anterior continua salvo.</p> : null}
      <details className="mt-2"><summary className="cursor-pointer">Ver andamento por arquivo</summary>
        <ul className="mt-2 max-h-48 space-y-1 overflow-auto">{analysis.fontes.map(source => <li key={source.id}>
          <span className="break-words font-medium">{source.nome}</span>: {source.trechosAnalisados ?? 0}/{source.trechosElegiveis} analisados · {source.trechosExcluidos} excluídos{source.estado !== "Concluido" ? " · leitura incompleta" : ""}
        </li>)}</ul>
      </details>
      {active(analysis.estado) ? <Button className="mt-2" size="sm" variant="outline" disabled={working} onClick={() => { void action("cancelamento"); }}>Cancelar análise</Button> : null}
      {analysis.estado === "Interrompida" ? <Button className="mt-2" size="sm" variant="outline" disabled={working} onClick={() => { void action("retomada"); }}>Retomar análise</Button> : null}
    </> : null}
    {error ? <><p role="alert" className="mt-2 text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => setEpoch(current => current + 1)}>Consultar análise novamente</Button></> : null}
  </section>;
}
