import { describe, it, expect } from "vitest";
import { detectSpeech } from "../shared/vad";
import { coachTip, scorePronunciation } from "../shared/vn";

const SR = 16000;
const gen = (sec: number, f: (t: number) => number) => Int16Array.from({ length: SR * sec }, (_, i) => Math.round(Math.max(-1, Math.min(1, f(i / SR))) * 32767));

describe("detectSpeech", () => {
  it("rejects silence", () => expect(detectSpeech(gen(2, () => 0), SR).speech).toBe(false));
  it("rejects a steady beep", () => expect(detectSpeech(gen(2, (t) => 0.5 * Math.sin(2 * Math.PI * 440 * t)), SR).speech).toBe(false));
  it("rejects steady noise", () => expect(detectSpeech(gen(2, () => (Math.random() * 2 - 1) * 0.3), SR).speech).toBe(false));
  it("accepts syllable-like modulated voice", () => {
    // 150 Hz voice with a 4 Hz syllable envelope and gaps
    // voiced 120-220 Hz glide with a syllable envelope, plus consonant-like noise bursts between syllables
    const v = gen(2, (t) => {
      const env = Math.max(0, Math.sin(2 * Math.PI * 2.2 * t)) ** 1.5;
      const f = 120 + 100 * Math.abs(Math.sin(2 * Math.PI * 0.7 * t));
      const voiced = env * 0.6 * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t) + 0.3 * Math.sin(6 * Math.PI * f * t)) / 1.8;
      const burst = env < 0.15 && (t * 2.2) % 1 > 0.5 ? (Math.random() * 2 - 1) * 0.25 : 0;
      return voiced + burst;
    });
    expect(detectSpeech(v, SR).speech).toBe(true);
  });
  it("rejects pulsed beeps (Chromium fake mic)", () => {
    const v = gen(3, (t) => ((t % 1) < 0.25 ? 0.5 * Math.sin(2 * Math.PI * 440 * t) : 0));
    expect(detectSpeech(v, SR).speech).toBe(false);
  });
  it("rejects short clicks separated by silence", () => {
    const v = gen(3, (t) => ((t % 0.5) < 0.03 ? (Math.random() * 2 - 1) * 0.6 : 0));
    expect(detectSpeech(v, SR).speech).toBe(false);
  });
  it("rejects a tiny blip", () => expect(detectSpeech(gen(2, (t) => (t > 1 && t < 1.08 ? 0.5 * Math.sin(2 * Math.PI * 200 * t) : 0)), SR).speech).toBe(false));
});

describe("coachTip", () => {
  it("praises a perfect take", () => expect(coachTip(scorePronunciation("Cảm ơn", "cảm ơn").syllables)).toMatch(/Perfect|Excellent|Spot on/i));
  it("names the tone to fix", () => {
    const tip = coachTip(scorePronunciation("Cảm ơn", "cam ơn").syllables);
    expect(tip).toContain("cảm");
    expect(tip).toMatch(/hỏi/);
  });
  it("handles a different phrase", () => expect(coachTip(scorePronunciation("Cảm ơn", "xin chào").syllables)).toMatch(/listen/i));
});
