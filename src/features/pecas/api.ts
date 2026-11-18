import { apiFetch, apiRequest } from "@/lib/api-client";
import type { Peca, PecaApresentacao, PecaPatch, PecaResumo } from "@/features/pecas/types";

export const listarPecas = (casoId: string, signal?: AbortSignal) =>
  apiRequest<PecaResumo[]>(`/casos/${casoId}/pecas`, { signal });

export const obterPeca = (pecaId: string, signal?: AbortSignal) =>
  apiRequest<Peca>(`/pecas/${pecaId}`, { signal });

export const criarPeca = (casoId: string, titulo: string, templateId?: string) =>
  apiRequest<Peca>(`/casos/${casoId}/pecas`, {
    method: "POST",
    body: JSON.stringify({ titulo, templateId: templateId || null }),
  });

export const atualizarPeca = (pecaId: string, versao: number, patch: PecaPatch) =>
  apiRequest<{ id: string; versao: number; dataAtualizacao: string; apresentacao?: PecaApresentacao | null }>(`/pecas/${pecaId}`, {
    method: "PATCH",
    body: JSON.stringify({ versao, ...patch }),
  });

export const excluirPeca = (pecaId: string, versao: number) =>
  apiRequest<void>(`/pecas/${pecaId}?versao=${versao}`, { method: "DELETE" });

export type ExportFormat = "docx" | "pdf";
export async function exportarPeca(pecaId: string, versao: number, formato: ExportFormat, signal: AbortSignal) {
  const response = await apiFetch(`/pecas/${pecaId}/exportar`, { method: "POST", body: JSON.stringify({ versao, formato }), signal });
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const encoded = /filename\*=UTF-8''([^;]+)/iu.exec(disposition)?.[1];
  const quoted = /filename="([^"]+)"/iu.exec(disposition)?.[1];
  let name = quoted ?? `peca.${formato}`;
  if (encoded) { try { name = decodeURIComponent(encoded); } catch { /* Usar o nome simples se o cabeçalho estiver malformado. */ } }
  name = [...name].filter(char => char.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(char)).join("").trim() || `peca.${formato}`;
  return { blob: await response.blob(), name };
}
