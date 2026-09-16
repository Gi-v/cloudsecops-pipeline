/** Minimal fake WebSocket for testing code that talks to one — just enough
 * of the real interface (readyState, on* handlers, send, close) plus test
 * helpers to drive it manually (__simulateOpen/__simulateMessage/
 * __simulateClose). Install with `vi.stubGlobal("WebSocket", MockWebSocket)`
 * per test file that needs it, not globally in setup.ts, so unrelated
 * suites aren't affected. */
export class MockWebSocket {
  static instances: MockWebSocket[] = [];

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(_data: string) {
    /* no-op — nothing in this app sends over the socket yet */
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  __simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  __simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  __simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  static reset() {
    MockWebSocket.instances = [];
  }

  static latest(): MockWebSocket {
    const inst = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    if (!inst) throw new Error("No MockWebSocket instance has been created yet");
    return inst;
  }
}
