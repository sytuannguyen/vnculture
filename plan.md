# Chào Việt Nam! — AI Culture & Language Lab
### A 2-hour live workshop app · `https://culture.eduflow.vn`

> **One sentence:** students scan a QR code, type their first name, and within 15 seconds they are
> learning Vietnamese tones, phrases and culture with AI on their phone — while every word they
> speak, photo they snap and question they answer lights a lantern on the shared projector screen,
> so the whole room sees the community light up Hội An together.

---

## 1. Context & success criteria

| Item | Value |
|---|---|
| Audience | ~20 Australian students (English speakers, zero Vietnamese) + a few Vietnamese students |
| Duration | ~2 hours, one facilitator (you), one projector, students' own phones |
| Topic | How AI helps you learn a new **culture** and **language** — Vietnamese |
| Hard constraint | **Zero friction, zero technical failure.** No login, no install, no account, no app store |

The session succeeds when:
1. **100% of students join in < 1 minute** (scan → name → in).
2. Every student **hears, speaks and is coached** on Vietnamese tones by AI at least 5 times.
3. Students *experience* (not just hear about) 5 distinct ways AI helps learning: **personalisation**
   (Vietnamese name), **pronunciation feedback** (speech), **seeing the world in Vietnamese**
   (camera), **safe role-play practice** (market bargaining), **an always-available culture guide** (Q&A).
4. The room feels like a **community**: live shared statistics, team play, Vietnamese students as
   valued "local buddies", and a collective goal everyone contributes to.
5. Students also learn the **limits** of AI: the local buddies verify and correct the AI, live.

---

## 2. Design principles

1. **One tap per decision.** Big touch targets (≥ 56 px), one primary action per screen, no menus deeper than one level.
2. **Never block on AI.** Every AI feature has a timeout (≤ 20 s), one automatic retry on a lighter model, and a graceful **offline fallback** (curated content), so a slow API never makes a student wait for nothing.
3. **Core content works without AI.** All lesson audio (tones, phrases, quiz) is **pre-generated** with Google's natural Chirp3-HD Vietnamese voice and shipped as static files. If Gemini went down, the tones, phrases, quiz, lantern sky and leaderboards would keep working.
4. **No identity friction.** Each phone gets a random id stored in `localStorage`; the server re-creates the participant from that profile if it ever loses state. Refresh, close the tab or lose network: you come back exactly where you were.
5. **Projector-first community.** Everything students do turns into something on the big screen within ~1 second.
6. **Delight on every action.** Sound (synthesised đàn tranh-style pentatonic plucks), haptics, confetti and lantern animations, all generated in code, with no asset loading that could fail.

---

## 3. The experience

### 3.1 Joining (target: 15 seconds)
1. The projector shows a **giant QR code** + `culture.eduflow.vn` (Lobby screen).
2. The phone opens straight onto the **Join card**:
   - "Xin chào! 👋 What's your first name?" (one text field, auto-focus)
   - Pick an avatar (12 big emoji: 🐨 🦘 🐉 🐃 🦜 🐢 🐠 🦊 🐼 🐯 🦋 🐘)
   - "I am…" → **🦘 Visitor** / **Vietnamese-flag Local buddy** (two big toggle cards; the flag is an SVG because flag emojis don't render on Windows projector laptops)
   - **[Let's go →]**
3. **Team reveal** animation: a spinning lantern lands on your team. Teams are auto-balanced so
   every team gets both visitors and local buddies:
   - 🍜 **Team Phở** (lacquer red) · 🥖 **Team Bánh Mì** (golden) · 🌸 **Team Đào / Peach blossom** (pink, the northern Tết flower) · 🐉 **Team Rồng / Dragon** (jade)
4. The student's avatar **flies onto the projector** with a pluck sound.

### 3.2 The phone home screen: "My Passport"
- Header: avatar, name (later their Vietnamese name), team chip, personal ✨ points.
- **Community goal bar** (live): "🏮 214 / 500 lanterns lit over Hội An".
- **Six activity stamps** (cards with an illustration colour + emoji); completing an activity puts a
  stamp in the passport:

| # | Activity | AI showcase | What the student does |
|---|---|---|---|
| 1 | 🏷️ **My Vietnamese Name** | Personalisation | Types 2-3 words about themselves → AI creates a Vietnamese name + meaning + pronunciation, read aloud. Becomes their display name on screen. |
| 2 | 🎵 **The Six Tones** | Interactive drills | Tone explorer (ma/má/mà/mả/mã/mạ with hand-gesture tone curves and meanings) + **Tone Ear Game**: hear a syllable, tap the right tone (10 rounds, streaks). |
| 3 | 🎤 **Say it! AI Coach** | Speech feedback | 12 survival phrases. Listen (AI voice + **real local buddy voices**), record yourself, AI transcribes what it *heard*, colours each syllable (✅ right / 🟡 right sound, wrong tone / ❌) and gives one tip. |
| 4 | 📸 **Snap & Learn** | Computer vision | Photograph anything → its Vietnamese name, pronunciation, audio, an example sentence and a culture note. Words go into the room's live word cloud. |
| 5 | 🛍️ **Bargain at Bến Thành** | Role-play practice | Chat with Cô Hoa, an AI market vendor, to buy a conical hat (nón lá) or a coffee filter (phin). Tap suggested Vietnamese replies (with English) or type freely. Score = discount achieved. Team best price on the projector. |
| 6 | 🏮 **Ask Cô Lan** | Culture guide | Ask anything about Vietnam (food, Tết, family, history, etiquette). Short, friendly answers, each ending with a "Try saying:" Vietnamese phrase and audio. |
| + | 💌 **Lantern Wish Wall** | Translation | Write a wish / thank-you in English → AI translates to Vietnamese (with back-translation so you can check) → it floats as a lantern on the projector. |

- **Local buddy mode** (🇻🇳 students): the same activities plus a **"Lend your voice"** mission: record
  the survival phrases in their natural voice. Their recordings show up as "🇻🇳 Hear it from Linh"
  next to the AI voice for all visitors (human + AI, side by side). Buddies also get points when
  they help, and are the fact-checkers in the "AI or Local?" quiz round.

### 3.3 Live moments (host-driven, phones auto-switch)
- **Live Quiz**: when the host starts a question, every phone switches to a full-screen
  answer pad (4 big coloured buttons with shapes ▲ ◆ ● ■). Countdown, live answer count on the projector,
  then reveal: bar chart, correct answer, a fun fact, the fastest correct answerers, points.
  Question types: culture MCQ, **tone listening** (audio plays on the projector), "What does it mean?",
  **"AI or Local?"** (is this AI explanation right? buddies explain), and **polls** (reflection, no right answer).
- **Spotlight**: the host pushes everyone to an activity ("Everybody: Tone Ear Game, go!").
- **Wish Wall**: the projector shows lantern wishes floating up.
- **Awards**: final screen with community totals, team ranking and fun awards (🎤 Golden Voice,
  🎵 Tone Master, 📸 Explorer, 🛍️ Master Bargainer, 🏮 Most Curious, 🤝 Best Buddy). Each phone shows a
  personal **Passport card** (stamps, words learned, best scores) to screenshot.

### 3.4 Projector (host) screens
`/host` (PIN-protected); one control bar at the bottom, everything else is for the audience.

| Screen | Content |
|---|---|
| **Lobby** | Giant QR + URL, joined avatars bubbling in, team counts, "Xin chào [name]!" toasts |
| **Live Dashboard** | Animated **lantern sky over Hội An** (one lantern rises per action), community goal bar with milestones, team leaderboard bars, live tiles (people, phrases spoken, avg pronunciation score, tone accuracy, photos, AI chats, wishes), live feed ticker, word cloud of Vietnamese words learned |
| **Quiz** | Question, timer ring, live answered count, results chart, fun fact, speed podium |
| **Wish Wall** | Floating lanterns with Vietnamese wish + English original |
| **Awards** | Fireworks, team podium, individual awards, community totals |

Host controls: switch screen · start/reveal/next quiz question · spotlight activity · hide a
wish/name (moderation) · export results (JSON/CSV) · reset event (double confirm) · sound on/off.

---

## 4. Facilitator run-sheet (120 minutes)

| Time | Segment | Projector | Phones | Facilitation notes |
|---|---|---|---|---|
| 0:00 | **Welcome & join** | Lobby (QR) | Join → team reveal | "Scan, type your name, done." Buddies spread across teams. Point at avatars appearing. |
| 0:08 | **Icebreaker: Vietnamese name** | Dashboard | 🪪 Activity 1 | Each student says their new name to their team; buddies check pronunciation. *AI = personalisation.* |
| 0:18 | **The six tones** | Dashboard | 🎵 Activity 2 | Demo ma/má/mà/mả/mã/mạ with hand gestures, whole room repeats. Then Tone Ear Game; watch tone accuracy climb. |
| 0:30 | **Say it! with AI coach** | Dashboard | 🎤 Activity 3 | Visitors practise survival phrases; buddies "lend your voice" and coach. Ask: *"Did the AI hear what your buddy heard?"* |
| 0:45 | **Live Quiz, Round 1** (culture) | Quiz | Auto quiz pad | 6 questions, ~6 min. Celebrate the team leaderboard. |
| 0:52 | **Snap & Learn hunt** + break | Dashboard (word cloud) | 📸 Activity 4 | "Find and snap 5 things: something red, something you eat, something you write with…" |
| 1:05 | **Bargain at Bến Thành** | Dashboard (best prices) | 🛍️ Activity 5 | Pairs: visitor bargains, buddy advises. Best discount per team shown live. Culture: bargaining etiquette, smiling, "Đắt quá!" |
| 1:20 | **Ask Cô Lan** | Dashboard | 🏮 Activity 6 | Each team asks 3 questions; buddies rate the AI's answers: right, partly right, wrong? |
| 1:30 | **Live Quiz, Round 2** (language + tones + AI or Local?) | Quiz | Auto quiz pad | Tone listening questions with audio on the room speakers. |
| 1:40 | **Lantern Wish Wall** | Wish Wall | 💌 Wish | Each writes a wish or thank-you; buddies read some aloud in Vietnamese. |
| 1:48 | **Reflection polls** | Quiz (polls) | Poll pad | "How much did AI help you?", "AI's biggest limitation?", "Which activity helped most?" Discuss: AI is a tireless tutor, but culture lives in people. |
| 1:55 | **Awards & group photo** | Awards | Passport card | Fireworks at the community goal; photo in front of the lantern sky. |

Backup plan: every segment works independently. If AI is slow, switch to the tones / quiz /
local-voice segments (no AI dependency) and come back later.

---

## 5. Visual & sensory design

- **Palette ("Hội An at dusk")**
  - Silk cream `#FFF7EA` (phone background), Lacquer red `#C8102E`, Lantern gold `#F4B63F`,
    Jade `#1F9D8B`, Lotus pink `#EF7FA3`, Ink indigo `#1C1842` (text, host night sky `#120F2E → #2B1D4F`).
  - Team colours: Phở `#E0412F` · Bánh Mì `#E39A12` · Đào `#DD5B92` · Rồng `#13957E`.
- **Emoji safety**: only emoji that render on Windows 10 projector laptops and older phones (no 🪷 🪪 or flag emoji).
- **Typography**: *Be Vietnam Pro* (a Google Font designed for Vietnamese diacritics), 800 weight for display, 500 for body. Vietnamese words always render large with correct tone marks.
- **Motifs**: subtle lotus/wave pattern (CSS/SVG), lantern shapes, stamp-style badges with slight rotation, soft paper grain.
- **Motion**: spring-like transitions (CSS), lanterns rising with sway (canvas), confetti on success, card press scale 0.97.
- **Sound** (Web Audio, synthesised, no files): Karplus-Strong plucked string in the Vietnamese
  pentatonic scale (đàn tranh feel) for correct answers and streaks (pitch rises with the streak), a soft
  wooden "tok" (mõ) for taps, a gentle low tone for misses, a gong for host events, and a bright chord + firework
  crackle for milestones. Mute toggle on every screen; never auto-plays before a tap (iOS rule).
- **Haptics**: `navigator.vibrate` short pulses on Android.
- **Tone visualisation**: each tone drawn as a pitch curve (ngang flat, sắc rising, huyền falling,
  hỏi dip, ngã broken rise, nặng heavy drop) with colour per tone, used everywhere tones appear.

---

## 6. Architecture (built for zero failure)

```
Phones (React SPA) ──HTTPS──┐                      ┌── Gemini API (gemini-flash-latest, LOW thinking;
Projector /host ────────────┤   Cloud Run service   │    fallback gemini-flash-lite-latest)
  ▲   Server-Sent Events    ├──►  "culture"          ├── Cloud Text-to-Speech (vi-VN Chirp3-HD) for dynamic audio
  └─── (1 s live state) ────┘   Node + Express      └── Firestore (snapshot every 3 s → crash recovery)
                                 in-memory state
                                 min=max=1 instance
```

- **Single Cloud Run instance** (`min-instances=1`, `max-instances=1`, `--no-cpu-throttling`,
  concurrency 500, 1 vCPU / 1 GiB). One instance holds all live state in memory, so there are no cold starts
  and no distributed-state problems. 30 phones is a tiny load (verified by a 60-client load test).
- **Real-time** via **Server-Sent Events** (`/api/stream`), throttled snapshots ≤ 2/s. EventSource
  auto-reconnects; if no message arrives for 8 s, the client falls back to polling `/api/state` every 2 s.
- **Persistence**: state snapshot to Firestore (`culture_events/main`, `culture_voices/*`) every 3 s
  when dirty, loaded on boot. A restart loses ≤ 3 s of activity; clients re-register automatically.
- **Identity**: `localStorage` `{id, name, avatar, role}`; every request carries the id; unknown ids
  are re-created from the profile.
- **AI gateway** (server-side only; the key never reaches the browser):
  - `@google/genai`, `gemini-flash-latest` with `thinkingLevel: LOW`, JSON output with schema.
  - 20 s timeout → retry once on `gemini-flash-lite-latest` → curated fallback.
  - Per-participant rate limit (token bucket, 30 AI calls / 5 min) + global concurrency guard.
  - Input size caps (text ≤ 300 chars, image ≤ 1 MB after client resize to 768 px JPEG, audio ≤ 8 s 16 kHz mono WAV).
  - Safety: prompts instruct age-appropriate, respectful content; wish wall & names pass an AI safety flag + word filter; host can hide anything.
- **Pronunciation pipeline** (designed and tested to be *honest*):
  1. Browser records with MediaRecorder (any codec), decodes with WebAudio, re-encodes to **16 kHz mono WAV** (works identically on iOS Safari and Android Chrome), trims silence, normalises.
  2. **Deterministic speech gate on the server** (`shared/vad.ts`): rejects silence, steady tones, pulsed beeps, noise and clicks before any AI call. Found in testing: given a target phrase, Gemini will "hear" it in a beep, so non-speech must never reach it.
  3. Gemini gets the target plus strict examiner rules ("never autocorrect, write the tone you actually hear, write English if they spoke English"). Verified: English "thank you" → "Thank you" (score 0), a different phrase → that phrase, flat tones → unmarked syllables.
  4. The **server scores deterministically**: syllable alignment comparing base letters and tone marks → ✅ / 🟡 tone / 🔵 close / ❌, score 0-100.
  5. The **coaching tip is computed from that comparison** (e.g. *"On 'cảm', use the hỏi (dipping) tone: dip down, then come back up"*), not invented by the AI.
  6. Known limit, used as a teaching point: AI tone hearing is good but not perfect on borderline audio, so the app says *"Ask your local buddy too: do they agree?"*
- **Audio**: all fixed content pre-generated to `/public/audio/*.mp3` by `scripts/gen-audio.mjs`
  (Cloud TTS Chirp3-HD). Dynamic text (AI replies, snap words) → `/api/tts` (Cloud TTS, in-memory LRU
  cache). Browser `speechSynthesis` (vi-VN) is the last fallback.
- **Front end**: Vite + React + TypeScript, hand-written CSS (no UI framework), < 250 KB gzipped JS,
  QR rendered locally (`qrcode`), confetti bundled (`canvas-confetti`). No runtime CDN dependencies except Google Fonts (system-font fallback).

### API surface
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/join` | create/restore participant, assign team |
| GET | `/api/stream?pid=&host=` | SSE live state |
| GET | `/api/state` | polling fallback |
| POST | `/api/event` | record activity results (tone game, phrase, quiz answer…) → points + lanterns |
| POST | `/api/ai/name` · `/api/ai/pronounce` · `/api/ai/snap` · `/api/ai/chat` · `/api/ai/wish` | AI features |
| POST | `/api/tts` | Vietnamese speech for dynamic text |
| POST/GET | `/api/voice` · `/api/voice/:id` | local buddy voice recordings |
| POST | `/api/host/*` | (PIN) phase, quiz control, spotlight, moderation, reset, export |

### Scoring & lanterns
| Action | Points | Lanterns |
|---|---|---|
| Join / Vietnamese name | 10 / 20 | 1 / 1 |
| Tone Ear Game correct (streak bonus) | 5 (+2/streak) | 1 per 2 correct |
| Phrase spoken (score ≥ 50) | 10 + score/10 | 1 |
| Snap & Learn | 15 | 1 |
| Bargain finished | 10 + discount% / 2 | 1 |
| Ask Cô Lan question | 8 | 1 |
| Wish posted | 15 | 1 |
| Buddy voice recorded | 20 | 1 |
| Quiz correct | 100 × speed factor (50-100) | 1 |

Community goal: 300 lanterns (auto-scales to ~15 × participants), milestones at 25/50/75/100% trigger
projector celebrations.

---

## 7. Content (curated, culturally accurate, reviewed)

- **Six tones**: ma (ghost) · má (mother, Southern) · mà (but) · mả (tomb) · mã (horse) · mạ (rice seedling); ear-game bases: ma, ba, la, ca (×6 tones).
- **12 survival phrases**: Xin chào · Cảm ơn · Không có gì · Xin lỗi · Tôi tên là… · Tôi đến từ Úc · Bao nhiêu tiền? · Đắt quá! · Ngon quá! · Một, hai, ba, dô! · Hẹn gặp lại · Tạm biệt. Each has an Aussie-friendly respelling, meaning, a culture note and an emoji.
- **Quiz bank** (~16): phở origin, Tết & lì xì, áo dài, cà phê sữa đá / phin, nón lá, Hạ Long Bay, motorbikes, the đồng, Hội An lanterns, chopstick etiquette, greetings & age-based pronouns, tone-listening items, "AI or Local?" items, and reflection polls.
- **Fallbacks**: 40 curated Vietnamese names with meanings; scripted vendor lines; FAQ answers for Cô Lan.

---

## 8. Quality & testing plan

1. **Unit tests** (Vitest): tone/syllable analysis & scoring, team balancing, points/lanterns, quiz scoring, state restore.
2. **Live AI smoke test** (`npm run smoke`): each AI endpoint against the real Gemini key, including pronunciation on a TTS-generated *correct* clip (expect a high score) and a *toneless* clip (expect tone errors).
3. **Load test** (`npm run load`): 60 simulated phones join, open SSE, fire events; the host receives updates; p95 latency check.
4. **Browser test** (`scripts/ui.ts`): headless Chromium at phone size (390×844) and projector size (1920×1080) walks join → every activity → spotlight → quiz → wall → awards → passport → reload; screenshots reviewed; zero console errors required.
5. **Production verification** after deploy: health check, one full scripted run against the live URL, then **Reset** so the event starts clean.

## 9. Deployment (done)

Live service: `culture` in `eduflow-94827` / `asia-southeast1`. Health check: `/api/health` (Cloud Run reserves paths ending in `z`, such as `/healthz`).


```bash
gcloud run deploy culture --source . --project eduflow-94827 --region asia-southeast1 \
  --allow-unauthenticated --min-instances 1 --max-instances 1 --concurrency 500 \
  --cpu 1 --memory 1Gi --no-cpu-throttling --timeout 3600 \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:1 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=eduflow-94827,HOST_PIN=<pin>
gcloud beta run domain-mappings create --service culture --domain culture.eduflow.vn \
  --project eduflow-94827 --region asia-southeast1
```
DNS (Mat Bao): `culture  CNAME  ghs.googlehosted.com.` The managed TLS certificate takes 15-60 min,
so map the domain **the day before**. The `*.run.app` URL works as an immediate backup (the QR on the
host screen always encodes whichever URL the projector is using).

## 10. Day-of checklist
- [ ] Day before: open `https://culture.eduflow.vn` on an iPhone and an Android phone, test the microphone and camera.
- [ ] Open `/host`, enter the PIN, press **Reset event**, keep the Lobby on the projector.
- [ ] Projector laptop audio connected to room speakers (tone-listening quiz).
- [ ] Ask the Vietnamese students to arrive 5 minutes early → join as Local buddies → record voices.
- [ ] Phones: if the venue Wi-Fi is captive-portal style, ask students to use 4G (the app is tiny).
- [ ] After the session: **Export results** (CSV/JSON) for your report.
