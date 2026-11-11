import { fakeApiUrl } from "./support/urls";
import { expect, test } from "@playwright/test";

const caseId = "11111111-1111-1111-1111-111111111111";

test.beforeEach(async ({ page, request }) => {
  await request.post(`${fakeApiUrl}/__e2e/reset`);
  await request.post(`${fakeApiUrl}/__e2e/scenario`, { data: { transparency: "pending" } });
  await page.addInitScript(() => {
    window.sessionStorage.setItem("juridicoai.auth-session", JSON.stringify({
      accessToken: "token-e2e-ficticio",
      expiresIn: 3_600,
      expiresAt: Date.now() + 3_600_000,
      user: { id: "user-e2e", nome: "Usuário E2E", email: "e2e@example.test" },
      organization: { id: "org-e2e", nome: "Organização E2E" },
      role: "Owner",
    }));
  });
});

test("confirma o aviso no primeiro uso e mantém a confirmação", async ({ page }) => {
  await page.goto(`/casos/${caseId}`);
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho original.");
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();

  const dialog = page.getByRole("dialog", { name: "Uso de inteligência artificial" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("poderão ser processadas por provedores de inteligência artificial");
  await expect(dialog).toContainText("devem ser revisadas pelo profissional responsável");
  const confirm = page.getByRole("button", { name: "Entendi e continuar" });
  await expect(confirm).toBeFocused();

  const confirmation = page.waitForResponse((response) =>
    response.request().method() === "POST"
    && response.url().endsWith("/api/assistente/transparencia/confirmacoes"));
  await page.keyboard.press("Enter");
  expect((await confirmation).status()).toBe(200);

  const instruction = page.getByRole("textbox", { name: "O que você quer que a IA faça?" });
  await expect(dialog).not.toBeVisible();
  await expect(instruction).toBeFocused();

  await page.getByRole("button", { name: "Fechar assistente" }).click();
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(instruction).toBeFocused();
});
