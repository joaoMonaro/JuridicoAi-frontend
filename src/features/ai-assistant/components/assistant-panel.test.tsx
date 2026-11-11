import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmAssistantTransparency,
  getAssistantTransparency,
  streamAssistantRequest,
} from "@/features/ai-assistant/api";
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
  getAssistantTransparency: vi.fn(),
  streamAssistantRequest: vi.fn(),
  rejectAssistantResponse: vi.fn(),
}));

vi.mock("@/features/contextos/api", () => ({
  listarContextos: vi.fn(),
}));

const editors: Editor[] = [];
const mockedTransparency = vi.mocked(getAssistantTransparency);
const mockedConfirmTransparency = vi.mocked(confirmAssistantTransparency);
const mockedStream = vi.mocked(streamAssistantRequest);
const mockedContexts = vi.mocked(listarContextos);

beforeEach(() => {
  mockedTransparency.mockReset();
  mockedConfirmTransparency.mockReset();
  mockedStream.mockReset();
  mockedContexts.mockReset();
  mockedTransparency.mockResolvedValue(confirmedTransparency);
  mockedConfirmTransparency.mockResolvedValue(confirmedTransparency);
  mockedContexts.mockResolvedValue([]);
});

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

describe("AssistantPanel", () => {
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

  it("impede envio vazio e explica quando Reescrever não possui seleção", async () => {
    const user = userEvent.setup();
    renderPanel();

    const send = await screen.findByRole("button", { name: "Enviar para IA" });
    expect(send).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Reescrever" }));
    expect(send).toBeEnabled();
    await user.click(send);

    expect(await screen.findByRole("alert")).toHaveTextContent("Selecione um trecho antes de usar esse escopo.");
    expect(mockedStream).not.toHaveBeenCalled();
  });

  it("envia pergunta sem seleção sem anexar conteúdo da Peça", async () => {
    const user = userEvent.setup();
    completeImmediately(completedEvent("ResponderNoPainel"));
    renderPanel();

    await user.type(
      await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" }),
      "O que falta nesta fundamentação?",
    );
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    await screen.findByRole("heading", { name: "Resposta da IA" });

    expect(mockedStream).toHaveBeenCalledOnce();
    const [, request] = mockedStream.mock.calls[0];
    expect(request).toMatchObject({
      modo: "Perguntar",
      instrucao: "O que falta nesta fundamentação?",
      operacaoPreferida: "ResponderNoPainel",
      contexto: {
        documento: {
          escopo: "Nenhum",
          texto: null,
          selecao: null,
        },
      },
    });
  });

  it("anexa automaticamente a seleção como chip e envia o snapshot capturado", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    const range = findText(editor, "Trecho original.");
    editor.commands.setTextSelection(range);
    completeImmediately(completedEvent("ResponderNoPainel"));
    renderPanel({ editor, editorRevision: 3 });

    expect(await screen.findByText("Seleção · 16 caracteres")).toBeVisible();
    editor.commands.setTextSelection(1);
    await user.type(
      screen.getByRole("textbox", { name: "O que você quer que a IA faça?" }),
      "Analise este trecho.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    await screen.findByRole("heading", { name: "Resposta da IA" });

    const [, request] = mockedStream.mock.calls[0];
    expect(request.contexto.documento).toMatchObject({
      escopo: "Selecao",
      texto: "Trecho original.",
      selecao: {
        from: range.from,
        to: range.to,
        textoOriginal: "Trecho original.",
      },
      revisaoEditor: 3,
    });
  });

  it("captura uma nova seleção quando o foco retorna do editor para o assistente", async () => {
    const editor = createEditor();
    renderPanel({ editor, editorRevision: 4 });
    const composer = await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" });
    expect(screen.queryByText(/Seleção · 16 caracteres/)).not.toBeInTheDocument();

    editor.commands.setTextSelection(findText(editor, "Trecho original."));
    fireEvent.focus(composer, { relatedTarget: editor.view.dom });

    expect(await screen.findByText("Seleção · 16 caracteres")).toBeVisible();
  });

  it("permite remover a seleção automática antes do envio", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    editor.commands.setTextSelection(findText(editor, "Trecho original."));
    completeImmediately(completedEvent("ResponderNoPainel"));
    renderPanel({ editor });

    await user.click(await screen.findByRole("button", { name: "Remover contexto: Seleção · 16 caracteres" }));
    await user.type(
      screen.getByRole("textbox", { name: "O que você quer que a IA faça?" }),
      "Responda sem usar a seleção.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    await screen.findByRole("heading", { name: "Resposta da IA" });

    const [, request] = mockedStream.mock.calls[0];
    expect(request.contexto.documento).toMatchObject({
      escopo: "Nenhum",
      texto: null,
      selecao: null,
    });
  });

  it("representa os contextos opcionais como chips removíveis", async () => {
    const user = userEvent.setup();
    mockedContexts.mockResolvedValue([{
      id: "contexto-1",
      casoId: peca.casoId,
      tipo: "Observacao",
      titulo: "Notas estratégicas",
      conteudo: "Conteúdo",
      dataCriacao: "2026-09-30T00:00:00Z",
      dataAtualizacao: "2026-09-30T00:00:00Z",
    }]);
    renderPanel();

    await user.click(await screen.findByText("+ Adicionar contexto"));
    const caseCheckbox = screen.getByRole("checkbox", { name: /Incluir dados do caso/ });
    const contextCheckbox = await screen.findByRole("checkbox", { name: /Notas estratégicas/ });
    await user.click(caseCheckbox);
    await user.click(contextCheckbox);
    await user.type(
      screen.getByRole("textbox", { name: "Informação apenas para este pedido" }),
      "Dado temporário.",
    );

    await user.click(screen.getByRole("button", { name: "Remover contexto: Dados essenciais do Caso" }));
    await user.click(screen.getByRole("button", { name: "Remover contexto: Notas estratégicas" }));
    await user.click(screen.getByRole("button", { name: /Remover contexto: Informação adicional/ }));

    expect(caseCheckbox).not.toBeChecked();
    expect(contextCheckbox).not.toBeChecked();
    expect(screen.getByRole("textbox", { name: "Informação apenas para este pedido" })).toHaveValue("");
  });

  it("envia seleção e somente os contextos explicitamente marcados", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    const range = findText(editor, "Trecho original.");
    editor.commands.setTextSelection(range);
    mockedContexts.mockResolvedValue([{
      id: "contexto-1",
      casoId: peca.casoId,
      tipo: "Observacao",
      titulo: "Notas estratégicas",
      conteudo: "Conteúdo",
      dataCriacao: "2026-09-30T00:00:00Z",
      dataAtualizacao: "2026-09-30T00:00:00Z",
    }]);
    completeImmediately(completedEvent("SubstituirSelecao", {
      from: range.from,
      to: range.to,
      textoOriginal: "Trecho original.",
    }));
    renderPanel({ editor });

    await user.click(await screen.findByRole("button", { name: "Reescrever" }));
    await user.click(screen.getByText("+ Adicionar contexto"));
    await user.click(screen.getByRole("checkbox", { name: /Incluir dados do caso/ }));
    await user.click(await screen.findByRole("checkbox", { name: /Notas estratégicas/ }));
    await user.type(
      screen.getByRole("textbox", { name: "Informação apenas para este pedido" }),
      "Considere o risco processual.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));
    await screen.findByRole("heading", { name: "Resposta da IA" });

    const [, request] = mockedStream.mock.calls[0];
    expect(request.contexto).toMatchObject({
      incluirDadosCaso: true,
      contextoCasoIds: ["contexto-1"],
      contextoAdicional: "Considere o risco processual.",
      documento: {
        escopo: "Selecao",
        selecao: {
          from: range.from,
          to: range.to,
          textoOriginal: "Trecho original.",
        },
      },
    });
  });

  it("anuncia streaming, agrega deltas e apresenta a conclusão", async () => {
    const user = userEvent.setup();
    let completeRequest: (() => void) | undefined;
    mockedStream.mockImplementation(async (_pecaId, _request, handlers) => {
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
    mockedStream.mockImplementation((_pecaId, _request, handlers, signal) => {
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

  it("preserva instrução e contexto adicional após erro recuperável", async () => {
    const user = userEvent.setup();
    mockedStream.mockRejectedValue(new ApiError("Falha temporária do provider.", 503, "AI_UNAVAILABLE"));
    renderPanel();
    const instruction = await screen.findByRole("textbox", { name: "O que você quer que a IA faça?" });

    await user.type(instruction, "Revise a fundamentação.");
    await user.click(screen.getByText("+ Adicionar contexto"));
    const additionalContext = screen.getByRole("textbox", { name: "Informação apenas para este pedido" });
    await user.type(additionalContext, "Considere o documento ainda não juntado.");
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha temporária do provider.");
    expect(instruction).toHaveValue("Revise a fundamentação.");
    expect(additionalContext).toHaveValue("Considere o documento ainda não juntado.");
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

    await user.click(await screen.findByRole("button", { name: "Reescrever" }));
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

    await user.click(await screen.findByRole("button", { name: "Reescrever" }));
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

    await user.click(await screen.findByRole("button", { name: "Reescrever" }));
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
  mockedStream.mockImplementation(async (_pecaId, _request, handlers) => {
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
  suportaHistorico: false,
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
