import { apiRequest } from "@/lib/api-client";

export function logout(): Promise<void> {
  return apiRequest<void>("/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}
