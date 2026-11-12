import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Dialog } from "radix-ui";
import { Download, History, LoaderCircle, LogOut, Scale, Trash2 } from "lucide-react";
import { navigate } from "@/app/navigation";
import { AppLink } from "@/components/shared/app-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { personalSession, personalLogin, personalRefresh, personalLogout, personalRequest, personalFetch, deletionRequestId } from "@/features/ai-assistant/personal-history";
import type { PersonalSession, PersonalConversation, PersonalConversationPage, PersonalMessage, PersonalAttachment, PersonalProposal, DeletionProtocol } from "@/features/ai-assistant/personal-history";
import { HistoryProposal } from "@/features/ai-assistant/components/history-proposal";

const date = (value: string) => new Date(value).toLocaleString("pt-BR");
const errorText = (error: unknown) => error instanceof Error ? error.message : "Não foi possível consultar seu histórico.";
export function PersonalHistoryPage({ conversationId }: { conversationId?: string }) {
  const [session, setSession] = useState<PersonalSession | null>(() => personalSession());
  const [checking, setChecking] = useState(() => !personalSession()); const [error, setError] = useState("");
  const expired = useCallback(() => setSession(null), []);
  useEffect(() => {
    if (session) return;
    let active = true;
    personalRefresh().then(value => { if (active) setSession(value); }).catch(failure => {
      if (active && !(failure instanceof ApiError && failure.status === 401)) setError(errorText(failure));
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [session]);
  const [leaving, setLeaving] = useState(false);
  async function logout() {
    setLeaving(true); setError("");
    try { await personalLogout(); setSession(null); }
    catch (failure) { setError(errorText(failure)); }
    finally { setLeaving(false); }
  }
  return <main className="flex min-h-svh flex-col bg-background text-foreground">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3"><Scale className="size-6 text-primary" /><div><p className="font-semibold">JurídicoAI</p><h1 className="text-sm text-muted-foreground">Meu histórico de conversas</h1></div></div>
      <div className="flex items-center gap-3 text-sm"><AppLink href="/login" className="text-primary underline underline-offset-4">Acessar plataforma</AppLink>
        {session ? <><span>{session.user.nome}</span><Button variant="outline" size="sm" disabled={leaving} onClick={() => { void logout(); }}><LogOut />Sair do histórico</Button></> : null}</div>
    </header>
    {error ? <p role="alert" className="m-4 rounded border border-destructive/40 p-3 text-sm text-destructive">{error}</p> : null}
    {checking ? <p role="status" className="p-6">Verificando sessão pessoal...</p> : session ? <HistoryWorkspace key={session.user.id} userId={session.user.id} conversationId={conversationId && /^[0-9a-f-]{36}$/i.test(conversationId) ? conversationId : undefined} onExpired={expired} /> :
      <HistoryLogin onLogin={value => { setError(""); setSession(value); }} />}
  </main>;
}
function HistoryLogin({ onLogin }: { onLogin: (session: PersonalSession) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { onLogin(await personalLogin(email.trim(), password)); }
    catch (failure) { setError(failure instanceof ApiError && failure.status === 401 ? "E-mail ou senha inválidos." : errorText(failure)); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto my-12 w-full max-w-md space-y-5 rounded-xl border bg-card p-6">
    <History className="size-7 text-primary" /><h2 className="text-xl font-semibold">Acesse suas conversas</h2>
    <p className="text-sm leading-6 text-muted-foreground">Use seu e-mail e senha. Suas conversas continuam disponíveis mesmo após sair do escritório. Esta área permite consultar o histórico e autorizar a exclusão.</p>
    <form onSubmit={event => { void submit(event); }} className="space-y-4">
      <div className="space-y-2"><label htmlFor="history-email">E-mail</label><Input id="history-email" type="email" autoComplete="username" required maxLength={320} value={email} onChange={event => setEmail(event.target.value)} /></div>
      <div className="space-y-2"><label htmlFor="history-password">Senha</label><Input id="history-password" type="password" autoComplete="current-password" required maxLength={1000} value={password} onChange={event => setPassword(event.target.value)} /></div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : null}Entrar no histórico</Button>
    </form>
  </section>;
}
function HistoryWorkspace({ userId, conversationId, onExpired }: { userId: string; conversationId?: string; onExpired: () => void }) {
  const [conversations, setConversations] = useState<PersonalConversation[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [deletions, setDeletions] = useState<DeletionProtocol[]>([]); const [epoch, setEpoch] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const failure = useCallback((value: unknown) => { if (value instanceof ApiError && value.status === 401) onExpired(); else setError(errorText(value)); }, [onExpired]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([personalRequest<PersonalConversationPage>("/conversas", { signal: controller.signal }), personalRequest<DeletionProtocol[]>("/exclusoes", { signal: controller.signal })])
      .then(([page, protocols]) => { if (!controller.signal.aborted) { setConversations(page.conversas); setCursor(page.proximoCursor); setDeletions(protocols); setError(""); } })
      .catch(value => { if (!controller.signal.aborted) failure(value); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [epoch, failure]);
  const pending = deletions.some(d => d.estado !== "RemovidaDoAmbienteAtivo");
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController(); const timer = setTimeout(() => {
      personalRequest<DeletionProtocol[]>("/exclusoes", { signal: controller.signal }).then(setDeletions).catch(value => { if (!controller.signal.aborted) failure(value); });
    }, 1500);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [pending, deletions, failure]);
  async function older() {
    if (!cursor || loading) return; setLoading(true);
    try { const page = await personalRequest<PersonalConversationPage>(`/conversas?antes=${encodeURIComponent(cursor)}`); setConversations(items => [...new Map([...items, ...page.conversas].map(c => [c.id, c])).values()]); setCursor(page.proximoCursor); }
    catch (value) { failure(value); } finally { setLoading(false); }
  }
  const deleted = useCallback((protocol: DeletionProtocol) => {
    setConversations(items => items.filter(c => c.id !== protocol.conversaId)); setDeletions(items => [protocol, ...items.filter(d => d.requestId !== protocol.requestId)]);
    navigate("/historico-assistente");
  }, []);
  return <div className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
    <p className="mb-5 rounded-md border bg-muted/30 p-3 text-sm">Consulta do conteúdo salvo nas suas conversas. Esta área não carrega dados atuais dos Casos nem permite alterar Peças.</p>
    {error ? <div role="alert" className="mb-4 text-sm text-destructive">{error} <Button variant="outline" size="sm" onClick={() => setEpoch(n => n + 1)}>Tentar novamente</Button></div> : null}
    <div className="grid gap-5 md:grid-cols-[280px_minmax(0,1fr)]">
      <aside aria-label="Suas conversas" className="space-y-3">
        <h2 className="font-semibold">Conversas privadas</h2>
        {loading ? <p role="status" className="text-sm">Carregando conversas...</p> : null}
        {!loading && !error && conversations.length === 0 ? <p className="text-sm text-muted-foreground">Você ainda não tem conversas salvas.</p> : null}
        <ul className="max-h-[55vh] space-y-2 overflow-y-auto">{conversations.map(item => <li key={item.id}><button onClick={() => navigate(`/historico-assistente?conversa=${item.id}`)} aria-current={conversationId === item.id ? "true" : undefined}
          className={`w-full rounded-lg border p-3 text-left hover:bg-muted ${conversationId === item.id ? "border-primary bg-primary/5" : "bg-card"}`}><span className="block break-words text-sm font-medium">{item.titulo || "Conversa sem título"}</span><time className="mt-1 block text-xs text-muted-foreground">{date(item.atualizadaEm)}</time></button></li>)}</ul>
        {cursor ? <Button variant="outline" size="sm" disabled={loading} onClick={() => { void older(); }}>Carregar mais conversas</Button> : null}
        {deletions.length ? <section aria-label="Exclusões autorizadas" className="space-y-2 border-t pt-3"><h2 className="text-sm font-semibold">Exclusões autorizadas</h2>{deletions.map(d => <details key={d.requestId} className="rounded border p-2 text-xs"><summary className="cursor-pointer">{d.estado === "RemovidaDoAmbienteAtivo" ? "Removida do ambiente ativo" : d.estado === "PendenteDeRetomada" ? "Exclusão aguardando nova tentativa" : "Exclusão em andamento"}</summary>
          <p className="mt-2 break-all">Protocolo: {d.requestId}</p><p className="mt-1">Autorizada em {date(d.autorizadaEm)}</p><p className="mt-1">A conclusão se refere ao ambiente ativo. A eliminação de cópias de segurança ainda não foi confirmada.</p></details>)}</section> : null}
      </aside>
      {conversationId ? <ConversationHistory key={conversationId} id={conversationId} userId={userId} onExpired={onExpired} onDeleted={deleted} /> : <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Selecione uma conversa para consultar as mensagens e os anexos privados.</section>}
    </div>
  </div>;
}
function ConversationHistory({ id, userId, onExpired, onDeleted }: { id: string; userId: string; onExpired: () => void; onDeleted: (protocol: DeletionProtocol) => void }) {
  const [conversation, setConversation] = useState<PersonalConversation | null>(null); const [messages, setMessages] = useState<PersonalMessage[]>([]); const [attachments, setAttachments] = useState<PersonalAttachment[]>([]);
  const [loading, setLoading] = useState(true); const [olderAvailable, setOlderAvailable] = useState(false); const [error, setError] = useState(""); const [epoch, setEpoch] = useState(0);
  const [proposal, setProposal] = useState<PersonalProposal | null>(null); const [openDelete, setOpenDelete] = useState(false); const [working, setWorking] = useState(false); const [deleteError, setDeleteError] = useState("");
  const failure = useCallback((value: unknown) => { if (value instanceof ApiError && value.status === 401) onExpired(); else setError(errorText(value)); }, [onExpired]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([personalRequest<PersonalConversation>(`/conversas/${id}`, { signal: controller.signal }), personalRequest<PersonalMessage[]>(`/conversas/${id}/mensagens`, { signal: controller.signal }), personalRequest<PersonalAttachment[]>(`/conversas/${id}/anexos`, { signal: controller.signal })])
      .then(([item, rows, files]) => { if (!controller.signal.aborted) { setConversation(item); setMessages(rows); setAttachments(files); setOlderAvailable(rows.length === 50); setError(""); } })
      .catch(value => { if (!controller.signal.aborted) failure(value); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, epoch, failure]);
  async function older() {
    if (loading) return; setLoading(true);
    try { const rows = await personalRequest<PersonalMessage[]>(`/conversas/${id}/mensagens?antes=${Math.min(...messages.map(m => m.sequencia))}`); setMessages(items => [...new Map([...rows, ...items].map(m => [m.id, m])).values()].sort((a, b) => a.sequencia - b.sequencia)); setOlderAvailable(rows.length === 50); }
    catch (value) { failure(value); } finally { setLoading(false); }
  }
  async function download(file: PersonalAttachment) {
    try { const response = await personalFetch(`/conversas/${id}/anexos/${file.id}/arquivo`); const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.nome; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (value) { failure(value); }
  }
  async function showProposal(proposalId: string) { try { setProposal(await personalRequest<PersonalProposal>(`/propostas/${proposalId}`)); } catch (value) { failure(value); } }
  async function remove() {
    if (working) return; setWorking(true); setDeleteError("");
    try {
      const requestId = deletionRequestId(userId, id);
      let protocol: DeletionProtocol;
      try { protocol = await personalRequest<DeletionProtocol>(`/conversas/${id}`, { method: "DELETE", body: JSON.stringify({ requestId, confirmarExclusao: true }) }); }
      catch (value) { try { protocol = await personalRequest<DeletionProtocol>(`/exclusoes/${requestId}`); } catch { throw value; } }
      setOpenDelete(false); onDeleted(protocol);
    } catch (value) { if (value instanceof ApiError && value.status === 401) onExpired(); else setDeleteError(errorText(value)); }
    finally { setWorking(false); }
  }
  return <section aria-label="Conversa histórica" className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
    {error ? <div role="alert" className="text-sm text-destructive">{error} <Button size="sm" variant="outline" onClick={() => setEpoch(n => n + 1)}>Consultar conversa novamente</Button></div> : null}
    {conversation ? <><header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="break-words text-lg font-semibold">{conversation.titulo}</h2><p className="mt-1 text-xs text-muted-foreground">Somente leitura · criada em {date(conversation.criadaEm)}</p></div>
      <Button variant="outline" size="sm" onClick={() => { setDeleteError(""); setOpenDelete(true); }}><Trash2 />Excluir conversa</Button></header>
      {olderAvailable ? <Button variant="outline" size="sm" disabled={loading} onClick={() => { void older(); }}>Carregar mensagens anteriores</Button> : null}
      <ol className="space-y-4">{messages.map(m => <li key={m.id} className={`rounded-lg border p-3 ${m.autor === "Usuario" ? "ml-4 bg-primary/5 sm:ml-10" : "mr-4 bg-muted/30 sm:mr-10"}`}>
        <p className="mb-2 text-xs font-medium text-muted-foreground">{m.autor === "Usuario" ? "Você" : "Assistente"} · {date(m.criadaEm)}</p>
        {m.titulo ? <h3 className="mb-2 text-sm font-semibold">{m.titulo}</h3> : null}<p className="whitespace-pre-wrap break-words text-sm leading-6">{m.texto || (m.estado === "SemRespostaConcluida" ? "Sem resposta concluída salva." : "")}</p>
        {m.contextoFornecido ? <details className="mt-2 text-sm"><summary className="cursor-pointer">Contexto fornecido</summary><p className="mt-2 whitespace-pre-wrap break-words">{m.contextoFornecido}</p></details> : null}
        {m.alertas.length ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{m.alertas.map((a, i) => <li key={i}>{a.mensagem}</li>)}</ul> : null}
        {m.autor === "Assistente" && m.propostaId ? <Button className="mt-2" variant="outline" size="sm" onClick={() => { void showProposal(m.propostaId!); }}>Consultar proposta salva</Button> : null}
      </li>)}</ol>
      {attachments.length ? <section aria-label="Anexos privados do histórico" className="border-t pt-4"><h3 className="mb-2 text-sm font-semibold">Anexos privados desta conversa</h3><ul className="space-y-2">{attachments.map(file => <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="break-all">{file.nome} · {Math.ceil(file.tamanhoBytes / 1024)} KB</span><Button variant="outline" size="sm" onClick={() => { void download(file); }}><Download />Baixar {file.nome}</Button></li>)}</ul></section> : null}
    </> : null}
    {loading ? <p role="status" className="text-sm">Carregando histórico...</p> : null}
    {proposal ? <HistoryProposal proposal={proposal} onClose={() => setProposal(null)} /> : null}
    <Dialog.Root open={openDelete} onOpenChange={value => { if (!working) setOpenDelete(value); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-popover p-6 shadow-xl">
      <Dialog.Title className="text-lg font-semibold">Excluir esta conversa?</Dialog.Title><Dialog.Description className="text-sm leading-6 text-muted-foreground">Esta ação remove as mensagens, propostas e anexos privados desta conversa. Não altera a Peça nem apaga documentos compartilhados do Caso. A conversa ficará indisponível assim que você confirmar.</Dialog.Description>
      <p className="text-xs text-muted-foreground">A remoção será processada em segundo plano. Cópias de segurança seguem o procedimento de retenção; a conclusão no ambiente ativo não confirma sua eliminação.</p>
      {deleteError ? <p role="alert" className="text-sm text-destructive">{deleteError}</p> : null}
      <div className="flex justify-end gap-2"><Dialog.Close asChild><Button variant="outline" disabled={working}>Manter conversa</Button></Dialog.Close><Button variant="destructive" disabled={working} onClick={() => { void remove(); }}>{working ? <LoaderCircle className="animate-spin" /> : <Trash2 />}Confirmar exclusão</Button></div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>;
}
