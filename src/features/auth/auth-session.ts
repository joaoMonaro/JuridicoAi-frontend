import type { AuthResponse, AuthSession } from "@/features/auth/types";

const AUTH_SESSION_KEY = "juridicoai.auth-session";

export function saveAuthSession(response: AuthResponse): AuthSession {
  const session = {
    ...response,
    expiresAt: Date.now() + response.expiresIn * 1000,
  };

  window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getAuthSession(): AuthSession | null {
  try {
    const stored = window.sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored) as AuthSession;
    if (!session.accessToken || session.expiresAt <= Date.now()) {
      clearAuthSession();
      return null;
    }
    return session;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function getAccessToken(): string | null {
  return getAuthSession()?.accessToken ?? null;
}

export function clearAuthSession() {
  try {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // A ausência do storage não deve impedir a limpeza lógica da sessão.
  }
}
