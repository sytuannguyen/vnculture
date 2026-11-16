// The live event store: joining, team balance, points/lanterns, quiz lifecycle,
// dashboards, awards, hiding, SSE fan-out and persistence.
import { beforeEach, describe, expect, it, vi } from "vitest";

const persist = vi.hoisted(() => ({
  loadEvent: vi.fn(async () => null as unknown),
  saveEvent: vi.fn(async () => true),
  loadVoices: vi.fn(async () => [] as unknown[]),
  clearVoices: vi.fn(async () => true),
  saveVoice: vi.fn(async () => true),
  deleteVoice: vi.fn(async () => true),
}));
vi.mock("../server/persist", () => ({ persistence: persist }));

import { Store, freshEvent } from "../server/state";
import { QUIZ, TEAMS } from "../shared/content";
import type { Profile } from "../shared/types";

let s: Store;
const prof = (n: number, role: Profile["role"] = "visitor"): Profile => ({ id: `p${n}`, name: `Kid${n}`, avatar: "🐨", role });
const mcqIndex = QUIZ.findIndex((q) => q.kind === "mcq");
const pollIndex = QUIZ.findIndex((q) => q.kind === "poll");

beforeEach(() => { s = new Store(); vi.clearAllMocks(); });

describe("join", () => {
  it("creates a participant with 10 points, 1 lantern, a feed item and a recent join", () => {
    const p = s.join(prof(1));
    expect(p.points).toBe(10);
    expect(s.e.lanterns).toBe(1);
    expect(s.e.feed[0].text).toMatch(/joined Team/);
    expect(s.e.recentJoins[0].name).toBe("Kid1");
    expect(p.stats).toMatchObject({ toneCorrect: 0, stamps: [], words: [] });
  });
  it("re-joining keeps progress and only updates name/avatar", () => {
    const p = s.join(prof(1));
    p.points = 99;
    const again = s.join({ ...prof(1), name: "Emma", avatar: "🐼" });
    expect(again).toBe(p);
    expect(again.points).toBe(99);
    expect(again.name).toBe("Emma");
    expect(s.list()).toHaveLength(1);
    expect(s.e.lanterns).toBe(1);
  });
  it("balances teams and spreads locals across teams", () => {
    for (let i = 0; i < 8; i++) s.join(prof(i));
    for (const t of TEAMS) expect(s.list().filter((p) => p.team === t.id)).toHaveLength(2);
    for (let i = 0; i < 4; i++) s.join(prof(100 + i, "local"));
    for (const t of TEAMS) expect(s.list().filter((p) => p.team === t.id && p.role === "local")).toHaveLength(1);
  });
  it("keeps only the 24 most recent joins", () => {
    for (let i = 0; i < 30; i++) s.join(prof(i));
    expect(s.e.recentJoins).toHaveLength(24);
    expect(s.e.recentJoins[0].name).toBe("Kid29");
  });
});

describe("goal", () => {
  it("is at least 300 and grows with the crowd in steps of 50", () => {
    expect(s.goal()).toBe(300);
    for (let i = 0; i < 40; i++) s.join(prof(i));
    expect(s.goal()).toBe(600);
    expect(s.goal() % 50).toBe(0);
  });
});

describe("award / feed / word / stamp", () => {
  it("adds rounded points and lanterns", () => {
    const p = s.join(prof(1));
    s.award(p, 12.6, 2, "did a thing", "🎉");
    expect(p.points).toBe(23);
    expect(s.e.lanterns).toBe(3);
    expect(s.e.feed[0]).toMatchObject({ text: "did a thing", emoji: "🎉" });
  });
  it("hidden participants never reach the feed", () => {
    const p = s.join(prof(1));
    p.hidden = true;
    s.feed(p, "secret", "🤫");
    expect(s.e.feed.some((f) => f.text === "secret")).toBe(false);
  });
  it("feed shows the Vietnamese name and keeps 40 items", () => {
    const p = s.join(prof(1));
    p.vnName = "Minh Anh";
    for (let i = 0; i < 50; i++) s.feed(p, `t${i}`, "✨");
    expect(s.e.feed).toHaveLength(40);
    expect(s.e.feed[0].name).toBe("Kid1 (Minh Anh)");
  });
  it("word cloud counts case-insensitively, trims punctuation, ignores junk", () => {
    const p = s.join(prof(1));
    s.word(p, "Xin chào!", "Hello");
    s.word(undefined, "xin chào");
    s.word(p, "   ");
    s.word(p, "x".repeat(41));
    expect(Object.values(s.e.words)).toEqual([{ w: "Xin chào", n: 2, en: "Hello" }]);
    expect(p.stats.words).toEqual(["Xin chào"]);
  });
  it("stamps are unique", () => {
    const p = s.join(prof(1));
    s.stamp(p, "tones"); s.stamp(p, "tones"); s.stamp(p, "say");
    expect(p.stats.stamps).toEqual(["tones", "say"]);
  });
});

describe("quiz", () => {
  it("opens a question and switches phase", () => {
    s.quizOpen(mcqIndex);
    expect(s.e.phase).toBe("quiz");
    expect(s.e.quiz).toMatchObject({ index: mcqIndex, status: "open", durationMs: QUIZ[mcqIndex].seconds * 1000 });
    s.quizOpen(999); // ignored
    expect(s.e.quiz.index).toBe(mcqIndex);
  });
  it("accepts one valid answer per person for the open question only", () => {
    const p = s.join(prof(1));
    expect(s.quizAnswer(p, mcqIndex, 0)).toBe(false); // not open
    s.quizOpen(mcqIndex);
    expect(s.quizAnswer(p, mcqIndex + 1, 0)).toBe(false); // wrong question
    expect(s.quizAnswer(p, mcqIndex, 99)).toBe(false); // bad option
    expect(s.quizAnswer(p, mcqIndex, -1)).toBe(false);
    expect(s.quizAnswer(p, mcqIndex, 0)).toBe(true);
    expect(s.quizAnswer(p, mcqIndex, 1)).toBe(false); // second try
    expect(s.e.counters.quizAnswers).toBe(1);
  });
  it("reveal scores correct answers 50-100 by speed, wrong answers 0, and names the fastest", () => {
    vi.useFakeTimers();
    try {
      const q = QUIZ[mcqIndex];
      const fast = s.join(prof(1)), slow = s.join(prof(2)), wrong = s.join(prof(3));
      s.quizOpen(mcqIndex);
      s.quizAnswer(fast, mcqIndex, q.answer);
      vi.advanceTimersByTime(q.seconds * 500);
      s.quizAnswer(slow, mcqIndex, q.answer);
      s.quizAnswer(wrong, mcqIndex, (q.answer + 1) % q.options.length);
      const before = { fast: fast.points, slow: slow.points, wrong: wrong.points };
      s.quizReveal();
      expect(s.e.quiz.status).toBe("reveal");
      expect(fast.points - before.fast).toBe(100);
      expect(slow.points - before.slow).toBe(75);
      expect(wrong.points).toBe(before.wrong);
      expect(fast.stats.quizCorrect).toBe(1);
      expect(wrong.stats.quizAnswered).toBe(1);
      expect(s.e.feed[0].text).toMatch(/fastest/);
      const pub = s.publicState();
      expect(pub.quiz.counts?.[q.answer]).toBe(2);
      expect(pub.quiz.fastest?.map((f) => f.name)).toEqual(["Kid1", "Kid2"]);
      s.quizReveal(); // idempotent
      expect(fast.points - before.fast).toBe(100);
    } finally { vi.useRealTimers(); }
  });
  it("polls give everyone 10 points and have no fastest list", () => {
    const a = s.join(prof(1)), b = s.join(prof(2));
    s.quizOpen(pollIndex);
    s.quizAnswer(a, pollIndex, 0); s.quizAnswer(b, pollIndex, 3);
    s.quizReveal();
    expect([a.points, b.points]).toEqual([20, 20]);
    expect(s.publicState().quiz.fastest).toBeUndefined();
  });
  it("tick auto-reveals when everyone eligible has answered", () => {
    const a = s.join(prof(1)), b = s.join(prof(2));
    s.quizOpen(mcqIndex);
    s.quizAnswer(a, mcqIndex, 0);
    s.tick();
    expect(s.e.quiz.status).toBe("open");
    s.quizAnswer(b, mcqIndex, 0);
    s.tick();
    expect(s.e.quiz.status).toBe("reveal");
  });
  it("tick auto-reveals when time is up", () => {
    vi.useFakeTimers();
    try {
      s.join(prof(1));
      s.quizOpen(mcqIndex);
      vi.advanceTimersByTime(QUIZ[mcqIndex].seconds * 1000 + 500);
      s.tick();
      expect(s.e.quiz.status).toBe("reveal");
    } finally { vi.useRealTimers(); }
  });
  it("hidden and idle (5 min) people are not eligible", () => {
    vi.useFakeTimers();
    try {
      const a = s.join(prof(1)); s.join(prof(2));
      a.hidden = true;
      expect(s.eligible()).toHaveLength(1);
      vi.advanceTimersByTime(5 * 60_000 + 1);
      expect(s.eligible()).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });
});

describe("views", () => {
  it("totals exclude hidden people and average correctly", () => {
    const a = s.join(prof(1)), b = s.join(prof(2, "local")), h = s.join(prof(3));
    a.stats.toneTotal = 4; a.stats.toneCorrect = 3; b.stats.toneTotal = 4; b.stats.toneCorrect = 1;
    h.hidden = true; h.stats.toneTotal = 100; h.stats.snaps = 50;
    s.e.counters.phrasesSpoken = 2; s.e.counters.pronSum = 151;
    const t = s.totals();
    expect(t).toMatchObject({ participants: 2, visitors: 1, locals: 1, toneAccuracy: 50, toneAnswers: 8, avgPronunciation: 76, snaps: 0 });
  });
  it("team scores sum visible members' points", () => {
    const a = s.join(prof(1));
    a.points = 500; a.stats.bestDiscount = 40;
    const team = s.teams().find((t) => t.id === a.team)!;
    expect(team).toMatchObject({ points: 500, members: 1, bestDiscount: 40 });
    a.hidden = true;
    expect(s.teams().find((t) => t.id === a.team)!.members).toBe(0);
  });
  it("personal state carries my rank and my quiz answer", () => {
    const a = s.join(prof(1)), b = s.join(prof(2));
    b.points = 1000;
    s.quizOpen(mcqIndex); s.quizAnswer(a, mcqIndex, 2);
    const mine = s.personal(s.publicState(), a.id);
    expect(mine.myRank).toBe(2);
    expect(mine.myQuiz).toMatchObject({ answered: true, choice: 2 });
    expect(s.personal(s.publicState(), "nobody").me).toBeNull();
  });
  it("public state never leaks answers while a question is open", () => {
    const a = s.join(prof(1));
    s.quizOpen(mcqIndex); s.quizAnswer(a, mcqIndex, 0);
    const q = s.publicState().quiz;
    expect(q.counts).toBeUndefined();
    expect(q.fastest).toBeUndefined();
    expect(q.answeredCount).toBe(1);
    expect(q.remainingMs).toBeGreaterThan(0);
  });
  it("awards pick the best visible person per category", () => {
    const a = s.join(prof(1)), b = s.join(prof(2, "local"));
    a.points = 300; a.stats.snaps = 4; a.vnName = "Minh Anh";
    b.stats.voices = 3; b.stats.phrases = { xinchao: 90, camon: 70 };
    const aw = s.awards();
    const by = (t: string) => aw.find((x) => x.title === t);
    expect(by("MVP")?.name).toBe("Kid1 · Minh Anh");
    expect(by("Explorer")?.detail).toBe("4 things snapped");
    expect(by("Golden Voice")?.detail).toBe("avg 80% on 2 phrases");
    expect(by("Best Buddy")?.name).toBe("Kid2");
    expect(by("Master Bargainer")).toBeUndefined(); // nobody > 0
  });
  it("host state sorts participants and caps the word cloud at 60", () => {
    const a = s.join(prof(1)), b = s.join(prof(2));
    b.points = 50;
    for (let i = 0; i < 70; i++) s.word(a, `w${i}`);
    const h = s.hostState(s.publicState());
    expect(h.participants[0].id).toBe(b.id);
    expect(h.words).toHaveLength(60);
  });
});

describe("SSE", () => {
  const fakeRes = () => {
    const writes: string[] = [];
    let onClose: (() => void) | undefined;
    return { writes, close: () => onClose?.(), res: { write: (x: string) => { writes.push(x); return true; }, on: (_: string, f: () => void) => { onClose = f; } } };
  };
  it("sends an initial snapshot, personal vs host payloads, and broadcasts only on change", () => {
    const p = s.join(prof(1));
    const phone = fakeRes(), host = fakeRes();
    s.addClient(phone.res as never, p.id, false);
    s.addClient(host.res as never, undefined, true);
    expect(JSON.parse(phone.writes[0].slice(6)).me.id).toBe(p.id);
    expect(JSON.parse(host.writes[0].slice(6)).participants).toHaveLength(1);
    s.tick(); // version changed since construction → broadcast
    const n = phone.writes.length;
    s.tick(); // nothing changed → silent
    expect(phone.writes.length).toBe(n);
    s.touch(); s.tick();
    expect(phone.writes.length).toBe(n + 1);
    expect(s.clientCount()).toBe(2);
    phone.close();
    expect(s.clientCount()).toBe(1);
  });
  it("drops clients whose socket throws", () => {
    s.addClient({ write: vi.fn().mockImplementationOnce(() => true).mockImplementation(() => { throw new Error("gone"); }), on: () => undefined } as never, undefined, false);
    s.broadcast();
    expect(s.clientCount()).toBe(0);
  });
});

describe("persistence", () => {
  it("saves only when dirty", async () => {
    await s.saveIfDirty();
    expect(persist.saveEvent).not.toHaveBeenCalled();
    s.touch();
    await s.saveIfDirty();
    expect(persist.saveEvent).toHaveBeenCalledTimes(1);
    await s.saveIfDirty();
    expect(persist.saveEvent).toHaveBeenCalledTimes(1);
  });
  it("stays dirty when a save fails", async () => {
    persist.saveEvent.mockResolvedValueOnce(false);
    s.touch();
    await s.saveIfDirty();
    await s.saveIfDirty();
    expect(persist.saveEvent).toHaveBeenCalledTimes(2);
  });
  it("restores a saved event and voices, filling in new fields", async () => {
    const saved = { ...freshEvent(), eventId: "restored", lanterns: 42 } as Record<string, unknown>;
    delete saved.recentJoins;
    persist.loadEvent.mockResolvedValueOnce(saved);
    persist.loadVoices.mockResolvedValueOnce([{ meta: { id: "v1", phraseId: "xinchao", pid: "p1", name: "A", avatar: "🐨" }, mime: "audio/wav", data: Buffer.from("x") }]);
    await s.load();
    expect(s.e.eventId).toBe("restored");
    expect(s.e.lanterns).toBe(42);
    expect(s.e.recentJoins).toEqual([]);
    expect(s.voices.has("v1")).toBe(true);
  });
  it("reset starts a new event and optionally clears voices", () => {
    s.join(prof(1));
    s.voices.set("v1", {} as never);
    const old = s.e.eventId;
    s.reset(false);
    expect(s.list()).toHaveLength(0);
    expect(s.e.eventId).not.toBe(old);
    expect(s.voices.size).toBe(1);
    s.reset(true);
    expect(s.voices.size).toBe(0);
    expect(persist.clearVoices).toHaveBeenCalled();
  });
});
