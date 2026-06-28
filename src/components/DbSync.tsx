"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const POLL_OPEN_MS = 5000;
const POLL_SLOW_MS = 30000;
const POLL_MAX_MS = 60000;

export type DbSyncProps =
  | { mode: "global" }
  | {
      mode: "game";
      gameId: string;
      gameStatus: "scheduled" | "open" | "closed";
    };

function pollConfig(props: DbSyncProps): {
  url: string;
  initialMs: number;
  maxMs: number;
} | null {
  if (props.mode === "global") {
    return {
      url: "/api/realtime/digest",
      initialMs: POLL_SLOW_MS,
      maxMs: POLL_MAX_MS,
    };
  }
  if (props.gameStatus === "closed") return null;
  return {
    url: `/api/realtime/digest?gameId=${encodeURIComponent(props.gameId)}`,
    initialMs: props.gameStatus === "open" ? POLL_OPEN_MS : POLL_SLOW_MS,
    maxMs: POLL_MAX_MS,
  };
}

/**
 * Polls a version counter; on change, refreshes server components.
 * Open games poll fast; list/scheduled poll slow; other pages omit this component.
 */
export function DbSync(props: DbSyncProps) {
  const router = useRouter();
  const lastV = useRef<string | null>(null);
  const delayMs = useRef(POLL_OPEN_MS);
  const mode = props.mode;
  const gameId = props.mode === "game" ? props.gameId : "";
  const gameStatus = props.mode === "game" ? props.gameStatus : "closed";

  useEffect(() => {
    const config =
      mode === "global"
        ? pollConfig({ mode: "global" })
        : pollConfig({ mode: "game", gameId, gameStatus });
    if (!config) return;

    const { url, initialMs, maxMs } = config;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => void tick(), ms);
    };

    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      try {
        const headers: HeadersInit = { "Cache-Control": "no-store" };
        if (lastV.current !== null) {
          headers["If-None-Match"] = `"${lastV.current}"`;
        }

        const r = await fetch(url, {
          credentials: "include",
          cache: "no-store",
          headers,
        });

        if (cancelled) return;

        if (r.status === 304) {
          delayMs.current = Math.min(delayMs.current * 2, maxMs);
          if (document.visibilityState === "visible") {
            schedule(delayMs.current);
          }
          return;
        }

        if (!r.ok) {
          if (document.visibilityState === "visible") {
            schedule(delayMs.current);
          }
          return;
        }

        const data = (await r.json()) as { v: string };
        const unchanged =
          lastV.current !== null && lastV.current === data.v;

        if (lastV.current !== null && !unchanged) {
          router.refresh();
        }

        lastV.current = data.v;
        delayMs.current = unchanged
          ? Math.min(delayMs.current * 2, maxMs)
          : initialMs;
      } catch {
        /* offline / transient — retry with current delay */
      }

      if (!cancelled && document.visibilityState === "visible") {
        schedule(delayMs.current);
      }
    };

    delayMs.current = initialMs;
    lastV.current = null;
    void tick();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        delayMs.current = initialMs;
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, mode, gameId, gameStatus]);

  return null;
}
