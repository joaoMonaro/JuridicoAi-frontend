import { ChevronDown, FileText, LoaderCircle, MoreHorizontal, PanelLeftClose, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PecaResumo } from "@/features/pecas/types";
import { cn } from "@/lib/utils";

interface Props { casoTitulo: string; items: PecaResumo[]; selectedId: string | null; loading: boolean; error: string; onSelect: (id: string) => void; onCreate: () => void; onDelete: (item: PecaResumo) => void; onClose?: () => void }

export function PecaExplorer({ casoTitulo, items, selectedId, loading, error, onSelect, onCreate, onDelete, onClose }: Props) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => items.filter((x) => x.titulo.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [items, search]);
  const drafts = filtered.filter((x) => x.status === "Rascunho");
  const finished = filtered.filter((x) => x.status === "Finalizada");

  const group = (label: string, list: PecaResumo[]) => list.length > 0 && <div className="mt-3">
    <p className="mb-1 flex items-center gap-1 px-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground"><ChevronDown className="size-3" />{label}</p>
    {list.map((item) => <div key={item.id} className={cn("group mx-1 flex items-center rounded-md border border-transparent", selectedId === item.id && "border-border bg-popover font-medium text-primary shadow-2xs")}>
      <button className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted/60 rounded-md" onClick={() => onSelect(item.id)} title={item.titulo}><FileText className="size-3.5 shrink-0" /><span className="truncate">{item.titulo}</span></button>
      <button onClick={() => onDelete(item)} className="mr-1 hidden p-1 text-muted-foreground hover:text-destructive group-hover:block" aria-label={`Excluir ${item.titulo}`}><MoreHorizontal className="size-3.5" /></button>
    </div>)}
  </div>;

  return <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
    <div className="flex h-10 items-center justify-between border-b border-border px-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Peças ({items.length})</span>
      <div className="flex items-center gap-0.5">
        <Button size="icon-sm" variant="ghost" onClick={onCreate} aria-label="Nova peça" title="Nova peça"><Plus /></Button>
        {onClose ? <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Ocultar explorador" title="Ocultar explorador"><PanelLeftClose /></Button> : null}
      </div>
    </div>
    <div className="p-2.5"><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 bg-popover pl-8 text-xs" placeholder="Buscar peças..." /></div></div>
    <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-4">
      <div className="px-2.5 py-1.5"><p className="truncate text-xs font-medium text-foreground">{casoTitulo}</p></div>
      {loading && <div className="flex items-center gap-2 px-3 py-6 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Carregando peças...</div>}
      {error && <p className="px-3 py-5 text-xs text-destructive">{error}</p>}
      {!loading && !error && filtered.length === 0 && <div className="px-3 py-8 text-center"><FileText className="mx-auto mb-2 size-6 text-muted-foreground" /><p className="text-xs text-muted-foreground">{search ? "Nenhuma peça encontrada." : "Nenhuma peça criada neste caso."}</p>{!search && <Button size="sm" variant="outline" className="mt-3" onClick={onCreate}><Plus />Nova Peça</Button>}</div>}
      {group("Em andamento", drafts)}{group("Concluídas", finished)}
    </div>
  </aside>;
}
