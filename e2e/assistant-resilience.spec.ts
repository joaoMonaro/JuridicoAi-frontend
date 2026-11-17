import { expect, test } from "@playwright/test";
import { fakeApiUrl } from "./support/urls";
import { approval, caretAtEnd, composer, configure, openChat, pieceId, readyEdit, send, setup, startEdit } from "./support/simple-chat";

test.beforeEach(async ({ page, request }) => setup(page, request));

test("cancelar durante o stream mantém o documento intacto", async ({ page, request }) => {
  await configure(request, { assistant: "slow" }); const editor = await startEdit(page, request);
  await expect(page.getByText("A IA está elaborando a resposta...", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Solicitação cancelada.");
  await page.waitForTimeout(1700);
  await expect(approval(page)).toHaveCount(0); await expect(editor).toHaveText("Trecho original.");
});

test("edição local durante a geração impede carregar proposta sobre outra versão", async ({ page, request }) => {
  await configure(request, { assistant: "slow" }); const editor = await startEdit(page, request);
  await expect(page.getByText("A IA está elaborando a resposta...", { exact: true })).toBeVisible();
  await caretAtEnd(editor); await page.keyboard.type(" Alteração local.");
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toBeVisible();
  await expect(editor).toContainText("Trecho original. Alteração local.");
  await expect(approval(page)).toHaveCount(0);
  await expect(page.getByText("O documento mudou desde a preparação da proposta.", { exact: true })).toBeVisible();
});

test("erro do provedor preserva pedido e permite novo envio explícito", async ({ page, request }) => {
  await configure(request, { assistant: "error" }); await startEdit(page, request);
  await expect(page.getByRole("alert")).toContainText("O provedor de IA está temporariamente indisponível.");
  await expect(composer(page)).toHaveValue("Reescreva o primeiro parágrafo preservando os fatos.");
  await configure(request, { assistant: "success" }); await page.getByRole("button", { name: "Enviar para IA" }).click();
  await expect(approval(page)).toBeEnabled(); expect((await (await request.get(`${fakeApiUrl}/api/pecas/${pieceId}`)).json()).conteudoJson.content[0].content[0].text).toBe("Trecho original.");
});

test("falha de salvamento bloqueia envio e recuperação permite usar versão salva", async ({ page, request }) => {
  const editor = await openChat(page); await configure(request, { autosave: "error", reply: "edit" });
  await caretAtEnd(editor); await page.keyboard.type(" Alteração manual.");
  await send(page, "Reescreva o primeiro parágrafo.");
  await expect(page.getByText("Erro ao salvar", { exact: true })).toBeVisible();
  await expect(approval(page)).toHaveCount(0); await expect(composer(page)).toHaveValue("Reescreva o primeiro parágrafo.");
  await configure(request, { autosave: "success" });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enviar para IA" }).click();
  await expect(approval(page)).toBeEnabled();
});

test("conflito de versão bloqueia envio e orienta recarregar", async ({ page, request }) => {
  const editor = await openChat(page); await configure(request, { autosave: "conflict" });
  await caretAtEnd(editor); await page.keyboard.type(" Alteração local.");
  await send(page, "Analise a versão atual.");
  await expect(page.getByText("Conflito de versão", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recarregar versão mais recente" })).toBeVisible();
  await expect(approval(page)).toHaveCount(0); await expect(editor).toContainText("Alteração local.");
});


test("salvamento pendente impede aprovação e recuperação exige proposta da versão salva", async ({ page, request }) => {
  await readyEdit(page, request); await configure(request, { autosave: "error" });
  await page.getByLabel("Status da peça").selectOption("Finalizada"); await approval(page).click();
  await expect(page.getByText("Erro ao salvar", { exact: true })).toBeVisible();
  expect((await (await request.get(`${fakeApiUrl}/__e2e/state`)).json()).applications).toBe(0);
  await configure(request, { autosave: "success" }); await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await send(page, "Atualize a proposta para a versão salva da peça.");
  await expect(page.getByRole("heading", { name: "Trecho revisado" })).toHaveCount(2); await expect(approval(page)).toBeEnabled();
  await approval(page).click(); await expect(page.locator(".ProseMirror")).toHaveText("Trecho jurídico revisado pela IA.");
  expect((await (await request.get(`${fakeApiUrl}/__e2e/state`)).json()).applications).toBe(1);
});

test("conflito de salvamento impede aprovação da proposta pendente", async ({ page, request }) => {
  await readyEdit(page, request); await configure(request, { autosave: "conflict" });
  await page.getByLabel("Status da peça").selectOption("Finalizada"); await approval(page).click();
  await expect(page.getByText("Conflito de versão", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recarregar versão mais recente" })).toBeVisible();
  expect((await (await request.get(`${fakeApiUrl}/__e2e/state`)).json()).applications).toBe(0);
});
