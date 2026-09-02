import type { Case, CaseStatus } from "@/features/cases/types/case";
import { apiRequest } from "@/lib/api-client";

export function listCases(status?: CaseStatus, signal?: AbortSignal): Promise<Case[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<Case[]>(`/casos${query}`, { signal });
}
