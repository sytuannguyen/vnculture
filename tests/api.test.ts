// HTTP API end to end against the real Express app, with Gemini, Cloud TTS and
// Firestore mocked so the tests are fast, free and deterministic.
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => { process.env.HOST_PIN = "4321"; process.env.CULTURE_PERSIST = "off"; });

const ai = vi.hoisted(() => ({
  aiName: vi.fn(), aiPronounce: vi.fn(), aiSnap: vi.fn(), aiGuide: vi.fn(), aiMarket: vi.fn(), aiWish: vi.fn(),
  aiStats: { calls: 0, failures: 0, fallbacks: 0, totalMs: 0 },
}));
vi.mock("../server/ai", () => ai);
const tts = vi.hoisted(() => ({ ttsVi: vi.fn() }));
vi.mock("../server/tts", () => tts);
vi.mock("../server/persist", () => ({
  persistence: { loadEvent: async () => null, saveEvent: async () => true, loadVoices: async () => [], clearVoices: async () => true, saveVoice: async () => true, deleteVoice: async () => true },
}));

import { app, decodeRestore } from "../server/app";
import { encodeRestore } from "../src/lib/install";
import { store } from "../server/state";
import { MARKET_ITEMS, QUIZ } from "../shared/content";

const PIN = "4321";
let server: Server, base = "";
beforeAll(async () => { server = app.listen(0); await new Promise((r) => server.once("listening", r)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await fetch(base + url, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text, headers: res.headers };
};
const post = (url: string, body: unknown = {}) => call("POST", url, body);
const hostPost = (url: string, body: unknown = {}) => call("POST", url, body, { "x-host-pin": PIN });

let n = 0;
async function join(extra: Record<string, unknown> = {}) {
  const r = await post("/api/join", { id: `kid-${++n}`, name: `Kid${n}`, avatar: "🐨", role: "visitor", ...extra });
  return r.json.me as { id: string; points: number; team: string; name: string; avatar: string; role: string };
}

// 16 kHz PCM16 WAV encoder + a synthetic "voice" that passes the speech gate
function wav(sec: number, f: (t: number) => number): string {
  const SR = 16000, N = SR * sec, buf = Buffer.alloc(44 + N * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 2, 40);
  for (let i = 0; i < N; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, f(i / SR))) * 32767), 44 + i * 2);
  return buf.toString("base64");
}
const voice = () => wav(2, (t) => {
  const env = Math.max(0, Math.sin(2 * Math.PI * 2.2 * t)) ** 1.5;
  const f = 120 + 100 * Math.abs(Math.sin(2 * Math.PI * 0.7 * t));
  const v = env * 0.6 * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t) + 0.3 * Math.sin(6 * Math.PI * f * t)) / 1.8;
  return v + (env < 0.15 && (t * 2.2) % 1 > 0.5 ? (Math.random() * 2 - 1) * 0.25 : 0);
});
const silence = () => wav(2, () => 0);

beforeEach(async () => {
  vi.clearAllMocks();
  await hostPost("/api/host/reset", { clearVoices: true });
});

describe("public basics", () => {
  it("health check", async () => {
    const r = await call("GET", "/api/health");
    expect(r.json).toMatchObject({ ok: true, participants: 0 });
  });
  it("unknown API routes are JSON 404s", async () => {
    const r = await call("GET", "/api/nope");
    expect(r.status).toBe(404);
    expect(r.json.error).toBe("not_found");
  });
  it("join sanitises name, avatar and role", async () => {
    const r = await post("/api/join", { id: "x1", name: "  <b>Emma</b>\u0007  the  great one", avatar: "💩", role: "admin" });
    expect(r.json.me).toMatchObject({ id: "x1", name: "bEmma/b the great on", avatar: "🐨", role: "visitor", points: 10 });
    expect(r.json.eventId).toBe(store.e.eventId);
  });
  it("join replaces rude names with Friend, and empty names too", async () => {
    expect((await join({ name: "shithead" })).name).toBe("Friend");
    expect((await join({ name: "   " })).name).toBe("Friend");
  });
  it("join without an id gets a fresh one; locals are kept", async () => {
    const r = await post("/api/join", { name: "Lan", role: "local" });
    expect(r.json.me.id).toMatch(/[0-9a-f-]{36}/);
    expect(r.json.me.role).toBe("local");
  });
  it("unknown participants are told to re-join (409)", async () => {
    const r = await post("/api/tone", { pid: "ghost", correct: true });
    expect(r.status).toBe(409);
    expect(r.json.error).toBe("rejoin");
  });
  it("state: public view is personal, host view needs the PIN", async () => {
    const me = await join();
    const pub = await call("GET", `/api/state?pid=${me.id}`);
    expect(pub.json.me.id).toBe(me.id);
    expect(pub.json.participants).toBeUndefined();
    const host = await call("GET", `/api/state?host=${PIN}`);
    expect(host.json.participants).toHaveLength(1);
    const wrong = await call("GET", `/api/state?host=0000`);
    expect(wrong.json.participants).toBeUndefined();
  });
  it("stream sends Server-Sent Events", async () => {
    const ctrl = new AbortController();
    const res = await fetch(`${base}/api/stream?pid=x`, { signal: ctrl.signal });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    let text = "";
    while (!text.includes("data: ")) text += new TextDecoder().decode((await reader.read()).value);
    expect(text).toContain("retry: 2000");
    ctrl.abort();
  });
});

describe("tones", () => {
  it("correct answers score more with a streak; wrong answers count but score 0", async () => {
    const me = await join();
    const a = await post("/api/tone", { pid: me.id, correct: true, streak: 1 });
    expect(a.json.points).toBe(10 + 5 + 2);
    const b = await post("/api/tone", { pid: me.id, correct: true, streak: 99 }); // capped
    expect(b.json.points).toBe(17 + 5 + 10);
    const c = await post("/api/tone", { pid: me.id, correct: false });
    expect(c.json.points).toBe(32);
    expect(store.get(me.id)!.stats).toMatchObject({ toneTotal: 3, toneCorrect: 2, toneBestStreak: 50 });
  });
  it("finishing the game stamps the passport", async () => {
    const me = await join();
    await post("/api/tone/done", { pid: me.id, score: 8 });
    expect(store.get(me.id)!.stats.stamps).toContain("tones");
    expect(store.e.feed[0].text).toContain("8/10");
  });
});

describe("host controls", () => {
  it("every host route rejects a wrong PIN", async () => {
    expect((await post("/api/host/check")).status).toBe(401);
    expect((await call("POST", "/api/host/phase", { phase: "wall" }, { "x-host-pin": "nope" })).status).toBe(401);
    expect((await hostPost("/api/host/check")).json.ok).toBe(true);
    expect((await call("GET", `/api/host/export?pin=${PIN}`)).status).toBe(200);
  });
  it("phase switching validates input and closes an open question", async () => {
    expect((await hostPost("/api/host/phase", { phase: "hacked" })).status).toBe(400);
    await hostPost("/api/host/quiz", { action: "open", index: 0 });
    await hostPost("/api/host/phase", { phase: "wall" });
    expect(store.e.phase).toBe("wall");
    expect(store.e.quiz.status).toBe("reveal");
  });
  it("full quiz round over HTTP: open → answer → reveal → next → select", async () => {
    const me = await join();
    const q = QUIZ[0];
    await hostPost("/api/host/quiz", { action: "open", index: 0 });
    expect((await post("/api/quiz/answer", { pid: me.id, index: 0, choice: q.answer })).json.ok).toBe(true);
    expect((await post("/api/quiz/answer", { pid: me.id, index: 0, choice: q.answer })).json.ok).toBe(false);
    await hostPost("/api/host/quiz", { action: "reveal" });
    const st = await call("GET", `/api/state?pid=${me.id}`);
    expect(st.json.myQuiz).toMatchObject({ answered: true, correct: true });
    expect(st.json.myQuiz.points).toBeGreaterThanOrEqual(50);
    await hostPost("/api/host/quiz", { action: "next" });
    expect(store.e.quiz).toMatchObject({ index: 1, status: "open" });
    await hostPost("/api/host/quiz", { action: "select", index: 999 });
    expect(store.e.quiz).toMatchObject({ index: QUIZ.length - 1, status: "idle" });
  });
  it("spotlight accepts real activities only", async () => {
    await hostPost("/api/host/spotlight", { activity: "snap" });
    expect(store.e.spotlight?.activity).toBe("snap");
    await hostPost("/api/host/spotlight", { activity: "evil" });
    expect(store.e.spotlight).toBeNull();
  });
  it("hide toggles a person (and scrubs their feed) and a wish", async () => {
    const me = await join();
    await hostPost("/api/host/hide", { pid: me.id });
    expect(store.get(me.id)!.hidden).toBe(true);
    expect(store.e.feed.some((f) => f.name.startsWith(me.name))).toBe(false);
    store.e.wishes.push({ id: "w1", at: 0, pid: me.id, name: "x", avatar: "🐨", team: "pho", en: "a", vi: "b" });
    await hostPost("/api/host/hide", { wishId: "w1" });
    expect(store.e.wishes[0].hidden).toBe(true);
  });
  it("reset starts a fresh event", async () => {
    await join();
    const old = store.e.eventId;
    const r = await hostPost("/api/host/reset");
    expect(r.json.eventId).not.toBe(old);
    expect(store.list()).toHaveLength(0);
  });
  it("exports CSV (escaped, with BOM) and JSON", async () => {
    const me = await join({ name: 'Em"ma' });
    store.get(me.id)!.stats.phrases = { xinchao: 80, camon: 61 };
    const csv = await call("GET", `/api/host/export?format=csv&pin=${PIN}`);
    expect(csv.headers.get("content-disposition")).toContain(".csv");
    const lines = csv.text.replace(/^﻿/, "").split("\n");
    expect(lines[0]).toMatch(/^name,vietnamese_name,role,team,points/);
    expect(lines[1]).toContain('"Em""ma"');
    expect(lines[1]).toContain('"71"'); // average phrase score
    const json = await call("GET", `/api/host/export?pin=${PIN}`);
    expect(json.json).toMatchObject({ eventId: store.e.eventId, totals: { participants: 1 } });
    expect(Array.isArray(json.json.awards)).toBe(true);
  });
});

describe("AI: Vietnamese name", () => {
  it("uses the AI name and awards 20 points the first time, 2 after", async () => {
    const me = await join();
    ai.aiName.mockResolvedValue({ vn_name: "Minh Anh", meaning: "bright", say: "ming ahn", story: "s" });
    const r = await post("/api/ai/name", { pid: me.id, about: "loves maths" });
    expect(r.json).toMatchObject({ vnName: "Minh Anh", ai: true });
    expect(ai.aiName).toHaveBeenCalledWith("Kid" + n, "loves maths");
    expect(store.get(me.id)!.points).toBe(30);
    await post("/api/ai/name", { pid: me.id });
    expect(store.get(me.id)!.points).toBe(32);
    expect(store.get(me.id)!.stats.stamps).toContain("name");
  });
  it("falls back to a curated name when the AI fails or is rude, deterministically", async () => {
    const me = await join();
    ai.aiName.mockResolvedValue(null);
    const a = await post("/api/ai/name", { pid: me.id, about: "x" });
    const b = await post("/api/ai/name", { pid: me.id, about: "x" });
    expect(a.json.ai).toBe(false);
    expect(a.json.vnName).toBe(b.json.vnName);
    ai.aiName.mockResolvedValue({ vn_name: "fuck", meaning: "", say: "", story: "" });
    expect((await post("/api/ai/name", { pid: me.id })).json.ai).toBe(false);
  });
  it("strips rude 'about' text before it reaches the AI", async () => {
    const me = await join();
    ai.aiName.mockResolvedValue(null);
    await post("/api/ai/name", { pid: me.id, about: "bitch" });
    expect(ai.aiName).toHaveBeenCalledWith(expect.any(String), "");
  });
});

describe("AI: pronunciation coach", () => {
  it("rejects missing phrases and junk audio", async () => {
    const me = await join();
    expect((await post("/api/ai/pronounce", { pid: me.id, phraseId: "nope", wav: voice() })).status).toBe(400);
    expect((await post("/api/ai/pronounce", { pid: me.id, phraseId: "camon", wav: "x".repeat(2000) })).status).toBe(400);
  });
  it("never calls the AI on silence", async () => {
    const me = await join();
    const r = await post("/api/ai/pronounce", { pid: me.id, phraseId: "camon", wav: silence() });
    expect(r.json).toMatchObject({ noSpeech: true, score: 0 });
    expect(r.json.tip).toMatch(/microphone/);
    expect(ai.aiPronounce).not.toHaveBeenCalled();
  });
  it("scores what the AI heard deterministically and records progress", async () => {
    const me = await join();
    ai.aiPronounce.mockResolvedValue({ heard: "cam ơn", matches: true });
    const r = await post("/api/ai/pronounce", { pid: me.id, phraseId: "camon", wav: voice() });
    expect(r.json.heard).toBe("cam ơn");
    expect(r.json.score).toBeGreaterThan(60);
    expect(r.json.score).toBeLessThan(100);
    expect(r.json.tip).toMatch(/hỏi/);
    const p = store.get(me.id)!;
    expect(p.stats.phrases.camon).toBe(r.json.score);
    expect(store.e.counters.phrasesSpoken).toBe(1);
    ai.aiPronounce.mockResolvedValue({ heard: "cảm ơn", matches: true });
    const perfect = await post("/api/ai/pronounce", { pid: me.id, phraseId: "camon", wav: voice() });
    expect(perfect.json.score).toBe(100);
    expect(p.stats.phrases.camon).toBe(100);
  });
  it("tells the phone to fall back when the AI is down", async () => {
    const me = await join();
    ai.aiPronounce.mockResolvedValue(null);
    expect((await post("/api/ai/pronounce", { pid: me.id, phraseId: "camon", wav: voice() })).json.fallback).toBe(true);
  });
});

describe("AI: snap, guide", () => {
  it("snap validates image size and rewards found objects", async () => {
    const me = await join();
    expect((await post("/api/ai/snap", { pid: me.id, image: "tiny" })).status).toBe(400);
    ai.aiSnap.mockResolvedValue({ found: true, en: "cup", vi: "cái cốc", say: "", example_vi: "", example_en: "", culture: "", emoji: "☕" });
    const r = await post("/api/ai/snap", { pid: me.id, image: "a".repeat(5000) });
    expect(r.json.vi).toBe("cái cốc");
    expect(store.get(me.id)!.stats).toMatchObject({ snaps: 1 });
    expect(store.get(me.id)!.stats.words).toContain("cái cốc");
    ai.aiSnap.mockResolvedValue({ found: false, en: "", vi: "", say: "", example_vi: "", example_en: "", culture: "", emoji: "" });
    await post("/api/ai/snap", { pid: me.id, image: "a".repeat(5000) });
    expect(store.get(me.id)!.stats.snaps).toBe(1);
  });
  it("guide needs a user question last and keeps 8 messages of history", async () => {
    const me = await join();
    expect((await post("/api/ai/guide", { pid: me.id, history: [] })).status).toBe(400);
    expect((await post("/api/ai/guide", { pid: me.id, history: [{ role: "guide", text: "hi" }] })).status).toBe(400);
    ai.aiGuide.mockResolvedValue({ answer: "a", try_vi: "phở", try_en: "noodle soup", try_say: "fuh", followups: [] });
    const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? "guide" : "user", text: `m${i}` })).concat([{ role: "user", text: "Why phở?" }]);
    const r = await post("/api/ai/guide", { pid: me.id, history });
    expect(r.json.answer).toBe("a");
    expect(ai.aiGuide.mock.calls[0][0]).toHaveLength(8);
    expect(store.get(me.id)!.stats.questions).toBe(1);
    expect(store.e.feed[0].text).toContain("Why phở?");
  });
});

describe("market role-play", () => {
  const item = MARKET_ITEMS[0];
  it("start opens a session at the asking price", async () => {
    const me = await join();
    const r = await post("/api/market/start", { pid: me.id, itemId: item.id });
    expect(r.json).toMatchObject({ price: item.start, deal: false });
    expect(r.json.suggestions).toHaveLength(3);
  });
  it("saying something without a session is rejected", async () => {
    const me = await join();
    expect((await post("/api/market/say", { pid: me.id, text: "hi" })).status).toBe(400);
  });
  it("the AI can never push the price below the floor or back up", async () => {
    const me = await join();
    await post("/api/market/start", { pid: me.id, itemId: item.id });
    ai.aiMarket.mockResolvedValue({ vendor_vi: "Ôi!", vendor_en: "Oh!", price: 1, deal: false, suggestions: [] });
    expect((await post("/api/market/say", { pid: me.id, text: "Đắt quá!" })).json.price).toBe(item.floor);
    ai.aiMarket.mockResolvedValue({ vendor_vi: "Ôi!", vendor_en: "Oh!", price: 9999, deal: false, suggestions: [] });
    expect((await post("/api/market/say", { pid: me.id, text: "hmm" })).json.price).toBe(item.floor);
  });
  it("a deal ends the session and records the discount", async () => {
    const me = await join();
    await post("/api/market/start", { pid: me.id, itemId: item.id });
    ai.aiMarket.mockResolvedValue({ vendor_vi: "Được!", vendor_en: "OK!", price: 125, deal: true, suggestions: [] });
    const r = await post("/api/market/say", { pid: me.id, text: "125 nghìn nhé" });
    expect(r.json).toMatchObject({ deal: true, price: 125, discount: 50, start: item.start });
    expect(store.get(me.id)!.stats).toMatchObject({ bestDiscount: 50 });
    expect(store.get(me.id)!.stats.stamps).toContain("market");
    expect((await post("/api/market/say", { pid: me.id, text: "more" })).status).toBe(400);
  });
  it("the vendor wraps up by turn 9", async () => {
    const me = await join();
    await post("/api/market/start", { pid: me.id, itemId: item.id });
    ai.aiMarket.mockResolvedValue({ vendor_vi: "Không!", vendor_en: "No!", price: item.start, deal: false, suggestions: [] });
    let last;
    for (let i = 0; i < 9; i++) last = await post("/api/market/say", { pid: me.id, text: `try ${i}` });
    expect(last!.json.deal).toBe(true);
  });
  it("an AI failure does not burn a turn", async () => {
    const me = await join();
    await post("/api/market/start", { pid: me.id, itemId: item.id });
    ai.aiMarket.mockResolvedValue(null);
    expect((await post("/api/market/say", { pid: me.id, text: "hi" })).json.fallback).toBe(true);
    ai.aiMarket.mockResolvedValue({ vendor_vi: "Ừ", vendor_en: "Yes", price: 200, deal: false, suggestions: [] });
    await post("/api/market/say", { pid: me.id, text: "hi" });
    expect(ai.aiMarket.mock.calls.at(-1)![3]).toBe(1); // still turn 1
  });
});

describe("lantern wishes", () => {
  it("publishes exactly the previewed translation, once", async () => {
    const me = await join();
    expect((await post("/api/wish", { pid: me.id })).status).toBe(400); // no preview
    ai.aiWish.mockResolvedValue({ safe: true, vi: "Chúc mọi người vui vẻ", back_en: "Wishing everyone joy" });
    const pre = await post("/api/ai/wish", { pid: me.id, en: "Happy days for all" });
    expect(pre.json).toMatchObject({ safe: true, vi: "Chúc mọi người vui vẻ" });
    expect((await post("/api/wish", { pid: me.id, vi: "something else" })).json.ok).toBe(true);
    expect(store.e.wishes[0]).toMatchObject({ en: "Happy days for all", vi: "Chúc mọi người vui vẻ", pid: me.id });
    expect((await post("/api/wish", { pid: me.id })).status).toBe(400);
  });
  it("blocks rude wishes before and after the AI", async () => {
    const me = await join();
    expect((await post("/api/ai/wish", { pid: me.id, en: "you are a dick" })).json.safe).toBe(false);
    expect(ai.aiWish).not.toHaveBeenCalled();
    ai.aiWish.mockResolvedValue({ safe: false, vi: "x", back_en: "x" });
    expect((await post("/api/ai/wish", { pid: me.id, en: "something mean" })).json.safe).toBe(false);
    expect((await post("/api/wish", { pid: me.id })).status).toBe(400);
  });
  it("rejects empty wishes", async () => {
    const me = await join();
    expect((await post("/api/ai/wish", { pid: me.id, en: " " })).status).toBe(400);
  });
});

describe("buddy voices", () => {
  it("records a voice, serves it back, and replaces an earlier take", async () => {
    const me = await join({ role: "local" });
    const a = await post("/api/voice", { pid: me.id, phraseId: "xinchao", wav: voice() });
    expect(a.json.ok).toBe(true);
    const audio = await fetch(`${base}/api/voice/${a.json.id}`);
    expect(audio.headers.get("content-type")).toBe("audio/wav");
    const b = await post("/api/voice", { pid: me.id, phraseId: "xinchao", wav: voice() });
    expect(store.voices.size).toBe(1);
    expect(store.voices.has(b.json.id)).toBe(true);
    expect((await fetch(`${base}/api/voice/${a.json.id}`)).status).toBe(404);
    expect((await call("GET", `/api/state?pid=${me.id}`)).json.voices).toHaveLength(1);
  });
  it("refuses silent recordings", async () => {
    const me = await join({ role: "local" });
    const r = await post("/api/voice", { pid: me.id, phraseId: "xinchao", wav: silence() });
    expect(r.status).toBe(422);
    expect(r.json.message).toMatch(/couldn't hear/);
  });
});

describe("text to speech", () => {
  it("serves MP3, 400 on empty text, 503 when TTS is down", async () => {
    tts.ttsVi.mockResolvedValueOnce(Buffer.from("mp3"));
    const ok = await fetch(`${base}/api/tts?t=${encodeURIComponent("Xin chào")}`);
    expect(ok.headers.get("content-type")).toBe("audio/mpeg");
    expect((await fetch(`${base}/api/tts?t=`)).status).toBe(400);
    tts.ttsVi.mockResolvedValueOnce(null);
    expect((await fetch(`${base}/api/tts?t=hi`)).status).toBe(503);
  });
});

describe("rate limiting", () => {
  it("allows a burst of 30 AI calls per person, then asks them to slow down", async () => {
    const me = await join();
    ai.aiWish.mockResolvedValue(null);
    const codes: number[] = [];
    for (let i = 0; i < 31; i++) codes.push((await post("/api/ai/wish", { pid: me.id, en: "hello there" })).status);
    expect(codes.slice(0, 30).every((c) => c === 200)).toBe(true);
    expect(codes[30]).toBe(429);
    const other = await join();
    expect((await post("/api/ai/wish", { pid: other.id, en: "hello there" })).status).toBe(200);
  });
});

describe("PWA manifest", () => {
  it("is installable: standalone, with any + maskable icons", async () => {
    const r = await call("GET", "/api/manifest.webmanifest");
    expect(r.headers.get("content-type")).toContain("application/manifest+json");
    expect(r.json).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone", short_name: "Chào VN" });
    expect(r.json.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(r.json.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  });
  it("carries a valid profile into start_url and drops tampered ones", async () => {
    const r = Buffer.from(JSON.stringify({ id: "abc-123", name: "<Lan>", avatar: "🐼", role: "local" })).toString("base64url");
    const m = await call("GET", `/api/manifest.webmanifest?r=${r}`);
    const start = new URL(m.json.start_url, "https://x").searchParams.get("r")!;
    expect(JSON.parse(Buffer.from(start, "base64url").toString())).toEqual({ id: "abc-123", name: "Lan", avatar: "🐼", role: "local" });
    const bad = Buffer.from(JSON.stringify({ id: "../../etc" })).toString("base64url");
    expect((await call("GET", `/api/manifest.webmanifest?r=${bad}`)).json.start_url).toBe("/");
    expect((await call("GET", "/api/manifest.webmanifest?r=%3Cscript%3E")).json.start_url).toBe("/");
  });
  it("server decodes exactly what the phone encodes (Vietnamese + emoji)", () => {
    const p = { id: "3f2a-9c1b-77", name: "Ngọc Ánh 🐉", avatar: "🐉", role: "local" as const };
    expect(decodeRestore(encodeRestore(p))).toEqual(p);
  });
});
