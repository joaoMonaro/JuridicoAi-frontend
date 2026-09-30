import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const caseId = "11111111-1111-1111-1111-111111111111";
const pecaId = "22222222-2222-2222-2222-222222222222";
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

test("pergunta sem seleção responde no painel sem alterar a peça", async ({ page }) => {
  const editor = await openPiece(page);
  const patchRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().endsWith(`/api/pecas/${pecaId}`)) {
      patchRequests.push(request.url());
    }
  });

  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  const instruction = page.getByRole("textbox", { name: "O que você quer que a IA faça?" });
  await instruction.fill("Quais pontos jurídicos precisam de revisão?");
  await page.getByRole("button", { name: "Enviar para IA" }).click();

  await expect(page.getByRole("heading", { name: "Resposta da IA" })).toBeVisible();
  await expect(page.getByText(/A peça apresenta uma fundamentação inicial/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Substituir seleção" })).not.toBeVisible();
  await expect(editor).toHaveText("Trecho original.");
  expect(patchRequests).toEqual([]);
});

test("trocar de peça aborta o stream e ignora resposta tardia", async ({ page, request }) => {
  await request.post(`${fakeApiUrl}/__e2e/scenario`, { data: { assistant: "slow" } });
  await startRewrite(page);
  await expect(page.getByText("A IA está elaborando a resposta...", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Contestação E2E" }).click();
  const editor = page.locator(".ProseMirror");
  await expect(editor).toHaveText("Conteúdo da segunda peça.");
  await expect(page.getByRole("complementary", { name: "Assistente de IA" })).not.toBeVisible();

  await page.waitForTimeout(1_700);
  await expect(editor).toHaveText("Conteúdo da segunda peça.");
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).not.toBeVisible();
});

test("uma sugestão não pode ser aplicada duas vezes", async ({ page }) => {
  const editor = await submitRewrite(page);
  const apply = page.getByRole("button", { name: "Substituir seleção" });
  await expect(apply).toBeEnabled();

  await apply.click();
  await expect(apply).toBeDisabled();
  await apply.evaluate((button: HTMLButtonElement) => button.click());

  await expect(editor).toHaveText("Trecho jurídico revisado pela IA.");
  await expect(editor.getByText("Trecho jurídico revisado pela IA.")).toHaveCount(1);
});

test("undo e redo persistem uma única nova versão no autosave", async ({ page, request }) => {
  const patchResponses: number[] = [];
  page.on("response", (response) => {
    if (response.request().method() === "PATCH" && response.url().endsWith(`/api/pecas/${pecaId}`)) {
      patchResponses.push(response.status());
    }
  });

  const editor = await submitRewrite(page);
  await page.getByRole("button", { name: "Substituir seleção" }).click();
  await expect(editor).toBeFocused();
  await page.keyboard.press("Control+z");
  await expect(editor).toHaveText("Trecho original.");
  await page.keyboard.press("Control+Shift+z");
  await expect(editor).toHaveText("Trecho jurídico revisado pela IA.");

  await expect(page.getByText("Salvo", { exact: true })).toBeVisible({ timeout: 6_000 });
  expect(patchResponses).toEqual([200]);

  const persistedResponse = await request.get(`${fakeApiUrl}/api/pecas/${pecaId}`);
  const persisted = await persistedResponse.json() as { versao: number; conteudoJson: unknown };
  expect(persisted.versao).toBe(2);

  await page.reload();
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho jurídico revisado pela IA.");
  await expect(page.getByText("Versão 2", { exact: true })).toBeVisible();
});

test("reload com alteração não salva avisa antes de descartar a edição local", async ({ page }) => {
  const editor = await openPiece(page);
  await placeCaretAtEnd(editor);
  await page.keyboard.type(" Alteração ainda local.");
  await expect(page.getByText("Não salvo", { exact: true })).toBeVisible();

  let beforeUnloadSeen = false;
  page.once("dialog", async (dialog) => {
    beforeUnloadSeen = true;
    expect(dialog.type()).toBe("beforeunload");
    await dialog.accept();
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  expect(beforeUnloadSeen).toBe(true);
  await expect(page.locator(".ProseMirror")).toHaveText("Trecho original.");
  await expect(page.locator(".ProseMirror")).not.toContainText("Alteração ainda local.");
});

async function openPiece(page: Page) {
  await page.goto(`/casos/${caseId}`);
  const editor = page.locator(".ProseMirror");
  await expect(editor).toHaveText("Trecho original.");
  return editor;
}

async function submitRewrite(page: Page) {
  const editor = await startRewrite(page);
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toBeVisible();
  return editor;
}

async function startRewrite(page: Page) {
  const editor = await openPiece(page);
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  await page.getByRole("button", { name: "Reescrever", exact: true }).click();
  await page.getByRole("button", { name: "Enviar para IA" }).click();
  return editor;
}

async function placeCaretAtEnd(editor: Locator) {
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
