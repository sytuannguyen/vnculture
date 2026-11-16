import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { MARKET_ITEMS, type MarketItem } from "../../shared/content";
import { friendlyError, post } from "../lib/api";
import { playVi } from "../lib/speech";
import { sfx } from "../lib/sound";
import { Thinking, TopBar } from "../ui";
import { useApp } from "./PhoneApp";

interface Turn { vendor_vi: string; vendor_en: string; price: number; deal: boolean; suggestions: { vi: string; en: string }[]; discount?: number; fallback?: boolean }
interface Msg { who: "me" | "them"; vi: string; en?: string }

export function Market() {
  const { go, state, me } = useApp();
  const [item, setItem] = useState<MarketItem | null>(null);
  const [sid, setSid] = useState(0);
  const teamBest = state?.teams.find((t) => t.id === me?.team)?.bestDiscount ?? 0;
  if (item) return <Haggle key={`${item.id}-${sid}`} item={item} onExit={() => setItem(null)} />;
  return (
    <>
      <TopBar title="Bargain at Bến Thành" sub="AI · role-play" onBack={() => go("home")} />
      <div className="screen stack">
        <div className="card" style={{ background: "linear-gradient(135deg,#FFE7A8,#F4B63F)", boxShadow: "var(--shadow-lg)" }}>
          <div style={{ fontSize: 40 }}>🛍️👩🏻‍🦱</div>
          <b style={{ fontSize: 19 }}>Meet Cô Hoa, Saigon's most dramatic vendor</b>
          <div style={{ fontSize: 14.5, marginTop: 4 }}>Bargaining is a friendly game in Vietnamese markets. Use Vietnamese and be charming: <b>she drops the price more when you try Vietnamese!</b></div>
        </div>
        <div className="label">Choose what to buy</div>
        {MARKET_ITEMS.map((it) => (
          <button key={it.id} className="phrase-item" onClick={() => { sfx.tap(); setSid((x) => x + 1); setItem(it); }}>
            <span className="em" style={{ fontSize: 36 }}>{it.emoji}</span>
            <div><b className="vi">{it.vi}</b><small>{it.en} · asking {it.start}k đồng</small></div>
          </button>
        ))}
        <div className="card small">
          <b>Useful phrases</b>
          <div style={{ marginTop: 6, lineHeight: 1.8 }}>
            <span className="vi">Đắt quá!</span> Too expensive · <span className="vi">Bớt đi!</span> Lower it! · <span className="vi">Chị ơi</span> Hey, sister (polite) · <span className="vi">… nghìn được không?</span> How about … thousand? · <span className="vi">Được!</span> Deal!
          </div>
        </div>
        <div className="center small muted">Your best: {me?.stats.bestDiscount ?? 0}% off · Team best: {teamBest}% off</div>
      </div>
    </>
  );
}

function Haggle({ item, onExit }: { item: MarketItem; onExit: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    post<Turn>("/api/market/start", { itemId: item.id }).then((t) => {
      setTurn(t); setMsgs([{ who: "them", vi: t.vendor_vi, en: t.vendor_en }]); setBusy(false);
      void playVi(t.vendor_vi).catch(() => undefined);
    }).catch((e) => { setErr(friendlyError(e)); setBusy(false); });
  }, [item.id]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  const say = async (vi: string, en?: string) => {
    const v = vi.trim(); if (!v || busy || turn?.deal) return;
    sfx.tap(); setText(""); setErr("");
    setMsgs((m) => [...m, { who: "me", vi: v, en }]); setBusy(true);
    try {
      const t = await post<Turn>("/api/market/say", { text: v });
      if (t.fallback) { setErr("Cô Hoa is busy with another customer… tap your line again! 😅"); setMsgs((m) => m.slice(0, -1)); }
      else {
        setTurn(t); setMsgs((m) => [...m, { who: "them", vi: t.vendor_vi, en: t.vendor_en }]);
        void playVi(t.vendor_vi).catch(() => undefined);
        if (t.deal) { sfx.fanfare(); confetti({ particleCount: 150, spread: 90, origin: { y: 0.4 } }); }
        else sfx.lantern();
      }
    } catch (e) { setErr(friendlyError(e)); setMsgs((m) => m.slice(0, -1)); }
    setBusy(false);
  };

  return (
    <>
      <TopBar title={`${item.emoji} ${item.vi}`} sub="Cô Hoa · Bến Thành market" onBack={onExit} />
      <div className="screen stack" style={{ paddingBottom: 0 }}>
        {turn && (
          <div className="price-tag">
            <span><span className="small" style={{ fontWeight: 700 }}>Current price</span><br /><b>{turn.price}k ₫</b></span>
            <span style={{ textAlign: "right" }}><span className="small">asked {item.start}k</span><br /><b style={{ fontSize: 20 }}>{Math.round(((item.start - turn.price) / item.start) * 100)}% off</b></span>
          </div>
        )}
        <div className="chat">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.who}`}>
              {m.who === "them" && <div className="who-row">👩🏻‍🦱 Cô Hoa <button onClick={() => playVi(m.vi).catch(() => undefined)} style={{ fontSize: 15 }}>🔈</button></div>}
              <div className="vi">{m.vi}</div>
              {m.en && <div className="en">{m.en}</div>}
            </div>
          ))}
          {busy && <Thinking text="Cô Hoa is thinking…" />}
          <div ref={end} />
        </div>
        {err && <div className="err">{err}</div>}
        {turn?.deal ? (
          <div className="word-card stack" style={{ gap: 6 }}>
            <div style={{ fontSize: 54 }}>🎉{item.emoji}</div>
            <div className="h2">Deal at {turn.price}k!</div>
            <div className="muted">You saved <b>{turn.discount ?? Math.round(((item.start - turn.price) / item.start) * 100)}%</b>. Say thank you: <span className="vi">“Cảm ơn chị!”</span></div>
            <button className="btn" onClick={onExit}>Bargain for something else</button>
          </div>
        ) : (
          <>
            {turn && !busy && (
              <div className="sugs">
                <div className="label">Tap to say</div>
                {turn.suggestions.slice(0, 3).map((s, i) => <button key={i} className="sug" onClick={() => say(s.vi, s.en)}><span className="vi">{s.vi}</span><small>{s.en}</small></button>)}
              </div>
            )}
            <div className="composer">
              <input className="input" value={text} placeholder="Or type (Vietnamese or English)…" maxLength={160} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && say(text)} />
              <button className="btn" onClick={() => say(text)} disabled={busy || !text.trim()}>➤</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
