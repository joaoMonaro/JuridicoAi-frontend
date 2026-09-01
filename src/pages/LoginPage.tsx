import { FileCheck2, Scale, ShieldCheck, Sparkles } from "lucide-react";

import { LoginForm } from "@/features/auth/components/login-form";

export function LoginPage() {
  return (
    <main className="grid min-h-svh bg-background text-foreground lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      <section className="relative hidden overflow-hidden border-r bg-sidebar lg:flex lg:flex-col" aria-label="Apresentação do JurídicoAI">
        <div className="absolute -left-28 top-1/3 size-80 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-28 -top-28 size-80 rounded-full bg-sidebar-primary/10 blur-3xl" aria-hidden="true" />

        <header className="relative flex h-20 items-center gap-3 px-10">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/10">
            <Scale className="size-5" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="font-semibold tracking-tight">JurídicoAI</p>
            <p className="text-[11px] text-muted-foreground">Copilot Jurídico</p>
          </div>
        </header>

        <div className="relative flex flex-1 items-center px-10 pb-12 xl:px-16">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/60 px-3 py-1.5 text-xs text-sidebar-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Tecnologia para uma advocacia mais eficiente
            </div>
            <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-[-0.035em] xl:text-5xl">
              Sua prática jurídica, organizada em um só lugar.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              Estruture casos, produza peças e gerencie o conhecimento do escritório com segurança e agilidade.
            </p>

            <div className="mt-10 grid max-w-lg gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/35 p-4">
                <FileCheck2 className="size-5 text-sidebar-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium">Fluxo centralizado</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Casos, modelos e documentos sempre organizados.</p>
              </div>
              <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/35 p-4">
                <ShieldCheck className="size-5 text-sidebar-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium">Ambiente seguro</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Acesso protegido aos dados do seu escritório.</p>
              </div>
            </div>
          </div>
        </div>

        <footer className="relative px-10 py-6 text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} JurídicoAI. Todos os direitos reservados.
        </footer>
      </section>

      <section className="flex min-h-svh items-center justify-center px-6 py-10 sm:px-10" aria-label="Acesso à plataforma">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="size-5" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <p className="font-semibold tracking-tight">JurídicoAI</p>
              <p className="text-[11px] text-muted-foreground">Copilot Jurídico</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-2xl shadow-black/20 sm:p-8">
            <header className="mb-7">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">Acesso seguro</p>
              <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Entre com sua conta para acessar o ambiente jurídico.</p>
            </header>
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
