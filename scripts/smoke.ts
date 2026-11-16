// End-to-end smoke test against a running server (local or production).
// Usage: BASE=http://localhost:8080 HOST_PIN=2468 npx tsx scripts/smoke.ts [--no-reset]
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:8080";
const PIN = process.env.HOST_PIN || "2468";
let failures = 0;
const ok = (cond: unknown, msg: string, extra?: unknown) => { console.log(`${cond ? "✅" : "❌"} ${msg}`, extra !== undefined ? JSON.stringify(extra).slice(0, 260) : ""); if (!cond) failures++; };

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const t = Date.now();
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j: j as Record<string, any>, ms: Date.now() - t };
}
const host = (path: string, body: unknown = {}) => post("/api/host" + path, body, { "x-host-pin": PIN });

const token = execSync("gcloud auth print-access-token", { shell: process.platform === "win32" ? "powershell.exe" : "/bin/sh" }).toString().trim();
async function wav(text: string): Promise<string> {
  const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", { method: "POST",
    headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": "eduflow-94827", "Content-Type": "application/json" },
    body: JSON.stringify({ input: { text }, voice: { languageCode: "vi-VN", name: "vi-VN-Neural2-D" }, audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 16000 } }) });
  return ((await r.json()) as { audioContent: string }).audioContent;
}

const health = await fetch(BASE + "/api/health").then((r) => r.json());
ok(health.ok, "health", health);

const pid = "smoke-" + Date.now();
const j = await post("/api/join", { id: pid, name: "Smokey", avatar: "🐨", role: "visitor" });
ok(j.status === 200 && j.j.me?.team, "join assigns a team", j.j.me?.team);
const local = await post("/api/join", { id: pid + "-vn", name: "Linh", avatar: "🌸", role: "local" });
ok(local.j.me?.team && local.j.me.team !== j.j.me.team, "local buddy balanced onto another team", local.j.me?.team);

// SSE
const ctrl = new AbortController();
const sse = await fetch(`${BASE}/api/stream?pid=${pid}`, { signal: ctrl.signal });
const reader = sse.body!.getReader();
let buf = "";
const complete = () => buf.includes("data: ") && buf.slice(buf.indexOf("data: ")).includes(String.fromCharCode(10, 10));
while (!complete()) buf += new TextDecoder().decode((await reader.read()).value);
ctrl.abort();
const first = JSON.parse(buf.split("data: ")[1].split("\n")[0]);
ok(first.me?.id === pid, "SSE stream delivers personal state", { lanterns: first.lanterns, goal: first.goal });

ok((await post("/api/tone", { pid, correct: true, streak: 1 })).j.ok, "tone event");
ok((await post("/api/tone/done", { pid, score: 8 })).j.ok, "tone game done");

const n = await post("/api/ai/name", { pid, about: "ocean lover, music" });
ok(n.j.vnName, `AI name (${n.ms}ms)`, n.j);

for (const [say, label] of [["Cảm ơn", "correct"], ["Cam ơn", "flat tone"]] as const) {
  const p = await post("/api/ai/pronounce", { pid, phraseId: "camon", wav: await wav(say) });
  ok(typeof p.j.score === "number", `pronounce ${label} → score ${p.j.score} (${p.ms}ms)`, { heard: p.j.heard, tip: p.j.tip });
}
const p2 = await post("/api/ai/pronounce", { pid, phraseId: "baonhieu", wav: await wav("Bao nhiêu tiền?") });
ok(p2.j.score >= 80, `pronounce "Bao nhiêu tiền?" → ${p2.j.score} (${p2.ms}ms)`, p2.j.heard);

// honesty checks: a beep must not score, English must not be "heard" as Vietnamese
const sr = 16000, n0 = sr * 2, beep = Buffer.alloc(44 + n0 * 2);
beep.write("RIFF", 0); beep.writeUInt32LE(36 + n0 * 2, 4); beep.write("WAVEfmt ", 8); beep.writeUInt32LE(16, 16); beep.writeUInt16LE(1, 20); beep.writeUInt16LE(1, 22);
beep.writeUInt32LE(sr, 24); beep.writeUInt32LE(sr * 2, 28); beep.writeUInt16LE(2, 32); beep.writeUInt16LE(16, 34); beep.write("data", 36); beep.writeUInt32LE(n0 * 2, 40);
for (let i = 0; i < n0; i++) beep.writeInt16LE((i / sr) % 1 < 0.25 ? Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 16000) : 0, 44 + i * 2); // pulsed, like a fake mic
const pb = await post("/api/ai/pronounce", { pid, phraseId: "camon", wav: beep.toString("base64") });
ok(pb.j.noSpeech && pb.j.score === 0, "beep is rejected as no speech (no AI hallucination)", pb.j.tip);
const en = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", { method: "POST", headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": "eduflow-94827", "Content-Type": "application/json" },
  body: JSON.stringify({ input: { text: "thank you" }, voice: { languageCode: "en-US", name: "en-US-Neural2-F" }, audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 16000 } }) }).then((r) => r.json()) as { audioContent: string };
const pe = await post("/api/ai/pronounce", { pid, phraseId: "camon", wav: en.audioContent });
ok(pe.j.score < 50, `English "thank you" for "Cảm ơn" scores low → ${pe.j.score}`, { heard: pe.j.heard, tip: pe.j.tip });

const img = readdirSync("scripts").find((f) => f.endsWith(".jpg"));
if (img) {
  const s = await post("/api/ai/snap", { pid, image: readFileSync("scripts/" + img).toString("base64") });
  ok(s.j.vi, `snap (${s.ms}ms)`, s.j);
}

const g = await post("/api/ai/guide", { pid, history: [{ role: "user", text: "What should I eat first in Vietnam?" }] });
ok(g.j.answer && g.j.try_vi, `guide (${g.ms}ms)`, g.j);

const m0 = await post("/api/market/start", { pid, itemId: "nonla" });
ok(m0.j.price === 250, "market start");
const m1 = await post("/api/market/say", { pid, text: "Đắt quá! Bớt đi chị ơi!" });
ok(m1.j.vendor_vi && m1.j.price <= 250 && m1.j.price >= 110, `market haggle (${m1.ms}ms) → ${m1.j.price}k`, m1.j.vendor_vi);
const m2 = await post("/api/market/say", { pid, text: `Được, ${m1.j.price} nghìn. Em mua!` });
ok(m2.j.vendor_vi, `market accept → deal=${m2.j.deal} ${m2.j.price}k ${m2.j.discount ?? ""}%`, m2.j.vendor_vi);

const w = await post("/api/ai/wish", { pid, en: "Thank you to my Vietnamese buddies!" });
ok(w.j.safe && w.j.vi, `wish translate (${w.ms}ms)`, w.j);
ok((await post("/api/wish", { pid })).j.ok, "wish posted");
const bad = await post("/api/ai/wish", { pid, en: "you are all stupid idiots and I hate you" });
ok(bad.j.safe === false, "unkind wish rejected", bad.j);

const v = await post("/api/voice", { pid: pid + "-vn", phraseId: "camon", wav: await wav("Cảm ơn") });
ok(v.j.ok, "buddy voice uploaded");
const vr = await fetch(`${BASE}/api/voice/${v.j.id}`);
ok(vr.ok && vr.headers.get("content-type") === "audio/wav", "buddy voice playable");

const tts = await fetch(`${BASE}/api/tts?t=${encodeURIComponent("Xin chào các bạn")}`);
ok(tts.ok && tts.headers.get("content-type") === "audio/mpeg", "dynamic TTS");
const stat = await fetch(`${BASE}/audio/` + Object.values(JSON.parse(readFileSync("shared/audioManifest.json", "utf8")))[0]);
ok(stat.ok, "static audio served");

// quiz flow
ok((await host("/check")).status === 200, "host pin ok");
ok((await post("/api/host/check", {}, { "x-host-pin": "nope" })).status === 401, "wrong pin rejected");
await host("/quiz", { action: "select", index: 0 });
await host("/quiz", { action: "open", index: 0 });
ok((await post("/api/quiz/answer", { pid, index: 0, choice: 0 })).j.ok, "quiz answer accepted");
ok(!(await post("/api/quiz/answer", { pid, index: 0, choice: 1 })).j.ok, "double answer rejected");
await host("/quiz", { action: "reveal" });
const st = await fetch(`${BASE}/api/state?pid=${pid}`).then((r) => r.json());
ok(st.quiz.status === "reveal" && st.myQuiz?.correct === true && st.myQuiz.points >= 50, "quiz reveal scores correctly", st.myQuiz);
const hs = await fetch(`${BASE}/api/state?host=${PIN}`).then((r) => r.json());
ok(hs.participants?.length >= 2 && hs.feed.length > 0 && hs.awards.length > 0, "host state has participants, feed, awards", { totals: hs.totals, words: hs.words.slice(0, 6) });
const csv = await fetch(`${BASE}/api/host/export?format=csv&pin=${PIN}`).then((r) => r.text());
ok(csv.includes("Smokey"), "CSV export");
await host("/phase", { phase: "lobby" });
if (!process.argv.includes("--no-reset")) { await host("/reset", { clearVoices: true }); console.log("(event reset)"); }
console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL GOOD");
process.exit(failures ? 1 : 0);
