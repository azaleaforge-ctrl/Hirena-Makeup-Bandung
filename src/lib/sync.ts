"use client";

import { useEffect, useRef, useCallback } from "react";
import { HIRENA_CHANNEL, getGlobalVersion, pullGlobalStateAndMerge } from "./db";

export const HIRENA_SYNC_CHANNEL = HIRENA_CHANNEL;
const STORAGE_KEY = "hirena_update_at";

export type HirenaUpdateType = "portfolio" | "bookings" | "settings" | "prices";

export function broadcastHirena(type: HirenaUpdateType): void {
  try {
    new BroadcastChannel(HIRENA_CHANNEL).postMessage({ type, at: Date.now() });
  } catch {}
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("hirena:update", { detail: { type } }));
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
  } catch {}
}

function useGlobalHirenaPolling(callback: () => void, intervalMs = 5000) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let initTimer: ReturnType<typeof setTimeout> | null = null;
    const check = async () => {
      try {
        const res = await fetch("/api/hirena", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: number };
        const serverVer = typeof data.version === "number" ? data.version : 0;
        if (!serverVer) return;
        const localVer = getGlobalVersion();
        if (serverVer > localVer) {
          await pullGlobalStateAndMerge();
          if (!cancelled) cbRef.current();
        }
      } catch {}
    };
    initTimer = setTimeout(check, 1500);
    timer = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      if (initTimer) clearTimeout(initTimer);
      if (timer) clearInterval(timer);
    };
  }, [intervalMs]);
}

// internal helper to setup listeners
function useHirenaRealtimeInternal(callback: () => void, typeFilter: string | undefined, intervalMs: number) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const trigger = useCallback(() => {
    cbRef.current();
  }, []);

  useGlobalHirenaPolling(trigger, Math.min(intervalMs, 5000));

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(HIRENA_CHANNEL);
      bc.onmessage = (ev: MessageEvent) => {
        const t = ev.data?.type as string | undefined;
        if (!typeFilter || t === typeFilter) trigger();
        else if (!t) trigger();
      };
    } catch {}

    const onCustom = (e: Event) => {
      const ce = e as CustomEvent;
      const t = ce.detail?.type as string | undefined;
      if (!typeFilter || !t || t === typeFilter) trigger();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) trigger();
    };

    window.addEventListener("hirena:update", onCustom as EventListener);
    window.addEventListener("storage", onStorage);

    return () => {
      try {
        bc?.close();
      } catch {}
      window.removeEventListener("hirena:update", onCustom as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [typeFilter, trigger]);

  return trigger;
}

// Exported hook: useHirenaSync supports (callback) or (typeFilter, callback) - single listener 15s
export function useHirenaSync(
  typeOrCallback?: string | (() => void),
  callbackOrInterval?: (() => void) | number,
  intervalMs = 15000
): () => void {
  let typeFilter: string | undefined;
  let callback: () => void = () => {};
  let interval = intervalMs;

  if (typeof typeOrCallback === "string") {
    typeFilter = typeOrCallback;
    if (typeof callbackOrInterval === "function") callback = callbackOrInterval;
    // third param is interval if provided
  } else if (typeof typeOrCallback === "function") {
    callback = typeOrCallback;
    if (typeof callbackOrInterval === "number") interval = callbackOrInterval;
  } else if (typeOrCallback === undefined && typeof callbackOrInterval === "function") {
    callback = callbackOrInterval;
  }

  return useHirenaRealtimeInternal(callback, typeFilter, interval);
}

export function useHirenaRealtime(callback: () => void, intervalMs = 15000): () => void {
  return useHirenaRealtimeInternal(callback, undefined, intervalMs);
}

export function useGlobalHirenaSync(callback: () => void, intervalMs = 5000): () => void {
  return useHirenaRealtimeInternal(callback, undefined, intervalMs);
}

export default useHirenaSync;
