import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("expõe o nome acessível e responde à interação do usuário", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Continuar</Button>);

    const button = screen.getByRole("button", { name: "Continuar" });
    await user.click(button);

    expect(button).toBeEnabled();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
