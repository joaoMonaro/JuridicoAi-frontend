import { FilePlus2, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_PAGE_CONFIG, DEFAULT_STYLES, EMPTY_DOCUMENT } from "@/features/pecas/types";
import type { DocumentStyles, PageConfig, TemplatePeca } from "@/features/pecas/types";
import { atualizarTemplate, criarTemplate, excluirTemplate, listarTemplates } from "@/features/templates/api";

interface Props { open: boolean; onClose: () => void }
type Draft = { id?: string; nome: string; pageConfig: PageConfig; styles: DocumentStyles; header: string; footer: string };
const emptyDraft = (): Draft => ({ nome: "", pageConfig: { ...DEFAULT_PAGE_CONFIG }, styles: { ...DEFAULT_STYLES }, header: "", footer: "" });
const textDoc = (text: string) => ({ type: "doc", content: text ? [{ type: "paragraph", content: [{ type: "text", text }] }] : [{ type: "paragraph" }] });

export function TemplateManager({ open, onClose }: Props) {
  const [items, setItems] = useState<TemplatePeca[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => { setLoading(true); setError(""); listarTemplates().then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar modelos." )).finally(() => setLoading(false)); };
  useEffect(() => {
    // A abertura do gerenciador inicia a sincronização com a API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) load();
  }, [open]);
  const getText = (json: unknown) => { const value = JSON.stringify(json); const matches = [...value.matchAll(/"text":"([^"]*)"/g)]; return matches.map((x) => x[1]).join(" "); };
  const edit = (item: TemplatePeca) => setDraft({ id: item.id, nome: item.nome, pageConfig: item.pageConfig, styles: item.styles, header: getText(item.headerJson), footer: getText(item.footerJson) });

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!draft?.nome.trim()) return; setSaving(true); setError("");
    const input = { nome: draft.nome.trim(), pageConfig: draft.pageConfig, styles: draft.styles, headerJson: textDoc(draft.header), footerJson: textDoc(draft.footer), ...(draft.id ? {} : { conteudoJson: EMPTY_DOCUMENT }) };
    try { if (draft.id) await atualizarTemplate(draft.id, input); else await criarTemplate(input); setDraft(null); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar o modelo."); }
    finally { setSaving(false); }
  }

  async function remove(item: TemplatePeca) {
    if (!window.confirm(`Excluir o modelo “${item.nome}”? Peças já criadas não serão alteradas.`)) return;
    try { await excluirTemplate(item.id); setItems((current) => current.filter((x) => x.id !== item.id)); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível excluir."); }
  }

  const numberField = (label: string, key: keyof PageConfig) => <label className="space-y-1 text-xs"><span className="text-muted-foreground">{label} (mm)</span><Input type="number" min="0" value={draft?.pageConfig[key] ?? 0} onChange={(e) => setDraft((d) => d && ({ ...d, pageConfig: { ...d.pageConfig, [key]: Number(e.target.value) } }))} /></label>;
  return <Modal open={open} onClose={onClose} title="Modelos de Peça" description="Gerencie as configurações copiadas ao criar novos documentos.">
    <div className="max-h-[75vh] overflow-y-auto p-5">
      {!draft ? <>
        <Button size="sm" onClick={() => setDraft(emptyDraft())}><FilePlus2 />Novo Modelo</Button>
        {loading && <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" />Carregando...</p>}
        {!loading && items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum modelo disponível.</p>}
        <div className="mt-4 divide-y border">{items.map((item) => <div key={item.id} className="flex items-center px-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.nome}</p><p className="text-xs text-muted-foreground">{item.styles.fontFamily} · {item.styles.fontSize} pt · A4</p></div><Button size="icon-sm" variant="ghost" onClick={() => edit(item)} aria-label={`Editar ${item.nome}`}><Pencil /></Button><Button size="icon-sm" variant="ghost" onClick={() => void remove(item)} aria-label={`Excluir ${item.nome}`} className="hover:text-destructive"><Trash2 /></Button></div>)}</div>
      </> : <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-xs"><span>Nome</span><Input autoFocus value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} /></label>
        <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Página A4</p><div className="grid grid-cols-2 gap-3">{numberField("Margem superior", "marginTop")}{numberField("Margem inferior", "marginBottom")}{numberField("Margem esquerda", "marginLeft")}{numberField("Margem direita", "marginRight")}</div></div>
        <div className="grid grid-cols-3 gap-3"><label className="space-y-1 text-xs"><span>Fonte</span><select className="h-9 w-full border bg-background px-2" value={draft.styles.fontFamily} onChange={(e) => setDraft({ ...draft, styles: { ...draft.styles, fontFamily: e.target.value } })}><option>Times New Roman</option><option>Arial</option><option>Georgia</option></select></label><label className="space-y-1 text-xs"><span>Tamanho</span><Input type="number" min="8" max="24" value={draft.styles.fontSize} onChange={(e) => setDraft({ ...draft, styles: { ...draft.styles, fontSize: Number(e.target.value) } })} /></label><label className="space-y-1 text-xs"><span>Entrelinha</span><Input type="number" step="0.1" min="1" max="3" value={draft.styles.lineHeight} onChange={(e) => setDraft({ ...draft, styles: { ...draft.styles, lineHeight: Number(e.target.value) } })} /></label></div>
        <label className="block space-y-1 text-xs"><span>Cabeçalho textual</span><Input value={draft.header} onChange={(e) => setDraft({ ...draft, header: e.target.value })} /></label><label className="block space-y-1 text-xs"><span>Rodapé textual</span><Input value={draft.footer} onChange={(e) => setDraft({ ...draft, footer: e.target.value })} /></label>
        <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="ghost" onClick={() => setDraft(null)}>Voltar</Button><Button disabled={!draft.nome.trim() || saving}>{saving && <LoaderCircle className="animate-spin" />}{saving ? "Salvando..." : "Salvar Modelo"}</Button></div>
      </form>}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  </Modal>;
}
