import { ACTIVITIES, teamById } from "../../shared/content";
import { TopBar } from "../ui";
import { useApp } from "./PhoneApp";

export function Passport({ onBack }: { onBack: () => void }) {
  const { me, state } = useApp();
  if (!me) return null;
  const team = teamById(me.team);
  const s = me.stats;
  const ph = Object.values(s.phrases);
  const avg = ph.length ? Math.round(ph.reduce((a, b) => a + b, 0) / ph.length) : 0;
  return (
    <>
      <TopBar title="My Passport" sub="Hộ chiếu văn hoá · culture passport" onBack={onBack} />
      <div className="screen stack">
        <div className="passport">
          <div style={{ padding: "16px 18px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 11, letterSpacing: ".2em", opacity: 0.8 }}>CỘNG ĐỒNG HỌC TẬP · AI</div><div style={{ fontWeight: 800, fontSize: 20, color: "#FFD27A" }}>HỘ CHIẾU VĂN HOÁ</div></div>
            <span style={{ fontSize: 34 }}>🏮</span>
          </div>
          <div className="inner stack" style={{ gap: 12 }}>
            <div className="row">
              <div style={{ fontSize: 46, width: 70, height: 70, borderRadius: 18, background: team.soft, display: "grid", placeItems: "center" }}>{me.avatar}</div>
              <div style={{ flex: 1 }}>
                <div className="label">Name / Tên</div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>{me.name}</div>
                {me.vnName && <div className="vi" style={{ color: "var(--red)" }}>{me.vnName} <span className="small muted">· {me.vnMeaning}</span></div>}
              </div>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="chip" style={{ background: team.soft, color: team.color }}>{team.emoji} {team.name}</span>
              <span className="pts">✨ {me.points} · #{state?.myRank ?? "-"}</span>
            </div>
            <div className="label">Stamps · {s.stamps.length}/7</div>
            <div className="stamps">
              {ACTIVITIES.map((a) => <div key={a.id} className={s.stamps.includes(a.id) ? "on" : ""} title={a.title}>{a.emoji}</div>)}
              <div className={s.quizCorrect > 0 ? "on" : ""} title="Quiz">🧠</div>
            </div>
            <div className="statline">
              <div><b>{s.toneCorrect}</b><span>tones caught</span></div>
              <div><b>{ph.length ? `${avg}%` : "-"}</b><span>avg speaking</span></div>
              <div><b>{s.quizCorrect}</b><span>quiz correct</span></div>
              <div><b>{s.snaps}</b><span>snaps</span></div>
              <div><b>{s.bestDiscount}%</b><span>best bargain</span></div>
              <div><b>{s.questions}</b><span>questions</span></div>
            </div>
            {s.words.length > 0 && (
              <div>
                <div className="label">Words I learned today</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {s.words.slice(-18).map((w) => <span key={w} className="chip vi" style={{ background: "#FFF1DA" }}>{w}</span>)}
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: "4px 18px 14px", fontSize: 12, opacity: 0.85, textAlign: "center" }}>Chào Việt Nam! · AI Culture Lab · culture.eduflow.vn</div>
        </div>
        <div className="center small muted">📸 Screenshot your passport to keep it!</div>
      </div>
    </>
  );
}
