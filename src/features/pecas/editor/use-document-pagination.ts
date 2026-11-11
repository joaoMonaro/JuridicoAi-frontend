import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";

import type { PageConfig } from "@/features/pecas/types";

const MM_TO_PX = 96 / 25.4;
export const mmToPx = (mm: number) => mm * MM_TO_PX;

export function useDocumentPagination(editor: Editor | null, pageConfig: PageConfig, reviewing = false) {
  const [pageCount, setPageCount] = useState(1);
  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom;
    // Preview widgets are outside the document and must not affect its page breaks.
    if (reviewing) {
      for (const node of Array.from(root.children) as HTMLElement[]) node.style.marginTop = "";
      return;
    }
    let frame = 0;
    const paginate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pageHeight = mmToPx(297);
        const usable = pageHeight - mmToPx(pageConfig.marginTop + pageConfig.marginBottom);
        let page = 0;
        let pageBottom = usable;
        const children = Array.from(root.children) as HTMLElement[];
        for (const node of children) {
          node.style.marginTop = "";
          const top = node.offsetTop;
          const height = node.offsetHeight;
          if (top + height > pageBottom && top > page * usable) {
            const gap = pageBottom - top + 28;
            node.style.marginTop = `${Math.max(28, gap)}px`;
            page += 1;
            pageBottom = (page + 1) * usable + page * 28;
          }
        }
        const last = children.at(-1);
        setPageCount(Math.max(1, last ? Math.ceil((last.offsetTop + last.offsetHeight) / (usable + 28)) : 1));
      });
    };
    const observer = new ResizeObserver(paginate);
    observer.observe(root);
    editor.on("update", paginate);
    paginate();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); editor.off("update", paginate); };
  }, [editor, pageConfig.marginBottom, pageConfig.marginTop, reviewing]);
  return pageCount;
}
