// "Install as an app" support.
// - Android / desktop Chrome & Edge: capture `beforeinstallprompt` and show the native dialog.
// - iOS has no install API: we show step-by-step "Share → Add to Home Screen" instructions.
// - In-app browsers (Instagram, Facebook, Zalo…) can't install: ask to open in the real browser.
// iOS gives a home-screen app storage separate from Safari, so the participant profile is
// carried in the start URL (`/?r=…`) and adopted on first launch.
import { useEffect, useState } from "react";
import type { Profile } from "../../shared/types";

export type InstallKind = "installed" | "prompt" | "ios" | "android" | "inapp" | "none";

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Zalo|Messenger|TikTok|musical_ly|Snapchat|Twitter|LinkedInApp|MicroMessenger|KAKAOTALK|; wv\)/i;

export function isIOS(ua: string, maxTouchPoints = 0): boolean {
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1); // iPadOS reports as Mac
}

/** Decide which install experience to offer. Pure, so it can be unit-tested. */
export function detectInstallKind(env: { ua: string; maxTouchPoints?: number; standalone: boolean; hasPrompt: boolean }): InstallKind {
  if (env.standalone) return "installed";
  if (env.hasPrompt) return "prompt";
  const ios = isIOS(env.ua, env.maxTouchPoints);
  const android = /Android/i.test(env.ua);
  if ((ios || android) && IN_APP.test(env.ua)) return "inapp";
  if (ios) return "ios";
  if (android) return "android";
  return "none"; // desktop without an install prompt (Firefox, Safari on Mac): nothing to offer
}

// ------------------------------------------------------------------ profile hand-off
const toB64Url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64Url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

export function encodeRestore(p: Profile): string {
  return toB64Url(JSON.stringify({ id: p.id, name: p.name, avatar: p.avatar, role: p.role }));
}
export function decodeRestore(r: string | null | undefined): Profile | null {
  try {
    if (!r || r.length > 400 || !/^[A-Za-z0-9_-]+$/.test(r)) return null;
    const o = JSON.parse(fromB64Url(r));
    if (typeof o?.id !== "string" || !/^[A-Za-z0-9-]{1,40}$/.test(o.id) || typeof o.name !== "string") return null;
    return { id: o.id, name: o.name.slice(0, 20), avatar: String(o.avatar ?? ""), role: o.role === "local" ? "local" : "visitor" };
  } catch { return null; }
}

/** On launch: if the URL carries `?r=` and this storage has no profile yet, adopt it. Returns the cleaned URL. */
export function adoptRestoreParam(href: string, hasProfile: boolean, save: (p: Profile) => void): string | null {
  const url = new URL(href);
  const r = url.searchParams.get("r");
  if (r === null) return null;
  const p = decodeRestore(r);
  if (p && !hasProfile) save(p);
  url.searchParams.delete("r");
  return url.pathname + (url.search || "") + url.hash;
}

/** Point the manifest at a start URL that carries the profile (no-op without a profile). */
export function linkManifestToProfile(p: Profile | null) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (link) link.href = p ? `/api/manifest.webmanifest?r=${encodeRestore(p)}` : "/api/manifest.webmanifest";
}

// ------------------------------------------------------------------ runtime state
let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

/** Call once at startup, before React renders: the prompt event can fire very early. */
export function initInstall() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; installedNow = true; emit(); });
}

export function isStandalone(): boolean {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

function currentKind(): InstallKind {
  if (installedNow) return "installed";
  return detectInstallKind({ ua: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, standalone: isStandalone(), hasPrompt: !!deferred });
}

/** Show the native install dialog (only when kind === "prompt"). */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const ev = deferred;
  if (!ev) return "unavailable";
  deferred = null;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  if (outcome === "accepted") installedNow = true;
  emit();
  return outcome;
}

export function useInstall(): { kind: InstallKind; justInstalled: boolean } {
  const [kind, setKind] = useState<InstallKind>(() => currentKind());
  const [justInstalled, setJust] = useState(false);
  useEffect(() => {
    const f = () => { const k = currentKind(); setKind(k); if (installedNow) setJust(true); };
    listeners.add(f);
    f();
    return () => { listeners.delete(f); };
  }, []);
  return { kind, justInstalled };
}
