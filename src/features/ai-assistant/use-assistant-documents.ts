import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiRequest } from "@/lib/api-client";

export interface AssistantDocument {
  id: string; nome: string; origem: "AnexoPrivado" | "DocumentoCaso"; formato: string; tamanhoBytes: number;
  estado: "Recebido" | "Processando" | "Concluido" | "Parcial" | "Inutilizavel" | "Falhou";
  paginasTotal: number | null; paginasConcluidas: number; trechosConfiaveis: number; trechosExcluidos: number;
  codigoErro: string | null; vinculado: boolean;
  problemas: { pagina: number | null; localizador: string; codigo: string }[];
}
export function useAssistantDocuments(enabled: boolean, conversationId: string | null) {
  const [items, setItems] = useState<AssistantDocument[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const active = useRef({ enabled, conversationId });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { active.current = { enabled, conversationId }; }, [enabled, conversationId]);
  const refresh = useCallback(async () => {
    if (!enabled || !conversationId) return;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    setLoading(true);
    try {
      const result = await apiRequest<AssistantDocument[]>(`/assistente/v2/conversas/${conversationId}/anexos`, { signal: controller.signal });
      if (controller.signal.aborted || active.current.conversationId !== conversationId) return;
      setItems(result); setError("");
      setSelected((previous) => previous.filter(id => result.some(d => d.id === id && !d.vinculado)));
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível consultar os documentos.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [enabled, conversationId]);
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => { if (mounted) void refresh(); });
    return () => { mounted = false; abort.current?.abort(); };
  }, [refresh]);
  const processing = items.some(d => (d.origem === "DocumentoCaso" || d.vinculado || selected.includes(d.id)) && ["Recebido", "Processando"].includes(d.estado));
  const anyProcessing = items.some(d => ["Recebido", "Processando"].includes(d.estado));
  useEffect(() => {
    if (!enabled || !anyProcessing || error || loading) return;
    const timer = window.setTimeout(() => { void refresh(); }, 1500);
    return () => clearTimeout(timer);
  }, [enabled, anyProcessing, error, loading, refresh]);
  const upload = async (file: File, maxBytes: number) => {
    if (!conversationId || uploading) return;
    if (!file.size || file.size > maxBytes) { setError("O arquivo está vazio ou excede o tamanho permitido."); return; }
    setUploading(true); setError("");
    try {
      const body = new FormData(); body.set("arquivo", file); body.set("clientUploadId", crypto.randomUUID());
      const item = await apiRequest<AssistantDocument>(`/assistente/v2/conversas/${conversationId}/anexos`, { method: "POST", body });
      if (active.current.conversationId !== conversationId) return;
      setSelected(ids => [...new Set([...ids, item.id])]);
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível enviar o arquivo."); }
    finally { setUploading(false); }
  };
  const download = async (item: AssistantDocument) => {
    try {
      const response = await apiFetch(`/assistente/v2/conversas/${conversationId}/anexos/${item.id}/arquivo`);
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
      link.href = url; link.download = item.nome; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível baixar o arquivo."); }
  };
  const retry = async (id: string) => {
    try { await apiRequest(`/assistente/v2/conversas/${conversationId}/anexos/${id}/reprocessar`, { method: "POST" }); await refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível reprocessar."); }
  };
  return { items, selected, loading, uploading, error, processing, refresh, upload, download, retry,
    toggle: (id: string) => setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]) };
}
