import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("preview isolado mantém conteúdo intacto e permite decisões individuais", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (["fetch", "xhr"].includes(request.resourceType()) && new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.goto("/dev/revisao-peca");
  await expect(page.getByRole("heading", { name: "Revisão de alterações na Peça" })).toBeVisible();
  const documentJson = page.getByTestId("document-json");
  await expect(documentJson).toContainText("João da Silva");
  const original = await documentJson.textContent();
  await page.getByRole("button", { name: "Carregar proposta de teste" }).click();
  await expect(page.locator(".assistant-review-preview")).toHaveCount(4);
  expect(await documentJson.textContent()).toBe(original);
  await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "false");
  await expect(page.locator(".assistant-review-removed").first()).toBeVisible();
  await expect(page.locator(".assistant-review-added").first()).toBeVisible();
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.getByLabel("Posição na revisão")).toHaveText("2 de 4");
  await page.screenshot({ path: "test-results/assistant-review-preview.png", fullPage: true });

  await page.getByRole("button", { name: "Aprovar alteração 2", exact: true }).click();
  await expect(documentJson).toContainText("Do pagamento");
  await page.getByRole("button", { name: "Aprovar alteração 1", exact: true }).click();
  await expect(documentJson).toContainText("contatou a empresa repetidamente");
  await page.getByRole("button", { name: "Rejeitar alteração 3", exact: true }).click();
  await page.getByRole("button", { name: "Aprovar todas", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Revisão concluída.");
  await expect(page.locator(".assistant-review-preview")).toHaveCount(0);
  await expect(documentJson).toContainText("Em outras palavras");
  await expect(documentJson).toContainText("Restituição de R$ 850,00");
  await expect(page.locator(".ProseMirror strong")).toHaveText("João da Silva");
  await expect(page.locator(".ProseMirror em")).toHaveText("Preservar os documentos apresentados");
  expect(apiRequests).toEqual([]);
});

test("aprovar tudo permite desfazer e refazer o lote no navegador", async ({ page }) => {
  await page.goto("/dev/revisao-peca");
  const documentJson = page.getByTestId("document-json");
  await expect(documentJson).toContainText("João da Silva");
  const original = await documentJson.textContent();
  await page.getByRole("button", { name: "Carregar proposta de teste" }).click();
  await page.getByRole("button", { name: "Aprovar todas", exact: true }).click();
  await expect(documentJson).toContainText("Restituição de R$ 850,00");
  const applied = await documentJson.textContent();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  expect(await documentJson.textContent()).toBe(original);
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  expect(await documentJson.textContent()).toBe(applied);
});

test("edição manual invalida pendências e preserva o texto digitado", async ({ page }) => {
  await page.goto("/dev/revisao-peca");
  await page.getByRole("button", { name: "Carregar proposta de teste" }).click();
  await page.getByRole("button", { name: "Continuar editando", exact: true }).click();
  const editor = page.locator(".ProseMirror");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Nota manual.");
  await expect(page.getByRole("alert")).toContainText("O documento foi editado");
  await expect(page.getByRole("button", { name: "Aprovar todas", exact: true })).toBeDisabled();
  await expect(page.getByTestId("document-json")).toContainText("Nota manual.");
});

test("comparação oferece controles acessíveis sem violações sérias", async ({ page }) => {
  await page.goto("/dev/revisao-peca");
  await page.getByRole("button", { name: "Carregar proposta de teste" }).click();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});
