export {};
// Load test: N simulated phones join, hold SSE streams, play the tone game and answer
// a live quiz; one host stream watches. Reports latency and missed updates.
// Usage: BASE=http://localhost:8080 N=60 npx tsx scripts/load.ts
const BASE = process.env.BASE || "http://localhost:8080";
const PIN = process.env.HOST_PIN || "2468";
const N = Number(process.env.N || 60);
const post = async (p: string, b: unknown, h: Record<string, string> = {}) => {
  const t = performance.now();
  const r = await fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify(b) });
  await r.text();
  return { ok: r.ok, ms: performance.now() - t };
};
const lat: number[] = [];
const ctrls: AbortController[] = [];
const msgs = new Map<string, number>();

async function stream(q: string, key: string) {
  const c = new AbortController(); ctrls.push(c);
  const r = await fetch(`${BASE}/api/stream?${q}`, { signal: c.signal });
  const rd = r.body!.getReader();
  (async () => { try { for (;;) { const { value, done } = await rd.read(); if (done) break; const s = new TextDecoder().decode(value); msgs.set(key, (msgs.get(key) ?? 0) + (s.match(/data:/g)?.length ?? 0)); } } catch { /* aborted */ } })();
}

const t0 = performance.now();
await stream(`host=${PIN}`, "host");
const ids = Array.from({ length: N }, (_, i) => `load-${Date.now()}-${i}`);
await Promise.all(ids.map(async (id, i) => {
  const r = await post("/api/join", { id, name: `Student${i}`, avatar: "🐨", role: i % 6 === 0 ? "local" : "visitor" });
  lat.push(r.ms);
  await stream(`pid=${id}`, id);
}));
console.log(`joined ${N} + streams in ${(performance.now() - t0).toFixed(0)}ms`);

// everybody plays 10 tone rounds concurrently
await Promise.all(ids.map(async (id) => { for (let k = 0; k < 10; k++) { const r = await post("/api/tone", { pid: id, correct: Math.random() > 0.3, streak: k }); lat.push(r.ms); } }));
// a quiz question
await post("/api/host/quiz", { action: "select", index: 0 }, { "x-host-pin": PIN });
await post("/api/host/quiz", { action: "open", index: 0 }, { "x-host-pin": PIN });
await Promise.all(ids.map(async (id) => { const r = await post("/api/quiz/answer", { pid: id, index: 0, choice: Math.floor(Math.random() * 4) }); lat.push(r.ms); }));
await new Promise((r) => setTimeout(r, 1500));
const st = await fetch(`${BASE}/api/state?host=${PIN}`).then((r) => r.json());
lat.sort((a, b) => a - b);
const p = (q: number) => lat[Math.floor(q * (lat.length - 1))].toFixed(0);
const phoneMsgs = ids.map((id) => msgs.get(id) ?? 0);
console.log(`requests: ${lat.length}  p50 ${p(0.5)}ms  p95 ${p(0.95)}ms  max ${p(1)}ms`);
console.log(`SSE messages: host ${msgs.get("host")}, phones min ${Math.min(...phoneMsgs)} / max ${Math.max(...phoneMsgs)}`);
console.log(`quiz auto-revealed when all answered: ${st.quiz.status === "reveal"}  answers=${st.quiz.counts?.reduce((a: number, b: number) => a + b, 0)}  participants=${st.totals.participants}  lanterns=${st.lanterns}`);
const okAll = st.quiz.status === "reveal" && Math.min(...phoneMsgs) > 2 && Number(p(0.95)) < 500;
ctrls.forEach((c) => c.abort());
await post("/api/host/reset", { clearVoices: false }, { "x-host-pin": PIN });
console.log(okAll ? "LOAD OK" : "LOAD PROBLEM");
process.exit(okAll ? 0 : 1);
