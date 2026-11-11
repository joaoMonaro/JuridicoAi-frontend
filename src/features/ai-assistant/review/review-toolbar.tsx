import type { Editor } from "@tiptap/core";

import { Button } from "@/components/ui/button";
import { applyReviewGroups, rejectReviewGroups, selectReviewGroup, setReviewVisible } from "./extension";
import { useReviewSession } from "./use-review-session";

export function AssistantReviewToolbar({ editor, onApprove, onReject }: {
  editor: Editor | null;
  onApprove?: (ids: string[]) => void;
  onReject?: (ids: string[]) => void;
}) {
  const session = useReviewSession(editor);
  if (!editor || !session) return null;
  const pending = session.groups.filter((group) => group.status === "pending");
  const current = Math.max(0, pending.findIndex((group) => group.id === session.activeGroupId));
  const enabled = session.visible && !session.stale && !session.locked && pending.length > 0;
  function navigate(direction: number) {
    if (!editor || !pending.length) return;
    selectReviewGroup(editor, pending[(current + direction + pending.length) % pending.length].id);
  }
  return <section aria-label="Revisão das alterações" tabIndex={-1} data-review-toolbar-focus className="space-y-3 rounded-lg border bg-card p-4">
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-auto text-sm font-medium" role="status" aria-live="polite">
        {session.stale ? "A proposta está desatualizada." : pending.length ? `${pending.length} ${pending.length === 1 ? "alteração pendente" : "alterações pendentes"}` : "Revisão concluída."}
      </p>
      <Button size="sm" variant="outline" disabled={!enabled} onClick={() => navigate(-1)}>Anterior</Button>
      <span className="text-xs tabular-nums" aria-label="Posição na revisão">{pending.length ? `${current + 1} de ${pending.length}` : "0 pendentes"}</span>
      <Button size="sm" variant="outline" disabled={!enabled} onClick={() => navigate(1)}>Próxima</Button>
    </div>
    {session.stale ? <p role="alert" className="text-sm text-warning">O documento foi editado. Esta proposta não pode ser aplicada sobre a nova versão.</p> : null}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={!enabled} onClick={() => (onApprove ?? ((ids) => applyReviewGroups(editor, ids)))(pending.map((group) => group.id))}>{!session.expectedDocument.textContent.trim() && pending.length ? "Aprovar minuta" : "Aprovar todas"}</Button>
      <Button size="sm" variant="outline" disabled={!enabled} onClick={() => (onReject ?? ((ids) => rejectReviewGroups(editor, ids)))(pending.map((group) => group.id))}>Rejeitar todas</Button>
      {pending.length && !session.stale ? <Button size="sm" variant="ghost" disabled={session.locked} onClick={() => setReviewVisible(editor, !session.visible)}>
        {session.visible ? "Continuar editando" : "Ver propostas"}
      </Button> : null}
    </div>
    <p className="text-xs text-muted-foreground">Exclusões riscadas; inclusões sublinhadas. O documento só muda ao aprovar. Saia da revisão para editar manualmente.</p>
  </section>;
}
