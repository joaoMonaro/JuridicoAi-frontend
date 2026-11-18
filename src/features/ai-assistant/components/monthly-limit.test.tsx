import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAssistantMonthlyLimit,
  getAssistantTransparency,
  streamAssistantInteraction,
} from "@/features/ai-assistant/api";
import { AssistantPanel } from "@/features/ai-assistant/components/assistant-panel";
import { MonthlyLimitBanner } from "@/features/ai-assistant/components/monthly-limit-banner";
import type { AssistantCapabilities, AssistantMonthlyLimit, AssistantTransparency } from "@/features/ai-assistant/types";
import { useAssistantHistory } from "@/features/ai-assistant/use-assistant-history";
import type { Peca } from "@/features/pecas/types";
import { ApiError } from "@/lib/api-client";

vi.mock("@/features/ai-assistant/api", () => ({
  confirmAssistantTransparency: vi.fn(),
  getAssistantMonthlyLimit: vi.fn(),
  getAssistantTransparency: vi.fn(),
  streamAssistantInteraction: vi.fn(),
  rejectAssistantResponse: vi.fn(),
}));

vi.mock("@/features/ai-assistant/use-assistant-history", () => ({ useAssistantHistory: vi.fn() }));

const editors: Editor[] = [];
const mockedTransparency = vi.mocked(getAssistantTransparency);
const mockedMonthlyLimit = vi.mocked(getAssistantMonthlyLimit);
const mockedStream = vi.mocked(streamAssistantInteraction);

function assertNoForbiddenFinancialTerms(container: HTMLElement) {
  const text = container.textContent ?? "";
  expect(text).not.toMatch(/\$|USD|dólar|dolar|orçamento|orcamento/i);
}

beforeEach(() => {
  vi.useRealTimers();
  mockedTransparency.mockReset();
  mockedMonthlyLimit.mockReset();
  mockedStream.mockReset();
  mockedTransparency.mockResolvedValue(confirmedTransparency);
  vi.mocked(useAssistantHistory).mockReturnValue({
    conversationId: "conversa-1",
    messages: [],
    loading: false,
    error: "",
    hasOlder: false,
    generating: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    loadOlder: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  vi.useRealTimers();
  for (const editor of editors.splice(0)) editor.destroy();
});

describe("MonthlyLimitBanner", () => {
  it("exibe carregamento, erro e indisponibilidade sem fingir 0% utilizado", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender, container } = render(
      <MonthlyLimitBanner limit={null} loading={true} error="" onRetry={onRetry} />,
    );
    expect(screen.getByText(/Consultando limite mensal/)).toBeVisible();
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    assertNoForbiddenFinancialTerms(container);

    rerender(<MonthlyLimitBanner limit={null} loading={false} error="Falha de rede" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível consultar o limite mensal.");
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(onRetry).toHaveBeenCalledOnce();
    assertNoForbiddenFinancialTerms(container);

    rerender(
      <MonthlyLimitBanner
        limit={{
          periodoReferencia: new Date().toISOString().slice(0, 7),
          estado: "Indisponivel",
          percentualUtilizado: null,
          percentualReservado: null,
          percentualDisponivel: null,
          possuiReservasEmAndamento: false,
          bloqueadoParaNovasChamadas: true,
          mensagemStatus: "O assistente de IA está temporariamente indisponível.",
        }}
        loading={false}
        error=""
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("O assistente de IA está temporariamente indisponível.");
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    assertNoForbiddenFinancialTerms(container);
  });

  it("separa utilizado e reservado em andamento, limita percentuais ao intervalo e exibe alertas de 70% e 90%", () => {
    const { rerender, container } = render(
      <MonthlyLimitBanner
        limit={{
          periodoReferencia: new Date().toISOString().slice(0, 7),
          estado: "Atencao70",
          percentualUtilizado: 70,
          percentualReservado: 15,
          percentualDisponivel: 15,
          possuiReservasEmAndamento: true,
          bloqueadoParaNovasChamadas: false,
          mensagemStatus: "Você utilizou 70% do limite mensal.",
        }}
        loading={false}
        error=""
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText(/Você utilizou 70% do limite mensal/)).toBeVisible();
    expect(screen.getByText(/Utilizado: 70%/)).toBeVisible();
    expect(screen.getByText(/Reservado em andamento: 15%/)).toBeVisible();
    expect(screen.getByText(/Disponível: 15%/)).toBeVisible();
    assertNoForbiddenFinancialTerms(container);

    rerender(
      <MonthlyLimitBanner
        limit={{
          periodoReferencia: new Date().toISOString().slice(0, 7),
          estado: "Critico90",
          percentualUtilizado: 112,
          percentualReservado: -5,
          percentualDisponivel: -2,
          possuiReservasEmAndamento: false,
          bloqueadoParaNovasChamadas: false,
          mensagemStatus: "Restam 10% do limite mensal.",
        }}
        loading={false}
        error=""
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText(/Restam 10% do limite mensal/)).toBeVisible();
    expect(screen.getByText(/Utilizado: 100%/)).toBeVisible();
    expect(screen.getByText(/Disponível: 0%/)).toBeVisible();
    assertNoForbiddenFinancialTerms(container);
  });

  it("exibe insuficiência antes de 100% e limite mensal atingido sem termos monetários", () => {
    const { rerender, container } = render(
      <MonthlyLimitBanner
        limit={{
          periodoReferencia: new Date().toISOString().slice(0, 7),
          estado: "Critico90",
          percentualUtilizado: 85,
          percentualReservado: 15,
          percentualDisponivel: 0,
          possuiReservasEmAndamento: true,
          bloqueadoParaNovasChamadas: true,
          mensagemStatus: "Limite disponível insuficiente para esta operação.",
        }}
        loading={false}
        error=""
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/Limite disponível insuficiente para esta operação/)).toBeVisible();
    expect(screen.getByText(/Reservado em andamento: 15%/)).toBeVisible();
    assertNoForbiddenFinancialTerms(container);

    rerender(
      <MonthlyLimitBanner
        limit={{
          periodoReferencia: new Date().toISOString().slice(0, 7),
          estado: "Atingido",
          percentualUtilizado: 100,
          percentualReservado: 0,
          percentualDisponivel: 0,
          possuiReservasEmAndamento: false,
          bloqueadoParaNovasChamadas: true,
          mensagemStatus: "Limite mensal atingido.",
        }}
        loading={false}
        error=""
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Limite mensal atingido")).toBeVisible();
    assertNoForbiddenFinancialTerms(container);
  });
});

describe("AssistantPanel — limite mensal", () => {
  it("atualiza consumo após conclusão e falha, preserva instrução no bloqueio e mantém histórico acessível", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    const onCapabilitiesInvalidated = vi.fn();
    const availableLimit: AssistantMonthlyLimit = {
      periodoReferencia: new Date().toISOString().slice(0, 7),
      estado: "Disponivel",
      percentualUtilizado: 25,
      percentualReservado: 0,
      percentualDisponivel: 75,
      possuiReservasEmAndamento: false,
      bloqueadoParaNovasChamadas: false,
      mensagemStatus: null,
    };
    const reachedLimit: AssistantMonthlyLimit = {
      periodoReferencia: new Date().toISOString().slice(0, 7),
      estado: "Atingido",
      percentualUtilizado: 100,
      percentualReservado: 0,
      percentualDisponivel: 0,
      possuiReservasEmAndamento: false,
      bloqueadoParaNovasChamadas: true,
      mensagemStatus: "Limite mensal atingido.",
    };

    mockedMonthlyLimit
      .mockResolvedValueOnce(availableLimit)
      .mockResolvedValueOnce(reachedLimit);

    mockedStream.mockRejectedValueOnce(new ApiError("Limite disponível insuficiente para esta operação.", 429, "AI_MONTHLY_LIMIT_INSUFFICIENT"));
    vi.mocked(useAssistantHistory).mockReturnValue({
      conversationId: "conversa-1",
      messages: [
        {
          id: "msg-1",
          sequencia: 1,
          autor: "Usuario",
          texto: "Mensagem histórica preservada",
          propostaId: null,
          criadaEm: "2026-11-18T12:00:00Z",
          clientRequestId: "req-old",
          respostaAId: null,
          estado: "Concluida",
          codigoErro: null,
        },
        {
          id: "msg-2",
          sequencia: 2,
          autor: "Assistente",
          texto: "Resposta anterior visível",
          propostaId: null,
          criadaEm: "2026-11-18T12:00:05Z",
          clientRequestId: null,
          respostaAId: "msg-1",
          estado: "Concluida",
          codigoErro: null,
        },
      ],
      loading: false,
      error: "",
      hasOlder: false,
      generating: false,
      refresh: vi.fn().mockResolvedValue(undefined),
      loadOlder: vi.fn().mockResolvedValue(undefined),
    });

    const view = render(panel({ editor, onCapabilitiesInvalidated }));
    await screen.findByText(/Limite mensal: 25% utilizado/);

    const composer = screen.getByRole("textbox", { name: "O que você quer que a IA faça?" });
    await user.type(composer, "Texto do usuário preservado");
    await user.click(screen.getByRole("button", { name: "Enviar para IA" }));

    await waitFor(() => expect(screen.getByText("Limite mensal atingido")).toBeVisible());
    expect(composer).toHaveValue("Texto do usuário preservado");
    expect(screen.getByRole("button", { name: "Enviar para IA" })).toBeDisabled();
    expect(screen.getByText("Mensagem histórica preservada")).toBeVisible();
    expect(screen.getByText("Resposta anterior visível")).toBeVisible();
    expect(onCapabilitiesInvalidated).not.toHaveBeenCalled();
    assertNoForbiddenFinancialTerms(view.container);
  });

  it("faz polling somente enquanto aberto com operação durável ativa e para ao fechar", async () => {
    vi.useFakeTimers();
    const editor = createEditor();
    mockedMonthlyLimit.mockResolvedValue({
      periodoReferencia: new Date().toISOString().slice(0, 7),
      estado: "Disponivel",
      percentualUtilizado: 30,
      percentualReservado: 10,
      percentualDisponivel: 60,
      possuiReservasEmAndamento: true,
      bloqueadoParaNovasChamadas: false,
      mensagemStatus: null,
    });
    vi.mocked(useAssistantHistory).mockReturnValue({
      conversationId: "conversa-1",
      messages: [],
      loading: false,
      error: "",
      hasOlder: false,
      generating: true,
      refresh: vi.fn().mockResolvedValue(undefined),
      loadOlder: vi.fn().mockResolvedValue(undefined),
    });

    const view = render(panel({ editor, open: true }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    const initialCalls = mockedMonthlyLimit.mock.calls.length;
    expect(initialCalls).toBe(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(5200); });
    expect(mockedMonthlyLimit.mock.calls.length).toBeGreaterThanOrEqual(3);

    const callsBeforeClose = mockedMonthlyLimit.mock.calls.length;
    view.rerender(panel({ editor, open: false }));
    await act(async () => { vi.advanceTimersByTime(6000); });
    expect(mockedMonthlyLimit.mock.calls.length).toBe(callsBeforeClose);
  });

  it("permite envio após falha temporária de consulta sem travar em 0% falso", async () => {
    const editor = createEditor();
    mockedMonthlyLimit.mockRejectedValueOnce(new Error("Erro 503"));
    render(panel({ editor }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível consultar o limite mensal."));
    expect(screen.queryByText(/Utilizado: 0%/)).not.toBeInTheDocument();

    mockedMonthlyLimit.mockResolvedValueOnce({
      periodoReferencia: new Date().toISOString().slice(0, 7),
      estado: "Disponivel",
      percentualUtilizado: 40,
      percentualReservado: 0,
      percentualDisponivel: 60,
      possuiReservasEmAndamento: false,
      bloqueadoParaNovasChamadas: false,
      mensagemStatus: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(screen.getByText(/Limite mensal: 40% utilizado/)).toBeVisible());
  });

  it("atualiza e desbloqueia quando reserva externa de outro usuário liquida, mesmo sem geração local", async () => {
    vi.useFakeTimers();
    const editor = createEditor();
    mockedMonthlyLimit
      .mockResolvedValueOnce({
        periodoReferencia: new Date().toISOString().slice(0, 7),
        estado: "Critico90",
        percentualUtilizado: 70,
        percentualReservado: 30,
        percentualDisponivel: 0,
        possuiReservasEmAndamento: true,
        bloqueadoParaNovasChamadas: true,
        mensagemStatus: "Limite disponível insuficiente para esta operação.",
      })
      .mockResolvedValueOnce({
        periodoReferencia: new Date().toISOString().slice(0, 7),
        estado: "Atencao70",
        percentualUtilizado: 75,
        percentualReservado: 0,
        percentualDisponivel: 25,
        possuiReservasEmAndamento: false,
        bloqueadoParaNovasChamadas: false,
        mensagemStatus: "Você utilizou 75% do limite mensal.",
      });

    render(panel({ editor, open: true }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    const composer = screen.getByRole("textbox", { name: "O que você quer que a IA faça?" });
    fireEvent.change(composer, { target: { value: "Pergunta preservada" } });
    expect(screen.getByRole("button", { name: "Enviar para IA" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeEnabled();

    await act(async () => { vi.advanceTimersByTime(2600); });
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText(/Você utilizou 75% do limite mensal/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Enviar para IA" })).toBeEnabled();
  });

  it("atualiza ao focar janela, na virada de mês UTC e cancela microtask quando fechado antes do disparo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-30T23:59:55Z"));
    const editor = createEditor();

    // Microtask cleanup: open then immediately unmount/close before microtask runs -> 0 requests!
    const quickView = render(panel({ editor, open: true }));
    quickView.rerender(panel({ editor, open: false }));
    await act(async () => { await Promise.resolve(); });
    expect(mockedMonthlyLimit).not.toHaveBeenCalled();

    mockedMonthlyLimit
      .mockResolvedValueOnce({
        periodoReferencia: new Date().toISOString().slice(0, 7),
        estado: "Atingido",
        percentualUtilizado: 100,
        percentualReservado: 0,
        percentualDisponivel: 0,
        possuiReservasEmAndamento: false,
        bloqueadoParaNovasChamadas: true,
        mensagemStatus: "Limite mensal atingido.",
      })
      .mockResolvedValueOnce({
        periodoReferencia: new Date().toISOString().slice(0, 7),
        estado: "Atingido",
        percentualUtilizado: 100,
        percentualReservado: 0,
        percentualDisponivel: 0,
        possuiReservasEmAndamento: false,
        bloqueadoParaNovasChamadas: true,
        mensagemStatus: "Limite mensal atingido.",
      })
      .mockResolvedValueOnce({
        periodoReferencia: "2026-12",
        estado: "Disponivel",
        percentualUtilizado: 0,
        percentualReservado: 0,
        percentualDisponivel: 100,
        possuiReservasEmAndamento: false,
        bloqueadoParaNovasChamadas: false,
        mensagemStatus: null,
      });

    quickView.rerender(panel({ editor, open: true }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Limite mensal atingido")).toBeVisible();

    // Focus refreshes while open
    fireEvent(window, new Event("focus"));
    await act(async () => { await Promise.resolve(); });
    expect(mockedMonthlyLimit).toHaveBeenCalledTimes(2);

    // Cross UTC midnight into 2026-12 -> boundary timer refreshes and unblocks!
    await act(async () => { vi.advanceTimersByTime(7000); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/Limite mensal: 0% utilizado/)).toBeVisible();
  });
});

function createEditor() {
  const editor = new Editor({
    extensions: [StarterKit],
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Trecho." }] }] },
  });
  editors.push(editor);
  return editor;
}

function panel(overrides: Partial<ComponentProps<typeof AssistantPanel>> = {}) {
  return (
    <AssistantPanel
      open={true}
      capabilities={capabilities}
      editor={createEditor()}
      peca={peca}
      editorRevision={1}
      saveState="SALVO"
      ensurePersisted={vi.fn().mockResolvedValue(1)}
      onCapabilitiesInvalidated={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />
  );
}

const capabilities: AssistantCapabilities = {
  habilitado: true,
  features: ["AI_ASSISTANT", "AI_EDIT", "AI_REVIEW"],
  modos: ["Perguntar", "Redigir", "Reescrever", "Revisar"],
  limites: { instrucaoCaracteres: 4_000, contextoDocumentoCaracteres: 60_000, contextoAdicionalCaracteres: 8_000 },
  suportaStreaming: true,
  suportaHistorico: true,
  suportaConversaLivre: true,
};

const confirmedTransparency: AssistantTransparency = {
  versao: "ai-transparency-v1",
  confirmado: true,
  confirmadoEm: "2026-10-01T03:30:00Z",
  titulo: "Uso de inteligência artificial",
  mensagem: "Aviso",
  avisoDeRevisao: "Revisar",
  politicaDePrivacidadeUrl: null,
};

const peca: Peca = {
  id: "peca-1",
  casoId: "caso-1",
  titulo: "Peça",
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
