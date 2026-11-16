// The single source of truth for the live event: in-memory, broadcast over SSE,
// snapshotted to Firestore for crash recovery.
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { QUIZ, TEAMS, type ActivityId, type TeamId, teamById } from "../shared/content";
import type { FeedItem, HostState, Participant, Phase, Profile, PublicState, PStats, TeamScore, Totals, VoiceMeta, Wish } from "../shared/types";
import { persistence } from "./persist";

export interface QuizAnswer { choice: number; ms: number; correct?: boolean; points?: number }
export interface EventData {
  eventId: string; createdAt: number; phase: Phase; lanterns: number;
  participants: Record<string, Participant>;
  feed: FeedItem[]; words: Record<string, { w: string; n: number; en?: string }>; wishes: Wish[];
  quiz: { index: number; status: "idle" | "open" | "reveal"; openedAt: number; durationMs: number; answers: Record<string, QuizAnswer> };
  spotlight: { activity: ActivityId; at: number } | null;
  counters: { phrasesSpoken: number; pronSum: number; aiChats: number; aiCalls: number; quizAnswers: number };
  recentJoins: { name: string; avatar: string; team: TeamId; at: number }[];
}
export interface Voice { meta: VoiceMeta; data: Buffer; mime: string }

const emptyStats = (): PStats => ({ toneCorrect: 0, toneTotal: 0, toneBestStreak: 0, phrases: {}, snaps: 0, questions: 0, wishes: 0, voices: 0, quizCorrect: 0, quizAnswered: 0, bestDiscount: 0, stamps: [], words: [] });

export function freshEvent(): EventData {
  return {
    eventId: randomUUID().slice(0, 8), createdAt: Date.now(), phase: "lobby", lanterns: 0, participants: {}, feed: [], words: {}, wishes: [],
    quiz: { index: 0, status: "idle", openedAt: 0, durationMs: 0, answers: {} }, spotlight: null,
    counters: { phrasesSpoken: 0, pronSum: 0, aiChats: 0, aiCalls: 0, quizAnswers: 0 }, recentJoins: [],
  };
}

interface Client { res: Response; pid?: string; host: boolean }

export class Store {
  e: EventData = freshEvent();
  voices = new Map<string, Voice>();
  private clients = new Set<Client>();
  private version = 1;
  private sentVersion = 0;
  private savedVersion = 1;

  // ------------------------------------------------------------ helpers
  touch() { this.version++; }
  get(pid: string | undefined): Participant | undefined { return pid ? this.e.participants[pid] : undefined; }
  list(): Participant[] { return Object.values(this.e.participants); }
  goal(): number { return Math.max(300, Math.ceil((this.list().length * 15) / 50) * 50); }

  pickTeam(role: Profile["role"]): TeamId {
    const ps = this.list();
    const score = (t: TeamId) => [ps.filter((p) => p.team === t && p.role === role).length, ps.filter((p) => p.team === t).length];
    const sorted = [...TEAMS].map((t) => ({ t: t.id, s: score(t.id), r: Math.random() }))
      .sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1] || a.r - b.r);
    return sorted[0].t;
  }

  join(profile: Profile): Participant {
    const existing = this.e.participants[profile.id];
    if (existing) {
      existing.name = profile.name || existing.name; existing.avatar = profile.avatar || existing.avatar;
      existing.lastSeen = Date.now(); this.touch(); return existing;
    }
    const p: Participant = { ...profile, team: this.pickTeam(profile.role), points: 0, joinedAt: Date.now(), lastSeen: Date.now(), stats: emptyStats() };
    this.e.participants[p.id] = p;
    this.e.recentJoins.unshift({ name: p.name, avatar: p.avatar, team: p.team, at: Date.now() });
    this.e.recentJoins = this.e.recentJoins.slice(0, 24);
    this.award(p, 10, 1, `joined ${teamById(p.team).name}`, "👋");
    return p;
  }

  award(p: Participant, points: number, lanterns: number, text?: string, emoji = "✨") {
    p.points += Math.round(points);
    this.e.lanterns += lanterns;
    p.lastSeen = Date.now();
    if (text) this.feed(p, text, emoji);
    this.touch();
  }

  feed(p: Participant, text: string, emoji: string) {
    if (p.hidden) return;
    this.e.feed.unshift({ id: randomUUID().slice(0, 8), at: Date.now(), avatar: p.avatar, name: p.vnName ? `${p.name} (${p.vnName})` : p.name, team: p.team, text, emoji });
    this.e.feed = this.e.feed.slice(0, 40);
  }

  stamp(p: Participant, a: ActivityId) {
    if (!p.stats.stamps.includes(a)) p.stats.stamps.push(a);
  }

  word(p: Participant | undefined, w: string, en?: string) {
    const clean = w.trim().replace(/[.!?]+$/, "");
    if (!clean || clean.length > 40) return;
    const k = clean.toLowerCase().normalize("NFC");
    const cur = this.e.words[k] ?? { w: clean, n: 0, en };
    cur.n++; if (en && !cur.en) cur.en = en;
    this.e.words[k] = cur;
    if (p && !p.stats.words.includes(clean)) p.stats.words = [...p.stats.words, clean].slice(-40);
  }

  // ------------------------------------------------------------ quiz
  quizOpen(index: number) {
    const q = QUIZ[index]; if (!q) return;
    this.e.quiz = { index, status: "open", openedAt: Date.now(), durationMs: q.seconds * 1000, answers: {} };
    this.e.phase = "quiz"; this.touch();
  }
  eligible(): Participant[] { const now = Date.now(); return this.list().filter((p) => !p.hidden && now - p.lastSeen < 5 * 60_000); }

  quizAnswer(p: Participant, index: number, choice: number): boolean {
    const qz = this.e.quiz;
    if (qz.status !== "open" || qz.index !== index || qz.answers[p.id]) return false;
    const q = QUIZ[index]; if (choice < 0 || choice >= q.options.length) return false;
    qz.answers[p.id] = { choice, ms: Math.min(Date.now() - qz.openedAt, qz.durationMs) };
    p.lastSeen = Date.now(); this.e.counters.quizAnswers++;
    this.touch();
    return true;
  }

  quizReveal() {
    const qz = this.e.quiz; if (qz.status !== "open") return;
    const q = QUIZ[qz.index];
    qz.status = "reveal";
    for (const [pid, a] of Object.entries(qz.answers)) {
      const p = this.e.participants[pid]; if (!p) continue;
      p.stats.quizAnswered++;
      if (q.kind === "poll") { a.points = 10; this.award(p, 10, 0); continue; }
      a.correct = a.choice === q.answer;
      if (a.correct) {
        a.points = Math.round(50 + 50 * (1 - a.ms / qz.durationMs));
        p.stats.quizCorrect++;
        this.award(p, a.points, 1);
      } else a.points = 0;
    }
    if (q.kind !== "poll") {
      const right = Object.entries(qz.answers).filter(([, a]) => a.correct).sort((x, y) => x[1].ms - y[1].ms)[0];
      const p = right && this.e.participants[right[0]];
      if (p) this.feed(p, `was fastest on the quiz (${(right[1].ms / 1000).toFixed(1)}s)`, "⚡");
    }
    this.touch();
  }

  tick() {
    const qz = this.e.quiz;
    if (qz.status === "open") {
      const answered = Object.keys(qz.answers).length;
      const elig = this.eligible().length;
      if (Date.now() - qz.openedAt > qz.durationMs + 400 || (elig > 0 && answered >= elig)) this.quizReveal();
    }
    if (this.version !== this.sentVersion) { this.sentVersion = this.version; this.broadcast(); }
  }

  // ------------------------------------------------------------ views
  totals(): Totals {
    const ps = this.list().filter((p) => !p.hidden);
    const toneT = ps.reduce((s, p) => s + p.stats.toneTotal, 0), toneC = ps.reduce((s, p) => s + p.stats.toneCorrect, 0);
    const c = this.e.counters;
    return {
      participants: ps.length, visitors: ps.filter((p) => p.role === "visitor").length, locals: ps.filter((p) => p.role === "local").length,
      phrasesSpoken: c.phrasesSpoken, avgPronunciation: c.phrasesSpoken ? Math.round(c.pronSum / c.phrasesSpoken) : 0,
      toneAccuracy: toneT ? Math.round((100 * toneC) / toneT) : 0, toneAnswers: toneT,
      snaps: ps.reduce((s, p) => s + p.stats.snaps, 0), aiChats: c.aiChats, wishes: this.e.wishes.filter((w) => !w.hidden).length,
      voices: this.voices.size, quizAnswers: c.quizAnswers, aiCalls: c.aiCalls,
    };
  }
  teams(): TeamScore[] {
    return TEAMS.map((t) => {
      const m = this.list().filter((p) => p.team === t.id && !p.hidden);
      return { id: t.id, points: m.reduce((s, p) => s + p.points, 0), members: m.length, bestDiscount: Math.max(0, ...m.map((p) => p.stats.bestDiscount)) };
    });
  }
  voiceList(): VoiceMeta[] { return [...this.voices.values()].map((v) => v.meta).filter((m) => !this.e.participants[m.pid]?.hidden); }

  publicState(): PublicState {
    const qz = this.e.quiz, q = QUIZ[qz.index];
    const counts = qz.status === "reveal" ? q.options.map((_, i) => Object.values(qz.answers).filter((a) => a.choice === i).length) : undefined;
    const fastest = qz.status === "reveal" && q.kind !== "poll"
      ? Object.entries(qz.answers).filter(([, a]) => a.correct).sort((a, b) => a[1].ms - b[1].ms).slice(0, 3)
        .map(([pid, a]) => { const p = this.e.participants[pid]; return { name: p?.vnName || p?.name || "?", avatar: p?.avatar || "🙂", team: p?.team || "pho", ms: a.ms }; })
      : undefined;
    return {
      serverTime: Date.now(), eventId: this.e.eventId, phase: this.e.phase, lanterns: this.e.lanterns, goal: this.goal(),
      quiz: { index: qz.index, status: qz.status, durationMs: qz.durationMs, remainingMs: qz.status === "open" ? Math.max(0, qz.openedAt + qz.durationMs - Date.now()) : 0,
        answeredCount: Object.keys(qz.answers).length, eligibleCount: this.eligible().length, counts, fastest },
      spotlight: this.e.spotlight, teams: this.teams(), totals: this.totals(), voices: this.voiceList(),
    };
  }

  personal(base: PublicState, pid?: string): PublicState {
    const me = this.get(pid) ?? null;
    if (!me) return { ...base, me: null };
    const sorted = this.list().filter((p) => !p.hidden).sort((a, b) => b.points - a.points);
    const a = this.e.quiz.answers[me.id];
    return { ...base, me, myRank: sorted.findIndex((p) => p.id === me.id) + 1,
      myQuiz: a ? { answered: true, choice: a.choice, correct: a.correct, points: a.points } : { answered: false } };
  }

  awards(): HostState["awards"] {
    const ps = this.list().filter((p) => !p.hidden);
    const out: HostState["awards"] = [];
    const top = (title: string, emoji: string, val: (p: Participant) => number, detail: (p: Participant) => string, pool = ps) => {
      const best = [...pool].sort((a, b) => val(b) - val(a))[0];
      if (best && val(best) > 0) out.push({ title, emoji, name: best.vnName ? `${best.name} · ${best.vnName}` : best.name, avatar: best.avatar, detail: detail(best) });
    };
    const avgPhrase = (p: Participant) => { const v = Object.values(p.stats.phrases); return v.length >= 2 ? v.reduce((s, x) => s + x, 0) / v.length : 0; };
    top("MVP", "⭐", (p) => p.points, (p) => `${p.points} points`);
    top("Golden Voice", "🎤", avgPhrase, (p) => `avg ${Math.round(avgPhrase(p))}% on ${Object.keys(p.stats.phrases).length} phrases`);
    top("Tone Master", "🎵", (p) => p.stats.toneCorrect * 100 + p.stats.toneBestStreak, (p) => `${p.stats.toneCorrect} tones caught, best streak ${p.stats.toneBestStreak}`);
    top("Quiz Champion", "🧠", (p) => p.stats.quizCorrect, (p) => `${p.stats.quizCorrect} correct answers`);
    top("Explorer", "📸", (p) => p.stats.snaps, (p) => `${p.stats.snaps} things snapped`);
    top("Master Bargainer", "🛍️", (p) => p.stats.bestDiscount, (p) => `${p.stats.bestDiscount}% off at Bến Thành`);
    top("Most Curious", "🏮", (p) => p.stats.questions, (p) => `${p.stats.questions} questions for Cô Lan`);
    top("Best Buddy", "🤝", (p) => p.stats.voices * 100 + p.points, (p) => `${p.stats.voices} voice recordings`, ps.filter((p) => p.role === "local"));
    return out;
  }

  hostState(base: PublicState): HostState {
    return {
      ...base,
      participants: this.list().sort((a, b) => b.points - a.points),
      feed: this.e.feed, wishes: this.e.wishes,
      words: Object.values(this.e.words).sort((a, b) => b.n - a.n).slice(0, 60),
      recentJoins: this.e.recentJoins, awards: this.awards(),
    };
  }

  // ------------------------------------------------------------ SSE
  addClient(res: Response, pid: string | undefined, host: boolean) {
    const c: Client = { res, pid, host };
    this.clients.add(c);
    const base = this.publicState();
    this.send(c, base);
    res.on("close", () => this.clients.delete(c));
  }
  private send(c: Client, base: PublicState) {
    const payload = c.host ? this.hostState(base) : this.personal(base, c.pid);
    c.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
  broadcast() {
    const base = this.publicState();
    for (const c of this.clients) { try { this.send(c, base); } catch { this.clients.delete(c); } }
  }
  heartbeat() { for (const c of this.clients) { try { c.res.write(`: ping\n\n`); } catch { this.clients.delete(c); } } }
  clientCount() { return this.clients.size; }

  // ------------------------------------------------------------ persistence
  async load() {
    const saved = await persistence.loadEvent();
    if (saved) { this.e = { ...freshEvent(), ...saved }; console.log(`[culture] restored event ${this.e.eventId} with ${this.list().length} participants`); }
    for (const v of await persistence.loadVoices()) this.voices.set(v.meta.id, v);
  }
  async saveIfDirty() {
    if (this.savedVersion === this.version) return;
    const v = this.version;
    if (await persistence.saveEvent(this.e)) this.savedVersion = v;
  }
  reset(clearVoices: boolean) {
    this.e = freshEvent();
    if (clearVoices) { this.voices.clear(); void persistence.clearVoices(); }
    this.touch();
  }
}

export const store = new Store();
