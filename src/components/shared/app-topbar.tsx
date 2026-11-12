import { Bell, Building2, ChevronLeft, History, LoaderCircle, LogOut, Plus, Save, Scale, UserRound } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";

import { navigate } from "@/app/navigation";
import { AppLink } from "@/components/shared/app-link";
import { Button } from "@/components/ui/button";
import { personalLogout } from "@/features/ai-assistant/personal-history";
import { logout } from "@/features/auth/api/logout";
import { clearAuthSession, getAuthSession } from "@/features/auth/auth-session";

interface AppTopbarProps {
  onCreate?: () => void;
  onSave?: () => void;
  showCaseNavigation?: boolean;
  caseTitle?: string;
}

export function AppTopbar({ onCreate, onSave, showCaseNavigation = false, caseTitle }: AppTopbarProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const session = getAuthSession();

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    setLogoutError("");
    try {
      const results = await Promise.allSettled([logout(), personalLogout()]);
      if (results.some(result => result.status === "rejected")) {
        setLogoutError("Não foi possível encerrar todas as sessões. Tente novamente."); return;
      }
      clearAuthSession();
      navigate("/login", { replace: true });
    } finally { setLoggingOut(false); }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-2 sm:px-4 xl:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <Scale className="size-4" aria-hidden="true" />
        </div>
        <div className="hidden shrink-0 leading-tight sm:block">
          <p className="text-sm font-semibold tracking-tight">JurídicoAI</p>
          <p className="text-[11px] text-muted-foreground">Copilot Jurídico</p>
        </div>

        {showCaseNavigation && (
          <div className="ml-1 flex min-w-0 items-center gap-2 border-l pl-2 sm:ml-2 sm:gap-3 sm:pl-4">
            <Button
              asChild
              type="button"
              variant="outline"
              size="icon-sm"
              className="shrink-0 rounded-full bg-secondary"
            >
              <AppLink href="/casos" aria-label="Voltar para a lista de casos" title="Voltar para casos">
                <ChevronLeft className="size-4" aria-hidden="true" />
              </AppLink>
            </Button>
            <div className="min-w-0 leading-tight">
              <p className="hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:block">Trabalhando em</p>
              <p className="max-w-24 truncate text-sm font-medium sm:max-w-40 lg:max-w-72" title={caseTitle}>
                {caseTitle || "Carregando caso..."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {logoutError ? <span role="alert" className="max-w-56 text-xs text-destructive">{logoutError}</span> : null}
        {onCreate && (
          <Button type="button" size="sm" className="px-2 xl:px-3" onClick={onCreate} aria-label="Nova peça" title="Nova peça">
            <Plus data-icon="inline-start" />
            <span className="hidden xl:inline">Nova Peça</span>
          </Button>
        )}
        {onSave && <Button type="button" variant="ghost" size="sm" className="px-2 xl:px-3" onClick={onSave} aria-label="Salvar peça" title="Salvar peça"><Save /><span className="hidden xl:inline">Salvar</span></Button>}
        <Button type="button" variant="ghost" size="icon-sm" className="hidden sm:inline-flex" aria-label="Notificações">
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

              <DropdownMenu.Item onSelect={() => navigate("/historico-assistente")} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none focus:bg-muted"><History className="size-4" />Meu histórico de conversas</DropdownMenu.Item>
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
