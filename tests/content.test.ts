// Curated content integrity: a typo here breaks a live session in front of a class.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../shared/audioManifest.json";
import { ACTIVITIES, AVATARS, FALLBACK_NAMES, MARKET_ITEMS, PHRASES, QUIZ, TEAMS, allStaticAudioTexts, teamById } from "../shared/content";
import { analyzeSyllable } from "../shared/vn";

const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe("content", () => {
  it("ids are unique", () => {
    for (const list of [TEAMS, ACTIVITIES, PHRASES, QUIZ, MARKET_ITEMS]) expect(unique(list.map((x) => x.id))).toBe(true);
    expect(unique(AVATARS)).toBe(true);
  });
  it("has 4 teams and 7 activities (the passport has 7 stamps)", () => {
    expect(TEAMS).toHaveLength(4);
    expect(ACTIVITIES).toHaveLength(7);
    expect(teamById("nope").id).toBe(TEAMS[0].id);
  });
  it("every scored quiz question has a valid answer; polls have none", () => {
    for (const q of QUIZ) {
      if (q.kind === "poll") expect(q.answer).toBe(-1);
      else expect(q.answer).toBeGreaterThanOrEqual(0), expect(q.answer).toBeLessThan(q.options.length);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.seconds).toBeGreaterThanOrEqual(10);
    }
  });
  it("tone questions play the correct option's audio", () => {
    for (const q of QUIZ.filter((x) => x.kind === "tone")) expect(q.options[q.answer]).toBe(q.audio);
  });
  it("market floors are below starting prices", () => {
    for (const it of MARKET_ITEMS) expect(it.floor).toBeLessThan(it.start);
  });
  it("fallback names are two syllables", () => {
    for (const n of FALLBACK_NAMES) expect(n.name.split(" ")).toHaveLength(2);
  });
  it("phrases are proper Vietnamese with tone marks somewhere", () => {
    expect(PHRASES.some((p) => p.vi.split(/\s+/).some((w) => analyzeSyllable(w).tone > 0))).toBe(true);
  });
  it("every static audio text has a pre-generated MP3 on disk", () => {
    const M = manifest as Record<string, string>;
    for (const t of allStaticAudioTexts()) {
      expect(M[t], `missing audio for "${t}"`).toBeTruthy();
      expect(existsSync(path.resolve("public/audio", M[t])), `missing file for "${t}"`).toBe(true);
    }
  });
});
