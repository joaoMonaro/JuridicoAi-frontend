import { Bell, Plus, Scale, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AppTopbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-5">
      <div className="flex items-center gap-3">
        <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
          <Scale className="size-4" aria-hidden="true" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">JurídicoAI</p>
          <p className="text-[11px] text-muted-foreground">Copilot Jurídico</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm">
          <Plus data-icon="inline-start" />
          Nova Peça
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Notificações">
          <Bell />
        </Button>
        <div className="ml-1 grid size-7 place-items-center rounded-full border bg-secondary text-secondary-foreground" aria-label="Área do usuário">
          <UserRound className="size-3.5" aria-hidden="true" />
        </div>
      </div>
    </header>
  );
}
