import { useState } from "react";
import confetti from "canvas-confetti";
import { friendlyError, post } from "../lib/api";
import { sfx } from "../lib/sound";
import { Speak, Thinking, TopBar } from "../ui";
import { useApp } from "./PhoneApp";

const TRAITS = ["🏄 ocean lover", "🎨 creative", "⚽ sporty", "🎵 music", "😂 funny", "🧠 curious", "🌿 calm", "🍜 foodie", "📚 bookworm", "✈️ adventurous"];
interface R { vnName: string; meaning: string; say: string; story: string; ai: boolean }

export function NameAct() {
  const { go, me } = useApp();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<R | null>(me?.vnName ? { vnName: me.vnName, meaning: me.vnMeaning ?? "", say: me.vnSay ?? "", story: "", ai: true } : null);

  const toggle = (t: string) => { sfx.tap(); setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length >= 3 ? p : [...p, t])); };
  const create = async () => {
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await post<R>("/api/ai/name", { about: picked.map((t) => t.replace(/^\S+\s/, "")).join(", ") });
      setRes(r); sfx.success();
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.4 }, colors: ["#C8102E", "#F4B63F", "#1F9D8B"] });
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  };

  return (
    <>
      <TopBar title="My Vietnamese Name" sub="AI · personalisation" onBack={() => go("home")} />
      <div className="screen stack">
        {!res && !busy && (
          <div className="card stack">
            <div className="h2">Pick up to 3 words that describe you</div>
            <div className="muted small">The AI will create a real Vietnamese name that fits you, with its meaning.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {TRAITS.map((t) => (
                <button key={t} className="chip" onClick={() => toggle(t)}
                  style={{ padding: "10px 14px", fontSize: 15, background: picked.includes(t) ? "#C8102E" : "#fff", color: picked.includes(t) ? "#fff" : "inherit", boxShadow: "var(--shadow)" }}>{t}</button>
              ))}
            </div>
            {err && <div className="err">{err}</div>}
            <button className="btn" onClick={create}>✨ Create my name</button>
          </div>
        )}
        {busy && <Thinking text="The AI is choosing a beautiful name for you…" />}
        {res && (
          <div className="word-card stack" style={{ gap: 8 }}>
            <div className="label">Your Vietnamese name</div>
            <div className="vi" style={{ fontSize: 46, color: "var(--red)" }}>{res.vnName}</div>
            {res.say && <div style={{ color: "var(--jade)", fontWeight: 700 }}>say it like “{res.say}”</div>}
            <div style={{ fontSize: 18, fontWeight: 700 }}>“{res.meaning}”</div>
            {res.story && <div className="muted">{res.story}</div>}
            <div className="listen-row"><Speak text={res.vnName} /></div>
            <div className="card" style={{ background: "#FFF6E6", boxShadow: "none", textAlign: "left" }}>
              <b>Now say it to your team:</b>
              <div className="vi" style={{ fontSize: 20, marginTop: 4 }}>“Tôi tên là {res.vnName}.”</div>
              <div className="small muted">My name is {res.vnName}. Ask your local buddy if you sound right!</div>
            </div>
            {!res.ai && <div className="small muted">(Offline name pick: the AI was busy.)</div>}
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => { setRes(null); }}>↻ Another</button>
              <button className="btn sm" style={{ flex: 1 }} onClick={() => go("home")}>Done ✓</button>
            </div>
          </div>
        )}
        <div className="small muted center">💡 Vietnamese names have meanings, often nature or virtues. Family names come first: Nguyễn is the most common, shared by ~38% of Vietnamese people.</div>
      </div>
    </>
  );
}
