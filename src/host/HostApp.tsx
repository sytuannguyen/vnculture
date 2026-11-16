import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import confetti from "canvas-confetti";
import "./host.css";
import { ACTIVITIES, QUIZ, QUIZ_ROUND_NAMES, TEAMS, teamById } from "../../shared/content";
import type { HostState, Phase } from "../../shared/types";
import { hostPost } from "../lib/api";
import { useLive } from "../lib/live";
import { playVi } from "../lib/speech";
import { sfx, unlockAudio } from "../lib/sound";
import { LanternSky } from "./LanternSky";
import { MuteButton, VnFlag } from "../ui";

const SHAPES = ["▲", "◆", "●", "■"];
const SKY_AREAS: Record<Phase, [number, number, number, number]> = {
  lobby: [0.45, 0.03, 0.97, 0.15], dashboard: [0.03, 0.34, 0.67, 0.78], quiz: [0.03, 0.05, 0.97, 0.7], wall: [0.03, 0.06, 0.97, 0.6], awards: [0.47, 0.58, 0.97, 0.8],
};
const PIN_KEY = "culture.hostpin";

export default function HostApp() {
  const [pin, setPin] = useState(() => { try { return localStorage.getItem(PIN_KEY) || ""; } catch { return ""; } });
  const [ok, setOk] = useState(false);
  useEffect(() => { if (pin) hostPost("/api/host/check", pin).then(() => setOk(true)).catch(() => setOk(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ok) return <PinGate onOk={(p) => { try { localStorage.setItem(PIN_KEY, p); } catch { /* */ } setPin(p); setOk(true); }} />;
  return <Host pin={pin} />;
}

function PinGate({ onOk }: { onOk: (p: string) => void }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  const go = () => { unlockAudio(); hostPost("/api/host/check", v).then(() => onOk(v)).catch(() => setErr(true)); };
  return (
    <div className="pin-gate"><div className="box stack">
      <div style={{ fontSize: 64 }}>🏮</div>
      <h2 className="h2">Facilitator screen</h2>
      <input className="input" style={{ textAlign: "center", color: "#1C1842" }} type="password" inputMode="numeric" autoFocus placeholder="Host PIN" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
      {err && <div className="err">Wrong PIN</div>}
      <button className="btn" onClick={go}>Open the stage</button>
    </div></div>
  );
}

function useJoinUrl() {
  const url = useMemo(() => new URLSearchParams(location.search).get("join") || location.origin, []);
  const [qr, setQr] = useState("");
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 720, errorCorrectionLevel: "M", color: { dark: "#1C1842", light: "#FFF7EA" } }).then(setQr).catch(() => undefined); }, [url]);
  return { url, qr, pretty: url.replace(/^https?:\/\//, "").replace(/\/$/, "") };
}

function Host({ pin }: { pin: string }) {
  const { state, connected } = useLive<HostState>(`host=${encodeURIComponent(pin)}`);
  const join = useJoinUrl();
  const [joinToast, setJoinToast] = useState<string>("");
  const [milestone, setMilestone] = useState("");
  const seenJoins = useRef<number | null>(null);
  const lastMilestone = useRef<number | null>(null);
  const lastLanternSound = useRef(0);

  // join toasts + sound
  useEffect(() => {
    if (!state) return;
    const latest = state.recentJoins[0]?.at ?? 0;
    if (seenJoins.current === null) { seenJoins.current = latest; return; }
    if (latest > seenJoins.current) {
      seenJoins.current = latest;
      const j = state.recentJoins[0];
      setJoinToast(`${j.avatar} Xin chào ${j.name}! ${teamById(j.team).emoji}`);
      sfx.join();
      const t = setTimeout(() => setJoinToast(""), 2600);
      return () => clearTimeout(t);
    }
  }, [state?.recentJoins]); // eslint-disable-line react-hooks/exhaustive-deps

  // community milestones
  useEffect(() => {
    if (!state) return;
    const pct = Math.floor((state.lanterns / state.goal) * 4); // quarters
    if (lastMilestone.current === null) { lastMilestone.current = pct; return; }
    if (pct > lastMilestone.current && pct >= 1) {
      lastMilestone.current = pct;
      const msg = pct >= 4 ? "🎆 Hội An is lit! Goal reached! 🎆" : `🏮 ${pct * 25}% of the sky lit! 🏮`;
      setMilestone(msg); sfx.fanfare();
      const end = Date.now() + (pct >= 4 ? 5000 : 1800);
      const burst = () => { confetti({ particleCount: 80, spread: 120, startVelocity: 45, origin: { x: Math.random(), y: Math.random() * 0.4 + 0.1 }, colors: ["#FF5A3C", "#FFB547", "#FFE08A", "#ffffff"] }); if (Date.now() < end) setTimeout(burst, 350); };
      burst();
      setTimeout(() => setMilestone(""), 4200);
    }
  }, [state?.lanterns, state?.goal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return <div className="host"><div className="pin-gate"><div className="spinner" /></div></div>;
  const onLaunch = () => { const n = performance.now(); if (n - lastLanternSound.current > 260) { lastLanternSound.current = n; sfx.lantern(); } };
  const skyDim = state.phase !== "dashboard";

  return (
    <div className="host">
      <div className="stage">
        <LanternSky lanterns={state.lanterns} words={state.words} dim={skyDim} area={SKY_AREAS[state.phase]} onLaunch={state.phase === "dashboard" || state.phase === "lobby" ? onLaunch : undefined} />
        <div className="brand"><span style={{ fontSize: "2.6vw" }}>🏮</span><div><b>Chào Việt Nam!</b><span className="conn"><i className={connected ? "" : "off"} /> AI Culture & Language Lab · {join.pretty} · {state.totals.participants} learners · {state.totals.aiCalls} AI calls</span></div></div>
        {state.phase === "lobby" && <Lobby s={state} join={join} />}
        {state.phase === "dashboard" && <Dashboard s={state} join={join} />}
        {state.phase === "quiz" && <QuizHost s={state} />}
        {state.phase === "wall" && <Wall s={state} join={join} />}
        {state.phase === "awards" && <Awards s={state} />}
        {joinToast && state.phase !== "quiz" && <div className="toast-join">{joinToast}</div>}
        {milestone && <div className="milestone"><div>{milestone}</div></div>}
      </div>
      <Controls s={state} pin={pin} />
    </div>
  );
}

type Join = ReturnType<typeof useJoinUrl>;

function Lobby({ s, join }: { s: HostState; join: Join }) {
  const ps = s.participants.filter((p) => !p.hidden);
  return (
    <div className="lobby">
      <div className="qr-card">
        {join.qr && <img src={join.qr} alt="QR code" />}
        <div className="url">{join.pretty}</div>
        <div style={{ fontWeight: 700, opacity: 0.7, fontSize: "1.1vw" }}>Scan with your phone camera · no login</div>
      </div>
      <div className="right">
        <div className="kicker">Learn Vietnamese culture & language with AI</div>
        <h1>Xin chào!<br />Scan to join</h1>
        <div className="steps"><div>① Scan</div><div>② Type your name</div><div>③ Meet your team</div></div>
        <div className="row" style={{ alignItems: "baseline", gap: "1vw" }}><span className="join-count">{ps.length}</span><span style={{ fontSize: "1.6vw", fontWeight: 700, opacity: 0.8 }}>learners joined · {s.totals.locals} <VnFlag size={22} /> local buddies</span></div>
        <div className={`ava-cloud${ps.length > 16 ? " dense" : ""}`}>
          {ps.slice(0, 60).map((p) => <div key={p.id} className="a" style={{ ["--tc" as string]: teamById(p.team).color }}><i>{p.avatar}</i>{p.vnName || p.name}</div>)}
        </div>
        <div className="team-row">
          {TEAMS.map((t) => { const ts = s.teams.find((x) => x.id === t.id)!; return <div key={t.id} style={{ ["--tc" as string]: t.color }}><b>{t.emoji}</b><span>{t.name} · {ts.members}</span></div>; })}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ s, join }: { s: HostState; join: Join }) {
  const t = s.totals;
  const pct = Math.min(100, (s.lanterns / s.goal) * 100);
  const maxTeam = Math.max(1, ...s.teams.map((x) => x.points));
  const teams = [...s.teams].sort((a, b) => b.points - a.points);
  const tiles = [
    { em: "👥", v: t.participants, l: `learners · ${t.locals} local buddies` },
    { em: "🎤", v: t.phrasesSpoken, l: "phrases spoken" },
    { em: "🎯", v: t.phrasesSpoken ? `${t.avgPronunciation}%` : "–", l: "avg pronunciation" },
    { em: "🎵", v: t.toneAnswers ? `${t.toneAccuracy}%` : "–", l: `tone accuracy (${t.toneAnswers})` },
    { em: "📸", v: t.snaps, l: "things snapped" },
    { em: "💬", v: t.aiChats, l: "AI conversations" },
    { em: "💌", v: t.wishes, l: "lantern wishes" },
    { em: "🎙️", v: t.voices, l: "buddy voices" },
    { em: "🤖", v: t.aiCalls, l: "AI calls" },
  ];
  return (
    <div className="dash">
      <div className="sky-ui">
        <div className="goal-big glass">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <div><div className="kicker">Community goal · light up Hội An</div><div className="num">{s.lanterns} <span style={{ fontSize: "1.6vw", opacity: 0.7 }}>/ {s.goal} lanterns</span></div></div>
            <div style={{ fontSize: "1.1vw", opacity: 0.8, textAlign: "right", fontWeight: 600 }}>Every word spoken, photo snapped & question asked<br />lights a lantern 🏮</div>
          </div>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="marks"><span>0</span><span>25%</span><span>50%</span><span>75%</span><span>🎆</span></div>
        </div>
        <div style={{ marginTop: "auto", alignSelf: "flex-start", display: "flex", gap: "1vw", alignItems: "center" }} className="glass">
          {join.qr && <img src={join.qr} alt="" style={{ width: "6.5vw", borderRadius: ".8vw", margin: ".6vw" }} />}
          <div style={{ paddingRight: "1.2vw", fontWeight: 800, fontSize: "1.3vw" }}>Join: {join.pretty}</div>
        </div>
      </div>
      <div className="side">
        <div className="teams glass">
          <div className="kicker">Team leaderboard</div>
          {teams.map((x, i) => { const tm = teamById(x.id); return (
            <div key={x.id} className="team-bar">
              <span className="em">{i === 0 && x.points > 0 ? "👑" : tm.emoji}</span>
              <div className="track"><i style={{ width: `${(x.points / maxTeam) * 100}%`, background: tm.color }} /><span>{tm.name} · {x.members}</span></div>
              <span>{x.points}</span>
            </div>); })}
          {s.teams.some((x) => x.bestDiscount > 0) && <div style={{ fontSize: ".9vw", opacity: 0.75, marginTop: ".4vh" }}>🛍️ Best bargains: {teams.filter((x) => x.bestDiscount > 0).map((x) => `${teamById(x.id).emoji} ${x.bestDiscount}%`).join(" · ")}</div>}
        </div>
        <div className="tiles">{tiles.map((x) => <div key={x.l} className="tile glass"><span className="em">{x.em}</span><b>{x.v}</b><span>{x.l}</span></div>)}</div>
        <div className="feed glass">
          <div className="kicker">Live</div>
          {s.feed.slice(0, 9).map((f) => (
            <div key={f.id} className="it" style={{ ["--tc" as string]: teamById(f.team).color }}><i>{f.avatar}</i><div><b>{f.name}</b> {f.text} {f.emoji}</div></div>
          ))}
          {s.feed.length === 0 && <div style={{ opacity: 0.6, fontSize: "1vw" }}>Waiting for the first lantern…</div>}
        </div>
      </div>
    </div>
  );
}

function QuizHost({ s }: { s: HostState }) {
  const qz = s.quiz, q = QUIZ[qz.index];
  const endAt = useRef(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (qz.status === "open") endAt.current = Date.now() + qz.remainingMs; }, [s.serverTime, qz.status, qz.remainingMs]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (qz.status === "open") { sfx.gong(); if (q.audio) setTimeout(() => void playVi(q.audio!).catch(() => undefined), 900); }
    if (qz.status === "reveal") { sfx.fanfare(); confetti({ particleCount: 120, spread: 100, origin: { y: 0.3 } }); }
  }, [qz.status, qz.index]); // eslint-disable-line react-hooks/exhaustive-deps
  const remaining = qz.status === "open" ? Math.max(0, endAt.current - now) : 0;
  const C = 2 * Math.PI * 44;
  const total = (qz.counts ?? []).reduce((a, b) => a + b, 0) || 1;
  const lowTime = qz.status === "open" && remaining < 5000;
  useEffect(() => { if (lowTime) sfx.tick(); }, [Math.ceil(remaining / 1000)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="quiz">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="kicker">{QUIZ_ROUND_NAMES[q.round]} · Question {qz.index + 1}/{QUIZ.length}</div>
          <div className="qtext">{q.emoji} {q.q}</div>
        </div>
        {qz.status === "open" && (
          <div className="timer-ring">
            <svg width="100%" height="100%" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,.12)" strokeWidth="9" fill="none" />
              <circle cx="50" cy="50" r="44" stroke={lowTime ? "#FF5A5A" : "#FFB547"} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - remaining / qz.durationMs)} style={{ transition: "stroke-dashoffset .25s linear" }} /></svg>
            <b>{Math.ceil(remaining / 1000)}</b>
          </div>
        )}
      </div>
      {q.audio && qz.status !== "idle" && <button className="btn gold sm" style={{ alignSelf: "flex-start", marginBottom: "2vh", fontSize: "1.3vw" }} onClick={() => playVi(q.audio!).catch(() => undefined)}>🔊 Play again</button>}
      {qz.status === "idle" ? (
        <div style={{ margin: "auto", textAlign: "center" }}>
          <div style={{ fontSize: "7vw" }}>{q.emoji}</div>
          <div style={{ fontSize: "2.4vw", fontWeight: 800 }}>Get your phones ready! 📱</div>
          <div style={{ opacity: 0.7, fontSize: "1.3vw" }}>{q.kind === "poll" ? "Poll: no wrong answers" : q.kind === "tone" ? "Listening question: turn the sound up 🔊" : q.kind === "ailocal" ? "AI or Local? Buddies, get ready to explain!" : "Faster correct answers score more points"}</div>
        </div>
      ) : (
        <div className="opts">
          {q.options.map((o, i) => {
            const rev = qz.status === "reveal";
            const win = rev && q.kind !== "poll" && i === q.answer;
            return (
              <div key={i} className={`opt q${i}${rev && q.kind !== "poll" && !win ? " dim" : ""}${win ? " win" : ""}`}>
                {rev && <i className="fill" style={{ width: `${((qz.counts?.[i] ?? 0) / total) * 100}%` }} />}
                <span className="shape" style={{ position: "relative" }}>{SHAPES[i]}</span><span style={{ position: "relative" }}>{o}</span>
                {rev && <span className="cnt" style={{ position: "relative" }}>{qz.counts?.[i] ?? 0}</span>}
              </div>
            );
          })}
        </div>
      )}
      <div className="row" style={{ justifyContent: "space-between", marginTop: "2vh", fontSize: "1.5vw", fontWeight: 800 }}>
        {qz.status === "open" && <span>📱 {qz.answeredCount} / {qz.eligibleCount} answered</span>}
        {qz.status === "reveal" && qz.fastest && qz.fastest.length > 0 && (
          <div className="podium">{qz.fastest.map((f, i) => <div key={i}>{["🥇", "🥈", "🥉"][i]} {f.avatar} {f.name} · {(f.ms / 1000).toFixed(1)}s</div>)}</div>
        )}
      </div>
      {qz.status === "reveal" && <div className="fact glass">💡 {q.fact}</div>}
    </div>
  );
}

function Wall({ s, join }: { s: HostState; join: Join }) {
  const wishes = s.wishes.filter((w) => !w.hidden);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 3200); return () => clearInterval(t); }, []);
  // show a rolling window: newest first, then cycle older ones
  const shown = useMemo(() => {
    if (!wishes.length) return [];
    const out = [];
    for (let k = 0; k < Math.min(6, wishes.length); k++) out.push({ w: wishes[(tick + k) % wishes.length], k });
    return out;
  }, [tick, wishes.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="wall">
      {wishes.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div><div style={{ fontSize: "7vw" }}>💌🏮</div><div style={{ fontSize: "3vw", fontWeight: 800 }}>Send your Lantern Wish!</div><div style={{ fontSize: "1.5vw", opacity: 0.8 }}>Open “Lantern Wish” on {join.pretty}</div></div>
        </div>
      )}
      {shown.map(({ w, k }) => (
        <div key={`${w.id}-${tick - k}`} className="wish" style={{ left: `${4 + ((tick - k) * 37 % 72)}vw`, animationDuration: "19s", animationDelay: `${-k * 3.2}s` }}>
          <div className="v">{w.vi}</div>
          <div className="e">“{w.en}”</div>
          <div className="n">{w.avatar} {w.name} {teamById(w.team).emoji}</div>
        </div>
      ))}
      <div className="glass" style={{ position: "absolute", right: "2vw", top: "2.2vh", padding: "1vw 1.4vw", fontWeight: 800, fontSize: "1.4vw" }}>💌 {wishes.length} {wishes.length === 1 ? "wish" : "wishes"} · AI-translated into Vietnamese</div>
    </div>
  );
}

function Awards({ s }: { s: HostState }) {
  const teams = [...s.teams].sort((a, b) => b.points - a.points);
  useEffect(() => {
    sfx.fanfare();
    let n = 0;
    const iv = setInterval(() => { confetti({ particleCount: 90, spread: 140, startVelocity: 50, origin: { x: Math.random(), y: Math.random() * 0.3 + 0.1 }, colors: ["#FF5A3C", "#FFB547", "#FFE08A", "#ffffff", "#7CF0B5"] }); if (++n > 14) clearInterval(iv); }, 500);
    return () => clearInterval(iv);
  }, []);
  const order = [teams[1], teams[0], teams[2], teams[3]].filter(Boolean);
  const heights = ["72%", "100%", "56%", "40%"];
  const t = s.totals;
  return (
    <div className="awards">
      <div>
        <div className="kicker">Cảm ơn! Thank you!</div>
        <div className="row" style={{ gap: "1vw" }}><h1>We lit {s.lanterns} lanterns</h1><span style={{ fontSize: "4vw" }}>🏮</span></div>
        <div style={{ fontSize: "1.4vw", opacity: 0.85, fontWeight: 600, marginTop: "1vh" }}>
          {t.participants} learners · {t.phrasesSpoken} phrases spoken · {t.toneAnswers} tones heard · {t.snaps} photos · {t.aiChats} AI conversations · {t.wishes} wishes · {t.voices} buddy voices
        </div>
        <div className="pod">
          {order.map((x, i) => { const tm = teamById(x.id); return (
            <div key={x.id} style={{ height: heights[i], background: `linear-gradient(180deg, ${tm.color}, color-mix(in srgb, ${tm.color} 40%, #120F2E))`, animationDelay: `${i * 0.2}s` }}>
              <span className="em">{tm.emoji}</span><b>{tm.name}</b><span>{x.points} pts</span><span style={{ fontSize: "2vw" }}>{["🥈", "🥇", "🥉", "🎖️"][i]}</span>
            </div>); })}
        </div>
      </div>
      <div className="award-grid">
        {s.awards.map((a, i) => (
          <div key={a.title} className="award glass" style={{ animationDelay: `${0.4 + i * 0.25}s` }}>
            <span className="em">{a.emoji}</span>
            <div><div className="t">{a.title}</div><b>{a.avatar} {a.name}</b><small>{a.detail}</small></div>
          </div>
        ))}
        {s.awards.length === 0 && <div style={{ opacity: 0.6 }}>Awards appear as people play.</div>}
      </div>
    </div>
  );
}

function Controls({ s, pin }: { s: HostState; pin: string }) {
  const [panel, setPanel] = useState(false);
  const [faded, setFaded] = useState(false);
  const call = (url: string, body: Record<string, unknown> = {}) => hostPost(url, pin, body).catch((e) => alert("Action failed: " + e.message));
  const setPhase = (p: Phase) => { sfx.tap(); void call("/api/host/phase", { phase: p }); };
  const qz = s.quiz;
  const phases: [Phase, string][] = [["lobby", "📱 Lobby"], ["dashboard", "🏮 Dashboard"], ["quiz", "🧠 Quiz"], ["wall", "💌 Wall"], ["awards", "🏆 Awards"]];

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "h") setFaded((f) => !f);
      if (e.key === "f") void document.documentElement.requestFullscreen?.().catch(() => undefined);
      if (e.key >= "1" && e.key <= "5") setPhase(phases[Number(e.key) - 1][0]);
      if (s.phase === "quiz" && (e.key === " " || e.key === "ArrowRight")) {
        e.preventDefault();
        if (qz.status === "idle") void call("/api/host/quiz", { action: "open", index: qz.index });
        else if (qz.status === "open") void call("/api/host/quiz", { action: "reveal" });
        else void call("/api/host/quiz", { action: "select", index: Math.min(QUIZ.length - 1, qz.index + 1) });
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <>
      <div className={`ctrl${faded ? " faded" : ""}`}>
        {phases.map(([p, l]) => <button key={p} className={s.phase === p ? "on" : ""} onClick={() => setPhase(p)}>{l}</button>)}
        {s.phase === "quiz" && (
          <>
            <span className="sep" />
            <select value={qz.index} onChange={(e) => void call("/api/host/quiz", { action: "select", index: Number(e.target.value) })}>
              {QUIZ.map((q, i) => <option key={q.id} value={i}>{i + 1}. [{q.kind}] {q.q.slice(0, 40)}</option>)}
            </select>
            {qz.status === "idle" && <button className="go" onClick={() => void call("/api/host/quiz", { action: "open", index: qz.index })}>▶ Start</button>}
            {qz.status === "open" && <button className="go" onClick={() => void call("/api/host/quiz", { action: "reveal" })}>👁 Reveal</button>}
            {qz.status === "reveal" && <button className="go" onClick={() => void call("/api/host/quiz", { action: "select", index: Math.min(QUIZ.length - 1, qz.index + 1) })}>Next ⏭</button>}
          </>
        )}
        <span className="sep" />
        <select value={s.spotlight?.activity ?? ""} onChange={(e) => void call("/api/host/spotlight", { activity: e.target.value || null })}>
          <option value="">🔦 Spotlight: off</option>
          {ACTIVITIES.map((a) => <option key={a.id} value={a.id}>🔦 {a.emoji} {a.title}</option>)}
        </select>
        <button onClick={() => setPanel((p) => !p)}>⚙︎</button>
        <button onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}>⛶</button>
        <MuteButton className="" />
      </div>
      {panel && <Panel s={s} call={call} pin={pin} />}
    </>
  );
}

function Panel({ s, call, pin }: { s: HostState; call: (u: string, b?: Record<string, unknown>) => Promise<unknown>; pin: string }) {
  return (
    <div className="panel">
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <a className="btn sm" style={{ textDecoration: "none" }} href={`/api/host/export?format=csv&pin=${encodeURIComponent(pin)}`}>⬇ CSV</a>
        <a className="btn sm ghost" style={{ textDecoration: "none" }} href={`/api/host/export?format=json&pin=${encodeURIComponent(pin)}`}>⬇ JSON</a>
      </div>
      <div style={{ opacity: 0.7, marginTop: 8, fontSize: 12 }}>Keys: 1-5 screens · Space = quiz start/reveal/next · H hide bar · F fullscreen</div>
      <h3>Participants ({s.participants.length})</h3>
      {s.participants.map((p) => (
        <div key={p.id} className="li" style={{ opacity: p.hidden ? 0.4 : 1 }}>
          <span>{p.avatar}</span><span>{p.name}{p.vnName ? ` · ${p.vnName}` : ""} {teamById(p.team).emoji} {p.role === "local" ? "(local)" : ""}</span><span style={{ opacity: 0.6 }}>{p.points}</span>
          <button onClick={() => call("/api/host/hide", { pid: p.id })}>{p.hidden ? "Show" : "Hide"}</button>
        </div>
      ))}
      <h3>Wishes ({s.wishes.length})</h3>
      {s.wishes.map((w) => (
        <div key={w.id} className="li" style={{ opacity: w.hidden ? 0.4 : 1 }}>
          <span style={{ fontSize: 12 }}>{w.name}: {w.vi}</span>
          <button onClick={() => call("/api/host/hide", { wishId: w.id })}>{w.hidden ? "Show" : "Hide"}</button>
        </div>
      ))}
      <h3>Danger zone</h3>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button className="btn sm danger" onClick={() => { if (confirm("Reset the event? All participants and scores are cleared (buddy voices are kept).") && confirm("Really reset?")) void call("/api/host/reset", { clearVoices: false }); }}>Reset event</button>
        <button className="btn sm danger" onClick={() => { if (confirm("Reset EVERYTHING including recorded buddy voices?") && confirm("Really?")) void call("/api/host/reset", { clearVoices: true }); }}>Reset + voices</button>
      </div>
    </div>
  );
}
