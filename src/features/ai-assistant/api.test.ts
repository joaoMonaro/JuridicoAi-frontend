import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamAssistantInteraction } from "./api";
import type { AssistantInteractionRequest } from "./types";
import { apiFetch } from "@/lib/api-client";
import { consumeAssistantEventStream } from "./sse-parser";

vi.mock("@/lib/api-client", async () => ({
  ...await vi.importActual("@/lib/api-client"), apiFetch: vi.fn(),
}));
vi.mock("./sse-parser", () => ({ consumeAssistantEventStream: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(consumeAssistantEventStream).mockReset();
});

describe("envio de interação", () => {
  it("envia o contrato atual pela conversa identificada e preserva streaming e cancelamento", async () => {
    const request: AssistantInteractionRequest = {
      clientRequestId: "pedido", texto: "Ajuste a introdução.", versaoPecaEsperada: 7,
      propostaReferenciadaId: "proposta", anexoIds: ["anexo"],
    };
    const response = new Response("", { status: 200 });
    vi.mocked(apiFetch).mockResolvedValue(response);
    const handlers = { onCompleted: vi.fn() };
    const controller = new AbortController();
    await streamAssistantInteraction("conversa", request, handlers, controller.signal);
    expect(apiFetch).toHaveBeenCalledOnce();
    const [path, options] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toBe("/assistente/v2/conversas/conversa/interacoes");
    expect(options).toMatchObject({ method: "POST", headers: { Accept: "text/event-stream" }, signal: controller.signal });
    expect(JSON.parse(options!.body as string)).toEqual({ clientRequestId: "pedido", texto: "Ajuste a introdução.",
      versaoPecaEsperada: 7, propostaReferenciadaId: "proposta", anexoIds: ["anexo"] });
    expect(consumeAssistantEventStream).toHaveBeenCalledExactlyOnceWith(response.body, handlers, 200, controller.signal);
  });

  it.each(["", "   "])("bloqueia envio sem conversa identificada, sem recorrer a outro endpoint (%j)", async id => {
    await expect(streamAssistantInteraction(id,
      { clientRequestId: "pedido", texto: "Explique a peça.", versaoPecaEsperada: 1 },
      { onCompleted: vi.fn() }, new AbortController().signal)).rejects.toMatchObject({ code: "AI_CONVERSATION_REQUIRED" });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(consumeAssistantEventStream).not.toHaveBeenCalled();
  });
});
