import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { teamById, type ActivityId } from "../../shared/content";
import type { Participant, Profile, PublicState } from "../../shared/types";
import { loadProfile, post, saveProfile, setPid, setRejoinHandler } from "../lib/api";
import { useLive } from "../lib/live";
import { linkManifestToProfile } from "../lib/install";
import { sfx, unlockAudio } from "../lib/sound";
import { Join, TeamReveal } from "./Join";
import { Home } from "./Home";
import { QuizPad } from "./QuizPad";
import { Passport } from "./Passport";
import { NameAct } from "./NameAct";
import { Tones } from "./Tones";
import { SayIt } from "./SayIt";
import { Snap } from "./Snap";
import { Market } from "./Market";
import { Guide } from "./Guide";
import { WishAct } from "./Wish";

export type Screen = "home" | "passport" | ActivityId;
interface Ctx { state: PublicState | null; me: Participant | null; go: (s: Screen) => void; toast: (t: string) => void; refreshMe: (p: Participant) => void }
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function PhoneApp() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [ready, setReady] = useState(false);
  const [reveal, setReveal] = useState<Participant | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [toastMsg, setToastMsg] = useState("");
  const [localMe, setLocalMe] = useState<Participant | null>(null);
  const { state, connected } = useLive<PublicState>(`pid=${profile?.id ?? ""}`, ready && !!profile);
  const me = state?.me ?? localMe;
  const rejoining = useRef(false);

  const toast = useCallback((t: string) => { setToastMsg(t); setTimeout(() => setToastMsg(""), 2600); }, []);

  const join = useCallback(async (p: Profile) => {
    setPid(p.id);
    const r = await post<{ me: Participant }>("/api/join", { ...p }, false);
    setLocalMe(r.me);
    return r.me;
  }, []);

  // restore a returning phone silently
  useEffect(() => {
    linkManifestToProfile(profile);
    if (!profile) return;
    setPid(profile.id);
    setRejoinHandler(async () => { await join(profile); });
    join(profile).catch(() => undefined).finally(() => setReady(true));
  }, [profile, join]);

  // server reset or lost us → re-register silently with the same profile
  useEffect(() => {
    if (!profile || !state || state.me !== null || rejoining.current) return;
    rejoining.current = true;
    join(profile).catch(() => undefined).finally(() => { setTimeout(() => { rejoining.current = false; }, 3000); });
  }, [state, profile, join]);

  // celebrate points
  const lastPts = useRef<number | null>(null);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (!me) return;
    if (lastPts.current !== null && me.points > lastPts.current) setBump((b) => b + 1);
    lastPts.current = me.points;
  }, [me?.points]); // eslint-disable-line react-hooks/exhaustive-deps

  // unlock audio on first touch (iOS)
  useEffect(() => {
    const f = () => { unlockAudio(); window.removeEventListener("pointerdown", f); };
    window.addEventListener("pointerdown", f);
    return () => window.removeEventListener("pointerdown", f);
  }, []);

  const go = useCallback((s: Screen) => { setScreen(s); window.scrollTo({ top: 0 }); }, []);

  if (!profile) {
    return (
      <div className="phone">
        <Join onJoin={async (p) => {
          saveProfile(p); setPid(p.id);
          const m = await join(p);
          setReveal(m); sfx.join();
          setProfile(p);
        }} />
      </div>
    );
  }
  if (reveal) return <TeamReveal me={reveal} onDone={() => setReveal(null)} />;

  const ctx: Ctx = { state, me, go, toast, refreshMe: setLocalMe };
  const showQuiz = state?.phase === "quiz" && state.quiz.status !== "idle" && !!me;
  const showPassport = state?.phase === "awards" && screen !== "passport";

  return (
    <C.Provider value={ctx}>
      <div className="phone" data-bump={bump}>
        {ready && !connected && state && <div className="offline">Reconnecting… your progress is safe 🙏</div>}
        {screen === "home" && <Home bump={bump} />}
        {screen === "passport" && <Passport onBack={() => go("home")} />}
        {screen === "name" && <NameAct />}
        {screen === "tones" && <Tones />}
        {screen === "say" && <SayIt />}
        {screen === "snap" && <Snap />}
        {screen === "market" && <Market />}
        {screen === "guide" && <Guide />}
        {screen === "wish" && <WishAct />}
        {showQuiz && <QuizPad />}
        {showPassport && !showQuiz && <AwardsPrompt onOpen={() => go("passport")} team={teamById(me?.team ?? "pho").emoji} />}
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </div>
    </C.Provider>
  );
}

function AwardsPrompt({ onOpen, team }: { onOpen: () => void; team: string }) {
  return (
    <div style={{ position: "fixed", left: 12, right: 12, bottom: 70, zIndex: 40, maxWidth: 496, margin: "0 auto" }}>
      <div className="banner"><span style={{ fontSize: 34 }}>🏆</span><div style={{ flex: 1 }}><b>Awards time! {team}</b><span className="small">Open your Passport card</span></div>
        <button className="btn sm" onClick={onOpen}>Open</button></div>
    </div>
  );
}
