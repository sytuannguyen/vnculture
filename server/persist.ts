// Firestore snapshotting. Every call is best-effort: if Firestore is unreachable
// (e.g. local dev without credentials) the app keeps running purely in memory.
import type { EventData, Voice } from "./state";

type FS = import("@google-cloud/firestore").Firestore;
let db: FS | null = null;
let disabled = process.env.CULTURE_PERSIST === "off";
const EVENT_DOC = process.env.CULTURE_EVENT_DOC || "main";

async function getDb(): Promise<FS | null> {
  if (disabled) return null;
  if (db) return db;
  try {
    const { Firestore } = await import("@google-cloud/firestore");
    db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT || "eduflow-94827", ignoreUndefinedProperties: true });
    return db;
  } catch (e) {
    console.warn("[culture] Firestore unavailable, memory only:", (e as Error).message);
    disabled = true;
    return null;
  }
}

async function guard<T>(what: string, fn: (db: FS) => Promise<T>, fallback: T): Promise<T> {
  const d = await getDb();
  if (!d) return fallback;
  try {
    const work = fn(d);
    work.catch(() => undefined); // a late rejection after the timeout must never go unhandled
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<T>((_, rej) => { timer = setTimeout(() => rej(new Error("timeout")), 8000); });
    try { return await Promise.race([work, timeout]); } finally { clearTimeout(timer); }
  } catch (e) {
    const msg = (e as Error).message || "";
    console.warn(`[culture] Firestore ${what} failed:`, msg.slice(0, 200));
    if (/default credentials|NO_ADC|PERMISSION_DENIED/i.test(msg)) { disabled = true; console.warn("[culture] persistence disabled (no credentials): running in memory"); }
    return fallback;
  }
}

export const persistence = {
  loadEvent: () => guard<EventData | null>("load", async (d) => {
    const snap = await d.collection("culture_events").doc(EVENT_DOC).get();
    const json = snap.exists ? (snap.get("json") as string | undefined) : undefined;
    return json ? (JSON.parse(json) as EventData) : null;
  }, null),
  saveEvent: (e: EventData) => guard("save", async (d) => {
    await d.collection("culture_events").doc(EVENT_DOC).set({ json: JSON.stringify(e), savedAt: Date.now() });
    return true;
  }, false),
  saveVoice: (v: Voice) => guard("voice save", async (d) => {
    await d.collection("culture_voices").doc(v.meta.id).set({ event: EVENT_DOC, meta: v.meta, mime: v.mime, b64: v.data.toString("base64") });
    return true;
  }, false),
  deleteVoice: (id: string) => guard("voice delete", async (d) => { await d.collection("culture_voices").doc(id).delete(); return true; }, false),
  loadVoices: () => guard<Voice[]>("voice load", async (d) => {
    const qs = await d.collection("culture_voices").where("event", "==", EVENT_DOC).get();
    return qs.docs.map((doc) => ({ meta: doc.get("meta"), mime: doc.get("mime"), data: Buffer.from(doc.get("b64") as string, "base64") }));
  }, []),
  clearVoices: () => guard("voice clear", async (d) => {
    const qs = await d.collection("culture_voices").where("event", "==", EVENT_DOC).get();
    await Promise.all(qs.docs.map((doc) => doc.ref.delete()));
    return true;
  }, false),
};
