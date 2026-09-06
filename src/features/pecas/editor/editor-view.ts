export type EditorZoom = "fit" | 0.75 | 0.9 | 1 | 1.25;

const EDITOR_ZOOM_KEY = "juridicoai.editor-zoom";
const allowedZooms: EditorZoom[] = ["fit", 0.75, 0.9, 1, 1.25];

export function getEditorZoom(): EditorZoom {
  try {
    const stored = window.localStorage.getItem(EDITOR_ZOOM_KEY);
    const parsed = stored === "fit" ? "fit" : Number(stored);
    return allowedZooms.includes(parsed as EditorZoom) ? parsed as EditorZoom : "fit";
  } catch {
    return "fit";
  }
}

export function saveEditorZoom(zoom: EditorZoom) {
  try {
    window.localStorage.setItem(EDITOR_ZOOM_KEY, String(zoom));
  } catch {
    // A preferência deixa de ser persistente quando o storage não está disponível.
  }
}
