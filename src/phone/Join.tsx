import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { AVATARS, teamById } from "../../shared/content";
import type { Participant, Profile, Role } from "../../shared/types";
import { friendlyError, newId } from "../lib/api";
import { sfx, unlockAudio } from "../lib/sound";
import { VnFlag } from "../ui";
import { InstallButton } from "./Install";

export function Join({ onJoin }: { onJoin: (p: Profile) => Promise<void> }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [role, setRole] = useState<Role>("visitor");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!name.trim()) { setErr("Type your first name 🙂"); return; }
    unlockAudio(); sfx.tap();
    setBusy(true); setErr("");
    try { await onJoin({ id: newId(), name: name.trim(), avatar, role }); }
    catch (e) { setErr(friendlyError(e)); setBusy(false); }
  };

  return (
    <div className="screen stack" style={{ gap: 18 }}>
      <div className="join-hero">
        <img className="lantern-ico" src="/icons/icon.svg" width={96} height={96} alt="Chào Việt Nam logo" />
        <h1>Xin chào!</h1>
        <div className="muted" style={{ fontWeight: 600 }}>Learn Vietnamese culture & language with AI</div>
      </div>
      <div className="card stack">
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Your first name</div>
          <input className="input" value={name} maxLength={20} autoComplete="given-name" enterKeyHint="go" placeholder="e.g. Emma"
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Pick your buddy</div>
          <div className="avatars">
            {AVATARS.map((a) => <button key={a} className={a === avatar ? "on" : ""} onClick={() => { setAvatar(a); sfx.tap(); }} aria-label={a}>{a}</button>)}
          </div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>I am a…</div>
          <div className="roles">
            <button className={role === "visitor" ? "on" : ""} onClick={() => { setRole("visitor"); sfx.tap(); }}><span className="flag">🦘</span><b>Visitor</b><span>Learning Vietnamese</span></button>
            <button className={role === "local" ? "on" : ""} onClick={() => { setRole("local"); sfx.tap(); }}><span className="flag"><VnFlag size={34} /></span><b>Local buddy</b><span>I speak Vietnamese</span></button>
          </div>
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy} onClick={submit}>{busy ? <div className="spinner" /> : <>Let's go <span>→</span></>}</button>
      </div>
      <div className="center small muted">No login, no account. Just learning & fun 🏮</div>
      <InstallButton className="btn ghost sm" />
    </div>
  );
}

export function TeamReveal({ me, onDone }: { me: Participant; onDone: () => void }) {
  const team = teamById(me.team);
  const [spin, setSpin] = useState(true);
  useEffect(() => {
    const t1 = setTimeout(() => {
      setSpin(false); sfx.success();
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.55 }, colors: [team.color, "#F4B63F", "#ffffff"] });
    }, 1300);
    const t2 = setTimeout(onDone, 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="reveal" style={{ background: `radial-gradient(circle at 50% 35%, ${team.color}, #1C1842 120%)` }} onClick={onDone}>
      <div>
        {spin ? <div className="big" style={{ animation: "spin 0.5s linear infinite" }}>🏮</div> : <div className="big">{team.emoji}</div>}
        {!spin && <>
          <h2>You're in {team.name}!</h2>
          <p>{me.role === "local" ? "You're a local buddy: help your team pronounce like a Vietnamese!" : "Find your teammates and your Vietnamese buddy 👋"}</p>
          <p className="small" style={{ opacity: 0.7, marginTop: 28 }}>Tap to continue</p>
        </>}
      </div>
    </div>
  );
}
