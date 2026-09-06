import { apiRequest } from "@/lib/api-client";
import type { Case } from "@/features/cases/types/case";

export const getCase = (id: string, signal?: AbortSignal) => apiRequest<Case>(`/casos/${id}`, { signal });
