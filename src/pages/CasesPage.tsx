import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { navigate } from "@/app/navigation";
import { Button } from "@/components/ui/button";
import { listCases } from "@/features/cases/api/list-cases";
import { CaseList } from "@/features/cases/components/case-list";
import type { Case } from "@/features/cases/types/case";
import { AppLayout } from "@/layouts/app-layout";

export function CasesPage() {
  const [items, setItems] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    setRequestVersion((current) => current + 1);
  }, []);
  const createCase = useCallback(() => navigate("/casos/novo"), []);

  useEffect(() => {
    const controller = new AbortController();

    listCases(undefined, controller.signal)
      .then(setItems)
      .catch((requestError) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar os casos.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [requestVersion]);

  return (
    <AppLayout sidebarActive="casos">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
        <header className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Casos</h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Acompanhe os processos e acesse as peças jurídicas e contextos vinculados.</p>
          </div>
          <Button type="button" size="sm" className="h-8 shrink-0 px-3" onClick={createCase} aria-label="Novo caso">
            <Plus data-icon="inline-start" /><span className="hidden sm:inline">Novo Caso</span>
          </Button>
        </header>

        <CaseList items={items} loading={loading} error={error} onRetry={load} onCreate={createCase} />
      </div>
    </AppLayout>
  );
}
