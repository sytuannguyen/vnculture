// Microphone → 16 kHz mono WAV (base64). Works on iOS Safari (mp4/aac) and Android
// Chrome (webm/opus) because we decode whatever MediaRecorder produced and re-encode.
import { audioCtx } from "./sound";

export interface Recording { wavB64: string; url: string; seconds: number }

export class Recorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private raf = 0;
  private stopTimer = 0;

  static supported() { return typeof navigator.mediaDevices?.getUserMedia === "function" && typeof MediaRecorder !== "undefined"; }

  async start(onLevel: (v: number) => void, maxMs = 6000, onAutoStop?: () => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    const c = audioCtx();
    if (c) {
      const src = c.createMediaStreamSource(this.stream), an = c.createAnalyser();
      an.fftSize = 512; src.connect(an);
      const mute = c.createGain(); mute.gain.value = 0; an.connect(mute).connect(c.destination);
      const data = new Uint8Array(an.fftSize);
      const loop = () => { an.getByteTimeDomainData(data); let m = 0; for (const x of data) m = Math.max(m, Math.abs(x - 128)); onLevel(Math.min(1, m / 70)); this.raf = requestAnimationFrame(loop); };
      loop();
    }
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream);
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start();
    this.stopTimer = window.setTimeout(() => onAutoStop?.(), maxMs);
  }

  async stop(): Promise<Recording> {
    clearTimeout(this.stopTimer);
    cancelAnimationFrame(this.raf);
    const rec = this.rec;
    if (!rec) throw new Error("not recording");
    const done = new Promise<void>((r) => { rec.onstop = () => r(); });
    if (rec.state !== "inactive") rec.stop();
    await done;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.rec = null; this.stream = null;
    const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
    return encode(blob);
  }

  cancel() {
    clearTimeout(this.stopTimer); cancelAnimationFrame(this.raf);
    try { if (this.rec && this.rec.state !== "inactive") this.rec.stop(); } catch { /* */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.rec = null; this.stream = null;
  }
}

async function encode(blob: Blob): Promise<Recording> {
  const c = audioCtx();
  if (!c) throw new Error("no audio");
  const buf = await new Promise<AudioBuffer>((res, rej) => {
    blob.arrayBuffer().then((ab) => c.decodeAudioData(ab, res, rej)).catch(rej);
  });
  const rate = 16000;
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * rate)), rate);
  const s = off.createBufferSource(); s.buffer = buf; s.connect(off.destination); s.start();
  const out = await off.startRendering();
  const pcm = out.getChannelData(0);
  // trim leading/trailing silence and normalise
  let peak = 0; for (const v of pcm) peak = Math.max(peak, Math.abs(v));
  const thr = Math.max(0.02, peak * 0.08);
  let a = 0, b = pcm.length - 1;
  while (a < b && Math.abs(pcm[a]) < thr) a++;
  while (b > a && Math.abs(pcm[b]) < thr) b--;
  a = Math.max(0, a - rate * 0.15); b = Math.min(pcm.length - 1, b + rate * 0.2);
  const seg = pcm.subarray(Math.floor(a), Math.floor(b));
  const gain = peak > 0 ? Math.min(4, 0.9 / peak) : 1;
  const wav = new DataView(new ArrayBuffer(44 + seg.length * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); wav.setUint32(4, 36 + seg.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true); wav.setUint32(24, rate, true);
  wav.setUint32(28, rate * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); w(36, "data"); wav.setUint32(40, seg.length * 2, true);
  for (let i = 0; i < seg.length; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, seg[i] * gain)) * 0x7fff, true);
  const bytes = new Uint8Array(wav.buffer);
  let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { wavB64: btoa(bin), url: URL.createObjectURL(new Blob([bytes], { type: "audio/wav" })), seconds: seg.length / rate };
}

export async function resizeImage(file: File, max = 768): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.82).split(",")[1];
  } finally { URL.revokeObjectURL(url); }
}
