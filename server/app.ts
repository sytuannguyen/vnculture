// Express app: every HTTP route. Booting (listen, timers, signals) lives in index.ts
// so tests can drive the API without a server process.
import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIVITIES, AVATARS, FALLBACK_NAMES, MARKET_GREETING, MARKET_ITEMS, PHRASES, QUIZ, type ActivityId } from "../shared/content";
import type { Phase, Role } from "../shared/types";
import { coachTip, scorePronunciation } from "../shared/vn";
import { detectSpeech, parseWav } from "../shared/vad";
import { aiGuide, aiMarket, aiName, aiPronounce, aiSnap, aiStats, aiWish } from "./ai";
import { persistence } from "./persist";
import { store } from "./state";
import { ttsVi } from "./tts";

const HOST_PIN = process.env.HOST_PIN || "2468";
export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: "3mb" }));

// ------------------------------------------------------------------ helpers
const BAD = /\b(fuck|shit|cunt|bitch|dick|nigg|fag|slut|whore|đụ|địt|lồn|cặc)\w*/i;
const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

const buckets = new Map<string, { tokens: number; at: number }>();
function allow(pid: string, cost = 1): boolean {
  const now = Date.now();
  const b = buckets.get(pid) ?? { tokens: 30, at: now };
  b.tokens = Math.min(30, b.tokens + ((now - b.at) / 300_000) * 30); // 30 per 5 min
  b.at = now;
  if (b.tokens < cost) { buckets.set(pid, b); return false; }
  b.tokens -= cost; buckets.set(pid, b);
  return true;
}

type H = (req: Request, res: Response) => Promise<unknown> | unknown;
const wrap = (h: H) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(h(req, res)).catch((e) => { console.error("[culture] route error", req.path, e); if (!res.headersSent) res.status(500).json({ error: "server_error" }); void next; });
};

function me(req: Request, res: Response) {
  const p = store.get(String(req.body?.pid ?? req.query.pid ?? ""));
  if (!p) { res.status(409).json({ error: "rejoin" }); return null; }
  p.lastSeen = Date.now();
  return p;
}
function aiGate(req: Request, res: Response) {
  const p = me(req, res); if (!p) return null;
  if (!allow(p.id)) { res.status(429).json({ error: "slow_down", message: "Wow, you're fast! Take a breath and try again in a minute 😄" }); return null; }
  store.e.counters.aiCalls++;
  return p;
}

// ------------------------------------------------------------------ public API
app.get("/api/health", (_q, res) => res.json({ ok: true, participants: store.list().length, clients: store.clientCount(), ai: aiStats }));

app.post("/api/join", wrap((req, res) => {
  const b = req.body ?? {};
  const id = clean(b.id, 40) || randomUUID();
  let name = clean(b.name, 20) || "Friend";
  if (BAD.test(name)) name = "Friend";
  const avatar = AVATARS.includes(b.avatar) ? b.avatar : AVATARS[0];
  const role: Role = b.role === "local" ? "local" : "visitor";
  const p = store.join({ id, name, avatar, role });
  res.json({ me: p, eventId: store.e.eventId });
}));

app.get("/api/stream", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  res.write("retry: 2000\n\n");
  store.addClient(res, clean(req.query.pid, 40) || undefined, req.query.host === HOST_PIN);
});

app.get("/api/state", (req, res) => {
  const base = store.publicState();
  if (req.query.host === HOST_PIN) return res.json(store.hostState(base));
  res.json(store.personal(base, clean(req.query.pid, 40)));
});

app.post("/api/tone", wrap((req, res) => {
  const p = me(req, res); if (!p) return;
  const correct = !!req.body.correct, streak = Math.min(50, Number(req.body.streak) || 0);
  p.stats.toneTotal++;
  if (correct) {
    p.stats.toneCorrect++;
    p.stats.toneBestStreak = Math.max(p.stats.toneBestStreak, streak);
    store.award(p, 5 + Math.min(streak, 5) * 2, p.stats.toneCorrect % 2 === 0 ? 1 : 0);
    if (streak === 5 || streak === 10 || streak === 20) store.feed(p, `is on a ${streak}-tone streak!`, "🔥");
  } else store.touch();
  res.json({ ok: true, points: p.points });
}));

app.post("/api/tone/done", wrap((req, res) => {
  const p = me(req, res); if (!p) return;
  const score = Math.max(0, Math.min(10, Number(req.body.score) || 0));
  store.stamp(p, "tones");
  store.award(p, 10, 1, `caught ${score}/10 tones in the Tone Ear Game`, "🎵");
  res.json({ ok: true });
}));

app.post("/api/quiz/answer", wrap((req, res) => {
  const p = me(req, res); if (!p) return;
  res.json({ ok: store.quizAnswer(p, Number(req.body.index), Number(req.body.choice)) });
}));

app.post("/api/ai/name", wrap(async (req, res) => {
  const p = aiGate(req, res); if (!p) return;
  const about = clean(req.body.about, 80);
  const out = await aiName(p.name, BAD.test(about) ? "" : about);
  const fb = FALLBACK_NAMES[parseInt(createHash("md5").update(p.id + about).digest("hex").slice(0, 6), 16) % FALLBACK_NAMES.length];
  const result = out && out.vn_name && !BAD.test(out.vn_name)
    ? { vnName: clean(out.vn_name, 24), meaning: clean(out.meaning, 60), say: clean(out.say, 40), story: clean(out.story, 200), ai: true }
    : { vnName: fb.name, meaning: fb.meaning, say: fb.say, story: "A classic, beautiful Vietnamese name, chosen just for you.", ai: false };
  const first = !p.vnName;
  p.vnName = result.vnName; p.vnMeaning = result.meaning; p.vnSay = result.say;
  store.stamp(p, "name");
  store.word(p, result.vnName, result.meaning);
  store.award(p, first ? 20 : 2, first ? 1 : 0, `is now called ${result.vnName}: “${result.meaning}”`, "🏷️");
  res.json(result);
}));

app.post("/api/ai/pronounce", wrap(async (req, res) => {
  const p = aiGate(req, res); if (!p) return;
  const phrase = PHRASES.find((x) => x.id === req.body.phraseId);
  const wav = String(req.body.wav ?? "");
  if (!phrase || wav.length < 1000 || wav.length > 1_500_000) return res.status(400).json({ error: "bad_audio" });
  const pcm = parseWav(wav);
  if (!pcm) return res.status(400).json({ error: "bad_audio" });
  const vad = detectSpeech(pcm.pcm, pcm.sampleRate);
  console.info(JSON.stringify({ culture: "vad", phrase: phrase.id, ...vad, sec: +(pcm.pcm.length / pcm.sampleRate).toFixed(2) }));
  if (!vad.speech) {
    return res.json({ heard: "", score: 0, syllables: [], noSpeech: true,
      tip: vad.reason === "silence" ? "I couldn't hear you. Check your microphone isn't covered, then speak a little louder, close to the phone." : "I couldn't hear clear speech. Tap the mic, say the phrase, then tap again." });
  }
  const out = await aiPronounce(phrase.vi, wav);
  if (!out) return res.json({ fallback: true });
  const heard = clean(out.heard, 120);
  const { score, syllables } = heard ? scorePronunciation(phrase.vi, heard) : { score: 0, syllables: [] };
  const tip = heard ? coachTip(syllables) : "I couldn't hear clear speech. Tap the mic, say the phrase, then tap again.";
  if (heard) {
    const prev = p.stats.phrases[phrase.id] ?? 0;
    p.stats.phrases[phrase.id] = Math.max(prev, score);
    store.e.counters.phrasesSpoken++; store.e.counters.pronSum += score;
    store.stamp(p, "say");
    store.word(p, phrase.vi, phrase.en);
    store.award(p, score >= 50 ? 10 + score / 10 : 3, score >= 50 ? 1 : 0,
      score >= 70 ? `said “${phrase.vi}”: ${score}%` : undefined, score >= 90 ? "🌟" : "🎤");
  }
  res.json({ heard, score, syllables, tip });
}));

app.post("/api/ai/snap", wrap(async (req, res) => {
  const p = aiGate(req, res); if (!p) return;
  const img = String(req.body.image ?? "");
  if (img.length < 1000 || img.length > 2_000_000) return res.status(400).json({ error: "bad_image" });
  const out = await aiSnap(img);
  if (!out) return res.json({ fallback: true });
  if (out.found && out.vi) {
    p.stats.snaps++;
    store.stamp(p, "snap");
    store.word(p, clean(out.vi, 30), clean(out.en, 30));
    store.award(p, 15, 1, `snapped ${out.emoji || "📷"} ${clean(out.vi, 30)} (${clean(out.en, 30)})`, "📸");
  }
  res.json(out);
}));

app.post("/api/ai/guide", wrap(async (req, res) => {
  const p = aiGate(req, res); if (!p) return;
  const history = (Array.isArray(req.body.history) ? req.body.history : []).slice(-8)
    .map((m: { role: string; text: string }) => ({ role: m.role === "guide" ? "guide" as const : "user" as const, text: clean(m.text, 400) }));
  const q = history.at(-1);
  if (!q || q.role !== "user" || !q.text) return res.status(400).json({ error: "empty" });
  const out = await aiGuide(history);
  if (!out) return res.json({ fallback: true });
  p.stats.questions++; store.e.counters.aiChats++;
  store.stamp(p, "guide");
  if (out.try_vi) store.word(p, clean(out.try_vi, 30), clean(out.try_en, 30));
  store.award(p, 8, 1, BAD.test(q.text) ? undefined : `asked Cô Lan: “${q.text.slice(0, 60)}${q.text.length > 60 ? "…" : ""}”`, "🏮");
  res.json(out);
}));

// --- Market role-play (session state kept server-side so prices can't be faked)
interface MarketSession { itemId: string; price: number; turn: number; history: { role: "user" | "vendor"; text: string }[]; done: boolean }
const markets = new Map<string, MarketSession>();
app.post("/api/market/start", wrap((req, res) => {
  const p = me(req, res); if (!p) return;
  const item = MARKET_ITEMS.find((i) => i.id === req.body.itemId) ?? MARKET_ITEMS[0];
  const greet = MARKET_GREETING(item);
  markets.set(p.id, { itemId: item.id, price: item.start, turn: 0, history: [{ role: "vendor", text: greet }], done: false });
  res.json({ vendor_vi: greet, vendor_en: `Hello dear! Want a ${item.en}? So pretty! Only ${item.start} thousand!`, price: item.start, deal: false,
    suggestions: [{ vi: "Đắt quá! Bớt đi chị ơi!", en: "Too expensive! Lower it please!" }, { vi: `${Math.round(item.start * 0.4)} nghìn được không?`, en: `How about ${Math.round(item.start * 0.4)} thousand?` }, { vi: "Đẹp quá! Bao nhiêu tiền?", en: "So pretty! How much?" }] });
}));
app.post("/api/market/say", wrap(async (req, res) => {
  const p = aiGate(req, res); if (!p) return;
  const s = markets.get(p.id);
  const text = clean(req.body.text, 160);
  if (!s || s.done || !text) return res.status(400).json({ error: "no_session" });
  const item = MARKET_ITEMS.find((i) => i.id === s.itemId)!;
  s.turn++; s.history.push({ role: "user", text });
  const out = await aiMarket(item, s.price, s.history, s.turn);
  if (!out) {
    s.history.pop(); s.turn--;
    return res.json({ fallback: true });
  }
  let price = Math.round(Number(out.price) || s.price);
  price = Math.max(item.floor, Math.min(s.price, price));
  s.price = price;
  let deal = !!out.deal;
  if (s.turn >= 9 && !deal) deal = true; // vendor wraps up
  s.history.push({ role: "vendor", text: out.vendor_vi });
  store.e.counters.aiChats++;
  let discount = 0;
  if (deal) {
    s.done = true;
    discount = Math.round(((item.start - price) / item.start) * 100);
    p.stats.bestDiscount = Math.max(p.stats.bestDiscount, discount);
    store.stamp(p, "market");
    store.award(p, 10 + discount / 2, 1, `bought a ${item.en} for ${price}k (${discount}% off!)`, "🛍️");
  } else store.touch();
  res.json({ ...out, price, deal, discount, start: item.start });
}));

// --- Wish wall: preview (AI translation) then publish exactly the previewed text
const pendingWish = new Map<string, { en: string; vi: string; back: string }>();
app.post("/api/ai/wish", wrap(async (req, res) => {
  const p = aiGate(req, res); if (!p) return;
  const en = clean(req.body.en, 160);
  if (en.length < 2) return res.status(400).json({ error: "empty" });
  if (BAD.test(en)) return res.json({ safe: false });
  const out = await aiWish(en);
  if (!out) return res.json({ fallback: true });
  if (!out.safe || BAD.test(out.vi)) return res.json({ safe: false });
  pendingWish.set(p.id, { en, vi: clean(out.vi, 200), back: clean(out.back_en, 200) });
  res.json({ safe: true, vi: clean(out.vi, 200), back_en: clean(out.back_en, 200) });
}));
app.post("/api/wish", wrap((req, res) => {
  const p = me(req, res); if (!p) return;
  const w = pendingWish.get(p.id);
  if (!w) return res.status(400).json({ error: "no_preview" });
  pendingWish.delete(p.id);
  store.e.wishes.unshift({ id: randomUUID().slice(0, 8), at: Date.now(), pid: p.id, name: p.vnName || p.name, avatar: p.avatar, team: p.team, en: w.en, vi: w.vi });
  store.e.wishes = store.e.wishes.slice(0, 150);
  p.stats.wishes++;
  store.stamp(p, "wish");
  store.award(p, p.stats.wishes <= 3 ? 15 : 2, 1, `sent a lantern wish: “${w.vi.slice(0, 50)}”`, "💌");
  res.json({ ok: true });
}));

// --- Local buddy voices
app.post("/api/voice", wrap(async (req, res) => {
  const p = me(req, res); if (!p) return;
  const phrase = PHRASES.find((x) => x.id === req.body.phraseId);
  const wav = String(req.body.wav ?? "");
  if (!phrase || wav.length < 1000 || wav.length > 1_200_000) return res.status(400).json({ error: "bad_audio" });
  const pcmV = parseWav(wav);
  if (!pcmV || !detectSpeech(pcmV.pcm, pcmV.sampleRate).speech) return res.status(422).json({ error: "no_speech", message: "We couldn't hear your voice clearly. Try again, a little closer to the phone 🙏" });
  for (const [id, v] of store.voices) if (v.meta.pid === p.id && v.meta.phraseId === phrase.id) { store.voices.delete(id); void persistence.deleteVoice(id); }
  const v = { meta: { id: randomUUID().slice(0, 10), phraseId: phrase.id, pid: p.id, name: p.name, avatar: p.avatar }, mime: "audio/wav", data: Buffer.from(wav, "base64") };
  store.voices.set(v.meta.id, v);
  void persistence.saveVoice(v);
  const first = p.stats.voices < PHRASES.length;
  p.stats.voices++;
  store.stamp(p, "say");
  store.award(p, first ? 20 : 2, first ? 1 : 0, `lent their voice for “${phrase.vi}”`, "🎙️");
  res.json({ ok: true, id: v.meta.id });
}));
app.get("/api/voice/:id", (req, res) => {
  const v = store.voices.get(req.params.id);
  if (!v) return res.status(404).end();
  res.set({ "Content-Type": v.mime, "Cache-Control": "public, max-age=86400" }).send(v.data);
});

app.get("/api/tts", wrap(async (req, res) => {
  const t = clean(req.query.t, 300);
  if (!t) return res.status(400).end();
  const audio = await ttsVi(t);
  if (!audio) return res.status(503).end();
  res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" }).send(audio);
}));

// ------------------------------------------------------------------ host API
const host = express.Router();
host.use((req, res, next) => (req.get("x-host-pin") === HOST_PIN || req.query.pin === HOST_PIN ? next() : res.status(401).json({ error: "pin" })));
host.post("/check", (_q, res) => res.json({ ok: true }));
host.post("/phase", (req, res) => {
  const phase = req.body.phase as Phase;
  if (!["lobby", "dashboard", "quiz", "wall", "awards"].includes(phase)) return res.status(400).end();
  store.e.phase = phase;
  if (phase !== "quiz" && store.e.quiz.status === "open") store.quizReveal();
  store.touch(); res.json({ ok: true });
});
host.post("/quiz", (req, res) => {
  const a = req.body.action;
  const qz = store.e.quiz;
  if (a === "open") store.quizOpen(Math.max(0, Math.min(QUIZ.length - 1, Number(req.body.index ?? qz.index))));
  else if (a === "reveal") store.quizReveal();
  else if (a === "next") store.quizOpen(Math.min(QUIZ.length - 1, qz.index + (qz.status === "idle" ? 0 : 1)));
  else if (a === "select") { store.e.quiz = { ...qz, index: Math.max(0, Math.min(QUIZ.length - 1, Number(req.body.index))), status: "idle", answers: {} }; store.e.phase = "quiz"; store.touch(); }
  res.json({ ok: true });
});
host.post("/spotlight", (req, res) => {
  const act = req.body.activity as ActivityId | null;
  store.e.spotlight = act && ACTIVITIES.some((x) => x.id === act) ? { activity: act, at: Date.now() } : null;
  store.touch(); res.json({ ok: true });
});
host.post("/hide", (req, res) => {
  const { pid, wishId } = req.body;
  if (pid && store.e.participants[pid]) { const p = store.e.participants[pid]; p.hidden = !p.hidden; store.e.feed = store.e.feed.filter((f) => !(f.name.startsWith(p.name) && f.avatar === p.avatar)); }
  if (wishId) { const w = store.e.wishes.find((x) => x.id === wishId); if (w) w.hidden = !w.hidden; }
  store.touch(); res.json({ ok: true });
});
host.post("/reset", (req, res) => {
  store.reset(!!req.body.clearVoices);
  markets.clear(); pendingWish.clear();
  void store.saveIfDirty();
  res.json({ ok: true, eventId: store.e.eventId });
});
host.get("/export", (req, res) => {
  const ps = store.list();
  if (req.query.format === "csv") {
    const head = "name,vietnamese_name,role,team,points,tone_correct,tone_total,phrases_spoken,avg_phrase_score,snaps,questions,wishes,voices,quiz_correct,best_discount,stamps,words";
    const rows = ps.map((p) => {
      const ph = Object.values(p.stats.phrases);
      return [p.name, p.vnName ?? "", p.role, p.team, p.points, p.stats.toneCorrect, p.stats.toneTotal, ph.length, ph.length ? Math.round(ph.reduce((a, b) => a + b, 0) / ph.length) : "", p.stats.snaps, p.stats.questions, p.stats.wishes, p.stats.voices, p.stats.quizCorrect, p.stats.bestDiscount, p.stats.stamps.join(" "), p.stats.words.join(" | ")]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",");
    });
    res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="culture-${store.e.eventId}.csv"` }).send("﻿" + [head, ...rows].join("\n"));
  } else {
    res.set({ "Content-Disposition": `attachment; filename="culture-${store.e.eventId}.json"` }).json({ ...store.e, totals: store.totals(), teams: store.teams(), awards: store.awards() });
  }
});
app.use("/api/host", host);

// ------------------------------------------------------------------ PWA manifest
// Served dynamically: `?r=<profile>` is copied into start_url so the home-screen app can
// restore the participant (iOS gives installed web apps storage separate from Safari).
export function decodeRestore(r: unknown): { id: string; name: string; avatar: string; role: Role } | null {
  try {
    const raw = String(r ?? "");
    if (!raw || raw.length > 400 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
    const o = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const id = clean(o?.id, 40);
    if (!id || !/^[A-Za-z0-9-]+$/.test(id)) return null;
    return { id, name: clean(o.name, 20) || "Friend", avatar: AVATARS.includes(o.avatar) ? o.avatar : AVATARS[0], role: o.role === "local" ? "local" : "visitor" };
  } catch { return null; }
}
app.get("/api/manifest.webmanifest", (req, res) => {
  const p = decodeRestore(req.query.r);
  const start = p ? `/?r=${Buffer.from(JSON.stringify(p)).toString("base64url")}` : "/";
  res.set({ "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "no-cache" }).send(JSON.stringify({
    id: "/", name: "Chào Việt Nam! · AI Culture Lab", short_name: "Chào VN",
    description: "Learn Vietnamese language and culture with AI: a live workshop.",
    start_url: start, scope: "/", display: "standalone", orientation: "portrait",
    background_color: "#FFF7EA", theme_color: "#FFF7EA", lang: "en", categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  }));
});
app.use("/api", (_q, res) => res.status(404).json({ error: "not_found" }));

// ------------------------------------------------------------------ static SPA
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (existsSync(root)) {
  app.use("/assets", express.static(path.join(root, "assets"), { immutable: true, maxAge: "30d" }));
  app.use("/audio", express.static(path.join(root, "audio"), { maxAge: "7d" }));
  app.use(express.static(root, { maxAge: 0, index: false }));
  app.get("*", (_q, res) => res.set("Cache-Control", "no-cache").sendFile(path.join(root, "index.html")));
}

