import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { loadProfile } from "../lib/api";
import { encodeRestore, promptInstall, useInstall, type InstallKind } from "../lib/install";
import { sfx } from "../lib/sound";

const DISMISS_KEY = "culture.install.dismissed";
const isDismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } };

/** Shared logic: tap → native dialog (Android/desktop) or the instruction sheet (iOS, other). */
function useInstallAction() {
  const { kind, justInstalled } = useInstall();
  const [sheet, setSheet] = useState(false);
  const start = async () => {
    sfx.tap();
    if (kind === "prompt") { const r = await promptInstall(); if (r === "unavailable") setSheet(true); return; }
    setSheet(true);
  };
  return { kind, justInstalled, start, sheet: sheet ? <InstallSheet kind={kind} onClose={() => setSheet(false)} /> : null };
}

const offer = (k: InstallKind) => k !== "installed" && k !== "none";

/** Prominent, dismissible card for the Home screen. */
export function InstallBanner() {
  const { kind, justInstalled, start, sheet } = useInstallAction();
  const [hidden, setHidden] = useState(isDismissed);
  if (justInstalled) return <div className="install-card done">🎉 <b>Installed!</b> Open <b>Chào VN</b> from your home screen.</div>;
  if (!offer(kind) || hidden) return sheet;
  return (
    <>
      <div className="install-card" role="region" aria-label="Install app">
        <img src="/icons/icon-192.png" alt="" width={48} height={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>Get the app</b>
          <span className="small">Full screen, one tap from your home screen</span>
        </div>
        <button className="btn sm" onClick={start}>Install</button>
        <button className="install-x" aria-label="Not now" onClick={() => { try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* */ } setHidden(true); }}>✕</button>
      </div>
      {sheet}
    </>
  );
}

/** Small always-available button (Home footer, Join screen). */
export function InstallButton({ className = "btn ghost" }: { className?: string }) {
  const { kind, start, sheet } = useInstallAction();
  if (!offer(kind)) return sheet;
  return <><button className={className} onClick={start}>📲 Install as an app</button>{sheet}</>;
}

const ShareIcon = () => (
  <svg className="step-ico" viewBox="0 0 24 24" aria-label="Share icon"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="#2F6FDB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="#2F6FDB" strokeWidth="2" strokeLinecap="round" /></svg>
);
const AddIcon = () => (
  <svg className="step-ico" viewBox="0 0 24 24" aria-label="Add icon"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="#1C1842" strokeWidth="2" /><path d="M12 8v8M8 12h8" stroke="#1C1842" strokeWidth="2" strokeLinecap="round" /></svg>
);

export function InstallSheet({ kind, onClose }: { kind: InstallKind; onClose: () => void }) {
  // iOS uses the current page URL (or the manifest start_url) for the home-screen icon:
  // carry the profile in both so the installed app opens already signed in.
  useEffect(() => {
    if (kind !== "ios") return;
    const p = loadProfile();
    if (!p) return;
    const before = location.pathname + location.search + location.hash;
    history.replaceState(history.state, "", `/?r=${encodeRestore(p)}`);
    return () => history.replaceState(history.state, "", before);
  }, [kind]);

  const steps: { ico: ReactNode; text: ReactNode }[] =
    kind === "ios" ? [
      { ico: <ShareIcon />, text: <>Tap the <b>Share</b> button in Safari's toolbar (on newer iPhones tap <b>⋯</b> first, then <b>Share</b>)</> },
      { ico: <AddIcon />, text: <>Scroll down and tap <b>Add to Home Screen</b></> },
      { ico: <span className="step-ico em">✅</span>, text: <>Tap <b>Add</b>, then open <b>Chào VN</b> from your home screen</> },
    ] : kind === "inapp" ? [
      { ico: <span className="step-ico em">⋯</span>, text: <>This page is open inside another app. Tap its <b>⋯</b> or <b>⋮</b> menu</> },
      { ico: <span className="step-ico em">🧭</span>, text: <>Choose <b>Open in Safari</b> / <b>Open in browser</b></> },
      { ico: <span className="step-ico em">📲</span>, text: <>Then tap <b>📲 Install</b> again there</> },
    ] : [
      { ico: <span className="step-ico em">⋮</span>, text: <>Tap the browser menu <b>⋮</b> (top right; in Samsung Internet it's <b>≡</b> at the bottom)</> },
      { ico: <AddIcon />, text: <>Tap <b>Install app</b> or <b>Add to Home screen</b></> },
      { ico: <span className="step-ico em">✅</span>, text: <>Confirm with <b>Install</b> / <b>Add</b>, then open <b>Chào VN</b> from your home screen</> },
    ];

  // portal: a transformed (animated) ancestor would otherwise trap position:fixed
  return createPortal(
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="How to install" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <img src="/icons/icon-192.png" alt="" width={56} height={56} />
          <div><b>Install Chào VN</b><span className="small muted">Works like a real app: full screen, no browser bars</span></div>
        </div>
        <ol className="steps">
          {steps.map((s, i) => <li key={i}><span className="num">{i + 1}</span>{s.ico}<span>{s.text}</span></li>)}
        </ol>
        <button className="btn" onClick={onClose}>Got it</button>
      </div>
      {kind === "ios" && <div className="share-hint" aria-hidden>⬇</div>}
    </div>,
    document.body,
  );
}
