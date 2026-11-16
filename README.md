# Chào Việt Nam! · AI Culture & Language Lab

A 2-hour live workshop app: students scan a QR code and learn Vietnamese tones, phrases and
culture with AI on their phones, while the projector shows the whole community lighting
lanterns over Hội An in real time. Full design and facilitator run-sheet: [`plan.md`](plan.md).

- **Students:** `https://culture.eduflow.vn` (no login)
- **Facilitator / projector:** `https://culture.eduflow.vn/host` (PIN = Cloud Run env `HOST_PIN`)

## Facilitator quick guide
| Key / button | Action |
|---|---|
| `1`–`5` | Lobby · Dashboard · Quiz · Wall · Awards |
| `Space` / `→` (Quiz) | Start question → Reveal → next question |
| `F` | Fullscreen · `H` hide the control bar |
| 🔦 Spotlight | Push every phone to an activity |
| ⚙︎ | Export CSV/JSON, hide a name or wish, **Reset event** |

Before the session: open `/host`, ⚙︎ → **Reset event**, stay on Lobby. After: ⚙︎ → **CSV**.

### Host PIN
The `/host` page asks for a PIN, which the server reads from the Cloud Run env var `HOST_PIN`
(if it's unset, the default is `2468`, so always set it in production). The browser remembers
the PIN after the first successful entry.

```bash
# see the current PIN
gcloud run services describe culture --project eduflow-94827 --region asia-southeast1 \
  --format="value(spec.template.spec.containers[0].env)"
# change it (new revision in ~20 s; keeps every other setting; live state survives via Firestore)
gcloud run services update culture --project eduflow-94827 --region asia-southeast1 \
  --update-env-vars HOST_PIN=<new-pin>
```
Use 6+ digits. Change it between events, not during a session (the projector would need to re-enter it).

## Install as an app (phones)
Students see a **Get the app** card on Home (plus a **📲 Install as an app** button on Home and Join):
- **Android / Chrome / Edge:** one tap opens the native install dialog.
- **iPhone / iPad:** Apple offers no install API, so a sheet shows Share → *Add to Home Screen*.
  iOS gives home-screen apps separate storage, so the profile is carried in the start URL
  (`/?r=…`) and the installed app opens already signed in, with the same points and team.
- **In-app browsers** (Instagram, Facebook, Zalo…): asks the student to open the page in Safari/Chrome first.

Logo / icons: `public/icons/` (regenerate with `npx tsx scripts/gen-icons.ts`), manifest served
by `/api/manifest.webmanifest`, service worker `public/sw.js` (never caches `/api` or live data).

## Develop
```bash
npm install
npm run audio          # pre-generate lesson audio (Cloud TTS Chirp3-HD, uses your gcloud login)
GEMINI_API_KEY=... CULTURE_PERSIST=off npm run dev     # client :5173, API :8080
npm test               # 120 unit/API tests: store, quiz, every route (AI mocked), scoring, VAD, install
npm run build && node dist-server/index.js
BASE=http://localhost:8080 HOST_PIN=... npm run smoke  # live end-to-end test incl. real AI
BASE=http://localhost:8080 HOST_PIN=... npm run load   # 60 simulated phones
BASE=http://localhost:8080 HOST_PIN=... npx tsx scripts/ui.ts   # browser walkthrough + screenshots
```

## Deploy (Cloud Run, `eduflow-94827`, `asia-southeast1`)
```bash
# redeploy code only (keeps env vars, secrets, scaling):
gcloud run deploy culture --source . --project eduflow-94827 --region asia-southeast1 --quiet
# first-time deploy with full config:
gcloud run deploy culture --source . --project eduflow-94827 --region asia-southeast1 \
  --allow-unauthenticated --min-instances 1 --max-instances 1 --concurrency 500 \
  --cpu 1 --memory 1Gi --no-cpu-throttling --timeout 3600 \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:1 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=eduflow-94827,HOST_PIN=<pin>,CULTURE_EVENT_DOC=main
```
DNS at Mat Bao: `culture  CNAME  ghs.googlehosted.com.`

## Architecture in one breath
One always-warm Cloud Run instance holds live state in memory, streams it to phones and the
projector over Server-Sent Events (with polling fallback), and snapshots it to Firestore every
3 s. Gemini (`gemini-flash-latest`, LOW thinking, fallback `gemini-flash-lite-latest`) powers
names, speech feedback, camera, role-play, the culture guide and translations, each with a
timeout and an offline fallback. Lesson audio is pre-generated static MP3, and sound effects are
synthesised in the browser.
