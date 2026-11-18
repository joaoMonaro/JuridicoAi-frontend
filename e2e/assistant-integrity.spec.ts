import { expect, test } from "@playwright/test";
import { fakeApiUrl } from "./support/urls";
import { approval, caretAtEnd, configure, openChat, openPiece, pieceId, readyEdit, send, setup, startEdit } from "./support/simple-chat";

test.beforeEach(async ({ page, request }) => setup(page, request));

test("pergunta responde no painel sem alterar ou salvar a peça", async ({ page }) => {
  const editor = await openChat(page);
  const patches: string[] = [];
  page.on("request", request => { if (request.method() === "PATCH" && request.url().endsWith(`/pecas/${pieceId}`)) patches.push(request.url()); });
  await send(page, "Quais pontos jurídicos precisam de revisão?");
  await expect(page.getByRole("heading", { name: "Resposta da IA" })).toBeVisible();
  await expect(approval(page)).toHaveCount(0);
  await expect(editor).toHaveText("Trecho original."); expect(patches).toEqual([]);
});

test("trocar de peça aborta o stream e ignora resposta tardia", async ({ page, request }) => {
  await configure(request, { assistant: "slow" }); await startEdit(page, request);
  await expect(page.getByText("A IA está elaborando a resposta...", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Contestação E2E" }).click();
  await expect(page.locator(".ProseMirror")).toHaveText("Conteúdo da segunda peça.");
  await expect(page.getByRole("complementary", { name: "Assistente de IA" })).not.toBeVisible();
  await page.waitForTimeout(1700);
  await expect(page.locator(".ProseMirror")).toHaveText("Conteúdo da segunda peça.");
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toHaveCount(0);
});

test("uma proposta só é aprovada uma vez", async ({ page, request }) => {
  const editor = await readyEdit(page, request); const approve = approval(page);
  await approve.click(); await expect(approve).toBeDisabled();
  await approve.evaluate((button: HTMLButtonElement) => button.click());
  await expect(editor).toHaveText("Trecho jurídico revisado pela IA.");
  expect((await (await request.get(`${fakeApiUrl}/__e2e/state`)).json()).applications).toBe(1);
});

test("undo e redo após aprovação geram apenas um autosave adicional", async ({ page, request }) => {
  const editor = await readyEdit(page, request); await approval(page).click();
  await expect(editor).toHaveText("Trecho jurídico revisado pela IA.");
  const patches: number[] = [];
  page.on("response", response => { if (response.request().method() === "PATCH" && response.url().endsWith(`/pecas/${pieceId}`)) patches.push(response.status()); });
  await editor.focus(); await page.keyboard.press("Control+z"); await expect(editor).toHaveText("Trecho original.");
  await page.keyboard.press("Control+Shift+z"); await expect(editor).toHaveText("Trecho jurídico revisado pela IA.");
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await expect.poll(() => patches).toEqual([200]);
  expect((await (await request.get(`${fakeApiUrl}/api/pecas/${pieceId}`)).json()).versao).toBe(3);
  await page.reload(); await expect(page.locator(".ProseMirror")).toHaveText("Trecho jurídico revisado pela IA.");
  await expect(page.getByText("Versão 3", { exact: true })).toBeVisible();
});

test("reload com alteração não salva avisa antes de descartar a edição local", async ({ page }) => {
  const editor = await openPiece(page); await caretAtEnd(editor); await page.keyboard.type(" Alteração ainda local.");
  await expect(page.getByText("Não salvo", { exact: true })).toBeVisible();
  let warned = false;
  page.once("dialog", async dialog => { warned = true; expect(dialog.type()).toBe("beforeunload"); await dialog.accept(); });
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(warned).toBe(true); await expect(page.locator(".ProseMirror")).toHaveText("Trecho original.");
  await expect(page.locator(".ProseMirror")).not.toContainText("Alteração ainda local.");
});
