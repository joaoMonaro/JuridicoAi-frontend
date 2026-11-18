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

test("tenant somente de conversa recebe caixa única sem ações de edição", async ({ page, request }) => {
  await configureScenario(request, { capabilities: "chat" }); await openPieceAndWaitCapabilities(page);
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  const instruction = page.getByRole("textbox", { name: "O que você quer que a IA faça?" });
  await expect(instruction).toBeEnabled(); await expect(page.getByRole("combobox", { name: "Modo" })).toHaveCount(0);
  for (const name of ["Reescrever", "Expandir", "Revisar", "Novo trecho", "Criar minuta", "Melhorar redação", "Explicar trecho"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await instruction.fill("Explique a fundamentação."); await page.getByRole("button", { name: "Enviar para IA" }).click();
  await expect(page.getByRole("heading", { name: "Resposta da IA" })).toBeVisible();
});

test("revogar edição preserva pedido e rollback permite reenviá-lo naturalmente", async ({ page, request }) => {
  const editor = await openPieceAndWaitCapabilities(page);
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  const instruction = page.getByRole("textbox", { name: "O que você quer que a IA faça?" });
  await instruction.fill("Reescreva o primeiro parágrafo preservando os fatos."); const original = await instruction.inputValue();
  await configureScenario(request, { capabilities: "chat", reply: "edit" });
  await page.getByRole("button", { name: "Enviar para IA" }).click();
  await expect(page.getByRole("alert")).toContainText("não está habilitada");
  await expect(instruction).toHaveValue(original); await expect(editor).toHaveText("Trecho original.");
  await configureScenario(request, { capabilities: "all" }); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("button", { name: "Enviar para IA" }).click();
  await expect(page.getByRole("button", { name: "Aprovar todas", exact: true })).toBeEnabled();
});

test("backend sem suporte ao chat informa indisponibilidade sem reintroduzir controles antigos", async ({ page, request }) => {
  await configureScenario(request, { capabilities: "legacy" }); await openPieceAndWaitCapabilities(page);
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(page.getByText("O assistente está indisponível neste ambiente.", { exact: false })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "O que você quer que a IA faça?" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reescrever", exact: true })).toHaveCount(0);
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
