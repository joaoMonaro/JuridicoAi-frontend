import type { Case, CreateCaseInput } from "@/features/cases/types/case";
import { apiRequest } from "@/lib/api-client";

export async function createCase(input: CreateCaseInput): Promise<Case> {
  return apiRequest<Case>("/casos", {
      method: "POST",
      body: JSON.stringify(input),
  });
}
