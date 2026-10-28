import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FooterPresentation } from "../document-footer";
import { footerDocument } from "../document-footer";
import { DocumentFooter } from "@/features/pecas/editor/document-footer";
import type { PageConfig } from "@/features/pecas/types";

interface Props {
  text: string;
  presentation: FooterPresentation;
  page: PageConfig;
  fontFamily: string;
  onTextChange: (text: string) => void;
  onPresentationChange: (presentation: FooterPresentation) => void;
}

export function FooterTextEditor({ text, presentation, page, fontFamily, onTextChange, onPresentationChange }: Props) {
  const change = (patch: Partial<FooterPresentation>) => onPresentationChange({ ...presentation, ...patch });
  return <fieldset className="space-y-3 rounded border p-3">
    <legend className="px-1 text-xs font-semibold">Rodapé textual</legend>
    <label className="block space-y-1 text-xs"><span>Texto do rodapé</span>
      <Textarea rows={3} value={text} onChange={event => onTextChange(event.target.value)} placeholder={"Nome do escritório · OAB/UF\nEndereço · Telefone · E-mail"} />
    </label>
    <div className="grid grid-cols-2 gap-3">
      <label className="space-y-1 text-xs"><span>Tamanho do rodapé (pt)</span><Input type="number" min="7" max="16" step="0.5" required value={presentation.fontSize} onChange={event => change({ fontSize: Number(event.target.value) })} /></label>
      <label className="space-y-1 text-xs"><span>Alinhamento do rodapé</span><select className="h-9 w-full border bg-background px-2" value={presentation.align} onChange={event => change({ align: event.target.value as FooterPresentation["align"] })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
      <label className="space-y-1 text-xs"><span>Cor do rodapé</span><Input type="color" className="w-full cursor-pointer p-1" value={presentation.color} onChange={event => change({ color: event.target.value })} /></label>
      <label className="space-y-1 text-xs"><span>Distância da borda inferior (mm)</span><Input type="number" min="0" max="30" step="any" required value={presentation.offsetBottomMm} onChange={event => change({ offsetBottomMm: Number(event.target.value) })} /></label>
    </div>
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={presentation.separator} onChange={event => change({ separator: event.target.checked })} />Linha divisória acima do rodapé</label>
    {text.trim() && <div className="space-y-2"><p className="text-xs text-muted-foreground">Prévia do rodapé</p>
      <div className="overflow-x-auto rounded border bg-white"><div className="flex flex-col text-black" style={{ width: "210mm", minHeight: "55mm", zoom: .45, padding: `5mm ${page.marginRight}mm 0 ${page.marginLeft}mm`, fontFamily }}>
        <p style={{ fontSize: "12pt", margin: 0 }}>Final do texto da peça</p>
        <DocumentFooter value={footerDocument(text, presentation)} page={page} />
      </div></div>
    </div>}
  </fieldset>;
}
