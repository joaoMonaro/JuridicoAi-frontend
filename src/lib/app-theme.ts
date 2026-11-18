import { useCallback, useEffect, useState } from "react";

export type AppTheme = "light" | "dark";

const APP_THEME_KEY = "juridicoai.app-theme";
const APP_THEME_EVENT = "juridicoai:app-theme";

export function getAppTheme(): AppTheme {
  try {
    return window.localStorage.getItem(APP_THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyAppTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function saveAppTheme(theme: AppTheme) {
  applyAppTheme(theme);
  try {
    window.localStorage.setItem(APP_THEME_KEY, theme);
  } catch {
    // A preferência deixa de ser persistente quando o storage não está disponível.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<AppTheme>(APP_THEME_EVENT, { detail: theme }));
  }
}

export function useAppTheme() {
  const [theme, setThemeState] = useState<AppTheme>(getAppTheme);

  useEffect(() => {
    applyAppTheme(theme);
  }, [theme]);

  useEffect(() => {
    const sync = () => setThemeState(getAppTheme());
    const onThemeEvent = (event: Event) => {
      const next = (event as CustomEvent<AppTheme>).detail;
      if (next === "light" || next === "dark") setThemeState(next);
    };
    window.addEventListener("storage", sync);
    window.addEventListener(APP_THEME_EVENT, onThemeEvent);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(APP_THEME_EVENT, onThemeEvent);
    };
  }, []);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
    saveAppTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
