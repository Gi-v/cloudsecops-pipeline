import { describe, expect, it } from "vitest";
import { api, getWebSocketUrl } from "./client";

describe("api client", () => {
  it("configures a base URL", () => {
    expect(api.defaults.baseURL).toBeTruthy();
  });

  it("falls back to localhost:8000 when VITE_API_BASE_URL is unset in this env", () => {
    // vitest doesn't load .env by default, so import.meta.env.VITE_API_BASE_URL
    // is undefined here — this asserts the fallback in client.ts actually fires.
    expect(api.defaults.baseURL).toBe("http://localhost:8000");
  });
});

describe("getWebSocketUrl", () => {
  it("returns a ws:// or wss:// URL", () => {
    const url = getWebSocketUrl();
    expect(url).toMatch(/^wss?:\/\//);
  });

  it("falls back to the default local WebSocket endpoint", () => {
    expect(getWebSocketUrl()).toBe("ws://localhost:8000/ws/live");
  });
});
