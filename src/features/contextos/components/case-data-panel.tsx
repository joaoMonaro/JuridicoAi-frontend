import { BookOpenText, CircleAlert, Database, FilePlus2, LoaderCircle, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TipoContextoCasoEnum } from "@/enums";
import { excluirContexto, listarContextos, obterContexto } from "@/features/contextos/api";
import { ContextoFormDialog } from "@/features/contextos/components/contexto-form-dialog";
import { CONTEXTO_TIPO_LABELS, CONTEXTO_TIPO_OPTIONS } from "@/features/contextos/contexto-options";
import type { ContextoCaso } from "@/features/contextos/types";

type TypeFilter = "Todos" | TipoContextoCasoEnum;
type DialogState = { mode: "create" } | { mode: "edit"; contexto: ContextoCaso } | null;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface Props {
  casoId: string;
  casoTitulo: string;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : dateFormatter.format(date);
}

export function CaseDataPanel({ casoId, casoTitulo }: Props) {
  const [items, setItems] = useState<ContextoCaso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("Todos");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // O caso ou uma tentativa manual de recarregar inicia uma nova consulta externa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    listarContextos(casoId, controller.signal)
      .then(setItems)
      .catch((requestError) => {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar os contextos.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [casoId, requestVersion]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      const matchesType = typeFilter === "Todos" || item.tipo === typeFilter;
      const matchesSearch = !term
        || item.titulo?.toLocaleLowerCase("pt-BR").includes(term)
        || item.conteudo.toLocaleLowerCase("pt-BR").includes(term);
      return matchesType && matchesSearch;
    });
  }, [items, search, typeFilter]);

  async function edit(item: ContextoCaso) {
    if (loadingItemId) return;
    setLoadingItemId(item.id);
    setActionError("");
    try {
      const contexto = await obterContexto(casoId, item.id);
      setDialog({ mode: "edit", contexto });
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Não foi possível abrir o contexto.");
    } finally {
      setLoadingItemId(null);
    }
  }

  async function remove(item: ContextoCaso) {
    const title = item.titulo || CONTEXTO_TIPO_LABELS[item.tipo];
    if (!window.confirm(`Excluir “${title}”? Esta ação não poderá ser desfeita.`)) return;
    setDeletingId(item.id);
    setActionError("");
    try {
      await excluirContexto(casoId, item.id);
      setItems((current) => current.filter((contexto) => contexto.id !== item.id));
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Não foi possível excluir o contexto.");
    } finally {
      setDeletingId(null);
    }
  }

  function saved(contexto: ContextoCaso) {
    setActionError("");
    setItems((current) => {
      const exists = current.some((item) => item.id === contexto.id);
      return exists
        ? current.map((item) => item.id === contexto.id ? contexto : item)
        : [contexto, ...current];
    });
  }

  const hasFilters = Boolean(search.trim()) || typeFilter !== "Todos";

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Base de contexto</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Dados do caso</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">Organize relatos, fatos, cronologias e estratégias relacionados a <span className="font-medium text-foreground">{casoTitulo}</span>.</p>
          </div>
          <Button type="button" size="sm" className="h-8 self-start px-3" onClick={() => setDialog({ mode: "create" })}>
            <FilePlus2 data-icon="inline-start" />Novo contexto
          </Button>
        </header>

        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 bg-popover pl-8.5 text-xs" placeholder="Buscar nos contextos..." aria-label="Buscar contextos" />
          </div>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            className="h-8 rounded-md border border-border bg-popover px-2.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            aria-label="Filtrar contextos por tipo"
          >
            <option value="Todos">Todos os tipos</option>
            {CONTEXTO_TIPO_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <span className="text-xs text-muted-foreground sm:ml-auto">{filtered.length} de {items.length} {items.length === 1 ? "registro" : "registros"}</span>
        </div>

        {actionError ? <div role="alert" className="mt-4 flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"><span className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{actionError}</span><button type="button" className="shrink-0 underline underline-offset-2" onClick={() => setActionError("")}>Fechar</button></div> : null}

        {loading ? <div className="grid min-h-72 place-items-center text-sm text-muted-foreground"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Carregando contextos...</span></div> : null}

        {!loading && error ? <div className="grid min-h-72 place-items-center text-center"><div><CircleAlert className="mx-auto size-8 text-destructive" aria-hidden="true" /><h2 className="mt-4 text-sm font-medium">Não foi possível carregar os dados</h2><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{error}</p><Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setRequestVersion((current) => current + 1)}><RefreshCw />Tentar novamente</Button></div></div> : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
            {filtered.map((item) => {
              const editing = loadingItemId === item.id;
              const deleting = deletingId === item.id;
              return <article key={item.id} className="group flex min-h-44 flex-col rounded-lg border border-border bg-popover p-4 transition-colors hover:border-primary/40">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-card text-primary"><BookOpenText className="size-4" aria-hidden="true" /></div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex rounded border border-primary/20 bg-accent px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-accent-foreground">{CONTEXTO_TIPO_LABELS[item.tipo]}</span>
                    <h2 className="mt-1.5 truncate text-sm font-semibold text-foreground" title={item.titulo || CONTEXTO_TIPO_LABELS[item.tipo]}>{item.titulo || CONTEXTO_TIPO_LABELS[item.tipo]}</h2>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => void edit(item)} disabled={Boolean(loadingItemId) || deleting} aria-label={`Editar ${item.titulo || CONTEXTO_TIPO_LABELS[item.tipo]}`} title="Editar contexto">{editing ? <LoaderCircle className="animate-spin" /> : <Pencil />}</Button>
                    <Button type="button" size="icon-sm" variant="ghost" className="hover:text-destructive" onClick={() => void remove(item)} disabled={Boolean(deletingId) || editing} aria-label={`Excluir ${item.titulo || CONTEXTO_TIPO_LABELS[item.tipo]}`} title="Excluir contexto">{deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}</Button>
                  </div>
                </div>
                <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs leading-5.5 text-muted-foreground sm:text-sm sm:leading-6">{item.conteudo}</p>
                <p className="mt-auto border-t border-border pt-2.5 text-[11px] text-muted-foreground">Atualizado em {formatDate(item.dataAtualizacao)}</p>
              </article>;
            })}
          </div>
        ) : null}

        {!loading && !error && filtered.length === 0 ? <div className="grid min-h-72 place-items-center text-center"><div>{hasFilters ? <Search className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /> : <Database className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />}<h2 className="mt-4 text-sm font-medium">{hasFilters ? "Nenhum contexto encontrado" : "Nenhum dado registrado"}</h2><p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{hasFilters ? "Ajuste a busca ou selecione outro tipo de contexto." : "Adicione o relato inicial, os fatos ou outras informações relevantes deste caso."}</p>{hasFilters ? <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => { setSearch(""); setTypeFilter("Todos"); }}>Limpar filtros</Button> : <Button type="button" size="sm" className="mt-4" onClick={() => setDialog({ mode: "create" })}><FilePlus2 />Adicionar contexto</Button>}</div></div> : null}
      </div>

      {dialog ? <ContextoFormDialog key={dialog.mode === "edit" ? dialog.contexto.id : "new"} casoId={casoId} contexto={dialog.mode === "edit" ? dialog.contexto : undefined} onClose={() => setDialog(null)} onSaved={saved} /> : null}
    </section>
  );
}
