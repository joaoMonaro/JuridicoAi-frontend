import { expect, test } from "@playwright/test";

const caseId = "11111111-1111-1111-1111-111111111111";

test.beforeEach(async ({ page, request }) => {
  await request.post("http://127.0.0.1:5299/__e2e/reset");
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

test("reescreve seleção, salva e mantém o conteúdo após reload", async ({ page }) => {
  await page.goto(`/casos/${caseId}`);

  const editor = page.locator(".ProseMirror");
  await expect(editor).toContainText("Trecho original.");
  await editor.click();
  await page.keyboard.press("Control+A");

  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await page.getByRole("button", { name: "Reescrever", exact: true }).click();
  await page.getByRole("button", { name: "Enviar para IA" }).click();

  const assistant = page.getByRole("complementary", { name: "Assistente de IA" });
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toBeVisible();
  await expect(assistant.getByText("Trecho original.", { exact: true })).toBeVisible();
  await expect(assistant.locator("textarea").last()).toHaveValue("Trecho jurídico revisado pela IA.");
  await expect(editor).toContainText("Trecho original.");

  const autosave = page.waitForResponse((response) =>
    response.request().method() === "PATCH" && response.url().endsWith("/api/pecas/22222222-2222-2222-2222-222222222222"));
  await page.getByRole("button", { name: "Substituir seleção" }).click();

  await expect(editor).toContainText("Trecho jurídico revisado pela IA.");
  await expect(editor).not.toContainText("Trecho original.");
  await expect(page.getByText(/Sugestão aplicada/)).toBeVisible();
  expect((await autosave).status()).toBe(200);
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();

  await page.reload();

  await expect(page.locator(".ProseMirror")).toContainText("Trecho jurídico revisado pela IA.");
  await expect(page.locator(".ProseMirror")).not.toContainText("Trecho original.");
});
