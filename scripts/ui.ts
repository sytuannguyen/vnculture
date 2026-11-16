// Browser walkthrough with screenshots: projector (1920x1080) + two phones (390x844).
// Usage: BASE=http://localhost:8080 OUT=<dir> npx tsx scripts/ui.ts
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:8080";
const PIN = process.env.HOST_PIN || "2468";
const OUT = process.env.OUT || "scripts/.cache/shots";
mkdirSync(OUT, { recursive: true });
const errors: string[] = [];

const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const watch = (p: Page, who: string) => {
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(`${who}: ${m.text()}`); });
  p.on("pageerror", (e) => errors.push(`${who} PAGEERROR: ${e.message}`));
};
const shot = (p: Page, name: string) => p.screenshot({ path: `${OUT}/${name}.png` });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const hostCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const host = await hostCtx.newPage(); watch(host, "host");
await host.goto(BASE + "/host");
await host.fill("input", PIN); await host.click("text=Open the stage");
await host.waitForSelector(".stage", { timeout: 10000 });
const hostApi = (path: string, body: unknown) => host.evaluate(async ([p, b, pin]) => { await fetch(p as string, { method: "POST", headers: { "Content-Type": "application/json", "x-host-pin": pin as string }, body: JSON.stringify(b) }); }, [path, body, PIN]);
await hostApi("/api/host/reset", { clearVoices: true });
await hostApi("/api/host/phase", { phase: "lobby" });
await wait(800);

const phoneCtx = (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ["microphone"] }));
const a = await phoneCtx.newPage(); watch(a, "phoneA");
await a.goto(BASE + "/");
await shot(a, "01-join");
await a.fill("input.input", "Emma");
await a.click("text=Let's go");
await wait(1700); await shot(a, "02-team-reveal");
await a.waitForSelector(".acts", { timeout: 10000 });
await wait(600); await shot(a, "03-home");

const bCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ["microphone"] });
const b = await bCtx.newPage(); watch(b, "phoneB");
await b.goto(BASE + "/"); await b.fill("input.input", "Linh"); await b.click("text=Local buddy"); await b.click("text=Let's go");
await b.waitForSelector(".acts", { timeout: 10000 });
await shot(b, "04-home-local");
await wait(1000); await shot(host, "05-host-lobby");

// Name
await a.click("text=My Vietnamese Name"); await a.click("text=🏄 ocean lover"); await a.click("text=🎵 music");
await a.click("text=Create my name"); await a.waitForSelector(".word-card", { timeout: 30000 }); await wait(800);
await shot(a, "06-name");
await a.click("text=Done ✓");

// Tones
await a.click("text=The Six Tones"); await wait(500); await shot(a, "07-tones-learn");
await a.click("text=Tone Ear Game"); await wait(300);
for (let k = 0; k < 3; k++) { await a.click(".big-play"); await wait(700); await a.click(".choice >> nth=0"); await wait(1900); }
await shot(a, "08-tones-game");
await a.click(".back");

// Say it (fake mic → beep)
await a.click("text=Say it! AI Coach"); await wait(300); await shot(a, "09-say-list");
await a.click("text=Cảm ơn"); await wait(300);
await a.click(".mic"); await wait(2200); await a.click(".mic");
await a.waitForSelector(".card .score-ring, .err, .syls", { timeout: 30000 }).catch(() => undefined); await wait(1200);
await shot(a, "10-say-result");
await a.click(".back"); await a.click(".back");

// Local buddy lends voice
await b.click("text=Buddy mission"); await wait(300); await b.click("text=Xin chào"); await b.click(".mic"); await wait(1800); await b.click(".mic");
await wait(2500); await shot(b, "11-buddy-voice");

// Guide
await a.click("text=Ask Cô Lan"); await a.click("text=What should I eat first"); await a.waitForSelector(".try-box", { timeout: 30000 }); await wait(500);
await shot(a, "12-guide"); await a.click(".back");

// Market
await a.click("text=Bargain at Bến Thành"); await wait(300); await shot(a, "13-market-pick");
await a.click("text=nón lá"); await a.waitForSelector(".sug", { timeout: 15000 });
await a.click(".sug >> nth=0"); await wait(500); await a.waitForSelector(".sug", { timeout: 30000 }); await wait(500);
await shot(a, "14-market-chat"); await a.click(".back"); await a.click(".back");

// Snap
await a.click("text=Snap & Learn");
await a.setInputFiles("input[type=file] >> nth=1", "scripts/test-photo.jpg");
await a.waitForSelector(".word-card, .err", { timeout: 30000 }); await wait(800);
await shot(a, "15-snap"); await a.click(".back");

// Wish
await a.click("text=Lantern Wish"); await a.fill("textarea", "I hope to visit Hội An with my new friends");
await a.click("text=✨ Translate"); await a.waitForSelector("text=Release my lantern", { timeout: 30000 }); await shot(a, "16-wish-preview");
await a.click("text=Release my lantern"); await wait(800); await a.click("text=Back home");

// Dashboard
await hostApi("/api/host/phase", { phase: "dashboard" }); await wait(3500); await shot(host, "17-host-dashboard");
await hostApi("/api/host/spotlight", { activity: "tones" }); await wait(800); await shot(a, "18-home-spotlight");
await hostApi("/api/host/spotlight", { activity: null });

// Quiz
await hostApi("/api/host/quiz", { action: "select", index: 8 }); await wait(700); await shot(host, "19-host-quiz-idle");
await hostApi("/api/host/quiz", { action: "open", index: 8 }); await wait(1200);
await shot(host, "20-host-quiz-open"); await shot(a, "21-phone-quiz");
await a.click(".qopt >> nth=1"); await wait(500); await shot(a, "22-phone-locked");
await b.click(".qopt >> nth=0"); await wait(1500);
await shot(host, "23-host-quiz-reveal"); await shot(a, "24-phone-reveal"); await shot(b, "25-phoneB-reveal");

// Wall + awards
await hostApi("/api/host/phase", { phase: "wall" }); await wait(2500); await shot(host, "26-host-wall");
await hostApi("/api/host/phase", { phase: "awards" }); await wait(3000); await shot(host, "27-host-awards");
await shot(a, "28-phone-awards-prompt");
await a.click("text=Open"); await wait(600); await shot(a, "29-passport");

// resilience: phone reload keeps identity
await a.reload(); await a.waitForSelector(".acts, .banner", { timeout: 10000 }); await shot(a, "30-after-reload");
const still = await a.textContent(".hello");
console.log("identity after reload:", still?.includes("Emma") ? "kept" : "LOST", "|", still?.slice(0, 80));
await hostApi("/api/host/phase", { phase: "lobby" });
await hostApi("/api/host/reset", { clearVoices: true });
await browser.close();
console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "no console errors");
console.log("screenshots in", OUT);
