import type { AssistantDocumentCoverage } from "../types";

export function DocumentCoverage({ coverage, running }: { coverage: AssistantDocumentCoverage; running: boolean }) {
  const consulted = coverage.fontes.reduce((sum, source) => sum + source.trechosConsultados, 0);
  const analyzed = coverage.fontes.reduce((sum, source) => sum + (source.trechosAnalisados ?? 0), 0);
  const eligible = coverage.fontes.reduce((sum, source) => sum + source.trechosElegiveis, 0);
  return <section aria-label="Cobertura da consulta documental" className="mt-3 rounded-md border bg-muted/20 p-2.5 text-xs">
    <p className="font-medium" role="status">{running ? "Consultando documentos" : coverage.estado === "Completa" ? "Consulta documental completa" : "Consulta documental parcial"} · {Math.max(consulted, analyzed)}/{eligible} trechos</p>
    <p className="mt-1 text-[10px] text-muted-foreground">{coverage.escopoSolicitado === "Todos" ? "Pedido de leitura de todos os documentos." : "Consulta dos trechos relevantes ao pedido."}</p>
    {analyzed > 0 ? <p className="mt-1">{analyzed} trechos processados por etapas; o chat recebeu uma síntese seletiva e pode consultar os originais.</p> : null}
    {coverage.limiteAtingido ? <p className="mt-1 text-destructive">A consulta atingiu o limite desta etapa. Há conteúdo que não foi consultado.</p> : null}
    <details className="mt-2"><summary className="cursor-pointer">Ver cobertura por arquivo</summary>
      <ul className="mt-2 max-h-48 space-y-2 overflow-auto">{coverage.fontes.map(source => <li key={source.id}>
        <p className="break-words font-medium">{source.nome}</p>
        <p>{source.trechosConsultados}/{source.trechosElegiveis} trechos consultados · {source.trechosExcluidos} excluídos da leitura{source.trechosAnalisados ? ` · ${source.trechosAnalisados} analisados por etapas` : ""}</p>
        <p className="text-[10px] text-muted-foreground">{source.origem === "AnexoPrivado" ? "Anexo privado" : "Documento do Caso"}{source.trechosConsultados === 0 && !source.trechosAnalisados ? " · Conteúdo não consultado" : ""}</p>
      </li>)}</ul>
    </details>
    <p className="mt-2 text-[10px] text-muted-foreground">A cobertura distingue trechos consultados diretamente e processados por etapas. Não comprova correção jurídica da resposta.</p>
  </section>;
}
