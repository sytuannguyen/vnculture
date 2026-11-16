import { useEffect, useRef, useState } from "react";

/** Live state over Server-Sent Events, with automatic fallback to polling when the
 * stream goes quiet (captive Wi-Fi, proxies, sleeping phones). */
export function useLive<T>(query: string, enabled = true): { state: T | null; connected: boolean; receivedAt: number } {
  const [state, setState] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const receivedAt = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let last = Date.now();
    let polling: number | null = null;
    let closed = false;

    const accept = (data: T) => { last = Date.now(); receivedAt.current = last; setState(data); setConnected(true); };
    const poll = async () => {
      try { const r = await fetch(`/api/state?${query}`, { cache: "no-store" }); if (r.ok) accept(await r.json()); } catch { setConnected(false); }
    };
    const open = () => {
      if (closed) return;
      try {
        es?.close();
        es = new EventSource(`/api/stream?${query}`);
        es.onmessage = (ev) => { try { accept(JSON.parse(ev.data)); } catch { /* ignore */ } };
        es.onerror = () => setConnected(false);
      } catch { /* EventSource unsupported: polling covers it */ }
    };
    open();
    void poll();
    const watchdog = window.setInterval(() => {
      const quiet = Date.now() - last > 8000;
      if (quiet && polling === null) { polling = window.setInterval(poll, 2000); void poll(); open(); }
      if (!quiet && polling !== null && es?.readyState === 1) { clearInterval(polling); polling = null; }
    }, 3000);
    const onVisible = () => { if (document.visibilityState === "visible") { void poll(); if (!es || es.readyState === 2) open(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { closed = true; es?.close(); clearInterval(watchdog); if (polling !== null) clearInterval(polling); document.removeEventListener("visibilitychange", onVisible); };
  }, [query, enabled]);

  return { state, connected, receivedAt: receivedAt.current };
}
