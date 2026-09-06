import { getAccessToken } from "@/features/auth/auth-session";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5299").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const accessToken = getAccessToken();

  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: init?.credentials ?? "include",
      headers,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Não foi possível conectar ao servidor.", 0);
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string; code?: string } | null;
    throw new ApiError(problem?.detail || "Não foi possível concluir a operação.", response.status, problem?.code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
