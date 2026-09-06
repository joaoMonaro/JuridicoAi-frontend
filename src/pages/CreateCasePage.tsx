import { ChevronRight, Info } from "lucide-react";

import { CreateCaseForm } from "@/features/cases/components/create-case-form";
import { AppLayout } from "@/layouts/app-layout";

export function CreateCasePage() {
  return (
    <AppLayout sidebarActive="casos">
      <div className="mx-auto w-full max-w-4xl px-8 py-7">
        <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Peças</span>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span className="text-foreground/80">Criar Novo Caso</span>
        </nav>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Criar Novo Caso</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Informe os dados iniciais para iniciar o trabalho.</p>
        </header>

        <CreateCaseForm />

        <aside className="mt-5 flex gap-3 border-l-2 border-primary/60 py-1 pl-4 text-xs leading-5 text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p>Após criar o caso, você poderá adicionar partes, documentos, jurisprudências e outras informações.</p>
            <p>Esses dados também poderão ser incluídos ou alterados posteriormente.</p>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
