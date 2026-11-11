import { useRef } from "react";
import { Download, LoaderCircle, Paperclip, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssistantCapabilities } from "../types";
import type { useAssistantDocuments } from "../use-assistant-documents";

const labels: Record<string, string> = { Recebido: "Aguardando leitura", Processando: "Lendo documento", Concluido: "Leitura concluída",
  Parcial: "Leitura parcial", Inutilizavel: "Sem trechos confiáveis", Falhou: "Falha na leitura" };
const reasons: Record<string, string> = {
  AI_DOCUMENT_PARSE_FAILED: "Não foi possível interpretar o arquivo.",
  AI_DOCUMENT_FORMAT_UNSUPPORTED: "Este formato não é suportado para leitura no chat.",
  AI_DOCUMENT_TOOL_UNAVAILABLE: "O serviço de leitura está indisponível neste ambiente.",
  AI_DOCUMENT_PROCESS_TIMEOUT: "A leitura excedeu o tempo disponível.",
  AI_DOCUMENT_ENCODING_INVALID: "O TXT não utiliza a codificação UTF-8 suportada.",
  AI_DOCUMENT_PAGE_LIMIT: "O PDF excede o limite de páginas.",
  AI_DOCUMENT_ENCRYPTED: "O PDF está protegido por senha.",
  AI_DOCUMENT_IMAGE_LIMIT: "A imagem excede o limite de resolução.",
  AI_DOCUMENT_IMAGE_INVALID: "Não foi possível decodificar a imagem.",
  AI_DOCUMENT_TEXT_LIMIT: "O conteúdo excede o limite de processamento.",
  AI_DOCUMENT_SOURCE_CHANGED: "O arquivo foi alterado durante a leitura.",
  AI_DOCUMENT_RETRY_LIMIT: "O processamento foi interrompido repetidamente. Tente reprocessar.",
  OCR_NOT_CALIBRATED: "A leitura de imagens ainda não está habilitada neste ambiente.",
  OCR_CONFIDENCE_INSUFFICIENT: "Reconhecimento duvidoso; trecho excluído do contexto.",
  READING_ORDER_UNCERTAIN: "Ordem de leitura incerta; trecho excluído.",
  TABLE_CELL_ASSOCIATION_UNCERTAIN: "Associação entre células incerta; tabela excluída.",
  CHARACTER_MAPPING_INVALID: "Caracteres inválidos; trecho excluído.", NO_READABLE_TEXT: "Nenhum texto legível encontrado.",
  DYNAMIC_FIELD_NOT_EVALUATED: "Campo dinâmico não avaliado.", FOOTNOTES_NOT_COVERED: "Notas não cobertas pela leitura.",
};
export function AssistantDocuments({ documents, limits, disabled }: { documents: ReturnType<typeof useAssistantDocuments>;
  limits: NonNullable<AssistantCapabilities["documentos"]>; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return <section aria-label="Documentos da conversa" className="mb-2 space-y-2 text-xs">
    <div className="flex items-center justify-between gap-2">
      <Button type="button" size="xs" variant="outline" disabled={disabled || documents.uploading} onClick={() => input.current?.click()}>
        {documents.uploading ? <LoaderCircle className="animate-spin" /> : <Paperclip />}Anexar documento
      </Button>
      <span className="text-[10px] text-muted-foreground">Até {Math.floor(limits.arquivoBytes / 1024 / 1024)} MB por arquivo</span>
    </div>
    <input ref={input} type="file" className="sr-only" aria-label="Arquivo para o chat" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
      disabled={disabled || documents.uploading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void documents.upload(file, limits.arquivoBytes); }} />
    <p className="text-[10px] text-muted-foreground">Anexos são privados deste chat. Documentos do Caso são consultados conforme suas permissões.</p>
    {!limits.ocrHabilitado ? <p className="text-[10px] text-muted-foreground">Imagens e regiões digitalizadas serão sinalizadas como não lidas; OCR ainda não habilitado.</p> : null}
    {documents.error ? <div role="alert" className="flex items-center gap-2 text-destructive"><span>{documents.error}</span><Button type="button" size="xs" variant="ghost" onClick={() => void documents.refresh()}>Atualizar</Button></div> : null}
    {documents.items.length ? <details open className="rounded-md border p-2">
      <summary className="cursor-pointer font-medium">Documentos disponíveis ({documents.items.length})</summary>
      <ul className="mt-2 max-h-44 space-y-2 overflow-auto">
        {documents.items.map(item => <li key={item.id} className="rounded border bg-background p-2">
          <div className="flex items-start gap-2">
            {item.origem === "AnexoPrivado" && !item.vinculado ? <input type="checkbox" aria-label={`Usar ${item.nome} no próximo pedido`}
              checked={documents.selected.includes(item.id)} disabled={disabled} onChange={() => documents.toggle(item.id)} /> : null}
            <div className="min-w-0 flex-1"><p className="break-words font-medium">{item.nome}</p><p className="text-[10px] text-muted-foreground">{item.origem === "AnexoPrivado" ? item.vinculado ? "Privado · contexto da conversa" : "Privado · selecione para enviar" : "Documento do Caso"}</p></div>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Baixar ${item.nome}`} onClick={() => void documents.download(item)}><Download /></Button>
          </div>
          <p className="mt-1" role="status">{labels[item.estado] ?? item.estado}{item.paginasTotal ? ` · ${item.paginasConcluidas}/${item.paginasTotal} páginas` : ""}</p>
          {["Concluido", "Parcial", "Inutilizavel", "Falhou"].includes(item.estado) ? <p className="text-[10px] text-muted-foreground">{item.trechosConfiaveis} trechos utilizáveis · {item.trechosExcluidos} excluídos</p> : null}
          {item.problemas.length || item.codigoErro ? <details className="mt-1 text-[10px]"><summary className="cursor-pointer text-destructive">Problemas de leitura</summary>
            {item.codigoErro ? <p>{reasons[item.codigoErro] ?? "O processamento não foi concluído. Reenvie uma versão legível ou tente reprocessar."}</p> : null}
            <ul>{item.problemas.map((p, index) => <li key={index}>{p.localizador}: {reasons[p.codigo] ?? "Trecho não utilizado devido a problema de leitura."}</li>)}</ul>
            <p className="mt-1">Você pode reenviar uma versão mais legível.</p>
            <Button type="button" size="xs" variant="ghost" disabled={disabled} onClick={() => void documents.retry(item.id)}><RotateCcw />Reprocessar</Button>
          </details> : null}
        </li>)}
      </ul>
    </details> : null}
    {documents.processing ? <p role="status" className="flex items-center gap-1"><LoaderCircle className="size-3 animate-spin" />Aguarde a leitura dos documentos antes de enviar.</p> : null}
  </section>;
}
