// Dynamic Vietnamese speech (AI replies, snap words) via Cloud Text-to-Speech,
// authenticated by the Cloud Run service account. In-memory LRU cache.
import { GoogleAuth } from "google-auth-library";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "eduflow-94827";
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const cache = new Map<string, Buffer>();
const inflight = new Map<string, Promise<Buffer | null>>();

export async function ttsVi(text: string): Promise<Buffer | null> {
  const key = text.trim().slice(0, 300);
  if (!key) return null;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = synth(key).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function synth(text: string): Promise<Buffer | null> {
  let token: string | null | undefined;
  try { token = process.env.CULTURE_DEV_TOKEN || (await auth.getAccessToken()); } catch (e) { console.warn("[culture] TTS auth failed", (e as Error).message); return null; }
  const single = !text.includes(" ");
  for (const name of ["vi-VN-Chirp3-HD-Aoede", "vi-VN-Neural2-A"]) {
    try {
      const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST", signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": PROJECT, "Content-Type": "application/json" },
        body: JSON.stringify({ input: { text }, voice: { languageCode: "vi-VN", name }, audioConfig: { audioEncoding: "MP3", speakingRate: single ? 0.8 : 0.92 } }),
      });
      if (!r.ok) { console.warn("[culture] TTS", name, r.status); continue; }
      const j = (await r.json()) as { audioContent?: string };
      if (!j.audioContent) continue;
      const buf = Buffer.from(j.audioContent, "base64");
      cache.set(text, buf);
      if (cache.size > 600) cache.delete(cache.keys().next().value!);
      return buf;
    } catch (e) { console.warn("[culture] TTS error", name, (e as Error).message); }
  }
  return null;
}
