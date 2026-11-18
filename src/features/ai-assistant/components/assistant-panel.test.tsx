import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmAssistantTransparency,
  getAssistantMonthlyLimit,
  getAssistantTransparency,
  streamAssistantInteraction,
} from "@/features/ai-assistant/api";
import { useAssistantHistory } from "@/features/ai-assistant/use-assistant-history";
import { AssistantPanel } from "@/features/ai-assistant/components/assistant-panel";
import type {
  AssistantCapabilities,
  AssistantCompletedEvent,
  AssistantOperation,
  AssistantTransparency,
} from "@/features/ai-assistant/types";
import { listarContextos } from "@/features/contextos/api";
import type { Peca, SaveState } from "@/features/pecas/types";
import { ApiError } from "@/lib/api-client";

vi.mock("@/features/ai-assistant/api", () => ({
  confirmAssistantTransparency: vi.fn(),
  getAssistantMonthlyLimit: vi.fn(),
  getAssistantTransparency: vi.fn(),
  streamAssistantInteraction: vi.fn(),
  rejectAssistantResponse: vi.fn(),
}));

vi.mock("@/features/ai-assistant/use-assistant-history", () => ({ useAssistantHistory: vi.fn() }));

vi.mock("@/features/contextos/api", () => ({
  listarContextos: vi.fn(),
}));

const editors: Editor[] = [];
const mockedTransparency = vi.mocked(getAssistantTransparency);
const mockedMonthlyLimit = vi.mocked(getAssistantMonthlyLimit);
const mockedConfirmTransparency = vi.mocked(confirmAssistantTransparency);
const mockedStream = vi.mocked(streamAssistantInteraction);
const mockedContexts = vi.mocked(listarContextos);

beforeEach(() => {
  mockedTransparency.mockReset();
  mockedMonthlyLimit.mockReset();
  mockedConfirmTransparency.mockReset();
  mockedStream.mockReset();
  mockedContexts.mockReset();
  mockedTransparency.mockResolvedValue(confirmedTransparency);
  mockedMonthlyLimit.mockResolvedValue({
    periodoReferencia: new Date().toISOString().slice(0, 7),
    estado: "Disponivel",
    percentualUtilizado: 12,
    percentualReservado: 0,
    percentualDisponivel: 88,
    possuiReservasEmAndamento: false,
    bloqueadoParaNovasChamadas: false,
    mensagemStatus: null,
  });
  mockedConfirmTransparency.mockResolvedValue(confirmedTransparency);
  mockedContexts.mockResolvedValue([]);
  vi.mocked(useAssistantHistory).mockReturnValue({ conversationId: "conversa-1", messages: [], loading: false, error: "", hasOlder: false, generating: false, refresh: vi.fn().mockResolvedValue(undefined), loadOlder: vi.fn().mockResolvedValue(undefined) });
});

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

describe("AssistantPanel", () => {
  it("aguarda o histórico para focar o composer uma vez sem roubar foco nos refreshes", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    const history = vi.mocked(useAssistantHistory).getMockImplementation()!(true, peca.id);
    vi.mocked(useAssistantHistory).mockReturnValue({ ...history, conversationId: null, loading: true });
    const view = renderPanel({ editor });
    const composer = await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" });
    expect(composer).toBeDisabled();
    expect(composer).not.toHaveFocus();

    vi.mocked(useAssistantHistory).mockReturnValue(history);
    view.rerender(panel({ editor }));
    await waitFor(() => expect(composer).toHaveFocus());

    const resize = screen.getByRole("button", { name: "Aumentar largura do assistente" });
    await user.click(resize);
    expect(resize).toHaveFocus();
    vi.mocked(useAssistantHistory).mockReturnValue({ ...history, loading: true });
    view.rerender(panel({ editor }));
    vi.mocked(useAssistantHistory).mockReturnValue(history);
    view.rerender(panel({ editor }));
    await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
    expect(resize).toHaveFocus();

    view.rerender(panel({ editor, open: false }));
    view.rerender(panel({ editor }));
    const reopenedComposer = await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" });
    await waitFor(() => expect(reopenedComposer).toHaveFocus());
  });

  it("mantém o histórico consultável e explica a ausência de conversa livre sem expor o fluxo antigo", async () => {
    renderPanel({ capabilities: { ...capabilities, suportaConversaLivre: false } });
    expect(await screen.findByText(/O assistente está indisponível/)).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "O que você quer que a IA faça?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reescrever" })).not.toBeInTheDocument();
  });

  it("exibe o aviso no primeiro uso e só libera o assistente após a confirmação", async () => {
    const user = userEvent.setup();
    mockedTransparency.mockResolvedValue(pendingTransparency);
    mockedConfirmTransparency.mockResolvedValue(confirmedTransparency);
    renderPanel();

    const dialog = await screen.findByRole("dialog", { name: "Uso de inteligência artificial" });
    expect(dialog).toHaveTextContent("Algumas informações do caso poderão ser processadas");
    expect(dialog).toHaveTextContent("devem ser revisadas pelo profissional responsável");
    expect(screen.queryByRole("textbox", { name: "O que você quer que a IA faça?" })).not.toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Entendi e continuar" });
    await waitFor(() => expect(confirm).toHaveFocus());
    await user.click(confirm);

    await waitFor(() => expect(mockedConfirmTransparency).toHaveBeenCalledWith("ai-transparency-v1"));
    const composer = await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" });
    await waitFor(() => expect(composer).toHaveFocus());
    expect(screen.queryByRole("dialog", { name: "Uso de inteligência artificial" })).not.toBeInTheDocument();
  });

  it("não renderiza fechado e solicita fechamento por botão ou Escape", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    const onClose = vi.fn();
    const view = renderPanel({ open: false, editor, onClose });

    expect(screen.queryByRole("complementary", { name: "Assistente de IA" })).not.toBeInTheDocument();

    view.rerender(panel({ open: true, editor, onClose }));
    await screen.findByRole("button", { name: "Enviar para IA" });
    await user.click(screen.getByRole("button", { name: "Fechar assistente" }));
    expect(onClose).toHaveBeenCalledOnce();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("impede envio vazio e não expõe atalhos ou campos paralelos", async () => {
    renderPanel();
    expect(await screen.findByRole("button", { name: "Enviar para IA" })).toBeDisabled();
    for (const name of ["Criar minuta", "Melhorar redação", "Explicar trecho", "Reescrever", "Expandir", "Revisar", "Novo trecho", "Desenvolver"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText("+ Adicionar contexto")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Informação apenas para este pedido" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(mockedContexts).not.toHaveBeenCalled();
  });

  it("sincroniza a peça e ignora a seleção e o cursor no envio", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    editor.commands.setTextSelection(findText(editor, "Trecho original."));
    const ensurePersisted = vi.fn().mockResolvedValue(7);
    completeImmediately(completedEvent("ResponderNoPainel"));
    renderPanel({ editor, editorRevision: 3, ensurePersisted });
    const composer = await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" });
    fireEvent.focus(composer, { relatedTarget: editor.view.dom });
    expect(screen.queryByText(/Seleção ·/)).not.toBeInTheDocument();
    await user.type(composer, "Analise a peça.");
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    await screen.findByRole("heading", { name: "Resposta da IA" });
    expect(ensurePersisted).toHaveBeenCalledOnce();
    expect(mockedStream.mock.calls[0][0]).toBe("conversa-1");
    expect(mockedStream.mock.calls[0][1]).toEqual({
      clientRequestId: expect.any(String), texto: "Analise a peça.", versaoPecaEsperada: 7,
      propostaReferenciadaId: null, anexoIds: undefined,
    });
  });

  it("reenvia mensagem histórica sem reutilizar seleção nem configurações antigas", async () => {
    const user = userEvent.setup();
    const saved = vi.mocked(useAssistantHistory).getMockImplementation()!;
    const current = saved(true, peca.id);
    vi.mocked(useAssistantHistory).mockReturnValue({ ...current, messages: [
      { id: "antiga", sequencia: 1, autor: "Usuario", texto: "Reescreva o parágrafo inicial.", propostaId: null, criadaEm: "2026-11-01T00:00:00Z",
        solicitacao: { clientRequestId: "old", modo: "Reescrever", instrucao: "Reescreva o parágrafo inicial.", versaoPeca: 1, operacaoPreferida: "SubstituirSelecao",
          contexto: { documento: { escopo: "Selecao", texto: "Trecho original.", tituloSecao: null,
            selecao: { from: 1, to: 17, textoOriginal: "Trecho original." }, cursor: { posicao: 17 }, revisaoEditor: 1 },
            contextoAdicional: "Informação antiga", incluirDadosCaso: true, contextoCasoIds: ["contexto-antigo"] } } },
      { id: "resposta-antiga", respostaAId: "antiga", sequencia: 2, autor: "Assistente", texto: "", propostaId: null,
        criadaEm: "2026-11-01T00:00:01Z", estado: "Cancelada" },
    ] });
    completeImmediately(completedEvent("ResponderNoPainel"));
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Reenviar pedido" }));
    await waitFor(() => expect(mockedStream).toHaveBeenCalledOnce());
    expect(mockedStream.mock.calls[0][1]).toEqual({ clientRequestId: expect.any(String),
      texto: "Reescreva o parágrafo inicial.", versaoPecaEsperada: 1,
      propostaReferenciadaId: null, anexoIds: undefined });
    expect(mockedContexts).not.toHaveBeenCalled();
  });

  it("preserva o pedido e não chama a IA se a sincronização falhar", async () => {
    const user = userEvent.setup();
    renderPanel({ ensurePersisted: vi.fn().mockRejectedValue(new Error("Falha ao salvar a Peça.")) });
    const composer = await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" });
    await user.type(composer, "Revise a peça.");
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao salvar a Peça.");
    expect(composer).toHaveValue("Revise a peça.");
    expect(mockedStream).not.toHaveBeenCalled();
  });

  it("não envia uma peça alterada durante a sincronização", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    renderPanel({ editor, ensurePersisted: async () => { editor.commands.setContent("<p>Texto novo</p>"); return 2; } });
    const composer = await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" });
    await user.type(composer, "Revise a peça.");
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A Peça mudou durante a sincronização");
    expect(composer).toHaveValue("Revise a peça.");
    expect(mockedStream).not.toHaveBeenCalled();
  });

  it("anuncia streaming, agrega deltas e apresenta a conclusão", async () => {
    const user = userEvent.setup();
    let completeRequest: (() => void) | undefined;
    mockedStream.mockImplementation(async (_conversationId, _request, handlers) => {
      handlers.onStarted?.({ solicitacaoId: "sol-1", clientRequestId: "req-1" });
      handlers.onDelta?.("Resposta parcial");
      await new Promise<void>((resolve) => {
        completeRequest = () => {
          handlers.onCompleted(completedEvent("ResponderNoPainel"));
          resolve();
        };
      });
    });
    renderPanel();

    await user.type(
      await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" }),
      "Analise a peça.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));

    const streaming = await screen.findByText("A IA está elaborando a resposta...");
    const liveRegion = streaming.closest("[aria-live]");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Resposta parcial")).toBeVisible();

    await act(async () => completeRequest?.());

    expect(await screen.findByRole("heading", { name: "Resposta da IA" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Resposta da IA concluída.");
    expect(screen.getByText(/Confirme as informações antes de usar/)).toBeVisible();
    expect(screen.queryByText("A IA está elaborando a resposta...")).not.toBeInTheDocument();
  });

  it("cancela a solicitação e não altera o documento", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    const originalJson = editor.getJSON();
    mockedStream.mockImplementation((_conversationId, _request, handlers, signal) => {
      handlers.onStarted?.({ solicitacaoId: "sol-1", clientRequestId: "req-1" });
      return new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });
    renderPanel({ editor });

    await user.type(
      await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" }),
      "Analise a peça.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Solicitação cancelada.");
    expect(editor.getJSON()).toEqual(originalJson);
  });

  it("preserva a mensagem após erro recuperável", async () => {
    const user = userEvent.setup();
    mockedStream.mockRejectedValue(new ApiError("Falha temporária do provider.", 503, "AI_UNAVAILABLE"));
    renderPanel();
    const instruction = await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" });
    await user.type(instruction, "Revise a fundamentação considerando o documento ainda não juntado.");
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha temporária do provider.");
    expect(instruction).toHaveValue("Revise a fundamentação considerando o documento ainda não juntado.");
  });

  it("exibe somente modos e ações liberados pelas capacidades", async () => {
    renderPanel({ capabilities: chatOnlyCapabilities });

    await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" });
    expect(screen.queryByRole("combobox", { name: "Modo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reescrever" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expandir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revisar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo trecho" })).not.toBeInTheDocument();
  });

  it("revalida capacidades após recusa do backend sem apagar o pedido", async () => {
    const user = userEvent.setup();
    const onCapabilitiesInvalidated = vi.fn();
    mockedStream.mockRejectedValue(new ApiError(
      "Esta operação de IA não está habilitada para a organização.",
      403,
      "AI_FEATURE_NOT_ENABLED",
    ));
    renderPanel({ onCapabilitiesInvalidated });
    const instruction = await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" });

    await user.type(instruction, "Revise a fundamentação.");
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("não está habilitada");
    expect(onCapabilitiesInvalidated).toHaveBeenCalledOnce();
    expect(instruction).toHaveValue("Revise a fundamentação.");
  });

  it("só altera a Peça depois da ação explícita de aplicar", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    const range = findText(editor, "Trecho original.");
    editor.commands.setTextSelection(range);
    completeImmediately(completedEvent("SubstituirSelecao", {
      from: range.from,
      to: range.to,
      textoOriginal: "Trecho original.",
    }));
    renderPanel({ editor, editorRevision: 1, saveState: "SALVO" });

    await user.type(await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" }), "Reescreva o parágrafo inicial.");
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    await user.click(await screen.findByText("Ver texto original"));
    expect(screen.getByText("Trecho original.")).toBeVisible();
    expect(editor.getText()).toContain("Trecho original.");

    const proposal = screen.getByDisplayValue("Texto sugerido");
    await user.clear(proposal);
    await user.type(proposal, "Texto revisado pelo usuário.");
    expect(editor.getText()).toContain("Trecho original.");

    await user.click(screen.getByRole("button", { name: "Substituir seleção" }));

    expect(editor.getText()).toContain("Texto revisado pelo usuário.");
    expect(editor.getText()).not.toContain("Trecho original.");
    expect(screen.getByText(/Sugestão aplicada/)).toBeVisible();
  });

  it("bloqueia aplicação quando a âncora retornada está expirada", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    const range = findText(editor, "Trecho original.");
    editor.commands.setTextSelection(range);
    completeImmediately(completedEvent("SubstituirSelecao", {
      from: range.from,
      to: range.to,
      textoOriginal: "Trecho original.",
      revisaoEditor: 1,
    }));
    renderPanel({ editor, editorRevision: 2 });

    await user.type(await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" }), "Reescreva o parágrafo inicial.");
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));

    expect(await screen.findByText(/O documento mudou desde o envio/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Substituir seleção" })).toBeDisabled();
  });

  it.each<[SaveState, RegExp]>([
    ["SALVANDO", /Aguarde a sincronização/],
    ["NAO_SALVO", /não podem ser aplicadas até que a sincronização seja restabelecida/],
    ["ERRO", /não podem ser aplicadas até que a sincronização seja restabelecida/],
    ["CONFLITO", /Resolva o conflito/],
  ])("bloqueia aplicação e explica o estado %s", async (saveState, message) => {
    const user = userEvent.setup();
    const editor = createEditor();
    const range = findText(editor, "Trecho original.");
    editor.commands.setTextSelection(range);
    completeImmediately(completedEvent("SubstituirSelecao", {
      from: range.from,
      to: range.to,
      textoOriginal: "Trecho original.",
    }));
    renderPanel({ editor, editorRevision: 1, saveState });

    await user.type(await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" }), "Reescreva o parágrafo inicial.");
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByRole("button", { name: "Substituir seleção" })).toBeDisabled();
    expect(editor.getText()).toContain("Trecho original.");
  });

  it("permite copiar, gerar novamente e rejeitar sem aplicação implícita", async () => {
    const user = userEvent.setup();
    completeImmediately(completedEvent("ResponderNoPainel"));
    const editor = createEditor();
    const originalJson = editor.getJSON();
    renderPanel({ editor });

    await user.type(
      await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" }),
      "Analise a peça.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    await screen.findByRole("heading", { name: "Resposta da IA" });

    await user.click(screen.getByRole("button", { name: "Copiar" }));
    expect(await navigator.clipboard.readText()).toBe("Texto sugerido");

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(mockedStream).toHaveBeenCalledTimes(2));
    const turns = screen.getAllByLabelText("Troca com o assistente");
    await user.click(within(turns.at(-1)!).getByRole("button", { name: "Rejeitar" }));

    expect(screen.getAllByRole("heading", { name: "Resposta da IA" })).toHaveLength(2);
    expect(within(turns.at(-1)!).getByText(/Sugestão rejeitada/)).toBeVisible();
    expect(editor.getJSON()).toEqual(originalJson);
  });

  it("preserva a conversa ao fechar e reabrir o painel", async () => {
    const user = userEvent.setup();
    completeImmediately(completedEvent("ResponderNoPainel"));
    const editor = createEditor();
    const view = renderPanel({ editor });

    await user.type(
      await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" }),
      "Analise este argumento.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    expect(await screen.findByRole("heading", { name: "Resposta da IA" })).toBeVisible();

    view.rerender(panel({ open: false, editor }));
    expect(screen.queryByRole("heading", { name: "Resposta da IA" })).not.toBeInTheDocument();
    view.rerender(panel({ open: true, editor }));

    expect(await screen.findByRole("heading", { name: "Resposta da IA" })).toBeVisible();
    expect(screen.getByText("Analise este argumento.")).toBeVisible();
  });

  it("permite ampliar a largura e expandir o assistente", async () => {
    const user = userEvent.setup();
    renderPanel();

    const resize = await screen.findByRole("button", { name: "Aumentar largura do assistente" });
    await user.click(resize);
    expect(screen.getByRole("button", { name: "Reduzir largura do assistente" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Expandir assistente" }));
    expect(screen.getByRole("button", { name: "Restaurar assistente" })).toHaveAttribute("aria-expanded", "true");
  });
});

function renderPanel(overrides: Partial<ComponentProps<typeof AssistantPanel>> = {}) {
  return render(panel(overrides));
}

function panel(overrides: Partial<ComponentProps<typeof AssistantPanel>> = {}) {
  const { editor = createEditor(), ...props } = overrides;
  return <AssistantPanel
    open
    editor={editor}
    peca={peca}
    editorRevision={1}
    saveState="SALVO"
    capabilities={capabilities}
    onCapabilitiesInvalidated={() => undefined}
    onClose={() => undefined}
    ensurePersisted={async () => peca.versao}
    {...props}
  />;
}

function createEditor(): Editor {
  const editor = new Editor({
    extensions: [StarterKit],
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Trecho original." }] }],
    },
  });
  editors.push(editor);
  return editor;
}

function findText(editor: Editor, text: string): { from: number; to: number } {
  let result: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, position) => {
    if (result || !node.isText || !node.text) return;
    const index = node.text.indexOf(text);
    if (index >= 0) result = { from: position + index, to: position + index + text.length };
  });
  if (!result) throw new Error(`Texto não encontrado no editor: ${text}`);
  return result;
}

function completeImmediately(event: AssistantCompletedEvent) {
  mockedStream.mockImplementation(async (_conversationId, _request, handlers) => {
    handlers.onStarted?.({ solicitacaoId: "sol-1", clientRequestId: "req-1" });
    handlers.onDelta?.(event.sugestao.texto);
    handlers.onCompleted(event);
  });
}

function completedEvent(
  operation: AssistantOperation,
  anchor: Partial<AssistantCompletedEvent["sugestao"]["ancora"]> = {},
): AssistantCompletedEvent {
  return {
    sugestao: {
      id: "sugestao-1",
      modo: operation === "SubstituirSelecao" ? "Reescrever" : "Perguntar",
      operacaoSugerida: operation,
      titulo: "Resposta da IA",
      texto: "Texto sugerido",
      resumo: "Resumo da resposta.",
      alertas: [{ codigo: "VERIFICAR", mensagem: "Confirme as informações antes de usar." }],
      achados: [],
      ancora: {
        from: null,
        to: null,
        posicao: null,
        revisaoEditor: 1,
        textoOriginal: null,
        ...anchor,
      },
    },
    uso: { entradaTokens: 10, saidaTokens: 5 },
    modelo: "modelo-teste",
  };
}

const capabilities: AssistantCapabilities = {
  habilitado: true,
  features: ["AI_ASSISTANT", "AI_EDIT", "AI_REVIEW"],
  modos: ["Perguntar", "Redigir", "Reescrever", "Revisar"],
  limites: {
    instrucaoCaracteres: 4_000,
    contextoDocumentoCaracteres: 60_000,
    contextoAdicionalCaracteres: 8_000,
  },
  suportaStreaming: true,
  suportaHistorico: true,
  suportaConversaLivre: true,
};

const chatOnlyCapabilities: AssistantCapabilities = {
  ...capabilities,
  features: ["AI_ASSISTANT"],
  modos: ["Perguntar"],
};

const pendingTransparency: AssistantTransparency = {
  versao: "ai-transparency-v1",
  confirmado: false,
  confirmadoEm: null,
  titulo: "Uso de inteligência artificial",
  mensagem: "Algumas informações do caso poderão ser processadas por provedores de inteligência artificial.",
  avisoDeRevisao: "As respostas devem ser revisadas pelo profissional responsável.",
  politicaDePrivacidadeUrl: null,
};

const confirmedTransparency: AssistantTransparency = {
  ...pendingTransparency,
  confirmado: true,
  confirmadoEm: "2026-10-01T03:30:00Z",
};

const peca: Peca = {
  id: "peca-1",
  casoId: "caso-1",
  titulo: "Peça de teste",
  status: "Rascunho",
  versao: 1,
  templateId: null,
  conteudoJson: { type: "doc", content: [{ type: "paragraph" }] },
  pageConfig: { format: "A4", marginTop: 25, marginBottom: 20, marginLeft: 30, marginRight: 20 },
  headerJson: null,
  footerJson: null,
  styles: { fontFamily: "Times New Roman", fontSize: 12, lineHeight: 1.5, textAlign: "justify" },
  dataCriacao: "2026-09-30T00:00:00Z",
  dataAtualizacao: "2026-09-30T00:00:00Z",
};
