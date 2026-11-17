import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { fakeApiUrl } from "./urls";

export const caseId = "11111111-1111-1111-1111-111111111111";
export const pieceId = "22222222-2222-2222-2222-222222222222";
export const composer = (page: Page) => page.getByRole("textbox", { name: "O que você quer que a IA faça?" });
export const approval = (page: Page) => page.getByRole("button", { name: "Aprovar todas", exact: true });
export async function setup(page: Page, request: APIRequestContext) {
  await request.post(`${fakeApiUrl}/__e2e/reset`);
  await page.addInitScript(() => window.sessionStorage.setItem("juridicoai.auth-session", JSON.stringify({
    accessToken: "token-e2e-ficticio", expiresIn: 3600, expiresAt: Date.now() + 3600000,
    user: { id: "user-e2e", nome: "Usuário E2E", email: "e2e@example.test" },
    organization: { id: "org-e2e", nome: "Organização E2E" }, role: "Owner",
  })));
}
export async function configure(request: APIRequestContext, scenario: Record<string, string>) {
  expect((await request.post(`${fakeApiUrl}/__e2e/scenario`, { data: scenario })).ok()).toBeTruthy();
}
export async function openPiece(page: Page) {
  await page.goto(`/casos/${caseId}`);
  const editor = page.locator(".ProseMirror");
  await expect(editor).toHaveText("Trecho original.");
  return editor;
}
export async function openChat(page: Page) {
  const editor = await openPiece(page);
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await expect(composer(page)).toBeEnabled();
  return editor;
}
export async function send(page: Page, text: string) {
  await composer(page).fill(text);
  await page.getByRole("button", { name: "Enviar para IA" }).click();
}
export async function startEdit(page: Page, request: APIRequestContext) {
  await configure(request, { reply: "edit" });
  const editor = await openChat(page);
  await send(page, "Reescreva o primeiro parágrafo preservando os fatos.");
  return editor;
}
export async function readyEdit(page: Page, request: APIRequestContext) {
  const editor = await startEdit(page, request);
  await expect(approval(page)).toBeEnabled();
  return editor;
}
export async function caretAtEnd(editor: Locator) {
  await editor.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element); range.collapse(false);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    (element as HTMLElement).focus();
  });
}
