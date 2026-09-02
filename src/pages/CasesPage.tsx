import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  const createCase = useCallback(() => window.location.assign("/casos/novo"), []);

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
      <div className="mx-auto w-full max-w-6xl px-8 py-7">
        <header className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Casos</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Acompanhe e acesse os casos vinculados ao seu escritório.</p>
          </div>
          <Button type="button" onClick={createCase}>
            <Plus data-icon="inline-start" />Novo Caso
          </Button>
        </header>

        <CaseList items={items} loading={loading} error={error} onRetry={load} onCreate={createCase} />
      </div>
    </AppLayout>
  );
}
