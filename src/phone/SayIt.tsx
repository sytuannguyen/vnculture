import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { PHRASES, TONES, type Phrase } from "../../shared/content";
import type { SylResult } from "../../shared/vn";
import { friendlyError, post } from "../lib/api";
import { Recorder, type Recording } from "../lib/recorder";
import { playUrl } from "../lib/speech";
import { sfx } from "../lib/sound";
import { ScoreRing, Speak, Thinking, TopBar, VnFlag } from "../ui";
import { useApp } from "./PhoneApp";

interface Result { heard: string; score: number; syllables: SylResult[]; tip: string; fallback?: boolean; noSpeech?: boolean }

export function SayIt() {
  const { go, me, state } = useApp();
  const [sel, setSel] = useState<Phrase | null>(null);
  const [mode, setMode] = useState<"practice" | "lend">(me?.role === "local" ? "lend" : "practice");
  if (sel) return <PhraseView key={sel.id + mode} phrase={sel} mode={mode} onBack={() => setSel(null)} onNext={() => {
    const i = PHRASES.findIndex((p) => p.id === sel.id); setSel(PHRASES[(i + 1) % PHRASES.length]);
  }} />;
  return (
    <>
      <TopBar title="Say it! AI Coach" sub="12 survival phrases" onBack={() => go("home")} />
      <div className="screen stack">
        {me?.role === "local" && (
          <div className="row" style={{ background: "#F3E5CE", padding: 4, borderRadius: 16 }}>
            {(["lend", "practice"] as const).map((t) => (
              <button key={t} onClick={() => { sfx.tap(); setMode(t); }} style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 800, background: mode === t ? "#fff" : "transparent", boxShadow: mode === t ? "var(--shadow)" : "none" }}>
                {t === "lend" ? <><VnFlag /> Lend your voice</> : "🎤 Test the AI"}
              </button>
            ))}
          </div>
        )}
        <div className="small muted">{mode === "lend" ? "Record each phrase naturally. Visitors will hear your voice next to the AI voice. 🙏" : "Tap a phrase → listen → record yourself → the AI tells you what it heard, syllable by syllable."}</div>
        <div className="phrase-list">
          {PHRASES.map((p) => {
            const best = me?.stats.phrases[p.id];
            const recorded = mode === "lend" && (state?.voices ?? []).some((v) => v.pid === me?.id && v.phraseId === p.id);
            return (
              <button key={p.id} className="phrase-item" onClick={() => { sfx.tap(); setSel(p); }}>
                <span className="em">{p.emoji}</span>
                <div style={{ minWidth: 0 }}><b className="vi">{p.vi}</b><small>{p.en}</small></div>
                {best !== undefined && mode === "practice" && <span className="best" style={{ background: best >= 80 ? "#DDF7E9" : best >= 50 ? "#FFF1D0" : "#FFE3E0" }}>{best}%</span>}
                {recorded && <span className="best" style={{ background: "#DDF7E9" }}>✓ shared</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function PhraseView({ phrase, mode, onBack, onNext }: { phrase: Phrase; mode: "practice" | "lend"; onBack: () => void; onNext: () => void }) {
  const { state, toast } = useApp();
  const rec = useRef<Recorder | null>(null);
  const [stage, setStage] = useState<"idle" | "rec" | "busy" | "done">("idle");
  const [level, setLevel] = useState(0);
  const [take, setTake] = useState<Recording | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const voices = (state?.voices ?? []).filter((v) => v.phraseId === phrase.id).slice(-3);
  useEffect(() => () => rec.current?.cancel(), []);

  const start = async () => {
    setErr(""); setRes(null);
    if (!Recorder.supported()) { setErr("This browser can't record audio. Practise out loud with your local buddy instead!"); return; }
    try {
      rec.current = new Recorder();
      await rec.current.start(setLevel, 6000, () => void stop());
      setStage("rec"); sfx.tick();
    } catch {
      setErr("Microphone blocked. Allow the microphone for this site in your browser settings, then try again.");
      setStage("idle");
    }
  };
  const stop = async () => {
    if (!rec.current) return;
    const r = rec.current; rec.current = null;
    setStage("busy"); setLevel(0);
    try {
      const t = await r.stop();
      if (t.seconds < 0.25) { setStage("idle"); setErr("That was very short. Tap the mic, say the phrase, then tap again."); return; }
      setTake(t);
      if (mode === "lend") {
        await post("/api/voice", { phraseId: phrase.id, wav: t.wavB64 });
        sfx.success(); toast("Cảm ơn! Your voice is shared 🎙️"); setStage("done");
      } else {
        const out = await post<Result>("/api/ai/pronounce", { phraseId: phrase.id, wav: t.wavB64 });
        if (out.fallback) { setErr("The AI coach is busy right now. Play your recording and ask your local buddy to judge! 🙏"); setStage("done"); return; }
        if (out.noSpeech) { setErr("🎧 " + out.tip); setStage("done"); sfx.wrong(); return; }
        setRes(out); setStage("done");
        if (out.score >= 80) { sfx.success(); confetti({ particleCount: 100, spread: 70, origin: { y: 0.35 } }); }
        else if (out.score >= 50) sfx.correct(); else sfx.wrong();
      }
    } catch (e) { setErr(friendlyError(e)); setStage("idle"); }
  };

  const ringScale = 1 + level * 0.5;
  return (
    <>
      <TopBar title={phrase.vi} sub={mode === "lend" ? "Lend your voice" : "AI pronunciation coach"} onBack={onBack} />
      <div className="screen stack">
        <div className="phrase-hero">
          <div style={{ fontSize: 40 }}>{phrase.emoji}</div>
          <div className="vi">{phrase.vi}</div>
          <div className="say">“{phrase.say}”</div>
          <div className="en">{phrase.en}</div>
          <div className="listen-row">
            <Speak text={phrase.vi} label="AI voice" />
            {voices.map((v) => (
              <button key={v.id} className="pill-btn local" onClick={() => playUrl(`/api/voice/${v.id}`).catch(() => undefined)}><VnFlag /> {v.avatar} {v.name}</button>
            ))}
          </div>
        </div>
        <div className="small muted center" style={{ padding: "0 8px" }}>💡 {phrase.note}</div>

        {stage !== "busy" && (
          <div className="center stack" style={{ gap: 10, padding: "8px 0" }}>
            <button className={`mic${stage === "rec" ? " rec" : ""}`} onClick={() => (stage === "rec" ? stop() : start())} aria-label={stage === "rec" ? "Stop" : "Record"}>
              {stage === "rec" && <span className="ring" style={{ transform: `scale(${ringScale})` }} />}
              {stage === "rec" ? "■" : "🎤"}
            </button>
            <div style={{ fontWeight: 700, color: stage === "rec" ? "var(--red)" : "var(--ink-2)" }}>
              {stage === "rec" ? "Recording… tap to stop" : res || stage === "done" ? "Tap to try again" : "Tap the mic and say it!"}
            </div>
          </div>
        )}
        {stage === "busy" && <Thinking text={mode === "lend" ? "Saving your voice…" : "The AI is listening to every syllable…"} />}
        {err && <div className="err">{err}</div>}

        {res && (
          <div className="card stack" style={{ animation: "rise .4s both" }}>
            <ScoreRing score={res.score} />
            <div className="center">
              <div className="label">The AI heard</div>
              <div className="vi" style={{ fontSize: 22 }}>{res.heard ? `“${res.heard}”` : "…nothing 🤔"}</div>
            </div>
            <div className="syls">
              {res.syllables.map((s, i) => (
                <div key={i} className={`syl ${s.status}`} style={{ animationDelay: `${i * 90}ms` }}>
                  {s.target}
                  <small>{s.status === "ok" ? "✓ perfect" : s.status === "tone" ? `tone: ${TONES[s.targetTone].name}` : s.status === "close" ? `heard “${s.heard}”` : "missed"}</small>
                </div>
              ))}
            </div>
            <div className="try-box"><span style={{ fontSize: 22 }}>🧑‍🏫</span><div><b>Tip:</b> {res.tip}</div></div>
            <div className="small muted center">AI hears like a machine. Ask your local buddy too: do they agree?</div>
          </div>
        )}
        {take && <button className="pill-btn" style={{ alignSelf: "center" }} onClick={() => playUrl(take.url).catch(() => undefined)}>▶ Hear my recording</button>}
        {(res || stage === "done") && <button className="btn ghost" onClick={onNext}>Next phrase →</button>}
      </div>
    </>
  );
}
