import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getWebSocketUrl } from "@/api/client";
import type { LiveFindingMessage } from "@/types";

interface AlertCounts {
  critical: number;
  high: number;
}

export interface LiveFeedItem {
  message: LiveFindingMessage;
  /** Client-received timestamp — the WS payload itself doesn't carry a
   * per-event time, so this is when this browser tab received the frame. */
  receivedAt: number;
  id: string;
}

interface LiveFeedContextValue {
  messages: LiveFeedItem[];
  connected: boolean;
  alertCounts: AlertCounts;
  clearAlertCounts: () => void;
}

const ZERO_COUNTS: AlertCounts = { critical: 0, high: 0 };

const LiveFeedContext = createContext<LiveFeedContextValue>({
  messages: [],
  connected: false,
  alertCounts: ZERO_COUNTS,
  clearAlertCounts: () => {},
});

const MAX_ITEMS = 50;

/** Owns the single WebSocket connection to the backend's live findings feed.
 * Every consumer (sidebar connection pill + notification bell, dashboard
 * live panel) reads from this one context instead of each opening its own
 * socket. Also surfaces a toast and tracks running CRITICAL/HIGH counts as
 * violations stream in, for the sidebar's notification bell — HIGH is
 * tracked alongside CRITICAL rather than only CRITICAL, since the WS
 * payload already carries full violation data and silently ignoring HIGH
 * severity here was leaving a real signal on the table. */
export function LiveFeedProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<LiveFeedItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [alertCounts, setAlertCounts] = useState<AlertCounts>(ZERO_COUNTS);
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelay = useRef(1000);
  const hasConnectedOnce = useRef(false);
  const idCounter = useRef(0);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(getWebSocketUrl());
      // The backend broadcasts via orjson.dumps() + send_bytes (see
      // app/websocket/live_feed.py) — a binary frame, not text. With the
      // default binaryType ("blob"), event.data below would be a Blob,
      // and JSON.parse(Blob) throws synchronously (it stringifies to
      // "[object Blob]" first) — silently swallowed by the catch below,
      // meaning every single live message was being dropped. "arraybuffer"
      // lets it decode synchronously via TextDecoder instead of needing an
      // async Blob.text() read inside a non-async handler.
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        if (hasConnectedOnce.current) {
          toast.success("Live feed reconnected");
        }
        hasConnectedOnce.current = true;
        retryDelay.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const raw =
            typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
          const msg = JSON.parse(raw) as LiveFindingMessage;
          if (msg.type !== "finding.enriched") return;

          idCounter.current += 1;
          const item: LiveFeedItem = { message: msg, receivedAt: Date.now(), id: String(idCounter.current) };
          setMessages((prev) => [item, ...prev].slice(0, MAX_ITEMS));

          const criticals = msg.data.violations.filter((v) => v.severity === "CRITICAL");
          const highs = msg.data.violations.filter((v) => v.severity === "HIGH");

          if (criticals.length > 0 || highs.length > 0) {
            setAlertCounts((c) => ({
              critical: c.critical + criticals.length,
              high: c.high + highs.length,
            }));
          }
          if (criticals.length > 0) {
            toast.warning(`${criticals.length} critical finding${criticals.length > 1 ? "s" : ""} on ${msg.data.resource_urn}`, {
              description: criticals[0].title,
            });
          } else if (highs.length > 0) {
            toast(`${highs.length} high-severity finding${highs.length > 1 ? "s" : ""} on ${msg.data.resource_urn}`, {
              description: highs[0].title,
            });
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          setTimeout(connect, retryDelay.current);
          retryDelay.current = Math.min(retryDelay.current * 1.5, 15000);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, []);

  return (
    <LiveFeedContext.Provider
      value={{
        messages,
        connected,
        alertCounts,
        clearAlertCounts: () => setAlertCounts(ZERO_COUNTS),
      }}
    >
      {children}
    </LiveFeedContext.Provider>
  );
}

export function useLiveFeedContext() {
  return useContext(LiveFeedContext);
}
