import type { JSONContent } from "@tiptap/react";

import { apiRequest } from "@/lib/api-client";
import type { DocumentStyles, PageConfig, TemplatePeca } from "@/features/pecas/types";

export interface TemplateInput {
  nome: string;
  conteudoJson?: JSONContent;
  pageConfig?: PageConfig;
  headerJson?: JSONContent | null;
  footerJson?: JSONContent | null;
  styles?: DocumentStyles;
}

export const listarTemplates = (signal?: AbortSignal) => apiRequest<TemplatePeca[]>("/templates-peca", { signal });
export const criarTemplate = (input: TemplateInput) => apiRequest<TemplatePeca>("/templates-peca", { method: "POST", body: JSON.stringify(input) });
export const atualizarTemplate = (id: string, input: Partial<TemplateInput>) => apiRequest<TemplatePeca>(`/templates-peca/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const excluirTemplate = (id: string) => apiRequest<void>(`/templates-peca/${id}`, { method: "DELETE" });
