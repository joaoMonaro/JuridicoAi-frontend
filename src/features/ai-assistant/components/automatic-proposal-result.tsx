import { AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssistantCompletedEvent } from "../types";
import type { StoredProposal } from "../review/persistent-api";

export function AutomaticProposalResult({ completed, proposal, knownCurrent, onOpen }: {
  completed: AssistantCompletedEvent; proposal: StoredProposal; knownCurrent: boolean; onOpen: () => void;
}) {
  const pending = proposal.grupos.filter((group) => group.estado === "Pendente").length;
  const status = !knownCurrent ? "Proposta salva no histórico. Consulte para ver o estado atual." :
    proposal.estado === "Substituida" ? "Esta proposta foi substituída por uma revisão posterior." :
    proposal.estado === "Desatualizada" ? "A Peça ou as fontes mudaram. Peça uma atualização desta proposta no chat." :
    pending ? "Alterações prontas para revisão no documento." : "Revisão desta proposta concluída.";
  return <section aria-label="Proposta de alterações da IA" className="space-y-3">
    <h3 className="text-sm font-semibold">{completed.sugestao.titulo || "Alterações propostas"}</h3>
    <p className="whitespace-pre-wrap text-sm leading-6">{completed.sugestao.texto}</p>
    {completed.sugestao.alertas.length ? <div className="rounded-md border border-warning/30 bg-warning/10 p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-warning"><AlertTriangle className="size-3.5" />Pontos para conferir</p>
      <ul className="mt-2 space-y-1 text-xs">{completed.sugestao.alertas.map((alert, index) => <li key={index}>{alert.mensagem}</li>)}</ul>
    </div> : null}
    <p role="status" className="text-xs text-muted-foreground">{status}</p>
    <Button size="sm" variant="outline" onClick={onOpen}><Eye />Ver proposta no documento</Button>
    <p className="text-[11px] text-muted-foreground">A Peça só muda após a aprovação na comparação.</p>
  </section>;
}
