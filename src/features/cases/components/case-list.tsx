import { Archive, ArrowRight, BriefcaseBusiness, CircleAlert, Plus, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Case, CaseStatus } from "@/features/cases/types/case";
import { cn } from "@/lib/utils";

type StatusFilter = "Todos" | CaseStatus;

interface CaseListProps {
  items: Case[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onCreate: () => void;
}

const filters: StatusFilter[] = ["Todos", "Ativo", "Arquivado"];
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : dateFormatter.format(date);
}

function LoadingRows() {
  return (
    <div className="divide-y" aria-label="Carregando casos">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_9rem_10rem_1.5rem] items-center gap-5 px-5 py-4">
          <div className="space-y-2">
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted/70" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="size-4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function CaseList({ items, loading, error, onRetry, onCreate }: CaseListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("Todos");

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      const matchesStatus = status === "Todos" || item.status === status;
      const matchesSearch = !term || item.titulo.toLocaleLowerCase("pt-BR").includes(term) || item.descricao?.toLocaleLowerCase("pt-BR").includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [items, search, status]);

  const hasFilters = Boolean(search.trim()) || status !== "Todos";

  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Lista de casos">
      <header className="flex items-center justify-between gap-5 border-b px-5 py-4">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Buscar por título ou descrição..."
            aria-label="Buscar casos"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-md border bg-background p-1" aria-label="Filtrar casos por status">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatus(filter)}
              className={cn(
                "h-7 rounded px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                status === filter && "bg-muted text-foreground shadow-sm",
              )}
              aria-pressed={status === filter}
            >
              {filter === "Ativo" ? "Ativos" : filter === "Arquivado" ? "Arquivados" : filter}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_9rem_10rem_1.5rem] gap-5 border-b bg-muted/25 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" aria-hidden="true">
        <span>Caso</span>
        <span>Status</span>
        <span>Atualização</span>
        <span />
      </div>

      {loading && <LoadingRows />}

      {!loading && error && (
        <div className="grid min-h-64 place-items-center px-6 py-10 text-center">
          <div>
            <CircleAlert className="mx-auto size-8 text-destructive" aria-hidden="true" />
            <h2 className="mt-4 text-sm font-medium">Não foi possível carregar os casos</h2>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{error}</p>
            <Button type="button" size="sm" variant="outline" className="mt-4" onClick={onRetry}>
              <RefreshCw />Tentar novamente
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="divide-y" role="list">
          {filtered.map((item) => (
            <a
              key={item.id}
              href={`/casos/${item.id}`}
              role="listitem"
              className="group grid grid-cols-[minmax(0,1fr)_9rem_10rem_1.5rem] items-center gap-5 px-5 py-4 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground transition-colors group-hover:text-primary">
                  <BriefcaseBusiness className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.titulo}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.descricao || "Sem descrição informada."}</p>
                </div>
              </div>
              <span
                className={cn(
                  "w-fit rounded-full border px-2 py-1 text-[11px] font-medium",
                  item.status === "Ativo"
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {item.status}
              </span>
              <span className="text-xs text-muted-foreground">{formatDate(item.dataAtualizacao)}</span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="grid min-h-64 place-items-center px-6 py-10 text-center">
          <div>
            {hasFilters ? <Search className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /> : <Archive className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />}
            <h2 className="mt-4 text-sm font-medium">{hasFilters ? "Nenhum caso encontrado" : "Nenhum caso cadastrado"}</h2>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              {hasFilters ? "Tente ajustar a busca ou os filtros selecionados." : "Crie o primeiro caso para começar a organizar documentos e peças jurídicas."}
            </p>
            {hasFilters ? (
              <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => { setSearch(""); setStatus("Todos"); }}>
                Limpar filtros
              </Button>
            ) : (
              <Button type="button" size="sm" className="mt-4" onClick={onCreate}>
                <Plus />Novo Caso
              </Button>
            )}
          </div>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <footer className="border-t px-5 py-3 text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "caso exibido" : "casos exibidos"} de {items.length}
        </footer>
      )}
    </section>
  );
}
