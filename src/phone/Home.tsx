import { ACTIVITIES, teamById } from "../../shared/content";
import { sfx } from "../lib/sound";
import { MuteButton, VnFlag } from "../ui";
import { useApp } from "./PhoneApp";
import { InstallBanner, InstallButton } from "./Install";

export function Home({ bump }: { bump: number }) {
  const { state, me, go } = useApp();
  if (!me) return <div className="screen"><div className="thinking"><div className="spinner dark" /> Connecting…</div></div>;
  const team = teamById(me.team);
  const pct = state ? Math.min(100, (state.lanterns / state.goal) * 100) : 0;
  const spot = state?.spotlight && state.serverTime - state.spotlight.at < 10 * 60_000 ? state.spotlight : null;
  const spotAct = spot ? ACTIVITIES.find((a) => a.id === spot.activity) : null;
  const myTeam = state?.teams.find((t) => t.id === me.team);
  const teamRank = state ? [...state.teams].sort((a, b) => b.points - a.points).findIndex((t) => t.id === me.team) + 1 : 0;
  const local = me.role === "local";

  return (
    <div className="screen stack">
      <div className="hello">
        <div className="ava">{me.avatar}</div>
        <div className="who">
          <span className="small muted" style={{ fontWeight: 600 }}>Xin chào{me.vnName ? "," : ""}</span>
          <b>{me.vnName ? `${me.vnName}` : me.name}{me.vnName && <span className="small muted" style={{ fontWeight: 600 }}> · {me.name}</span>}</b>
          <span className="chip" style={{ background: team.soft, color: team.color, marginTop: 4 }}>{team.emoji} {team.name}{teamRank ? ` · #${teamRank}` : ""}</span>
        </div>
        <div className="stack" style={{ gap: 8, alignItems: "flex-end" }}><button className="pts" key={bump} onClick={() => go("passport")} style={{ animation: bump ? "pop .45s" : undefined }}>✨ {me.points}</button><MuteButton className="icon-btn" /></div>
      </div>

      <InstallBanner />

      {spotAct && (
        <div className="banner">
          <span style={{ fontSize: 32 }}>{spotAct.emoji}</span>
          <div style={{ flex: 1 }}><b>Everyone, now:</b><span className="small">{spotAct.title}</span></div>
          <button className="btn sm" onClick={() => { sfx.tap(); go(spotAct.id); }}>Go!</button>
        </div>
      )}

      <div className="goal">
        <span className="mini-l">🏮</span>
        <div className="label" style={{ color: "rgba(255,255,255,.65)" }}>Community goal</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{state?.lanterns ?? 0} / {state?.goal ?? 300} lanterns over Hội An</div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="small" style={{ opacity: 0.75, marginTop: 8 }}>
          {state?.totals.participants ?? 0} {state?.totals.participants === 1 ? "learner" : "learners"} · {myTeam ? `${team.emoji} ${myTeam.points} team pts` : ""} · every action lights a lantern
        </div>
      </div>

      {local && (
        <button className="act wide" style={{ ["--c" as string]: "#C8102E" }} onClick={() => { sfx.tap(); go("say"); }}>
          <span className="em"><VnFlag size={34} /></span>
          <div><b>Buddy mission: Lend your voice</b><small>Record the survival phrases. Visitors will hear YOUR voice next to the AI's.</small></div>
          <span className="tag">Buddy</span>
        </button>
      )}

      <div className="acts">
        {ACTIVITIES.map((a, i) => {
          const done = me.stats.stamps.includes(a.id);
          const wide = i === ACTIVITIES.length - 1;
          return (
            <button key={a.id} className={`act${wide ? " wide" : ""}`} style={{ ["--c" as string]: a.color, animationDelay: `${i * 40}ms` }} onClick={() => { sfx.tap(); go(a.id); }}>
              <span className="tag">{a.ai}</span>
              <span className="em">{a.emoji}</span>
              <div><b>{a.title}</b><small>{a.sub}</small></div>
              {done && <span className="stamp">ĐÃ<br />XONG</span>}
            </button>
          );
        })}
      </div>
      <button className="btn ghost" onClick={() => go("passport")}>🛂 My Passport · {me.stats.stamps.length}/7 stamps</button>
      <InstallButton />
    </div>
  );
}
