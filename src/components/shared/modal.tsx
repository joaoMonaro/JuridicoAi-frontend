import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface ModalProps { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void }

export function Modal({ open, title, description, children, onClose }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-6" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="w-full max-w-lg border bg-popover shadow-2xl">
        <header className="flex items-start justify-between border-b px-5 py-4">
          <div><h2 id="modal-title" className="font-semibold">{title}</h2>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar"><X /></Button>
        </header>
        {children}
      </section>
    </div>
  );
}
