import { useRef, useState } from "react";
import confetti from "canvas-confetti";
import { friendlyError, post } from "../lib/api";
import { resizeImage } from "../lib/recorder";
import { playVi } from "../lib/speech";
import { sfx } from "../lib/sound";
import { Speak, Thinking, TopBar, VnFlag } from "../ui";
import { useApp } from "./PhoneApp";

interface SnapRes { found: boolean; en: string; vi: string; say: string; example_vi: string; example_en: string; culture: string; emoji: string; fallback?: boolean }
const HUNT = ["something red ❤️", "something you eat or drink 🍵", "something you write with ✏️", "something on your body 👟", "something with a screen 📱", "something from nature 🌿"];

export function Snap() {
  const { go, me } = useApp();
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SnapRes | null>(null);
  const [err, setErr] = useState("");

  const onFile = async (f?: File | null) => {
    if (!f) return;
    setErr(""); setRes(null); setBusy(true);
    try {
      const b64 = await resizeImage(f);
      setImg(`data:image/jpeg;base64,${b64}`);
      const r = await post<SnapRes>("/api/ai/snap", { image: b64 });
      if (r.fallback) setErr("The AI's eyes are busy right now. Try again in a moment! 🙏");
      else {
        setRes(r);
        if (r.found) { sfx.success(); confetti({ particleCount: 70, spread: 60, origin: { y: 0.3 } }); setTimeout(() => void playVi(r.vi).catch(() => undefined), 400); }
      }
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
    if (cam.current) cam.current.value = ""; if (lib.current) lib.current.value = "";
  };

  return (
    <>
      <TopBar title="Snap & Learn" sub="AI · computer vision" onBack={() => go("home")} right={<span className="pts">📸 {me?.stats.snaps ?? 0}</span>} />
      <div className="screen stack">
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={lib} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        {!img && (
          <div className="snap-drop stack" style={{ gap: 10 }}>
            <div style={{ fontSize: 56 }}>📸</div>
            <div className="h2">Point your camera at anything</div>
            <div className="muted">The AI will teach you its Vietnamese name, how to say it, and a cultural secret.</div>
          </div>
        )}
        {img && <img className="snap-img" src={img} alt="" />}
        {busy && <Thinking text="The AI is looking at your photo…" />}
        {err && <div className="err">{err}</div>}
        {res && res.found && (
          <div className="word-card stack" style={{ gap: 6 }}>
            <div style={{ fontSize: 40 }}>{res.emoji}</div>
            <div className="vi">{res.vi}</div>
            <div style={{ color: "var(--jade)", fontWeight: 700 }}>say “{res.say}”</div>
            <div className="muted" style={{ fontWeight: 600 }}>{res.en}</div>
            <div className="listen-row"><Speak text={res.vi} /></div>
            <div className="card" style={{ background: "#FFF6E6", boxShadow: "none", textAlign: "left", marginTop: 8 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div><div className="vi" style={{ fontSize: 18 }}>{res.example_vi}</div><div className="small muted">{res.example_en}</div></div>
                <button className="icon-btn" onClick={() => playVi(res.example_vi).catch(() => undefined)}>🔈</button>
              </div>
            </div>
            <div className="card" style={{ background: "#EEF6FF", boxShadow: "none", textAlign: "left" }}><VnFlag /> <b>Culture:</b> {res.culture}</div>
          </div>
        )}
        {res && !res.found && <div className="card">🤔 {res.culture || "I couldn't see clearly. Try a closer photo of one object!"}</div>}
        {!busy && (
          <div className="row">
            <button className="btn" onClick={() => { sfx.tap(); cam.current?.click(); }}>📷 {img ? "Snap another" : "Take a photo"}</button>
            <button className="btn ghost sm" style={{ minHeight: 58 }} onClick={() => lib.current?.click()}>🖼️</button>
          </div>
        )}
        <div className="card">
          <div className="label">🔎 Scavenger hunt: find & snap</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {HUNT.map((h) => <span key={h} className="chip" style={{ background: "#F7EBD6" }}>{h}</span>)}
          </div>
        </div>
      </div>
    </>
  );
}
