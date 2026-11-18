import { expect, test } from "@playwright/test";
import { fakeApiUrl } from "./support/urls";
import { approval, pieceId, readyEdit, setup } from "./support/simple-chat";

test.beforeEach(async ({ page, request }) => setup(page, request));

test("pedido natural propõe alteração, salva na aprovação e preserva após reload", async ({ page, request }) => {
  const editor = await readyEdit(page, request);
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toBeVisible();
  expect((await (await request.get(`${fakeApiUrl}/api/pecas/${pieceId}`)).json()).conteudoJson.content[0].content[0].text).toBe("Trecho original.");
  await expect(page.locator(".assistant-review-proposed-content")).toContainText("Trecho jurídico revisado pela IA.");
  const application = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith("/aplicacoes"));
  await approval(page).click();
  expect((await application).status()).toBe(200);
  await expect(editor).toHaveText("Trecho jurídico revisado pela IA.");
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho jurídico revisado pela IA.");
});
