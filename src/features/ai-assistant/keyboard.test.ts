import { describe, expect, it } from "vitest";

import {
  assistantShortcutLabel,
  isAssistantShortcut,
  isMacPlatform,
} from "@/features/ai-assistant/keyboard";

describe("atalho do assistente", () => {
  it.each([
    ["Linux x86_64", false],
    ["Win32", false],
    ["MacIntel", true],
    ["iPhone", true],
  ])("identifica a plataforma %s", (platform, expected) => {
    expect(isMacPlatform(platform)).toBe(expected);
  });

  it("exibe o modificador adequado à plataforma", () => {
    expect(assistantShortcutLabel("Linux x86_64")).toBe("Ctrl+Alt+A");
    expect(assistantShortcutLabel("MacIntel")).toBe("Cmd+Alt+A");
  });

  it("aceita Ctrl somente no Windows/Linux", () => {
    expect(isAssistantShortcut(keyboardEvent({ ctrlKey: true }), "Linux x86_64")).toBe(true);
    expect(isAssistantShortcut(keyboardEvent({ ctrlKey: true }), "MacIntel")).toBe(false);
  });

  it("aceita Cmd somente no macOS", () => {
    expect(isAssistantShortcut(keyboardEvent({ metaKey: true }), "MacIntel")).toBe(true);
    expect(isAssistantShortcut(keyboardEvent({ metaKey: true }), "Linux x86_64")).toBe(false);
  });

  it("ignora tecla repetida, modificadores ambíguos e combinações incompletas", () => {
    expect(isAssistantShortcut(keyboardEvent({ ctrlKey: true, repeat: true }), "Linux x86_64")).toBe(false);
    expect(isAssistantShortcut(keyboardEvent({ ctrlKey: true, metaKey: true }), "Linux x86_64")).toBe(false);
    expect(isAssistantShortcut(keyboardEvent({ ctrlKey: true, altKey: false }), "Linux x86_64")).toBe(false);
    expect(isAssistantShortcut(keyboardEvent({ ctrlKey: true, key: "b" }), "Linux x86_64")).toBe(false);
  });
});

function keyboardEvent(overrides: Partial<KeyboardEvent> = {}) {
  return {
    altKey: true,
    ctrlKey: false,
    key: "a",
    metaKey: false,
    repeat: false,
    ...overrides,
  };
}
