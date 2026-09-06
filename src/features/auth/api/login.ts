import type { AuthResponse, LoginInput } from "@/features/auth/types";
import { apiRequest } from "@/lib/api-client";

export function login(input: LoginInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(input),
  });
}
