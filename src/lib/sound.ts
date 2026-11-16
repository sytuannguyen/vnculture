// All sound effects are synthesised with Web Audio: no files to load or fail.
// The "pluck" is a Karplus-Strong string tuned to the Vietnamese pentatonic scale,
// giving a đàn tranh (zither) flavour.

let ctx: AudioContext | null = null;
let muted = (() => { try { return localStorage.getItem("culture.muted") === "1"; } catch { return false; } })();
const listeners = new Set<(m: boolean) => void>();

export function isMuted() { return muted; }
export function setMuted(m: boolean) { muted = m; try { localStorage.setItem("culture.muted", m ? "1" : "0"); } catch { /* */ } listeners.forEach((f) => f(m)); }
export function onMute(f: (m: boolean) => void) { listeners.add(f); return () => { listeners.delete(f); }; }

export function audioCtx(): AudioContext | null {
  try {
    if (!ctx) { const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; ctx = new C(); }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
/** Call from the first user gesture (iOS needs it). */
export function unlockAudio() { const c = audioCtx(); if (!c) return; const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); }

const PENTA = [261.63, 293.66, 349.23, 392.0, 440.0]; // C D F G A
const note = (i: number) => PENTA[((i % 5) + 5) % 5] * Math.pow(2, Math.floor(i / 5));
const pluckCache = new Map<number, AudioBuffer>();

function pluckBuffer(c: AudioContext, freq: number): AudioBuffer {
  const key = Math.round(freq);
  const hit = pluckCache.get(key); if (hit) return hit;
  const sr = c.sampleRate, len = Math.floor(sr * 1.6);
  const buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const period = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % period;
    const v = ring[idx];
    ring[idx] = 0.4985 * (v + ring[next]);
    d[i] = v * (i < 40 ? i / 40 : 1);
    idx = next;
  }
  pluckCache.set(key, buf);
  return buf;
}

function pluck(i: number, when = 0, gain = 0.5) {
  const c = audioCtx(); if (!c || muted) return;
  const s = c.createBufferSource(); s.buffer = pluckBuffer(c, note(i));
  const g = c.createGain(); g.gain.value = gain;
  s.connect(g).connect(c.destination); s.start(c.currentTime + when);
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.2, when = 0, slideTo?: number) {
  const c = audioCtx(); if (!c || muted) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + when);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + when + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + when);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
  o.connect(g).connect(c.destination); o.start(c.currentTime + when); o.stop(c.currentTime + when + dur + 0.05);
}

function vibrate(p: number | number[]) { try { navigator.vibrate?.(p); } catch { /* */ } }

export const sfx = {
  tap() { tone(900, 0.06, "triangle", 0.12); tone(600, 0.05, "sine", 0.08, 0.01); vibrate(8); },
  correct(streak = 0) { const b = 5 + Math.min(streak, 6); pluck(b); pluck(b + 2, 0.09); pluck(b + 4, 0.18, 0.6); vibrate([20, 30, 20]); },
  wrong() { tone(220, 0.25, "sine", 0.18, 0, 160); vibrate(60); },
  success() { [5, 7, 9, 10, 12].forEach((n, i) => pluck(n, i * 0.08, 0.55)); vibrate([30, 40, 30, 40, 60]); },
  join() { pluck(7); pluck(9, 0.12); pluck(12, 0.24, 0.6); },
  gong() { const c = audioCtx(); if (!c || muted) return; tone(98, 2.6, "sine", 0.35); tone(196.5, 2, "sine", 0.12); tone(293, 1.4, "triangle", 0.05); },
  lantern() { pluck(10 + Math.floor(Math.random() * 5), 0, 0.25); },
  tick() { tone(1400, 0.03, "square", 0.04); },
  whoosh() { tone(300, 0.35, "sine", 0.08, 0, 900); },
  fanfare() { [0, 2, 4, 5, 7, 9, 10, 12].forEach((n, i) => pluck(n + 3, i * 0.07, 0.5)); tone(130.8, 1.5, "triangle", 0.12, 0.5); },
};
