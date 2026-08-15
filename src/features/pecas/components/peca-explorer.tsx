import { ChevronDown, FileText, LoaderCircle, MoreHorizontal, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PecaResumo } from "@/features/pecas/types";
import { cn } from "@/lib/utils";

interface Props { casoTitulo: string; items: PecaResumo[]; selectedId: string | null; loading: boolean; error: string; onSelect: (id: string) => void; onCreate: () => void; onDelete: (item: PecaResumo) => void }

export function PecaExplorer({ casoTitulo, items, selectedId, loading, error, onSelect, onCreate, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => items.filter((x) => x.titulo.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [items, search]);
  const drafts = filtered.filter((x) => x.status === "Rascunho");
  const finished = filtered.filter((x) => x.status === "Finalizada");

  const group = (label: string, list: PecaResumo[]) => list.length > 0 && <div className="mt-4">
    <p className="mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><ChevronDown className="size-3" />{label}</p>
    {list.map((item) => <div key={item.id} className={cn("group flex items-center border-l-2 border-transparent", selectedId === item.id && "border-primary bg-primary/10 text-primary")}>
      <button className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent" onClick={() => onSelect(item.id)} title={item.titulo}><FileText className="size-3.5 shrink-0" /><span className="truncate">{item.titulo}</span></button>
      <button onClick={() => onDelete(item)} className="mr-1 hidden p-1 text-muted-foreground hover:text-destructive group-hover:block" aria-label={`Excluir ${item.titulo}`}><MoreHorizontal className="size-3.5" /></button>
    </div>)}
  </div>;

  return <aside className="flex w-[260px] shrink-0 flex-col border-r bg-[#101821]">
    <div className="flex h-12 items-center justify-between border-b px-3"><span className="text-xs font-semibold">EXPLORADOR</span><Button size="icon-sm" variant="ghost" onClick={onCreate} aria-label="Nova peça"><Plus /></Button></div>
    <div className="p-3"><div className="relative"><Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-xs" placeholder="Buscar peças..." /></div></div>
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      <div className="px-2 py-2"><p className="truncate text-xs font-medium">{casoTitulo}</p><p className="mt-1 text-[10px] text-muted-foreground">{items.length} {items.length === 1 ? "peça" : "peças"}</p></div>
      {loading && <div className="flex items-center gap-2 px-3 py-6 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Carregando peças...</div>}
      {error && <p className="px-3 py-5 text-xs text-destructive">{error}</p>}
      {!loading && !error && filtered.length === 0 && <div className="px-3 py-8 text-center"><FileText className="mx-auto mb-2 size-6 text-muted-foreground" /><p className="text-xs text-muted-foreground">{search ? "Nenhuma peça encontrada." : "Nenhuma peça criada neste caso."}</p>{!search && <Button size="sm" variant="outline" className="mt-3" onClick={onCreate}><Plus />Nova Peça</Button>}</div>}
      {group("Em andamento", drafts)}{group("Concluídas", finished)}
    </div>
  </aside>;
}
