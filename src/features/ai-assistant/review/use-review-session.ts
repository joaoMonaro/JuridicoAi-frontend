import type { Editor } from "@tiptap/core";
import { useCallback, useSyncExternalStore } from "react";

import { getReviewSession } from "./extension";

const emptySnapshot = () => null;

export function useReviewSession(editor: Editor | null) {
  const subscribe = useCallback((notify: () => void) => {
    if (!editor) return () => {};
    editor.on("transaction", notify);
    return () => { editor.off("transaction", notify); };
  }, [editor]);
  const snapshot = useCallback(() => editor && !editor.isDestroyed ? getReviewSession(editor) : null, [editor]);
  return useSyncExternalStore(subscribe, snapshot, emptySnapshot);
}
