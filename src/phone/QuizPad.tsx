import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { QUIZ } from "../../shared/content";
import { post } from "../lib/api";
import { playVi } from "../lib/speech";
import { sfx } from "../lib/sound";
import { useApp } from "./PhoneApp";

const SHAPES = ["▲", "◆", "●", "■"];

export function QuizPad() {
  const { state } = useApp();
  const qz = state!.quiz;
  const q = QUIZ[qz.index];
  const [mine, setMine] = useState<{ index: number; choice: number } | null>(null);
  const endAt = useRef(0);
  const [now, setNow] = useState(Date.now());
  const celebrated = useRef("");

  useEffect(() => { if (qz.status === "open") endAt.current = Date.now() + qz.remainingMs; }, [state?.serverTime, qz.status, qz.remainingMs]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  useEffect(() => { sfx.gong(); }, [qz.index]);

  const answered = state?.myQuiz?.answered || mine?.index === qz.index;
  const choice = state?.myQuiz?.choice ?? (mine?.index === qz.index ? mine.choice : undefined);

  useEffect(() => {
    const key = `${qz.index}-${qz.status}`;
    if (qz.status !== "reveal" || celebrated.current === key) return;
    celebrated.current = key;
    if (q.kind === "poll") sfx.correct();
    else if (state?.myQuiz?.correct) { sfx.success(); confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 } }); }
    else if (answered) sfx.wrong();
  }, [qz.status, qz.index]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i: number) => {
    if (answered || qz.status !== "open") return;
    sfx.tap();
    setMine({ index: qz.index, choice: i });
    void post("/api/quiz/answer", { index: qz.index, choice: i }).catch(() => undefined);
  };

  const remaining = Math.max(0, endAt.current - now);
  const pct = qz.durationMs ? (remaining / qz.durationMs) * 100 : 0;

  if (qz.status === "reveal") {
    const correct = state?.myQuiz?.correct;
    const total = (qz.counts ?? []).reduce((a, b) => a + b, 0) || 1;
    return (
      <div className="overlay" style={{ background: q.kind === "poll" ? "#2B1D4F" : correct ? "linear-gradient(160deg,#0E7A55,#1C1842)" : "linear-gradient(160deg,#8E0B22,#1C1842)" }}>
        <div className="result-big">{q.kind === "poll" ? "🗳️" : correct ? "🎉" : answered ? "😅" : "⏰"}</div>
        <div className="h1 center" style={{ color: "#fff" }}>
          {q.kind === "poll" ? "Thanks for voting!" : correct ? `+${state?.myQuiz?.points ?? 0} points!` : answered ? "Not this time!" : "Time's up!"}
        </div>
        {q.kind !== "poll" && <div className="center" style={{ marginTop: 8, opacity: 0.9 }}>Answer: <b>{q.options[q.answer]}</b></div>}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {q.options.map((o, i) => (
            <div key={i} style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,.1)", padding: "8px 12px", fontWeight: 700, border: i === q.answer ? "2px solid #7CF0B5" : i === choice ? "2px solid rgba(255,255,255,.5)" : "2px solid transparent" }}>
              <i className={`q${i}`} style={{ position: "absolute", inset: 0, width: `${((qz.counts?.[i] ?? 0) / total) * 100}%`, opacity: 0.55 }} />
              <span style={{ position: "relative" }}>{SHAPES[i]} {o} · {qz.counts?.[i] ?? 0}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ marginTop: 16, background: "rgba(255,255,255,.1)", color: "#fff", boxShadow: "none" }}>💡 {q.fact}</div>
        <div className="center small" style={{ marginTop: "auto", opacity: 0.7 }}>Look at the big screen 👀 · rank #{state?.myRank ?? "-"}</div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="chip" style={{ background: "rgba(255,255,255,.12)" }}>{q.emoji} Question {qz.index + 1}</span>
        <span style={{ fontWeight: 800, fontSize: 22 }}>{Math.ceil(remaining / 1000)}s</span>
      </div>
      <div className="timer-bar" style={{ marginTop: 10 }}><i style={{ width: `${pct}%` }} /></div>
      <div className="quiz-q">{q.q}</div>
      {q.audio && <button className="btn gold sm" style={{ alignSelf: "center", marginBottom: 12 }} onClick={() => playVi(q.audio!).catch(() => undefined)}>🔊 Play the sound</button>}
      {answered ? (
        <div className="center" style={{ margin: "auto 0" }}>
          <div className="result-big" style={{ fontSize: 70 }}>🔒</div>
          <div className="h2">Locked in!</div>
          <div style={{ opacity: 0.8, marginTop: 6 }}>{choice !== undefined && `${SHAPES[choice]} ${q.options[choice]}`}</div>
          <div style={{ opacity: 0.6, marginTop: 14 }}>{qz.answeredCount}/{qz.eligibleCount} answered</div>
        </div>
      ) : (
        <div className="quiz-opts">
          {q.options.map((o, i) => (
            <button key={i} className={`qopt q${i}`} onClick={() => pick(i)}><span className="shape">{SHAPES[i]}</span>{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}
