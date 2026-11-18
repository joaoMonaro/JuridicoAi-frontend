import type { JSONContent } from "@tiptap/core";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import type { PersonalProposal } from "../personal-history";
// Render as React text, never as stored HTML. Historical nodes cannot load remote assets or execute links.
function Node({ node }: { node: JSONContent }) {
  if (node.type === "text") return <>{node.text}</>;
  if (node.type === "hardBreak") return <br />;
  const children = node.content?.map((child, i) => <Node key={i} node={child} />);
  if (node.type === "bulletList") return <ul className="list-inside list-disc">{children}</ul>;
  if (node.type === "orderedList") return <ol className="list-inside list-decimal">{children}</ol>;
  if (node.type === "listItem") return <li>{children}</li>;
  if (node.type === "heading") return <p className="my-2 font-semibold">{children}</p>;
  return <div className="my-1 whitespace-pre-wrap break-words">{children}</div>;
}
export function HistoryProposal({ proposal, onClose }: { proposal: PersonalProposal; onClose: () => void }) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border bg-popover p-5 shadow-xl">
    <Dialog.Title className="text-lg font-semibold">Proposta salva no histórico</Dialog.Title><Dialog.Description className="text-sm text-muted-foreground">Comparação registrada na conversa. Não representa a versão atual da Peça e não permite aprovação.</Dialog.Description>
    {proposal.grupos.map(group => <section key={group.id} className="space-y-3 rounded-lg border p-3"><h3 className="text-sm font-semibold">{group.explicacao}</h3><p className="text-xs text-muted-foreground">Decisão registrada: {group.estado}</p><div className="grid gap-4 sm:grid-cols-2"><div><h4 className="mb-2 text-xs font-medium">Texto original registrado</h4>{group.original.map((node, i) => <Node key={i} node={node} />)}</div><div><h4 className="mb-2 text-xs font-medium">Texto proposto registrado</h4>{group.proposto.map((node, i) => <Node key={i} node={node} />)}</div></div></section>)}
    <Dialog.Close asChild><Button variant="outline">Fechar proposta</Button></Dialog.Close>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
