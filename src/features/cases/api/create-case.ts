import type { Case, CreateCaseInput } from "@/features/cases/types/case";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5299").replace(/\/$/, "");

export async function createCase(input: CreateCaseInput): Promise<Case> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/casos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Verifique se a API está disponível.");
  }

  if (!response.ok) {
    throw new Error(
      response.status >= 500
        ? "O servidor não conseguiu criar o caso. Tente novamente."
        : "Não foi possível criar o caso. Revise os dados informados.",
    );
  }

  return response.json() as Promise<Case>;
}
