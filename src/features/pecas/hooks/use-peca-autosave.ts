import type { JSONContent } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

import { atualizarPeca } from "@/features/pecas/api";
import type { PecaPatch, SaveState } from "@/features/pecas/types";
import { ApiError } from "@/lib/api-client";

interface Options { pecaId: string; initialVersion: number; onPersisted: (version: number, updatedAt: string, patch: PecaPatch) => void }

export function usePecaAutosave({ pecaId, initialVersion, onPersisted }: Options) {
  const [state, setState] = useState<SaveState>("SALVO");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const version = useRef(initialVersion);
  const revision = useRef(0);
  const persistedRevision = useRef(0);
  const pending = useRef<PecaPatch>({});
  const inFlight = useRef(false);
  const conflict = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, []);

  function schedule() {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), 3000);
  }

  async function save() {
    clearTimeout(timer.current);
    if (inFlight.current || conflict.current || revision.current === persistedRevision.current) return;
    const sendingRevision = revision.current;
    const patch = pending.current;
    pending.current = {};
    inFlight.current = true;
    setState("SALVANDO");
    try {
      const result = await atualizarPeca(pecaId, version.current, patch);
      if (!mounted.current) return;
      version.current = Math.max(version.current, result.versao);
      persistedRevision.current = sendingRevision;
      setLastSavedAt(result.dataAtualizacao);
      onPersisted(result.versao, result.dataAtualizacao, { ...patch, ...result.apresentacao });
      if (revision.current > sendingRevision) { setState("NAO_SALVO"); schedule(); }
      else setState("SALVO");
    } catch (error) {
      if (!mounted.current) return;
      pending.current = { ...patch, ...pending.current };
      if (error instanceof ApiError && error.status === 409) { conflict.current = true; setState("CONFLITO"); }
      else setState("ERRO");
    } finally {
      inFlight.current = false;
    }
  }

  function change(patch: PecaPatch) {
    if (conflict.current) return;
    pending.current = { ...pending.current, ...patch };
    revision.current += 1;
    setState("NAO_SALVO");
    schedule();
  }

  return {
    state,
    lastSavedAt,
    change,
    contentChanged: (json: JSONContent) => change({ conteudoJson: json }),
    flush: save,
    retry: save,
  };
}
