import { apiRequest } from "@/lib/api-client";
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
