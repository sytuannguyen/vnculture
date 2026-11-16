import { useEffect, useRef, useState } from "react";
import { friendlyError, post } from "../lib/api";
import { playVi } from "../lib/speech";
import { sfx } from "../lib/sound";
import { Thinking, TopBar, VnFlag } from "../ui";
import { useApp } from "./PhoneApp";

interface G { answer: string; try_vi: string; try_en: string; try_say: string; followups: string[]; fallback?: boolean }
interface M { role: "user" | "guide"; text: string; g?: G }
const STARTERS = ["What should I eat first in Vietnam? 🍜", "How do people celebrate Tết? 🧧", "Why are there so many motorbikes? 🛵", "What's polite when visiting a family? 🏠", "Tell me a Vietnamese legend 🐉", "Is it rude to tip? 💵"];

export function Guide() {
  const { go } = useApp();
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  const ask = async (q: string) => {
    const v = q.trim(); if (!v || busy) return;
    sfx.tap(); setText(""); setErr("");
    const next: M[] = [...msgs, { role: "user", text: v }];
    setMsgs(next); setBusy(true);
    try {
      const g = await post<G>("/api/ai/guide", { history: next.map((m) => ({ role: m.role, text: m.text })) });
      if (g.fallback) { setErr("Cô Lan is helping someone else. Ask again in a moment! 🙏"); setMsgs(msgs); }
      else { setMsgs([...next, { role: "guide", text: g.answer, g }]); sfx.lantern(); }
    } catch (e) { setErr(friendlyError(e)); setMsgs(msgs); }
    setBusy(false);
  };
  const last = [...msgs].reverse().find((m) => m.g)?.g;

  return (
    <>
      <TopBar title="Ask Cô Lan" sub="AI culture guide from Hội An" onBack={() => go("home")} />
      <div className="screen stack" style={{ paddingBottom: 0 }}>
        {msgs.length === 0 && (
          <>
            <div className="card row" style={{ alignItems: "flex-start" }}>
              <span style={{ fontSize: 44 }}>👩🏻‍🏫</span>
              <div><b>Xin chào! I'm Cô Lan 🏮</b><div className="muted" style={{ fontSize: 14.5 }}>Ask me anything about Vietnam: food, festivals, family, history, manners. I'll also teach you a Vietnamese word each time.</div></div>
            </div>
            <div className="sugs">{STARTERS.map((s) => <button key={s} className="sug" onClick={() => ask(s)}>{s}</button>)}</div>
          </>
        )}
        <div className="chat">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "me" : "them"}`}>
              {m.role === "guide" && <div className="who-row">👩🏻‍🏫 Cô Lan</div>}
              <div style={{ fontSize: 15.5 }}>{m.text}</div>
              {m.g?.try_vi && (
                <div className="try-box">
                  <button className="icon-btn" onClick={() => playVi(m.g!.try_vi).catch(() => undefined)}>🔈</button>
                  <div><div className="label" style={{ fontSize: 10 }}>Try saying</div><div className="vi" style={{ fontSize: 18 }}>{m.g.try_vi}</div><div className="small muted">“{m.g.try_say}” · {m.g.try_en}</div></div>
                </div>
              )}
            </div>
          ))}
          {busy && <Thinking text="Cô Lan is thinking…" />}
          <div ref={end} />
        </div>
        {err && <div className="err">{err}</div>}
        {last && !busy && <div className="sugs">{last.followups.slice(0, 3).map((f) => <button key={f} className="sug" onClick={() => ask(f)}>💬 {f}</button>)}</div>}
        <div className="small muted center"><VnFlag /> Local buddies: is Cô Lan right? Tell your team!</div>
        <div className="composer">
          <input className="input" value={text} placeholder="Ask about Vietnam…" maxLength={300} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(text)} />
          <button className="btn" onClick={() => ask(text)} disabled={busy || !text.trim()}>➤</button>
        </div>
      </div>
    </>
  );
}
