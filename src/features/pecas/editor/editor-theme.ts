export type EditorTheme = "light" | "dark";

const EDITOR_THEME_KEY = "juridicoai.editor-theme";

export function getEditorTheme(): EditorTheme {
  try {
    return window.localStorage.getItem(EDITOR_THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveEditorTheme(theme: EditorTheme) {
  try {
    window.localStorage.setItem(EDITOR_THEME_KEY, theme);
  } catch {
    // A preferência deixa de ser persistente quando o storage não está disponível.
  }
}
