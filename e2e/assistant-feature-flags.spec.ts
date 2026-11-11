import { fakeApiUrl } from "./support/urls";
import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

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

test("kill switch oculta o acesso e impede abertura pelo atalho", async ({ page, request }) => {
  await configureScenario(request, { capabilities: "disabled" });
  await openPieceAndWaitCapabilities(page);

  await expect(page.getByRole("button", { name: "Abrir assistente de IA" })).toHaveCount(0);
  await page.keyboard.press("Control+Alt+a");
  await expect(page.getByRole("complementary", { name: "Assistente de IA" })).toHaveCount(0);
});

test("falha ao carregar capacidades mantém a funcionalidade fechada", async ({ page, request }) => {
  await configureScenario(request, { capabilities: "error" });
  await openPieceAndWaitCapabilities(page, 503);

  await expect(page.getByRole("button", { name: "Abrir assistente de IA" })).toHaveCount(0);
  await page.keyboard.press("Control+Alt+a");
  await expect(page.getByRole("complementary", { name: "Assistente de IA" })).toHaveCount(0);
});

test("tenant com acesso apenas a chat não recebe ações de edição ou revisão", async ({ page, request }) => {
  await configureScenario(request, { capabilities: "chat" });
  await openPieceAndWaitCapabilities(page);
  await page.locator('[aria-label="Abrir assistente de IA"]:visible').click();

  const mode = page.getByRole("combobox", { name: "Modo" });
  await expect(mode).toHaveValue("Perguntar");
  await expect(mode.locator("option")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Reescrever", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Expandir", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Revisar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Novo trecho", exact: true })).toHaveCount(0);
});

test("revoga um modo após recusa e o restaura no rollback sem perder o pedido", async ({ page, request }) => {
  const editor = await openPieceAndWaitCapabilities(page);
  await page.locator('[aria-label="Abrir assistente de IA"]:visible').click();
  await page.getByRole("button", { name: "Novo trecho", exact: true }).click();
  const instruction = page.getByRole("textbox", { name: "O que você quer que a IA faça?" });
  const originalInstruction = await instruction.inputValue();

  await configureScenario(request, { capabilities: "chat" });
  await page.getByRole("button", { name: "Enviar para IA" }).click();

  await expect(page.getByRole("alert")).toContainText("não está habilitada");
  await expect(page.getByRole("button", { name: "Reescrever", exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Modo" })).toHaveValue("Perguntar");
  await expect(instruction).toHaveValue(originalInstruction);
  await expect(editor).toHaveText("Trecho original.");

  await configureScenario(request, { capabilities: "all" });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  await expect(page.getByRole("button", { name: "Reescrever", exact: true })).toBeVisible();
  await expect(instruction).toHaveValue(originalInstruction);
});

test("revogação do acesso base fecha o painel e oculta o acionador", async ({ page, request }) => {
  const editor = await openPieceAndWaitCapabilities(page);
  await page.locator('[aria-label="Abrir assistente de IA"]:visible').click();
  const instruction = page.getByRole("textbox", { name: "O que você quer que a IA faça?" });
  await instruction.fill("Analise a fundamentação.");

  await configureScenario(request, { capabilities: "disabled" });
  await page.getByRole("button", { name: "Enviar para IA" }).click();

  await expect(page.getByRole("complementary", { name: "Assistente de IA" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir assistente de IA" })).toHaveCount(0);
  await expect(editor).toHaveText("Trecho original.");
});

async function openPieceAndWaitCapabilities(page: Page, expectedStatus = 200) {
  const capabilitiesResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/assistente/capacidades") && response.status() === expectedStatus);
  await page.goto(`/casos/${caseId}`);
  await capabilitiesResponse;
  const editor = page.locator(".ProseMirror");
  await expect(editor).toHaveText("Trecho original.");
  return editor;
}

async function configureScenario(request: APIRequestContext, scenario: Record<string, string>) {
  const response = await request.post(`${fakeApiUrl}/__e2e/scenario`, { data: scenario });
  expect(response.ok()).toBeTruthy();
}
