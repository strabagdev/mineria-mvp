import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./observability/logger", () => ({
  recordOperationalEvent: vi.fn(),
}));

function installBrowserGlobals(input: { online: boolean; fetchImpl?: typeof fetch }) {
  const listeners = new Map<string, EventListenerOrEventListenerObject[]>();
  const addEventListener = vi.fn((event: string, listener: EventListenerOrEventListenerObject) => {
    listeners.set(event, [...(listeners.get(event) ?? []), listener]);
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: input.online },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      addEventListener,
      visibilityState: "visible",
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener,
      clearInterval,
      clearTimeout,
      dispatchEvent: vi.fn(),
      setInterval,
      setTimeout,
    },
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: input.fetchImpl ?? vi.fn(() => new Promise(() => undefined)),
  });
}

describe("networkStatus", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "navigator");
    Reflect.deleteProperty(globalThis, "fetch");
  });

  it("does not treat unknown backend status as offline while the browser is online", async () => {
    installBrowserGlobals({ online: true });
    const { isBrowserOffline } = await import("./networkStatus");

    expect(isBrowserOffline()).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/health?ts="),
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("still reports offline when navigator is offline", async () => {
    installBrowserGlobals({ online: false });
    const { isBrowserOffline } = await import("./networkStatus");

    expect(isBrowserOffline()).toBe(true);
  });
});
