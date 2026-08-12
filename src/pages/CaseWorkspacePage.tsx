import { CheckCircle2 } from "lucide-react";

import { AppLayout } from "@/layouts/app-layout";

type CaseWorkspacePageProps = {
  caseId: string;
};

export function CaseWorkspacePage({ caseId }: CaseWorkspacePageProps) {
  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-4xl px-8 py-7">
        <div className="flex items-start gap-3 border-l-2 border-success py-1 pl-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold">Caso criado com sucesso</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O workspace deste caso está pronto para receber as próximas funcionalidades.
            </p>
            <p className="mt-3 font-mono text-xs text-muted-foreground">ID: {caseId}</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
