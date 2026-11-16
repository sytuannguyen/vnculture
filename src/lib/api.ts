import type { Profile } from "../../shared/types";

const KEY = "culture.profile.v1";

export function loadProfile(): Profile | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Profile) : null; } catch { return null; }
}
export function saveProfile(p: Profile) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ } }
export function newId(): string {
  try { return crypto.randomUUID(); } catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

let currentPid = "";
export const setPid = (id: string) => { currentPid = id; };
export const getPid = () => currentPid;
let onRejoin: (() => Promise<void>) | null = null;
export const setRejoinHandler = (fn: () => Promise<void>) => { onRejoin = fn; };

export class ApiError extends Error { constructor(public status: number, public body: Record<string, unknown>) { super(String(body?.message || body?.error || status)); } }

/** POST JSON with the participant id; transparently re-joins once if the server forgot us. */
export async function post<T = Record<string, unknown>>(url: string, body: Record<string, unknown> = {}, retry = true): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pid: currentPid, ...body }), signal: ctrl.signal });
    const json = await res.json().catch(() => ({}));
    if (res.status === 409 && retry && onRejoin) { await onRejoin(); return post<T>(url, body, false); }
    if (!res.ok) throw new ApiError(res.status, json);
    return json as T;
  } finally { clearTimeout(t); }
}

export async function hostPost(url: string, pin: string, body: Record<string, unknown> = {}) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-host-pin": pin }, body: JSON.stringify(body) });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

export function friendlyError(e: unknown): string {
  if (e instanceof ApiError && (e.status === 429 || e.status === 422) && e.body?.message) return String(e.body.message);
  if (e instanceof DOMException && e.name === "AbortError") return "That took too long. Please try again!";
  return "Hmm, the connection hiccuped. Please try again 🙏";
}
