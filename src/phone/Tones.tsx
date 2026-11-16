import { useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { LOCAL_TONE_HINT, TONE_BASES, TONES, withTone, type ToneId } from "../../shared/content";
import { post } from "../lib/api";
import { playVi } from "../lib/speech";
import { sfx } from "../lib/sound";
import { ToneCurve, TopBar } from "../ui";
import { useApp } from "./PhoneApp";

const ROUNDS = 10;

export function Tones() {
  const { go } = useApp();
  const [tab, setTab] = useState<"learn" | "game">("learn");
  return (
    <>
      <TopBar title="The Six Tones" sub="Same sound, six meanings" onBack={() => go("home")} />
      <div className="screen stack">
        <div className="row" style={{ background: "#F3E5CE", padding: 4, borderRadius: 16 }}>
          {(["learn", "game"] as const).map((t) => (
            <button key={t} onClick={() => { sfx.tap(); setTab(t); }} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 800, background: tab === t ? "#fff" : "transparent", boxShadow: tab === t ? "var(--shadow)" : "none" }}>
              {t === "learn" ? "👂 Explore" : "🎯 Tone Ear Game"}
            </button>
          ))}
        </div>
        {tab === "learn" ? <Learn onPlay={() => setTab("game")} /> : <Game />}
      </div>
    </>
  );
}

function Learn({ onPlay }: { onPlay: () => void }) {
  const [playing, setPlaying] = useState<number | null>(null);
  const [base, setBase] = useState("ma");
  const play = async (t: ToneId) => { setPlaying(t); try { await playVi(withTone(base, t)); } finally { setPlaying(null); } };
  const playAll = async () => { for (const t of TONES) { setPlaying(t.id); await playVi(withTone(base, t.id)).catch(() => undefined); await new Promise((r) => setTimeout(r, 250)); } setPlaying(null); };
  return (
    <>
      <div className="card" style={{ background: "linear-gradient(135deg,#2B1D4F,#1C1842)", color: "#fff" }}>
        <b style={{ fontSize: 18 }}>Vietnamese is musical 🎶</b>
        <div style={{ opacity: 0.85, fontSize: 14.5, marginTop: 4 }}>Each syllable has a pitch “shape”. Change the shape, change the meaning. Tap each card and copy it with your hand drawing the curve in the air!</div>
      </div>
      <div className="row" style={{ justifyContent: "center" }}>
        {TONE_BASES.map((b) => (
          <button key={b} className="chip" onClick={() => { sfx.tap(); setBase(b); }} style={{ padding: "8px 16px", fontSize: 16, background: base === b ? "var(--ink)" : "#fff", color: base === b ? "#fff" : "inherit", boxShadow: "var(--shadow)" }}>{b}</button>
        ))}
      </div>
      <div className="tone-grid">
        {TONES.map((t) => (
          <button key={t.id} className={`tone-card${playing === t.id ? " playing" : ""}`} style={{ ["--c" as string]: t.color }} onClick={() => play(t.id)}>
            <div className="syl">{withTone(base, t.id)}</div>
            <ToneCurve tone={t.id} animate={playing === t.id} key={`${t.id}-${playing === t.id}`} />
            <div className="nm">{t.name} · {t.english}</div>
            {base === "ma" && <div className="mean">{t.maMeaning}</div>}
          </button>
        ))}
      </div>
      {playing !== null && <div className="card center" style={{ padding: 12, fontWeight: 700, color: TONES[playing].color }}>✋ {TONES[playing].gesture}</div>}
      <div className="row">
        <button className="btn ghost" onClick={playAll}>▶ Play all six</button>
      </div>
      <div className="small muted center">{LOCAL_TONE_HINT}</div>
      <button className="btn jade" onClick={onPlay}>🎯 I'm ready: Tone Ear Game</button>
    </>
  );
}

function Game() {
  const { toast } = useApp();
  const make = () => {
    const tone = Math.floor(Math.random() * 6) as ToneId;
    const base = TONE_BASES[Math.floor(Math.random() * TONE_BASES.length)];
    const others = TONES.map((t) => t.id).filter((x) => x !== tone).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [tone, ...others].sort(() => Math.random() - 0.5) as ToneId[];
    return { tone, base, options };
  };
  const [round, setRound] = useState(0);
  const [q, setQ] = useState(make);
  const [picked, setPicked] = useState<ToneId | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [streak, setStreak] = useState(0);
  const [heard, setHeard] = useState(false);
  const done = round >= ROUNDS;
  const score = useMemo(() => results.filter(Boolean).length, [results]);

  const listen = async () => { sfx.tap(); setHeard(true); await playVi(withTone(q.base, q.tone)).catch(() => undefined); };
  const answer = (t: ToneId) => {
    if (picked !== null) return;
    if (!heard) { toast("Tap ▶ to listen first 👂"); return; }
    setPicked(t);
    const ok = t === q.tone;
    const s = ok ? streak + 1 : 0;
    setStreak(s);
    setResults((r) => [...r, ok]);
    if (ok) sfx.correct(s); else sfx.wrong();
    void post("/api/tone", { correct: ok, streak: s }).catch(() => undefined);
    setTimeout(() => {
      const nr = round + 1;
      setRound(nr); setPicked(null); setHeard(false);
      if (nr >= ROUNDS) {
        const final = results.filter(Boolean).length + (ok ? 1 : 0);
        void post("/api/tone/done", { score: final }).catch(() => undefined);
        sfx.fanfare();
        if (final >= 6) confetti({ particleCount: 160, spread: 90, origin: { y: 0.5 } });
      } else setQ(make());
    }, ok ? 900 : 1700);
  };

  if (done) {
    return (
      <div className="word-card stack" style={{ gap: 10 }}>
        <div style={{ fontSize: 64 }}>{score >= 8 ? "🏆" : score >= 5 ? "🎉" : "💪"}</div>
        <div className="h1">{score}/{ROUNDS}</div>
        <div className="muted">{score >= 8 ? "Tone master! Vietnamese ears unlocked." : score >= 5 ? "Great ears! Native speakers train for years." : "Tones are tricky for everyone at first. Try again!"}</div>
        <button className="btn" onClick={() => { setRound(0); setResults([]); setStreak(0); setQ(make()); }}>↻ Play again</button>
      </div>
    );
  }

  return (
    <>
      <div className="dots">{Array.from({ length: ROUNDS }, (_, i) => <i key={i} className={i < results.length ? (results[i] ? "ok" : "no") : i === round ? "cur" : ""} />)}</div>
      <div className="card center stack" style={{ gap: 10 }}>
        <div className="label">Round {round + 1} · {streak >= 2 ? `🔥 streak ${streak}` : "listen carefully"}</div>
        <button className="big-play" onClick={listen} aria-label="Play">▶</button>
        <div className="muted small">Which tone did you hear?</div>
      </div>
      <div className="choices">
        {q.options.map((t) => {
          const cls = picked === null ? "" : t === q.tone ? "right" : t === picked ? "wrong" : "";
          return (
            <button key={t} className={`choice ${cls}`} onClick={() => answer(t)} style={{ color: picked === null ? TONES[t].color : undefined }}>
              {withTone(q.base, t)}
              <small>{TONES[t].name} · {TONES[t].english}</small>
            </button>
          );
        })}
      </div>
    </>
  );
}
