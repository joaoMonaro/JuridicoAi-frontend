import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { isGeneration } from "../sse-parser";
import type { AssistantGeneration } from "../types";
import { DocumentAnalysis } from "./document-analysis";

const labels: Record<AssistantGeneration["estado"], string> = {
  NaFila: "Pedido salvo; aguardando processamento", PreparandoContexto: "Preparando o contexto", AguardandoDocumentos: "Aguardando a leitura dos documentos",
  AguardandoAnalise: "Analisando os documentos", Executando: "Elaborando a resposta", Redigindo: "Redigindo a minuta por seções",
  Verificando: "Revisando a completude e a coerência da minuta", Publicando: "Preparando o resultado para revisão", Concluida: "Processamento concluído",
  Interrompida: "Processamento interrompido", Incompleta: "Não foi possível completar este pedido", Desatualizada: "O contexto ou a Peça mudou", Cancelada: "Pedido cancelado",
};
const active = (state: string) => ["NaFila", "PreparandoContexto", "AguardandoDocumentos", "AguardandoAnalise", "Executando", "Redigindo", "Verificando", "Publicando"].includes(state);

export function GenerationProgress({ conversationId, generationId, onTerminal }: {
  conversationId: string; generationId: string; onTerminal: () => Promise<void>;
}) {
  const [generation, setGeneration] = useState<AssistantGeneration | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  const terminal = useRef<string | null>(null);
  const url = `/assistente/v2/conversas/${conversationId}/geracoes/${generationId}`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const value = await apiRequest<unknown>(url, { signal });
      if (signal?.aborted) return;
      if (!isGeneration(value)) throw new Error("Não foi possível interpretar o andamento do pedido.");
      setGeneration(value); setError("");
      if (!active(value.estado) && terminal.current !== value.estado) { terminal.current = value.estado; await onTerminal(); }
      return active(value.estado);
    } catch (failure) {
      if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível consultar o pedido.");
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
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível atualizar o pedido."); }
    finally { setWorking(false); }
  };
  return <section aria-label="Progresso do pedido" className="mt-3 rounded-md border bg-muted/30 p-3 text-xs">
    <p role="status" className="font-medium">{generation ? labels[generation.estado] : "Recuperando andamento do pedido..."}</p>
    {generation ? <>
      {generation.secoesTotal > 0 ? <><p className="mt-1">{generation.secoesConcluidas}/{generation.secoesTotal} seções redigidas</p>
        <details className="mt-2"><summary className="cursor-pointer">Ver plano da minuta</summary><ol className="mt-2 list-inside list-decimal space-y-1">{generation.secoes.map((title, i) => <li key={i}>{title}</li>)}</ol></details></> : null}
      {active(generation.estado) ? <p className="mt-1">Você pode fechar esta tela. O processamento continuará e a proposta completa ficará disponível para revisão.</p> : null}
      {generation.estado === "Interrompida" ? <p className="mt-1">As partes concluídas foram preservadas. Retomar pode gerar novo consumo na etapa sem conclusão confirmada.</p> : null}
      {generation.estado === "Incompleta" ? <p className="mt-1">Há etapas pendentes ou o limite desta execução foi atingido. Nenhuma proposta parcial será aplicada. O pedido e os rascunhos permanecem salvos.</p> : null}
      {generation.estado === "Desatualizada" ? <p className="mt-1">Faça um novo pedido com a versão atual da Peça e das fontes. O trabalho anterior continua salvo.</p> : null}
      {active(generation.estado) ? <Button className="mt-2" size="sm" variant="outline" disabled={working} onClick={() => { void action("cancelamento"); }}>Cancelar processamento</Button> : null}
      {generation.estado === "Interrompida" ? <Button className="mt-2" size="sm" variant="outline" disabled={working} onClick={() => { void action("retomada"); }}>Retomar processamento</Button> : null}
      {generation.analiseId ? <DocumentAnalysis conversationId={conversationId} analysisId={generation.analiseId} onTerminal={onTerminal} managed /> : null}
    </> : null}
    {error ? <><p role="alert" className="mt-2 text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => setEpoch(current => current + 1)}>Consultar andamento novamente</Button></> : null}
  </section>;
}
