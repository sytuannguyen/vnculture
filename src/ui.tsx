import { useEffect, useState, type ReactNode } from "react";
import { TONES, type ToneId } from "../shared/content";
import { playVi } from "./lib/speech";
import { isMuted, onMute, setMuted, sfx } from "./lib/sound";

export function TopBar({ title, sub, onBack, right }: { title: ReactNode; sub?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="topbar">
      {onBack && <button className="back" aria-label="Back" onClick={() => { sfx.tap(); onBack(); }}>←</button>}
      <div className="title">{title}{sub && <small>{sub}</small>}</div>
      {right}
      <MuteButton className="icon-btn" />
    </div>
  );
}

export function ToneCurve({ tone, width = 100, stroke = 6, animate = false }: { tone: ToneId; width?: number | string; stroke?: number; animate?: boolean }) {
  const t = TONES[tone];
  return (
    <svg className="curve" viewBox="0 0 100 60" style={{ width }} preserveAspectRatio="none" aria-hidden>
      <path d="M4 30 L96 30" stroke="rgba(28,24,66,.08)" strokeWidth={1.5} strokeDasharray="3 4" fill="none" />
      <path d={t.curve} stroke={t.color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none"
        style={animate ? { strokeDasharray: 200, strokeDashoffset: 200, animation: "draw 0.9s ease forwards" } : undefined} />
      <style>{`@keyframes draw{to{stroke-dashoffset:0}}`}</style>
    </svg>
  );
}

export function Thinking({ text }: { text: string }) {
  return <div className="thinking"><div className="spinner dark" /> {text}</div>;
}

export function ScoreRing({ score }: { score: number }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(score), 60); return () => clearTimeout(t); }, [score]);
  const color = score >= 80 ? "#16A36A" : score >= 50 ? "#E39A12" : "#D93B3B";
  const C = 2 * Math.PI * 50;
  return (
    <div className="score-ring">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" stroke="#F0E2CB" strokeWidth="12" fill="none" />
        <circle cx="60" cy="60" r="50" stroke={color} strokeWidth="12" fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.9,.3,1)" }} />
      </svg>
      <b style={{ color }}>{score}</b>
    </div>
  );
}

export function Speak({ text, label = "Listen", slow = true, className = "pill-btn" }: { text: string; label?: string; slow?: boolean; className?: string }) {
  const [busy, setBusy] = useState<"" | "n" | "s">("");
  const go = async (s: boolean) => { setBusy(s ? "s" : "n"); try { await playVi(text, s); } finally { setBusy(""); } };
  return (
    <>
      <button className={className} onClick={() => go(false)}>{busy === "n" ? "🔊" : "🔈"} {label}</button>
      {slow && <button className={className} onClick={() => go(true)}>{busy === "s" ? "🐢" : "🐢"} Slow</button>}
    </>
  );
}

export function MuteButton({ className = "mute" }: { className?: string }) {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMute(setM), []);
  return <button className={className} aria-label={m ? "Unmute" : "Mute"} onClick={() => setMuted(!m)}>{m ? "🔇" : "🔊"}</button>;
}

/** Vietnamese flag as SVG: flag emojis don't render on Windows (projector laptops). */
export function VnFlag({ size = 18 }: { size?: number }) {
  return (
    <svg width={size * 1.5} height={size} viewBox="0 0 30 20" style={{ verticalAlign: "-0.15em", borderRadius: 2, display: "inline-block" }} aria-label="Vietnam">
      <rect width="30" height="20" fill="#DA251D" />
      <polygon fill="#FFFF00" points="15,4 16.18,7.62 20,7.62 16.91,9.86 18.09,13.48 15,11.24 11.91,13.48 13.09,9.86 10,7.62 13.82,7.62" />
    </svg>
  );
}
