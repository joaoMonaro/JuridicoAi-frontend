import { useSyncExternalStore } from "react";

const NAVIGATION_EVENT = "juridicoai:navigation";

interface NavigateOptions {
  replace?: boolean;
}

function locationSnapshot() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function subscribe(onStoreChange: () => void) {
  const handleChange = () => onStoreChange();
  window.addEventListener("popstate", handleChange);
  window.addEventListener(NAVIGATION_EVENT, handleChange);

  return () => {
    window.removeEventListener("popstate", handleChange);
    window.removeEventListener(NAVIGATION_EVENT, handleChange);
  };
}

export function useAppLocation() {
  return useSyncExternalStore(subscribe, locationSnapshot, locationSnapshot);
}

export function navigate(to: string, options: NavigateOptions = {}) {
  const url = new URL(to, window.location.href);

  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return;
  }

  const destination = `${url.pathname}${url.search}${url.hash}`;
  if (destination === locationSnapshot()) return;

  window.history[options.replace ? "replaceState" : "pushState"](null, "", destination);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
  window.scrollTo({ top: 0, left: 0 });
}
