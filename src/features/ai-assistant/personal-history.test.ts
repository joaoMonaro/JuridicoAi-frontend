import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "@/lib/api-client";
import { getAccessToken } from "@/features/auth/auth-session";
import { deletionRequestId, personalFetch, personalLogin, personalLogout } from "./personal-history";
vi.mock("@/lib/api-client", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/api-client")>(), apiFetch: vi.fn() }));
const user = { id: "owner", nome: "Titular", email: "titular@example.test" };
const response = () => new Response(JSON.stringify({ accessToken: "history", expiresIn: 900, user }));
beforeEach(() => { sessionStorage.clear(); vi.mocked(apiFetch).mockReset(); });
it("sessão pessoal não substitui nem envia o token organizacional", async () => {
  sessionStorage.setItem("juridicoai.auth-session", JSON.stringify({ accessToken: "organization", expiresAt: Date.now() + 60000 }));
  vi.mocked(apiFetch).mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response("[]"));
  await personalLogin(user.email, "senha"); await personalFetch("/conversas");
  expect(apiFetch).toHaveBeenNthCalledWith(1, "/auth/pessoal/login", expect.objectContaining({ headers: { Authorization: "" } }));
  expect(apiFetch).toHaveBeenNthCalledWith(2, "/assistente/v2/pessoal/conversas", expect.objectContaining({ headers: { Authorization: "Bearer history" } }));
  expect(getAccessToken()).toBe("organization");
});
it("consultas simultâneas compartilham uma rotação de refresh", async () => {
  let complete!: (value: Response) => void;
  vi.mocked(apiFetch).mockImplementation(path => path === "/auth/pessoal/refresh" ? new Promise(resolve => { complete = resolve; }) : Promise.resolve(new Response("[]")));
  const a = personalFetch("/conversas"); const b = personalFetch("/exclusoes");
  expect(apiFetch).toHaveBeenCalledTimes(1); complete(response()); await Promise.all([a, b]); expect(apiFetch).toHaveBeenCalledTimes(3);
});
it("401 renova apenas a sessão pessoal antes de repetir a leitura", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(response()); await personalLogin(user.email, "senha");
  vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError("Expirada", 401)).mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response("[]"));
  await personalFetch("/conversas");
  expect(apiFetch).toHaveBeenNthCalledWith(3, "/auth/pessoal/refresh", expect.objectContaining({ headers: { Authorization: "" } }));
});
it("falha ao revogar não declara a sessão encerrada", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(response()); await personalLogin(user.email, "senha");
  vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError("Sem conexão", 0)); await expect(personalLogout()).rejects.toThrow("Sem conexão");
  expect(sessionStorage.getItem("juridicoai.personal-history-session")).toContain("history");
});
it("identificador de exclusão persiste por usuário e conversa para reconciliar resposta perdida", () => {
  const id = deletionRequestId("owner", "conversation"); expect(deletionRequestId("owner", "conversation")).toBe(id);
  expect(deletionRequestId("other-owner", "conversation")).not.toBe(id); expect(deletionRequestId("owner", "other-conversation")).not.toBe(id);
});
it("logout espera a renovação em voo e impede que ela restaure o token local", async () => {
  let complete!: (value: Response) => void;
  vi.mocked(apiFetch).mockImplementation(path => path === "/auth/pessoal/refresh" ? new Promise(resolve => { complete = resolve; }) : Promise.resolve(new Response(null, { status: 204 })));
  const read = personalFetch("/conversas"); const readFailure = expect(read).rejects.toMatchObject({ name: "AbortError" });
  const logout = personalLogout(); complete(response()); await Promise.all([readFailure, logout]);
  expect(sessionStorage.getItem("juridicoai.personal-history-session")).toBeNull();
  expect(apiFetch).toHaveBeenCalledTimes(2); expect(apiFetch).toHaveBeenLastCalledWith("/auth/pessoal/logout", expect.anything());
});
