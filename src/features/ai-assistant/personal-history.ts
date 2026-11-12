import { apiFetch, ApiError } from "@/lib/api-client";
import type { AuthUser } from "@/features/auth/types";
import type { JSONContent } from "@tiptap/core";

export interface PersonalSession { accessToken: string; expiresAt: number; user: AuthUser }
interface LoginResponse { accessToken: string; expiresIn: number; user: AuthUser }
const key = "juridicoai.personal-history-session";
let sessionEpoch = 0;
export function personalSession(): PersonalSession | null {
  try { const session = JSON.parse(sessionStorage.getItem(key) ?? "null") as PersonalSession | null;
    return session?.accessToken && session.expiresAt > Date.now() ? session : null;
  } catch { return null; }
}
function save(response: LoginResponse): PersonalSession {
  const session = { accessToken: response.accessToken, user: response.user, expiresAt: Date.now() + response.expiresIn * 1000 };
  sessionStorage.setItem(key, JSON.stringify(session)); return session;
}
async function auth(path: string, body?: unknown): Promise<PersonalSession> {
  const epoch = sessionEpoch;
  const response = await apiFetch(`/auth/pessoal/${path}`, { method: "POST", headers: { Authorization: "" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await response.json() as LoginResponse;
  if (epoch !== sessionEpoch) throw new DOMException("A sessão pessoal foi alterada.", "AbortError");
  return save(value);
}
export const personalLogin = (email: string, senha: string) => { sessionEpoch++; return auth("login", { email, senha }); };
let refreshing: Promise<PersonalSession> | null = null;
export function personalRefresh(): Promise<PersonalSession> {
  refreshing ??= auth("refresh").catch(error => { if (error instanceof ApiError && error.status === 401) sessionStorage.removeItem(key); throw error; }).finally(() => { refreshing = null; });
  return refreshing;
}
export async function personalLogout() {
  sessionEpoch++;
  if (refreshing) await refreshing.catch(() => undefined);
  await apiFetch("/auth/pessoal/logout", { method: "POST", headers: { Authorization: "" } }); sessionStorage.removeItem(key);
}
export async function personalFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = personalSession() ?? await personalRefresh();
  const send = (token: string) => apiFetch(`/assistente/v2/pessoal${path}`, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), Authorization: `Bearer ${token}` } });
  try { return await send(session.accessToken); }
  catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw error; return send((await personalRefresh()).accessToken); }
}
export async function personalRequest<T>(path: string, init?: RequestInit): Promise<T> { return (await personalFetch(path, init)).json() as Promise<T>; }
export interface PersonalConversation { id: string; titulo: string; criadaEm: string; atualizadaEm: string }
export interface PersonalConversationPage { conversas: PersonalConversation[]; proximoCursor: string | null }
export interface PersonalMessage { id: string; sequencia: number; autor: string; texto: string; criadaEm: string; estado: string; titulo: string | null; contextoFornecido: string | null; propostaId: string | null; alertas: { codigo: string; mensagem: string }[] }
export interface PersonalAttachment { id: string; nome: string; tamanhoBytes: number; criadoEm: string }
export interface PersonalProposal { id: string; conversaId: string; grupos: { id: string; estado: string; explicacao: string; original: JSONContent[]; proposto: JSONContent[] }[] }
export interface DeletionProtocol { requestId: string; conversaId: string; estado: string; autorizadaEm: string; concluidaEm: string | null; codigoErro: string | null; eliminadaDasCopias: boolean }
export function deletionRequestId(userId: string, conversationId: string) {
  const storageKey = `juridicoai.history.deletion.${userId}.${conversationId}`;
  const requestId = sessionStorage.getItem(storageKey) ?? crypto.randomUUID(); sessionStorage.setItem(storageKey, requestId); return requestId;
}
