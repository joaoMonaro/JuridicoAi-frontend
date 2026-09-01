import { ChevronRight, CircleAlert, FileText, LoaderCircle, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AppSidebar } from "@/components/shared/app-sidebar";
import { AppTopbar } from "@/components/shared/app-topbar";
import { Button } from "@/components/ui/button";
import { getCase } from "@/features/cases/api/get-case";
import type { Case } from "@/features/cases/types/case";
import { excluirPeca, listarPecas, obterPeca } from "@/features/pecas/api";
import { CreatePecaDialog } from "@/features/pecas/components/create-peca-dialog";
import { PecaExplorer } from "@/features/pecas/components/peca-explorer";
import { LegalDocumentEditor } from "@/features/pecas/editor/legal-document-editor";
import type { Peca, PecaResumo, PecaStatus } from "@/features/pecas/types";
import { TemplateManager } from "@/features/templates/components/template-manager";

type Props = { caseId: string };

export function CaseWorkspacePage({ caseId }: Props) {
  const [caso, setCaso] = useState<Case | null>(null);
  const [items, setItems] = useState<PecaResumo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peca, setPeca] = useState<Peca | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [listError, setListError] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const mergePeca = useCallback((updated: Peca) => {
    setPeca(updated);
    setItems((current) => current.map((x) => x.id === updated.id ? { id: updated.id, titulo: updated.titulo, status: updated.status, versao: updated.versao, templateId: updated.templateId, dataAtualizacao: updated.dataAtualizacao } : x));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // O id da rota define uma nova consulta externa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingList(true);
    Promise.all([getCase(caseId, controller.signal), listarPecas(caseId, controller.signal)])
      .then(([caseData, pecas]) => { setCaso(caseData); setItems(pecas); if (pecas.length) setSelectedId(pecas[0].id); })
      .catch((e) => { if (e.name !== "AbortError") setListError(e instanceof Error ? e.message : "Não foi possível abrir o caso."); })
      .finally(() => setLoadingList(false));
    return () => controller.abort();
  }, [caseId]);

  useEffect(() => {
    // A seleção representa a troca explícita do documento exibido.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedId) { setPeca(null); return; }
    const controller = new AbortController();
    const requestedId = selectedId;
    setLoadingDocument(true); setDocumentError(""); setPeca(null);
    obterPeca(requestedId, controller.signal).then((result) => { if (requestedId === selectedId) setPeca(result); }).catch((e) => { if (e.name !== "AbortError") setDocumentError(e instanceof Error ? e.message : "Não foi possível abrir a peça."); }).finally(() => setLoadingDocument(false));
    return () => controller.abort();
  }, [selectedId]);

  const reload = useCallback(async () => {
    if (!selectedId) return;
    if (!window.confirm("Recarregar a versão do servidor? Alterações locais não salvas serão descartadas.")) return;
    setLoadingDocument(true);
    try { setPeca(await obterPeca(selectedId)); } catch (e) { setDocumentError(e instanceof Error ? e.message : "Falha ao recarregar."); }
    finally { setLoadingDocument(false); }
  }, [selectedId]);

  function patchMetadata(patch: { titulo?: string; status?: PecaStatus }) {
    if (!peca) return;
    mergePeca({ ...peca, ...patch });
    window.dispatchEvent(new CustomEvent("peca:patch", { detail: patch }));
  }

  async function rename() {
    if (!peca) return; const title = window.prompt("Novo título da peça", peca.titulo)?.trim();
    if (title && title !== peca.titulo) patchMetadata({ titulo: title });
  }

  async function remove(item: PecaResumo) {
    if (!window.confirm(`Excluir a peça “${item.titulo}”? Esta ação não poderá ser desfeita pela interface.`)) return;
    try { await excluirPeca(item.id, item.versao); const remaining = items.filter((x) => x.id !== item.id); setItems(remaining); if (selectedId === item.id) setSelectedId(remaining[0]?.id ?? null); }
    catch (e) { setListError(e instanceof Error ? e.message : "Não foi possível excluir a peça."); }
  }

  return <div className="flex h-screen min-h-[680px] min-w-[1024px] flex-col overflow-hidden bg-background text-foreground">
    <AppTopbar onCreate={() => setCreateOpen(true)} onSave={() => window.dispatchEvent(new Event("peca:save"))} />
    <div className="flex min-h-0 flex-1">
      <AppSidebar onTemplates={() => setTemplatesOpen(true)} />
      <PecaExplorer casoTitulo={caso?.titulo || "Caso"} items={items} selectedId={selectedId} loading={loadingList} error={listError} onSelect={setSelectedId} onCreate={() => setCreateOpen(true)} onDelete={(item) => void remove(item)} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-[#111a23] px-4 text-xs">
          <span className="max-w-52 truncate text-muted-foreground">{caso?.titulo || "Caso"}</span><ChevronRight className="size-3 text-muted-foreground" />
          {peca ? <><span className="min-w-0 truncate font-medium">{peca.titulo}</span><Button size="icon-sm" variant="ghost" onClick={() => void rename()} aria-label="Renomear peça"><Pencil /></Button><span className="ml-auto text-muted-foreground">Versão {peca.versao}</span><select aria-label="Status da peça" className="h-7 border bg-background px-2 text-xs" value={peca.status} onChange={(e) => patchMetadata({ status: e.target.value as PecaStatus })}><option value="Rascunho">Rascunho</option><option value="Finalizada">Finalizada</option></select><Button size="icon-sm" variant="ghost" onClick={() => void remove(peca)} aria-label="Excluir peça"><Trash2 /></Button></> : <span className="text-muted-foreground">Peças</span>}
        </header>
        {loadingDocument && <div className="grid flex-1 place-items-center text-sm text-muted-foreground"><span className="flex items-center gap-2"><LoaderCircle className="animate-spin" />Carregando documento...</span></div>}
        {!loadingDocument && documentError && <div className="grid flex-1 place-items-center"><div className="text-center"><CircleAlert className="mx-auto mb-3 text-destructive" /><p className="text-sm text-destructive">{documentError}</p><Button variant="outline" size="sm" className="mt-4" onClick={() => void reload()}><RefreshCw />Tentar novamente</Button></div></div>}
        {!loadingDocument && !documentError && peca && <LegalDocumentEditor key={peca.id} peca={peca} onChanged={mergePeca} onReload={() => void reload()} />}
        {!loadingDocument && !documentError && !peca && <div className="grid flex-1 place-items-center"><div className="text-center"><FileText className="mx-auto mb-3 size-9 text-muted-foreground" /><h2 className="text-sm font-medium">Nenhuma peça aberta</h2><p className="mt-1 text-xs text-muted-foreground">Selecione uma peça no explorador ou crie um novo documento.</p><Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>Nova Peça</Button></div></div>}
      </main>
    </div>
    <CreatePecaDialog casoId={caseId} open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(created) => { setItems((current) => [{ id: created.id, titulo: created.titulo, status: created.status, versao: created.versao, templateId: created.templateId, dataAtualizacao: created.dataAtualizacao }, ...current]); setSelectedId(created.id); }} />
    <TemplateManager open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
  </div>;
}
