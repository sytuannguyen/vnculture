// Pre-generates every fixed Vietnamese audio clip with Cloud TTS (Chirp3-HD) so the
// core lessons never depend on a live API during the workshop.
// Usage: npm run audio   (uses your gcloud user credentials)
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { allStaticAudioTexts } from "../shared/content";

const OUT = "public/audio";
mkdirSync(OUT, { recursive: true });
const token = execSync("gcloud auth print-access-token", { shell: process.platform === "win32" ? "powershell.exe" : "/bin/sh" }).toString().trim();
export const fileFor = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 12) + ".mp3";

async function synth(text: string): Promise<Buffer> {
  const single = !text.includes(" ");
  for (const name of ["vi-VN-Chirp3-HD-Aoede", "vi-VN-Neural2-A"]) {
    const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": "eduflow-94827", "Content-Type": "application/json" },
      body: JSON.stringify({ input: { text }, voice: { languageCode: "vi-VN", name }, audioConfig: { audioEncoding: "MP3", speakingRate: single ? 0.8 : 0.92 } }),
    });
    const j = (await r.json()) as { audioContent?: string };
    if (j.audioContent) return Buffer.from(j.audioContent, "base64");
    console.warn("voice failed", name, JSON.stringify(j).slice(0, 200));
  }
  throw new Error("TTS failed for " + text);
}

const manifest: Record<string, string> = {};
const texts = allStaticAudioTexts();
let made = 0;
for (const text of texts) {
  const f = fileFor(text);
  manifest[text] = f;
  if (existsSync(`${OUT}/${f}`)) continue;
  writeFileSync(`${OUT}/${f}`, await synth(text));
  made++;
}
writeFileSync("shared/audioManifest.json", JSON.stringify(manifest, null, 1));
console.log(`audio: ${texts.length} clips (${made} new)`);
