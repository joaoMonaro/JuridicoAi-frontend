import { fakeApiUrl } from "./support/urls";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const caseId = "11111111-1111-1111-1111-111111111111";

test.beforeEach(async ({ page, request }) => {
  await request.post(`${fakeApiUrl}/__e2e/reset`);
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

test("Ctrl+Alt+A abre no Linux, posiciona o foco e ignora repetição", async ({ page }) => {
  const editor = await openPiece(page);
  await editor.focus();

  await page.keyboard.press("Control+Alt+a");

  const panel = page.getByRole("complementary", { name: "Assistente de IA" });
  const instruction = page.getByRole("textbox", { name: "O que você quer que a IA faça?" });
  await expect(panel).toBeVisible();
  await expect(instruction).toBeFocused();
  await expect(page.locator('[title="Abrir assistente de IA (Ctrl+Alt+A)"]:visible')).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      altKey: true,
      bubbles: true,
      ctrlKey: true,
      key: "a",
      repeat: true,
    }));
  });
  await expect(panel).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(editor).toBeFocused();

  await page.keyboard.press("Meta+Alt+a");
  await expect(panel).not.toBeVisible();
});

test("Cmd+Alt+A abre no macOS e Ctrl não aciona o painel", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "platform", { configurable: true, get: () => "MacIntel" });
  });
  await openPiece(page);

  await page.keyboard.press("Control+Alt+a");
  await expect(page.getByRole("complementary", { name: "Assistente de IA" })).not.toBeVisible();

  await page.keyboard.press("Meta+Alt+a");
  await expect(page.getByRole("complementary", { name: "Assistente de IA" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "O que você quer que a IA faça?" })).toBeFocused();
  await expect(page.locator('[title="Abrir assistente de IA (Cmd+Alt+A)"]:visible')).toBeVisible();
});

test("Tab percorre composer e ação de envio em ordem previsível", async ({ page }) => {
  await openPiece(page);
  await page.keyboard.press("Control+Alt+a");

  const instruction = page.getByRole("textbox", { name: "O que você quer que a IA faça?" });
  await expect(instruction).toBeFocused();
  await page.keyboard.type("Analise o trecho atual.");

  await page.keyboard.press("Tab");
  await expect(page.locator("summary", { hasText: "Contexto adicional e dados do caso" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Enviar para IA" })).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("summary", { hasText: "Contexto adicional e dados do caso" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(instruction).toBeFocused();
});

test("Escape cancela o stream antes de fechar e devolve o foco ao editor", async ({ page, request }) => {
  await request.post(`${fakeApiUrl}/__e2e/scenario`, { data: { assistant: "slow" } });
  const editor = await openPiece(page);
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Control+Alt+a");
  await expect(page.getByRole("textbox", { name: "O que você quer que a IA faça?" })).toBeFocused();

  await activateWithKeyboard(page.getByRole("button", { name: "Reescrever", exact: true }), page);
  await activateWithKeyboard(page.getByRole("button", { name: "Enviar para IA" }), page);
  await expect(page.getByText("A IA está elaborando a resposta...", { exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("alert")).toContainText("Solicitação cancelada.");
  await expect(page.getByRole("complementary", { name: "Assistente de IA" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Assistente de IA" })).not.toBeVisible();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveText("Trecho original.");
});

test("aplica com Enter e preserva undo e redo do editor", async ({ page }) => {
  const editor = await openPiece(page);
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Control+Alt+a");
  await expect(page.getByRole("textbox", { name: "O que você quer que a IA faça?" })).toBeFocused();

  await activateWithKeyboard(page.getByRole("button", { name: "Reescrever", exact: true }), page);
  await activateWithKeyboard(page.getByRole("button", { name: "Enviar para IA" }), page);
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toBeVisible();

  await activateWithKeyboard(page.getByRole("button", { name: "Substituir seleção" }), page);
  await expect(editor).toBeFocused();
  await expect(editor).toHaveText("Trecho jurídico revisado pela IA.");

  await page.keyboard.press("Control+z");
  await expect(editor).toHaveText("Trecho original.");
  await page.keyboard.press("Control+Shift+z");
  await expect(editor).toHaveText("Trecho jurídico revisado pela IA.");
});

async function openPiece(page: Page) {
  await page.goto(`/casos/${caseId}`);
  const editor = page.locator(".ProseMirror");
  await expect(editor).toHaveText("Trecho original.");
  return editor;
}

async function activateWithKeyboard(locator: ReturnType<Page["locator"]>, page: Page) {
  await locator.focus();
  await expect(locator).toBeFocused();
  await page.keyboard.press("Enter");
}
