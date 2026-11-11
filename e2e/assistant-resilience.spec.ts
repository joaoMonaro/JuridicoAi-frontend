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

test("cancelar durante o stream mantém o documento intacto", async ({ page, request }) => {
  await configureScenario(request, { assistant: "slow" });
  const editor = await submitRewrite(page);

  await expect(page.getByText("A IA está elaborando a resposta...", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText("Solicitação cancelada.");
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).not.toBeVisible();
  await expect(editor).toHaveText("Trecho original.");

  await page.waitForTimeout(1_700);
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).not.toBeVisible();
  await expect(editor).toHaveText("Trecho original.");
});

test("editar durante a geração expira a âncora e bloqueia a aplicação", async ({ page, request }) => {
  await configureScenario(request, { assistant: "slow" });
  const editor = await submitRewrite(page);

  await expect(page.getByText("A IA está elaborando a resposta...", { exact: true })).toBeVisible();
  await editor.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    (element as HTMLElement).focus();
  });
  await page.keyboard.type(" Alteração local.");

  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toBeVisible();
  await expect(page.getByText(/O documento mudou desde o envio/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Substituir seleção" })).toBeDisabled();
  await expect(editor).toContainText("Trecho original. Alteração local.");
  await expect(editor).not.toContainText("Trecho jurídico revisado pela IA.");
});

test("erro do provedor preserva o texto e permite tentar novamente", async ({ page, request }) => {
  await configureScenario(request, { assistant: "error" });
  const editor = await submitRewrite(page);

  await expect(page.getByRole("alert")).toContainText("O provedor de IA está temporariamente indisponível.");
  await expect(page.getByRole("button", { name: "Enviar para IA" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).not.toBeVisible();
  await expect(editor).toHaveText("Trecho original.");
});

test("erro de autosave bloqueia a aplicação e retry restaura o fluxo", async ({ page, request }) => {
  const editor = await submitRewrite(page);
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toBeVisible();

  await configureScenario(request, { autosave: "error" });
  await page.getByLabel("Status da peça").selectOption("Finalizada");
  await expect(page.getByRole("button", { name: "Substituir seleção" })).toBeDisabled();

  const failedSave = page.waitForResponse(isPiecePatch);
  await page.getByRole("button", { name: "Salvar peça" }).click();
  expect((await failedSave).status()).toBe(500);

  await expect(page.getByText("Erro ao salvar", { exact: true })).toBeVisible();
  await expect(page.getByText(/sugestões da IA não podem ser aplicadas/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Substituir seleção" })).toBeDisabled();

  await configureScenario(request, { autosave: "success" });
  const retriedSave = page.waitForResponse(isPiecePatch);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  expect((await retriedSave).status()).toBe(200);

  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Substituir seleção" })).toBeEnabled();
  await page.getByRole("button", { name: "Substituir seleção" }).click();
  await expect(editor).toHaveText("Trecho jurídico revisado pela IA.");
});

test("conflito de versão bloqueia a aplicação e orienta recarregar", async ({ page, request }) => {
  const editor = await submitRewrite(page);
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toBeVisible();

  await configureScenario(request, { autosave: "conflict" });
  await page.getByLabel("Status da peça").selectOption("Finalizada");

  const conflictedSave = page.waitForResponse(isPiecePatch);
  await page.getByRole("button", { name: "Salvar peça" }).click();
  expect((await conflictedSave).status()).toBe(409);

  await expect(page.getByText("Conflito de versão", { exact: true })).toBeVisible();
  await expect(page.getByText(/Esta peça foi alterada em outra sessão/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Recarregar versão mais recente" })).toBeVisible();
  await expect(page.getByText(/Resolva o conflito da Peça/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Substituir seleção" })).toBeDisabled();
  await expect(editor).toHaveText("Trecho original.");
});

async function submitRewrite(page: Page) {
  await page.goto(`/casos/${caseId}`);

  const editor = page.locator(".ProseMirror");
  await expect(editor).toHaveText("Trecho original.");
  await editor.click();
  await page.keyboard.press("Control+A");

  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await page.getByRole("button", { name: "Reescrever", exact: true }).click();
  await page.getByRole("button", { name: "Enviar para IA" }).click();
  return editor;
}

async function configureScenario(request: APIRequestContext, scenario: Record<string, string>) {
  const response = await request.post(`${fakeApiUrl}/__e2e/scenario`, { data: scenario });
  expect(response.ok()).toBeTruthy();
}

function isPiecePatch(response: { request(): { method(): string }; url(): string }) {
  return response.request().method() === "PATCH"
    && response.url().endsWith("/api/pecas/22222222-2222-2222-2222-222222222222");
}
