import { Scale } from "lucide-react";

import { AppLink } from "@/components/shared/app-link";
import { LoginForm } from "@/features/auth/components/login-form";

export function LoginPage() {
  return (
    <main className="grid min-h-svh bg-background text-foreground lg:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)]">
      <section
        className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-card px-11 py-8 lg:flex"
        aria-label="Apresentação do JurídicoAI"
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-[72px] w-px bg-border/70"
          aria-hidden="true"
        />

        <header className="relative z-10 flex items-center gap-2.5 pl-11">
          <div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Scale className="size-3.5" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold tracking-tight">JurídicoAI</span>
        </header>

        <div className="relative z-10 my-auto ml-11 max-w-[520px]">
          <div className="rounded-lg border border-input bg-popover p-7 shadow-md">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-6.5 place-items-center border border-primary font-serif text-[11px] font-bold text-primary">
                  FA
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">
                    Ferreira &amp; Associados
                  </p>
                  <p className="mt-0.5 text-[9.5px] text-muted-foreground">
                    Contestação Cível · Versão 4
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                ● Sincronizado
              </span>
            </div>

            <div className="mb-2 h-1.5 w-[72%] rounded bg-muted" aria-hidden="true" />
            <div className="mb-2 h-1.5 w-[94%] rounded bg-muted" aria-hidden="true" />
            <div className="mb-4 h-1.5 w-[86%] rounded bg-muted" aria-hidden="true" />

            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.05em] text-primary">
              II. Da Excludente de Mora Contratual
            </p>

            <div className="my-3.5 rounded-md border border-primary/25 bg-card p-3.5 font-serif text-[12.5px] leading-relaxed text-foreground">
              <span className="rounded-xs bg-destructive/12 px-1 text-destructive line-through">
                A entrega ocorreu no prazo previsto no contrato.
              </span>
              <span className="ml-1 rounded-xs bg-success/12 px-1 font-medium text-success">
                Restou comprovado pelo Habite-se (fl. 84) e pelo Termo de Vistoria que a entrega das chaves ocorreu no 142º dia do prazo legal de tolerância (Tema 996/STJ).
              </span>
              <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-border pt-2.5 font-sans text-[11px] text-muted-foreground">
                <span>Proposta de revisão · Seção II</span>
                <span className="rounded bg-[#1E563B] px-2.5 py-0.5 text-[10.5px] font-semibold text-white">
                  ✓ Aceitar na peça
                </span>
              </div>
            </div>

            <div className="mt-3.5 mb-2 h-1.5 w-[90%] rounded bg-muted" aria-hidden="true" />
            <div className="h-1.5 w-[64%] rounded bg-muted" aria-hidden="true" />
          </div>
        </div>

        <footer className="relative z-10 pl-11 text-[11px] tracking-[0.03em] text-muted-foreground">
          © {new Date().getFullYear()} JURÍDICOAI
        </footer>
      </section>

      <section className="flex min-h-svh items-center justify-center bg-background px-6 py-10 sm:px-10" aria-label="Acesso à plataforma">
        <div className="w-full max-w-[390px]">
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Scale className="size-4" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold tracking-tight">JurídicoAI</span>
          </div>

          <div className="rounded-xl border border-border bg-popover p-7 shadow-sm sm:p-8">
            <header className="mb-6">
              <h1 className="font-serif text-2xl font-normal tracking-tight text-foreground">
                Acessar escritório
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Credenciais da sua organização
              </p>
            </header>
            <LoginForm />
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs">
              <span className="text-muted-foreground">Arquivo privado</span>
              <AppLink href="/historico-assistente" className="font-medium text-primary underline underline-offset-4">
                Acessar meu histórico de conversas
              </AppLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
