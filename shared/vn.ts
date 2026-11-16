// Vietnamese syllable analysis: split a syllable into its tone and its toneless
// base, and score a heard transcription against a target phrase, deterministically.
import type { ToneId } from "./content";

const TONE_MARKS: Record<string, ToneId> = { "́": 1, "̀": 2, "̉": 3, "̃": 4, "̣": 5 };

export function analyzeSyllable(s: string): { base: string; tone: ToneId } {
  const nfd = s.normalize("NFD").toLowerCase();
  let tone: ToneId = 0;
  let base = "";
  for (const ch of nfd) {
    if (ch in TONE_MARKS) tone = TONE_MARKS[ch];
    else base += ch;
  }
  return { base: base.normalize("NFC"), tone };
}

/** Plain letters only (no tone, no vowel-quality marks, đ→d): for "close" matches. */
export function plain(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
}

export function syllables(text: string): string[] {
  return text
    .normalize("NFC")
    .replace(/[.,!?;:"“”‘’()…\-–—]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export type SylStatus = "ok" | "tone" | "close" | "miss";
export interface SylResult { target: string; heard: string | null; status: SylStatus; targetTone: ToneId; heardTone: ToneId | null }

const VALUE: Record<SylStatus, number> = { ok: 1, tone: 0.55, close: 0.6, miss: 0 };

function compare(t: string, h: string): SylStatus {
  const A = analyzeSyllable(t), B = analyzeSyllable(h);
  if (A.base === B.base) return A.tone === B.tone ? "ok" : "tone";
  const pa = plain(t), pb = plain(h);
  if (pa === pb) return A.tone === B.tone ? "close" : "tone";
  if (editDistance(pa, pb) <= (pa.length > 3 ? 2 : 1)) return "close";
  return "miss";
}

/** Align target syllables with heard syllables (extra heard syllables are free) and score 0-100. */
export function scorePronunciation(target: string, heard: string): { score: number; syllables: SylResult[] } {
  const T = syllables(target), H = syllables(heard);
  const n = T.length, m = H.length;
  // DP maximising total value; skipping a heard syllable costs 0, skipping a target costs 0 (counts as miss).
  const best: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  const move: string[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(""));
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      if (i === 0 && j === 0) continue;
      let v = -1, mv = "";
      if (i > 0 && j > 0) { const s = best[i - 1][j - 1] + VALUE[compare(T[i - 1], H[j - 1])]; if (s > v) { v = s; mv = "d"; } }
      if (i > 0 && best[i - 1][j] > v) { v = best[i - 1][j]; mv = "t"; }
      if (j > 0 && best[i][j - 1] > v) { v = best[i][j - 1]; mv = "h"; }
      best[i][j] = v; move[i][j] = mv;
    }
  const out: SylResult[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const mv = move[i][j];
    if (mv === "d") {
      const st = compare(T[i - 1], H[j - 1]);
      out.unshift({ target: T[i - 1], heard: st === "miss" ? H[j - 1] : H[j - 1], status: st, targetTone: analyzeSyllable(T[i - 1]).tone, heardTone: analyzeSyllable(H[j - 1]).tone });
      i--; j--;
    } else if (mv === "t") {
      out.unshift({ target: T[i - 1], heard: null, status: "miss", targetTone: analyzeSyllable(T[i - 1]).tone, heardTone: null });
      i--;
    } else j--;
  }
  const total = out.reduce((s, r) => s + VALUE[r.status], 0);
  return { score: n ? Math.round((100 * total) / n) : 0, syllables: out };
}

const TONE_TIPS = ["keep it flat and steady", "swing your voice up, like asking “huh?”", "relax and let it fall low", "dip down, then come back up", "rise, catch in your throat, then jump up", "make it short and heavy, drop and stop"];
const TONE_NAMES = ["ngang (level)", "sắc (rising)", "huyền (falling)", "hỏi (dipping)", "ngã (broken rising)", "nặng (heavy drop)"];

/** A specific, honest coaching tip computed from the syllable comparison (no AI guesswork). */
export function coachTip(res: SylResult[]): string {
  if (!res.length) return "Tap the mic and say the phrase clearly, close to your phone.";
  const bad = res.filter((r) => r.status !== "ok");
  if (!bad.length) return "Perfect! Every tone was spot on. Now say it with a smile to a Vietnamese friend 😄";
  const missed = res.filter((r) => r.status === "miss").length;
  if (missed >= Math.ceil(res.length / 2)) return "The AI heard different words. Listen to the voice again (try 🐢 Slow), then copy it syllable by syllable.";
  const tone = bad.find((r) => r.status === "tone");
  if (tone) return `Nearly! On “${tone.target.toLowerCase()}”, use the ${TONE_NAMES[tone.targetTone]} tone: ${TONE_TIPS[tone.targetTone]}.`;
  const close = bad.find((r) => r.status === "close");
  if (close) return `So close! “${close.target.toLowerCase()}” sounded like “${close.heard}”. Listen again and copy the vowel carefully.`;
  return `Don't forget “${bad[0].target.toLowerCase()}”. Say every syllable, nice and clear.`;
}
