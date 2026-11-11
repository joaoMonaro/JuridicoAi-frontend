import type { JSONContent } from "@tiptap/core";

import type { LocalReviewProposal } from "./types";

const paragraph = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });

export const reviewDocument: JSONContent = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "DOS FATOS" }] },
    { type: "paragraph", content: [
      { type: "text", text: "João da Silva", marks: [{ type: "bold" }] },
      { type: "text", text: " entrou em contato com a empresa por diversas vezes, porém não recebeu resposta." },
    ] },
    paragraph("O pagamento de R$ 850,00 ocorreu em 10/10/2026."),
    paragraph("Em outras palavras, a empresa não respondeu ao contato do autor."),
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "DOS PEDIDOS" }] },
    { type: "bulletList", content: [
      { type: "listItem", content: [paragraph("Solicita que seja feita a devolução do valor pago.")] },
      { type: "listItem", content: [{ type: "paragraph", content: [
        { type: "text", text: "Preservar os documentos apresentados", marks: [{ type: "italic" }] },
        { type: "text", text: "." },
      ] }] },
    ] },
    { type: "paragraph", content: [
      { type: "text", text: "Fonte fictícia de referência", marks: [{ type: "link", attrs: { href: "https://example.test/documento" } }] },
    ] },
  ],
};

export function createReviewFixture(baseDocument: JSONContent): LocalReviewProposal {
  const firstParagraph = structuredClone(baseDocument.content![1]);
  firstParagraph.content![1].text = " contatou a empresa repetidamente e não recebeu resposta.";
  const list = structuredClone(baseDocument.content![5]);
  list.content![0].content![0] = paragraph("Restituição de R$ 850,00, correspondente ao valor pago.");
  return {
    id: "proposta-ficticia-e0",
    baseDocument: structuredClone(baseDocument),
    groups: [
      { id: "fatos", explanation: "Redação mais objetiva, preservando o nome e seu destaque em negrito.",
        operations: [{ startIndex: 1, deleteCount: 1, newBlocks: [firstParagraph] }] },
      { id: "organizacao", explanation: "Inclui um subtítulo para organizar o pagamento já informado.",
        operations: [{ startIndex: 2, deleteCount: 0, newBlocks: [
          { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Do pagamento" }] },
        ] }] },
      { id: "repeticao", explanation: "Remove a repetição, preservando o relato anterior sobre a falta de resposta.",
        operations: [{ startIndex: 3, deleteCount: 1, newBlocks: [] }] },
      { id: "pedidos", explanation: "Objetiva o pedido de restituição e mantém o segundo item com a formatação original.",
        operations: [{ startIndex: 5, deleteCount: 1, newBlocks: [list] }] },
    ],
  };
}
