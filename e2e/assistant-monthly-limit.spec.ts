import { expect, test } from "@playwright/test";
import { composer, configure, openChat, send, setup } from "./support/simple-chat";

test.describe("Limite mensal do assistente", () => {
  test("exibe percentuais de utilizado/reservado, alertas 70%/90% e nunca mostra valores monetários", async ({ page, request }) => {
    await setup(page, request);
    await configure(request, { monthlyLimit: "critical90" });
    await openChat(page);

    const banner = page.getByRole("status", { name: "Consumo do limite mensal" });
    await expect(banner).toContainText("Restam 10% do limite mensal");
    await expect(banner).toContainText("Utilizado: 80%");
    await expect(banner).toContainText("Reservado em andamento: 10%");
    await expect(banner).toContainText("Disponível: 10%");
    await expect(page.getByRole("complementary", { name: "Assistente de IA" })).not.toContainText(/\$|USD|dólar|orçamento/i);
  });

  test("bloqueia envio ao atingir limite preservando instrução, histórico, edição manual e exportação, e desbloqueia após liquidação externa", async ({ page, request }) => {
    await setup(page, request);
    await openChat(page);

    await send(page, "Resuma o pedido inicial.");
    await expect(page.getByText("A peça apresenta uma fundamentação inicial")).toBeVisible();

    // Another user/tab holds remaining limit in reservation -> blocked!
    await configure(request, { monthlyLimit: "reserved_blocked" });
    await page.getByRole("button", { name: "Fechar assistente" }).click();
    await page.getByRole("button", { name: "Abrir assistente de IA" }).click();

    await expect(page.getByText("Limite disponível insuficiente para esta operação.")).toBeVisible();
    await expect(page.getByText("Reservado em andamento: 25%")).toBeVisible();

    const textBox = composer(page);
    await textBox.fill("Instrução digitada antes do desbloqueio");
    await expect(page.getByRole("button", { name: "Enviar para IA" })).toBeDisabled();

    // History, manual editing and export remain available while AI is blocked
    await expect(page.getByText("Resuma o pedido inicial.")).toBeVisible();
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type(" Edição manual permitida.");
    await expect(editor).toContainText("Edição manual permitida.");
    await expect(page.getByRole("button", { name: "Exportar" })).toBeEnabled();

    // External reservation settles -> polling/refresh unblocks and preserves typed instruction
    await configure(request, { monthlyLimit: "attention70" });
    await page.getByRole("button", { name: "Atualizar" }).click();
    await expect(page.getByText("Você utilizou 70% do limite mensal.")).toBeVisible();
    await expect(textBox).toHaveValue("Instrução digitada antes do desbloqueio");
    await expect(page.getByRole("button", { name: "Enviar para IA" })).toBeEnabled();
  });
});
