import { useState } from "react";
import confetti from "canvas-confetti";
import { friendlyError, post } from "../lib/api";
import { sfx } from "../lib/sound";
import { Speak, Thinking, TopBar } from "../ui";
import { useApp } from "./PhoneApp";

const IDEAS = ["Thank you to my Vietnamese buddies!", "I hope to visit Hội An one day", "Wishing everyone health and happiness", "I want to eat real phở in Hà Nội", "Friendship between Australia and Vietnam forever"];

export function WishAct() {
  const { go } = useApp();
  const [en, setEn] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ vi: string; back_en: string } | null>(null);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  const translate = async () => {
    if (en.trim().length < 2) return;
    sfx.tap(); setBusy(true); setErr(""); setPreview(null);
    try {
      const r = await post<{ safe?: boolean; vi?: string; back_en?: string; fallback?: boolean }>("/api/ai/wish", { en });
      if (r.fallback) setErr("The AI translator is busy. Try again in a moment 🙏");
      else if (!r.safe) setErr("Let's keep the lantern sky kind and friendly 🏮 Try another wish!");
      else setPreview({ vi: r.vi!, back_en: r.back_en! });
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  };
  const send = async () => {
    setBusy(true);
    try {
      await post("/api/wish");
      setSent(true); sfx.whoosh(); setTimeout(() => sfx.success(), 300);
      confetti({ particleCount: 60, spread: 50, startVelocity: 55, angle: 90, origin: { y: 0.8 }, colors: ["#FF8A3D", "#F4B63F", "#C8102E"] });
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  };

  if (sent) {
    return (
      <>
        <TopBar title="Lantern Wish" onBack={() => go("home")} />
        <div className="screen center stack" style={{ paddingTop: 40 }}>
          <div style={{ fontSize: 96, animation: "float 3s ease-in-out infinite" }}>🏮</div>
          <div className="h1">Your lantern is flying!</div>
          <div className="muted">Look at the big screen ✨</div>
          <button className="btn ghost" onClick={() => { setSent(false); setPreview(null); setEn(""); }}>Send another wish</button>
          <button className="btn" onClick={() => go("home")}>Back home</button>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Lantern Wish" sub="AI · translation" onBack={() => go("home")} />
      <div className="screen stack">
        <div className="card" style={{ background: "linear-gradient(135deg,#2B1D4F,#1C1842)", color: "#fff" }}>
          <div style={{ fontSize: 36 }}>💌🏮</div>
          <b style={{ fontSize: 18 }}>Write a wish or a thank-you in English</b>
          <div style={{ opacity: 0.85, fontSize: 14.5 }}>AI translates it into Vietnamese, then sends it floating as a lantern across the big screen.</div>
        </div>
        <textarea className="input" value={en} maxLength={160} placeholder="My wish is…" onChange={(e) => setEn(e.target.value)} />
        {!preview && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{IDEAS.map((i) => <button key={i} className="chip" style={{ background: "#fff", boxShadow: "var(--shadow)" }} onClick={() => setEn(i)}>{i}</button>)}</div>}
        {busy && <Thinking text="Translating with care…" />}
        {err && <div className="err">{err}</div>}
        {preview && !busy && (
          <div className="word-card stack" style={{ gap: 8, textAlign: "left" }}>
            <div className="label">In Vietnamese</div>
            <div className="vi" style={{ fontSize: 24, color: "var(--red)", lineHeight: 1.3 }}>{preview.vi}</div>
            <div className="listen-row" style={{ justifyContent: "flex-start", marginTop: 0 }}><Speak text={preview.vi} slow={false} /></div>
            <div className="label" style={{ marginTop: 6 }}>Back-translation (check the AI!)</div>
            <div className="muted">“{preview.back_en}”</div>
            <button className="btn gold" onClick={send}>🏮 Release my lantern</button>
          </div>
        )}
        {!preview && !busy && <button className="btn" disabled={en.trim().length < 2} onClick={translate}>✨ Translate</button>}
      </div>
    </>
  );
}
