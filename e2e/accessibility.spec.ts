import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

const caseId = "11111111-1111-1111-1111-111111111111";
const fakeApiUrl = "http://127.0.0.1:5299";

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

test("painel vazio não possui violações críticas ou sérias", async ({ page }) => {
  await openAssistant(page);
  await expect(page.getByLabel("O que você quer que a IA faça?")).toBeVisible();

  await expectNoSeriousAccessibilityViolations(page);
});

test("streaming não possui violações críticas ou sérias", async ({ page, request }) => {
  await configureScenario(request, { assistant: "slow" });
  await submitRewrite(page);
  await expect(page.getByText("A IA está elaborando a resposta...", { exact: true })).toBeVisible();

  await expectNoSeriousAccessibilityViolations(page);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
});

test("sugestão e diff não possuem violações críticas ou sérias", async ({ page }) => {
  await submitRewrite(page);
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toBeVisible();

  await expectNoSeriousAccessibilityViolations(page);
});

test("erro do provider não possui violações críticas ou sérias", async ({ page, request }) => {
  await configureScenario(request, { assistant: "error" });
  await submitRewrite(page);
  await expect(page.getByRole("alert")).toContainText("O provedor de IA está temporariamente indisponível.");

  await expectNoSeriousAccessibilityViolations(page);
});

test("erro de autosave não possui violações críticas ou sérias", async ({ page, request }) => {
  await submitRewrite(page);
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toBeVisible();

  await configureScenario(request, { autosave: "error" });
  await page.getByLabel("Status da peça").selectOption("Finalizada");
  const failedSave = page.waitForResponse(isPiecePatch);
  await page.getByRole("button", { name: "Salvar peça" }).click();
  expect((await failedSave).status()).toBe(500);
  await expect(page.getByText("Erro ao salvar", { exact: true })).toBeVisible();

  await expectNoSeriousAccessibilityViolations(page);
});

test("âncora expirada não possui violações críticas ou sérias", async ({ page, request }) => {
  await configureScenario(request, { assistant: "slow" });
  const editor = await submitRewrite(page);
  await expect(page.getByText("A IA está elaborando a resposta...", { exact: true })).toBeVisible();

  await placeCaretAtEnd(editor);
  await page.keyboard.type(" Alteração local.");
  await expect(page.getByText(/O documento mudou desde o envio/)).toBeVisible();

  await expectNoSeriousAccessibilityViolations(page);
});

async function openAssistant(page: Page) {
  await page.goto(`/casos/${caseId}`);
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho original.");
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
}

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

async function placeCaretAtEnd(editor: ReturnType<Page["locator"]>) {
  await editor.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    (element as HTMLElement).focus();
  });
}

async function configureScenario(request: APIRequestContext, scenario: Record<string, string>) {
  const response = await request.post(`${fakeApiUrl}/__e2e/scenario`, { data: scenario });
  expect(response.ok()).toBeTruthy();
}

function isPiecePatch(response: { request(): { method(): string }; url(): string }) {
  return response.request().method() === "PATCH"
    && response.url().endsWith("/api/pecas/22222222-2222-2222-2222-222222222222");
}

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = results.violations
    .filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      nodes: nodes.map(({ target, html, failureSummary }) => ({ target, html, failureSummary })),
    }));

  expect(violations, `Violações críticas/sérias:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
}
