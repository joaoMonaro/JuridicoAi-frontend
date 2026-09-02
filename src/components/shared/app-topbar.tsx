import { Bell, Building2, LoaderCircle, LogOut, Plus, Save, Scale, UserRound } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/api/logout";
import { clearAuthSession, getAuthSession } from "@/features/auth/auth-session";

interface AppTopbarProps { onCreate?: () => void; onSave?: () => void }

export function AppTopbar({ onCreate, onSave }: AppTopbarProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const session = getAuthSession();

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await logout();
    } catch {
      // A sessão local ainda deve ser encerrada se a API estiver indisponível.
    } finally {
      clearAuthSession();
      window.location.replace("/login");
    }
  }

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
        {onCreate && (
          <Button type="button" size="sm" onClick={onCreate}>
            <Plus data-icon="inline-start" />
            Nova Peça
          </Button>
        )}
        {onSave && <Button type="button" variant="ghost" size="sm" onClick={onSave}><Save />Salvar</Button>}
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Notificações">
          <Bell />
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-1 rounded-full border bg-secondary text-secondary-foreground hover:bg-muted data-[state=open]:bg-muted"
              aria-label="Abrir menu do usuário"
            >
              <UserRound className="size-3.5" aria-hidden="true" />
            </Button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-64 rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            >
              <DropdownMenu.Label className="p-2 font-normal">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full border bg-secondary text-secondary-foreground">
                    <UserRound className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{session?.user.nome || "Usuário"}</p>
                    <p className="truncate text-xs text-muted-foreground">{session?.user.email || "Sessão ativa"}</p>
                  </div>
                </div>
                {session?.organization.nome && (
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
                    <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{session.organization.nome}</span>
                  </div>
                )}
              </DropdownMenu.Label>

              <DropdownMenu.Separator className="my-1 h-px bg-border" />

              <DropdownMenu.Item
                disabled={loggingOut}
                onSelect={(event) => {
                  event.preventDefault();
                  void handleLogout();
                }}
                className="flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive outline-none transition-colors focus:bg-destructive/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                {loggingOut ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
                {loggingOut ? "Saindo..." : "Sair da conta"}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
