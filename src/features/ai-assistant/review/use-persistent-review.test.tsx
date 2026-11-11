import { Editor } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { Transform } from "@tiptap/pm/transform";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLegalEditorExtensions } from "@/features/pecas/editor/legal-editor-extensions";
import type { usePecaAutosave } from "@/features/pecas/hooks/use-peca-autosave";
import { ApiError } from "@/lib/api-client";
import { createReviewFixture, reviewDocument } from "./fixtures";
import { getReviewSession } from "./extension";
import * as api from "./persistent-api";
import type { StoredProposal, ReviewReceipt } from "./persistent-api";
import { usePersistentReview } from "./use-persistent-review";

vi.mock("./persistent-api", () => ({ openReviewConversation: vi.fn(), listReviewProposals: vi.fn(),
  registerReviewProposal: vi.fn(), approveStoredGroups: vi.fn(), getReviewReceipt: vi.fn(), rejectStoredGroups: vi.fn() }));
const editors: Editor[] = [];
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { cleanup(); editors.splice(0).forEach((editor) => editor.destroy()); });

function setup() {
  const editor = new Editor({ extensions: createLegalEditorExtensions(), content: reviewDocument });
  editors.push(editor);
  const base = editor.getJSON();
  const fixture = createReviewFixture(base);
  const proposal: StoredProposal = { id: "p1", conversaId: "c1", snapshotId: "s1", revisao: 1,
    versaoDecisoes: 1, versaoPecaAplicavel: 7, estado: "Pendente", documentoBase: base,
    grupos: fixture.groups.map((group) => ({ id: group.id, explicacao: group.explanation,
      estado: "Pendente", previewSha256: `hash-${group.id}`, operacoes: group.operations.map((op) => ({
        tipo: "SpliceBlocos", startIndex: op.startIndex, deleteCount: op.deleteCount, novosBlocos: op.newBlocks,
      })),
    })),
  };
  const boundaries: number[] = [];
  editor.state.doc.forEach((_node, offset) => boundaries.push(offset)); boundaries.push(editor.state.doc.content.size);
  const op = proposal.grupos[0].operacoes[0];
  const transform = new Transform(editor.state.doc).replaceWith(boundaries[op.startIndex], boundaries[op.startIndex + op.deleteCount],
    Fragment.fromArray(op.novosBlocos.map((node) => editor.schema.nodeFromJSON(node))));
  const receipt: ReviewReceipt = { requestId: "will-be-set", propostaId: "p1", versaoAnterior: 7,
    versaoResultante: 8, versaoPecaAtual: 8, resultadoAindaAtual: true, gruposAplicados: ["fatos"],
    conteudoJson: transform.doc.toJSON(), dataAtualizacao: "agora",
    propostaRestante: { ...proposal, documentoBase: transform.doc.toJSON(), versaoDecisoes: 2,
      versaoPecaAplicavel: 8, estado: "ParcialmenteResolvida", grupos: proposal.grupos.map((group) => group.id === "fatos" ? { ...group, estado: "Aplicado" } : group) },
  };
  const autosave = { ensurePersisted: vi.fn().mockResolvedValue(7), beginExternalCommit: vi.fn(),
    endExternalCommit: vi.fn(), adoptExternalCommit: vi.fn() } as unknown as ReturnType<typeof usePecaAutosave>;
  vi.mocked(api.openReviewConversation).mockResolvedValue({ id: "c1" });
  vi.mocked(api.listReviewProposals).mockResolvedValue([proposal]);
  const hook = renderHook(({ enabled }) => usePersistentReview({ editor, enabled, pecaId: "piece", editorRevision: 0, autosave }), { initialProps: { enabled: true } });
  return { editor, proposal, receipt, autosave, base, ...hook };
}

describe("revisão persistida", () => {
  it("desligar a capacidade libera o editor e reativar recupera a proposta salva", async () => {
    const { editor, result, rerender, base } = setup();
    await waitFor(() => expect(getReviewSession(editor)?.visible).toBe(true));
    rerender({ enabled: false });
    await waitFor(() => expect(getReviewSession(editor)).toBeNull());
    expect(editor.isEditable).toBe(true);
    expect(editor.getJSON()).toEqual(base);
    expect(result.current.saved).toHaveLength(1);
    rerender({ enabled: true });
    await waitFor(() => expect(getReviewSession(editor)?.visible).toBe(true));
    expect(api.approveStoredGroups).not.toHaveBeenCalled();
    expect(api.rejectStoredGroups).not.toHaveBeenCalled();
  });
  it("recupera proposta e só muda o editor após o recibo confirmado", async () => {
    const { editor, result, receipt, autosave, base } = setup();
    await waitFor(() => expect(getReviewSession(editor)?.visible).toBe(true));
    let finish!: (value: ReviewReceipt) => void;
    vi.mocked(api.approveStoredGroups).mockImplementation((_id, command) => new Promise((resolve) => {
      receipt.requestId = command.requestId; finish = resolve;
    }));
    let operation!: Promise<void>;
    act(() => { operation = result.current.approve(["fatos"]); });
    await waitFor(() => expect(api.approveStoredGroups).toHaveBeenCalledOnce());
    expect(editor.getJSON()).toEqual(base);
    expect(getReviewSession(editor)?.locked).toBe(true);
    expect(autosave.adoptExternalCommit).not.toHaveBeenCalled();
    await act(async () => { finish(receipt); await operation; });
    expect(editor.getJSON()).toEqual(receipt.conteudoJson);
    expect(autosave.adoptExternalCommit).toHaveBeenCalledWith(8, "agora", editor.getJSON());
    expect(result.current.uncertain).toBe(false);
    expect(getReviewSession(editor)?.locked).toBe(false);
  });

  it("recupera resposta perdida pelo recibo sem nova aprovação ou escrita duplicada", async () => {
    const { editor, result, receipt, autosave, base } = setup();
    await waitFor(() => expect(getReviewSession(editor)?.visible).toBe(true));
    vi.mocked(api.approveStoredGroups).mockRejectedValue(new ApiError("Conexão perdida", 0));
    await act(async () => { await result.current.approve(["fatos"]); });
    expect(result.current.uncertain).toBe(true);
    expect(editor.getJSON()).toEqual(base);
    const command = vi.mocked(api.approveStoredGroups).mock.calls[0][1];
    vi.mocked(api.getReviewReceipt).mockResolvedValue({ ...receipt, requestId: command.requestId });
    await act(async () => { await result.current.retry(); });
    expect(api.getReviewReceipt).toHaveBeenCalledWith("c1", command.requestId);
    expect(api.approveStoredGroups).toHaveBeenCalledOnce();
    expect(autosave.adoptExternalCommit).toHaveBeenCalledOnce();
    expect(result.current.uncertain).toBe(false);
  });

  it("reenvia o mesmo comando se o primeiro envio não chegou ao backend", async () => {
    const { editor, result, receipt } = setup();
    await waitFor(() => expect(getReviewSession(editor)?.visible).toBe(true));
    vi.mocked(api.approveStoredGroups).mockRejectedValueOnce(new ApiError("Sem rede", 0));
    await act(async () => { await result.current.approve(["fatos"]); });
    const command = vi.mocked(api.approveStoredGroups).mock.calls[0][1];
    vi.mocked(api.getReviewReceipt).mockRejectedValue(new ApiError("Não encontrado", 404));
    vi.mocked(api.approveStoredGroups).mockResolvedValue({ ...receipt, requestId: command.requestId });
    await act(async () => { await result.current.retry(); });
    expect(vi.mocked(api.approveStoredGroups).mock.calls[1][1]).toEqual(command);
    expect(editor.getJSON()).toEqual(receipt.conteudoJson);
  });

  it("conflito não muda o documento e impede a aprovação da base antiga", async () => {
    const { editor, result, autosave, base } = setup();
    await waitFor(() => expect(getReviewSession(editor)?.visible).toBe(true));
    vi.mocked(api.approveStoredGroups).mockRejectedValue(new ApiError("Versão mudou", 409));
    await act(async () => { await result.current.approve(["fatos"]); });
    expect(editor.getJSON()).toEqual(base);
    expect(getReviewSession(editor)?.stale).toBe(true);
    expect(getReviewSession(editor)?.locked).toBe(false);
    expect(autosave.adoptExternalCommit).not.toHaveBeenCalled();
  });

  it("recibo diferente do preview não é aplicado silenciosamente", async () => {
    const { editor, result, receipt, autosave, base } = setup();
    await waitFor(() => expect(getReviewSession(editor)?.visible).toBe(true));
    vi.mocked(api.approveStoredGroups).mockResolvedValue({ ...receipt, conteudoJson: { type: "doc", content: [{ type: "paragraph" }] } });
    await act(async () => { await result.current.approve(["fatos"]); });
    expect(editor.getJSON()).toEqual(base);
    expect(result.current.uncertain).toBe(true);
    expect(autosave.adoptExternalCommit).not.toHaveBeenCalled();
  });
});
