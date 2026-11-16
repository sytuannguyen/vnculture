import { describe, it, expect } from "vitest";
import { analyzeSyllable, scorePronunciation, syllables } from "../shared/vn";
import { allStaticAudioTexts, withTone, TONES } from "../shared/content";

describe("analyzeSyllable", () => {
  it("extracts the six tones", () => {
    expect(["ma", "má", "mà", "mả", "mã", "mạ"].map((s) => analyzeSyllable(s).tone)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("keeps vowel-quality marks in the base", () => {
    expect(analyzeSyllable("Cảm").base).toBe("cam");
    expect(analyzeSyllable("tiền")).toEqual({ base: "tiên", tone: 2 });
    expect(analyzeSyllable("Đắt")).toEqual({ base: "đăt", tone: 1 });
    expect(analyzeSyllable("ơn")).toEqual({ base: "ơn", tone: 0 });
  });
  it("withTone builds tone variants", () => {
    expect(TONES.map((t) => withTone("ba", t.id))).toEqual(["ba", "bá", "bà", "bả", "bã", "bạ"]);
  });
});

describe("scorePronunciation", () => {
  it("perfect match = 100", () => {
    expect(scorePronunciation("Cảm ơn", "cảm ơn").score).toBe(100);
    expect(scorePronunciation("Một, hai, ba, dô!", "một hai ba dô").score).toBe(100);
  });
  it("wrong tone is partial and flagged", () => {
    const r = scorePronunciation("Cảm ơn", "cam ơn");
    expect(r.syllables[0].status).toBe("tone");
    expect(r.syllables[1].status).toBe("ok");
    expect(r.score).toBeGreaterThan(60);
    expect(r.score).toBeLessThan(100);
  });
  it("missing syllables count as misses, extra heard syllables are free", () => {
    expect(scorePronunciation("Bao nhiêu tiền", "bao nhiêu").syllables[2].status).toBe("miss");
    expect(scorePronunciation("Tôi tên là", "tôi tên là Emma").score).toBe(100);
  });
  it("close sounds get partial credit", () => {
    const r = scorePronunciation("Bao nhiêu tiền", "bao nhiêu tìm");
    expect(r.syllables[2].status).toBe("close");
  });
  it("garbage scores low", () => {
    expect(scorePronunciation("Xin chào", "hello there").score).toBeLessThan(30);
    expect(scorePronunciation("Xin chào", "").score).toBe(0);
  });
  it("splits punctuation", () => {
    expect(syllables("Bao nhiêu tiền?")).toEqual(["Bao", "nhiêu", "tiền"]);
  });
  it("has static audio texts", () => {
    expect(allStaticAudioTexts().length).toBeGreaterThan(40);
  });
});
