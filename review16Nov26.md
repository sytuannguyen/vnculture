# Live app review — 16 Nov 2026

**App:** [culture.eduflow.vn](https://culture.eduflow.vn/)  
**Purpose:** Assess whether the app can support a fun, engaging two-hour Vietnamese language and culture course for visiting Australian students and local Vietnamese student buddies.  
**Method:** Live, visible in-app browser walkthrough as a visitor participant, with read-only code inspection to interpret observed behavior. I did not run tests or change the app. Follow-up live checks were completed on 16 Nov 2026.

## Overall assessment

The app has a strong workshop concept and a polished learner path: join without an account, receive a team, and choose among seven clearly labeled activities. A Vietnamese name and wish translation worked. On follow-up, the market role-play also completed a full bargaining exchange and awarded a deal; Cô Lan's guide stayed on its loading indicator through repeated observations. Speech/camera capture still needs verification on actual student devices. The host/projector view remains unverified because the live facilitator PIN was not available. Treat the guide's slow response and the device/host checks as the main unresolved risks before relying on the full two-hour session.

## What I exercised

- Joined as a visitor named “Alex”; the join form and team reveal worked, with a team assigned and no account creation.
- Generated a Vietnamese name (“Anh Khoa”), saw a meaning and pronunciation guide, and returned to the home activities.
- Opened the tone explorer and tone ear game. The game visibly advanced from round 1 to round 2 after an answer. The full ten-round completion was not exercised.
- Opened the phrase pronunciation coach and tapped Record. No permission prompt or recording state appeared in this browser session, so microphone capture and AI feedback were not verified.
- Opened Snap & Learn. Its camera and image-picker controls were visible; the image-picker tap did not open a chooser in this browser session. Camera/vision results were not verified.
- Started the market role-play twice. On the first run, the response had not appeared at the immediate check. On follow-up, Cô Hoa responded with a 27% discount; tapping the suggested acceptance produced a deal screen, points, team best, and a completed activity stamp. Response latency is variable, but the core exchange can complete.
- Asked Cô Lan a suggested question in both review sessions. It remained on “Cô Lan is thinking…” across repeated observations during the checks. Browser console inspection showed no visible errors. The guide request has a shared 45-second abort in the client helper, but the session did not wait long enough to verify whether that timeout clears the loading state.
- Opened the passport; it showed name, stamps, activity totals, words learned, and team points.
- Translated a preset wish successfully and saw its back-translation. I did not release it to the shared projector wall.
- Opened `/host`; the PIN gate worked, but the development PIN was rejected. Projector screens, quiz controls, spotlight, and moderation/export were not verified.

## Findings

### P1 — Culture guide response is slow or stalled, with weak waiting feedback

**Observed:** Cô Lan remained on “Cô Lan is thinking…” across repeated checks in two sessions, while name and wish AI returned results. Browser console inspection showed no visible errors. The market initially looked similarly delayed, but on follow-up it responded and completed successfully. Source inspection shows a shared POST timeout of 45 seconds; the UI offers no progress estimate or cancel/retry control while waiting. The guide catches request errors and should eventually clear its busy state, but the live check did not wait long enough to verify recovery at the 45-second deadline.

**Why it matters:** The guide is a central showcase for an always-available culture assistant. Students have no indication how long to wait; a slow turn can interrupt momentum in a two-hour workshop. The market result confirms that role-play can recover and reach a satisfying outcome, though variable latency still merits a user-visible waiting state.

**Recommendation:** Verify guide response times and server logs on the deployed service. Add elapsed-time feedback and a cancel/retry option while waiting; ensure a timed-out request leaves the student able to continue. Check that the market thinking state similarly recovers on a true timeout.

### P1 — Classroom microphone and camera readiness is not confirmed

**Observed:** Tapping Record did not enter a recording state or surface a permission prompt in this browser session. The photo library icon also did not visibly open a chooser. I did not grant or deny camera/microphone permission.

**Why it matters:** Pronunciation coaching, local buddy recordings, and computer vision depend on these device features. A mobile browser may behave differently from this desktop in-app browser, but no fallback path was demonstrated live.

**Recommendation:** Run a short preflight on the actual student phone/browser mix (especially iOS Safari and Android Chrome): grant microphone/camera permissions, make one recording and one image submission, and verify feedback arrives. Add a brief preflight hint for permission setup and a clear recovery state if capture is unsupported or blocked. Keep a prepared no-camera scavenger-hunt alternative for any device that cannot capture.

### P2 — Facilitator/projector workflow could not be validated

**Observed:** `/host` presented a functioning PIN gate, but the supplied development PIN was rejected. The deployed facilitator PIN was not available during review.

**Why it matters:** The course depends on the QR lobby, shared dashboard, live quiz, wall, and awards. A working student app alone does not demonstrate that a single facilitator can run the two-hour session from the projector.

**Recommendation:** Before the session, sign in with the actual facilitator PIN and verify the QR code, all five screens, quiz start/reveal/next, phone auto-switch to quiz, spotlight, exports, and fullscreen on the projector laptop. Confirm that the displayed URL/QR points to the student app and scans successfully from a phone.

### P2 — Tone-game continuity and score completion need a full-run check

**Observed:** The ear game advanced from round 1 to round 2. The source defines a ten-question game and posts a completion event only after round 10; the live test did not complete the run.

**Why it matters:** A completed game appears to be the trigger for the tone passport stamp and completion award. If students exit early, they may not receive the expected stamp or score, and the facilitator may not know how long the activity takes.

**Recommendation:** Complete a ten-round run on a phone, including correct and incorrect answers, and verify round feedback, final score, stamp, points, and projector totals. Consider showing explicit “X of 10” progress and a clear exit/restart path.

### P2 — Name activity pronunciation respelling needs local-speaker review

**Observed:** The result was “Anh Khoa” with the pronunciation hint “Ung Kwah”. I cannot verify Vietnamese pronunciation from the spelling alone; the cue may be difficult for Australian beginners to map back to the displayed Vietnamese.

**Why it matters:** Students may treat a generated name as culturally authoritative and rely on its pronunciation cue. Local buddies can help verify it, but the pronunciation format should be accessible and reviewed.

**Recommendation:** Have a Vietnamese speaker review generated name examples and the Australian-English respelling convention. Consider presenting the audio as the primary model and labeling respelling as approximate; invite the local buddy to confirm pronunciation.

### P3 — Live event already contained a review participant

**Observed:** Joining as Alex added a participant to the live event; the lobby showed 3 learners and the event counters increased. The participant appeared in the passport. I left the participant in place because resetting or deleting shared event data would affect other users.

**Recommendation:** Before the real session, the facilitator should use the approved reset workflow to clear test participants and counters. After testing in the future, use a staging event or a documented participant cleanup option if available.

## Strengths worth keeping

- Joining is low-friction and clearly explains the visitor/local buddy distinction.
- The six-tone lesson uses audio, visual pitch curves, gesture prompts, and a tone game; it also notes the regional hỏi/ngã distinction.
- AI name generation worked and provided meaning, an audio control, a slower playback option, and a phrase to introduce oneself.
- The wish translation includes a back-translation so a learner can check meaning before choosing whether to publish.
- Passport and shared team/lantern progress give the two groups a visible community goal.
- The activity descriptions make the AI learning mode explicit, which supports reflection on how AI is helping.

## Suggested day-of run checks

1. Test on the same phones and browsers students will use; verify audio, mic, and camera access.
2. Confirm the real host PIN and run the projector from `/host`, including one quiz answer from a student phone.
3. Check live AI guide, market, name, wish, and vision responses on the deployed environment; confirm visible timeout and retry behavior.
4. Confirm local buddy voice recording and playback with a consenting test recording.
5. Reset the test event using the facilitator workflow immediately before students arrive.

## Review limits

This review covers live browser sessions on the student app and source inspection. The host/projector view, phone microphone/camera behavior, full ten-round tone completion, and wish publication were not verified. I did not record a voice, upload a photo, modify host settings, or reset the live event. Follow-up bargaining produced points and changed the live event's team best; that shared test data remains in the event.
