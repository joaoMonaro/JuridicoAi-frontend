export function isMacPlatform(platform = navigator.platform) {
  return /mac|iphone|ipad|ipod/iu.test(platform);
}

export function assistantShortcutLabel(platform = navigator.platform) {
  return `${isMacPlatform(platform) ? "Cmd" : "Ctrl"}+Alt+A`;
}

export function isAssistantShortcut(
  event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "repeat">,
  platform = navigator.platform,
) {
  if (event.repeat || !event.altKey || event.key.toLowerCase() !== "a") return false;
  return isMacPlatform(platform)
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
}
