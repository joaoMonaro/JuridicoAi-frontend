import type { ContextoCaso, ContextoCasoInput } from "@/features/contextos/types";
import { apiRequest } from "@/lib/api-client";

export const listarContextos = (casoId: string, signal?: AbortSignal) =>
  apiRequest<ContextoCaso[]>(`/casos/${casoId}/contextos`, { signal });

export const obterContexto = (casoId: string, id: string, signal?: AbortSignal) =>
  apiRequest<ContextoCaso>(`/casos/${casoId}/contextos/${id}`, { signal });

export const criarContexto = (casoId: string, input: ContextoCasoInput) =>
  apiRequest<ContextoCaso>(`/casos/${casoId}/contextos`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const atualizarContexto = (casoId: string, id: string, input: ContextoCasoInput) =>
  apiRequest<ContextoCaso>(`/casos/${casoId}/contextos/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const excluirContexto = (casoId: string, id: string) =>
  apiRequest<void>(`/casos/${casoId}/contextos/${id}`, { method: "DELETE" });
