import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { openReviewConversation } from "./review/persistent-api";
import type { StoredMessage } from "./conversation-history";

const pageSize = 50;
export function useAssistantHistory(enabled: boolean, pecaId: string) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasOlder, setHasOlder] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const current = useRef({ conversationId, messages });
  useEffect(() => { current.current = { conversationId, messages }; }, [conversationId, messages]);

  const load = useCallback(async (older = false) => {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const id = ++requestId.current;
    setLoading(true); setError("");
    try {
      const conversation = current.current.conversationId ?? (await openReviewConversation(pecaId, abort.signal)).id;
      const before = older && current.current.messages.length ? Math.min(...current.current.messages.map((m) => m.sequencia)) : null;
      const items = await apiRequest<StoredMessage[]>(`/assistente/v2/conversas/${conversation}/mensagens?limite=${pageSize}${before ? `&antes=${before}` : ""}`, { signal: abort.signal });
      if (abort.signal.aborted || id !== requestId.current) return;
      setConversationId(conversation);
      setMessages((previous) => {
        const merged = new Map(previous.map((message) => [message.id, message]));
        items.forEach((message) => merged.set(message.id, message));
        return [...merged.values()].sort((a, b) => a.sequencia - b.sequencia);
      });
      if (older || !current.current.messages.length) setHasOlder(items.length === pageSize);
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível recuperar a conversa.");
    } finally { if (!abort.signal.aborted && id === requestId.current) setLoading(false); }
  }, [pecaId]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; controller.current?.abort(); };
  }, [enabled, load]);
  const generating = messages.some((message) => message.estado === "Gerando" || message.estado === "AguardandoAnalise");
  useEffect(() => {
    if (!enabled || !generating || loading || error) return;
    const timer = window.setTimeout(() => { void load(); }, 1500);
    return () => clearTimeout(timer);
  }, [enabled, generating, loading, error, load]);
  return { conversationId, messages, loading, error, hasOlder, generating,
    refresh: load, loadOlder: () => load(true) };
}
