import type { JSONContent } from "@tiptap/react";

export type PecaStatus = "Rascunho" | "Finalizada";

export interface PageConfig {
  format: "A4";
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

export interface DocumentStyles {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textAlign: "left" | "center" | "right" | "justify";
}

export interface PecaResumo {
  id: string;
  titulo: string;
  status: PecaStatus;
  versao: number;
  templateId: string | null;
  dataAtualizacao: string;
}

export interface Peca extends PecaResumo {
  casoId: string;
  conteudoJson: JSONContent;
  pageConfig: PageConfig;
  headerJson: JSONContent | null;
  footerJson: JSONContent | null;
  styles: DocumentStyles;
  dataCriacao: string;
}

export interface TemplatePeca {
  id: string;
  nome: string;
  conteudoJson: JSONContent;
  pageConfig: PageConfig;
  headerJson: JSONContent | null;
  footerJson: JSONContent | null;
  styles: DocumentStyles;
  dataCriacao: string;
  dataAtualizacao: string;
}

export type PecaPatch = Partial<Pick<Peca, "titulo" | "conteudoJson" | "pageConfig" | "headerJson" | "footerJson" | "styles" | "status">>;
export type SaveState = "SALVO" | "NAO_SALVO" | "SALVANDO" | "ERRO" | "CONFLITO";

export const EMPTY_DOCUMENT: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
export const DEFAULT_PAGE_CONFIG: PageConfig = { format: "A4", marginTop: 25, marginBottom: 20, marginLeft: 30, marginRight: 20 };
export const DEFAULT_STYLES: DocumentStyles = { fontFamily: "Times New Roman", fontSize: 12, lineHeight: 1.5, textAlign: "justify" };
