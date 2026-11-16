// Deterministic voice-activity check on 16-bit mono PCM. Speech has a syllabic
// rhythm: its loudness rises and falls several times per second. Silence is quiet;
// beeps, hums and steady noise are flat. AI models hallucinate words for those, so we
// reject them before any AI call.

export interface VadResult { speech: boolean; voicedSec: number; modulation: number; zcrVar?: number; reason?: string }

export function detectSpeech(pcm: Int16Array, sampleRate: number): VadResult {
  const frame = Math.round(sampleRate * 0.02);
  const rms: number[] = [], zcr: number[] = [];
  for (let i = 0; i + frame <= pcm.length; i += frame) {
    let s = 0, z = 0;
    for (let j = i; j < i + frame; j++) { const v = pcm[j] / 32768; s += v * v; if (j > i && (pcm[j] >= 0) !== (pcm[j - 1] >= 0)) z++; }
    rms.push(Math.sqrt(s / frame)); zcr.push(z / frame);
  }
  if (rms.length < 10) return { speech: false, voicedSec: 0, modulation: 0, reason: "too_short" };
  const peak = Math.max(...rms);
  if (peak < 0.01) return { speech: false, voicedSec: 0, modulation: 0, reason: "silence" };
  const thr = Math.max(0.006, peak * 0.12);
  const voiced = rms.filter((r) => r > thr);
  const voicedSec = (voiced.length * frame) / sampleRate;
  // envelope modulation: mean absolute frame-to-frame change relative to the mean level, over voiced span
  const first = rms.findIndex((r) => r > thr), last = rms.length - 1 - [...rms].reverse().findIndex((r) => r > thr);
  const span = rms.slice(first, last + 1);
  const mean = span.reduce((a, b) => a + b, 0) / span.length;
  const sd = Math.sqrt(span.reduce((a, b) => a + (b - mean) ** 2, 0) / span.length);
  const modulation = mean > 0 ? sd / mean : 0;
  if (voicedSec < 0.2) return { speech: false, voicedSec, modulation, reason: "too_short" };
  // a spoken syllable is a continuous sound of >= ~120 ms; clicks, taps and blips are not
  let run = 0, maxRun = 0, gap = 0;
  for (const r of rms) {
    if (r > thr) { run += 1 + gap; gap = 0; maxRun = Math.max(maxRun, run); }
    else if (run > 0 && gap < 1) gap++;
    else { run = 0; gap = 0; }
  }
  if ((maxRun * frame) / sampleRate < 0.12) return { speech: false, voicedSec, modulation, reason: "clicks" };
  if (modulation < 0.3) return { speech: false, voicedSec, modulation, reason: "flat" };
  // spectral variety: a beep/hum is one pure tone, so its zero-crossing rate barely changes;
  // speech alternates vowels (low ZCR) and consonants (high ZCR) and glides in pitch.
  const vz = zcr.filter((_, k) => rms[k] > thr);
  const zm = vz.reduce((a, b) => a + b, 0) / vz.length;
  const zsd = Math.sqrt(vz.reduce((a, b) => a + (b - zm) ** 2, 0) / vz.length);
  const zcrVar = zm > 0 ? zsd / zm : 0;
  if (zcrVar < 0.3) return { speech: false, voicedSec, modulation, zcrVar, reason: "tone" };
  return { speech: true, voicedSec, modulation, zcrVar };
}

/** Parse a base64 PCM16 mono WAV (as produced by our recorder or Cloud TTS LINEAR16). */
export function parseWav(b64: string): { pcm: Int16Array; sampleRate: number } | null {
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
    let off = 12, sampleRate = 16000, channels = 1, bits = 16;
    while (off + 8 <= buf.length) {
      const id = buf.toString("ascii", off, off + 4), size = buf.readUInt32LE(off + 4);
      if (id === "fmt ") { channels = buf.readUInt16LE(off + 10); sampleRate = buf.readUInt32LE(off + 12); bits = buf.readUInt16LE(off + 22); }
      if (id === "data") {
        if (bits !== 16) return null;
        const end = Math.min(buf.length, off + 8 + size);
        const n = Math.floor((end - off - 8) / 2 / channels);
        const pcm = new Int16Array(n);
        for (let i = 0; i < n; i++) pcm[i] = buf.readInt16LE(off + 8 + i * 2 * channels);
        return { pcm, sampleRate };
      }
      off += 8 + size + (size % 2);
    }
    return null;
  } catch { return null; }
}
