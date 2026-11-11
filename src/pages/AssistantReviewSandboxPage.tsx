import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { loadReviewProposal } from "@/features/ai-assistant/review/extension";
import { createReviewFixture, reviewDocument } from "@/features/ai-assistant/review/fixtures";
import { AssistantReviewToolbar } from "@/features/ai-assistant/review/review-toolbar";
import { useReviewSession } from "@/features/ai-assistant/review/use-review-session";
import { createLegalEditorExtensions } from "@/features/pecas/editor/legal-editor-extensions";

export default function AssistantReviewSandboxPage() {
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);
  return <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
    <header className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-sidebar-primary">Ambiente de desenvolvimento · E0</p>
      <h1 className="text-2xl font-semibold">Revisão de alterações na Peça</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">Documento e propostas fictícios, somente neste navegador. Nada é enviado à IA ou salvo no servidor. A proposta permite testar substituição, inclusão, remoção e lista formatada.</p>
    </header>
    <SandboxEditor key={generation} onReset={() => { setError(""); setGeneration((value) => value + 1); }} error={error} setError={setError} />
  </main>;
}

function SandboxEditor({ onReset, error, setError }: { onReset: () => void; error: string; setError: (value: string) => void }) {
  const editor = useEditor({
    extensions: createLegalEditorExtensions(),
    content: reviewDocument,
    editorProps: { attributes: { class: "legal-editor-content focus:outline-none", "aria-label": "Documento de teste" } },
  }, ["review-sandbox"]);
  const state = useEditorState({ editor, selector: ({ editor: current }) => {
    return {
      document: current?.getJSON() ?? null,
      undo: current && !current.isDestroyed ? current.can().undo() : false,
      redo: current && !current.isDestroyed ? current.can().redo() : false,
    };
  } });
  const session = useReviewSession(editor);
  function review() {
    if (!editor) return;
    const result = loadReviewProposal(editor, createReviewFixture(editor.schema.nodeFromJSON(reviewDocument).toJSON()));
    setError(result.ok ? "" : result.message);
  }
  return <>
    <div className="flex flex-wrap gap-2">
      <Button disabled={!editor || Boolean(session)} onClick={review}>Carregar proposta de teste</Button>
      <Button variant="outline" disabled={!state?.undo || session?.visible} onClick={() => editor?.commands.undo()}>Desfazer</Button>
      <Button variant="outline" disabled={!state?.redo || session?.visible} onClick={() => editor?.commands.redo()}>Refazer</Button>
      <Button variant="ghost" onClick={onReset}>Reiniciar exemplo</Button>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <AssistantReviewToolbar editor={editor} />
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section aria-label="Peça com comparação" className="overflow-x-auto rounded-xl bg-slate-300 p-4 sm:p-6">
        <div className="legal-editor-page mx-auto min-h-[900px] min-w-[300px] max-w-[794px] bg-white p-6 text-[#20242a] shadow-lg sm:p-12" data-editor-theme="light" style={{ fontFamily: '"Times New Roman", serif', fontSize: "17px", lineHeight: 1.7 }}>
          <EditorContent editor={editor} />
        </div>
      </section>
      <aside className="space-y-4 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Conteúdo real do editor</h2>
        <p className="text-xs text-muted-foreground">Os destaques da proposta não fazem parte deste JSON. Ele muda somente com aprovação ou edição manual.</p>
        <details><summary className="cursor-pointer text-sm">Inspecionar documento</summary>
          <pre data-testid="document-json" className="mt-3 max-h-[650px] overflow-auto whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(state?.document, null, 2)}</pre>
        </details>
        {session ? <ul className="space-y-2 text-xs" aria-label="Decisões da revisão">{session.groups.map((group, index) => <li key={group.id}>
          Alteração {index + 1}: {group.status === "pending" ? "Pendente" : group.status === "applied" ? "Aplicada" : "Rejeitada"}
        </li>)}</ul> : null}
      </aside>
    </div>
  </>;
}
