# Testing Haunt Kit (Judge Testing Guide)

Haunt Kit is designed with flexible testing options so judges can evaluate core game loops, application rules, AI ghost bots, and simulated exercise sessions directly from a desktop browser, or test live physical motion sensors with a smartphone:

- **Without a phone (Computer / Laptop):** You can test the full Séance Party game loops with AI ghost bots, steer via the desktop mouse simulator, run Steady's automated 5-rep demo mode, inspect local session reports, and execute all automated test suites.
- **With a smartphone (Real Motion Sensors):** You can test physical spatial gestures—including real-time accelerometer/gyroscope streaming, phone tilt/shake/scream gestures, and on-device joint Range of Motion (ROM) tracking—over a secure HTTPS connection.

---

## 1. Quick Start: Live Hosted Demos

You can immediately test the deployed production applications in your browser:

- **Séance Party (Big-Screen Game):** https://kirohauntkit-seance.pages.dev
- **Steady (Exercise Companion):** https://kirohauntkit-steady.pages.dev
- **Phone Controller (Client):** https://kirohauntkit-play.pages.dev

> [!NOTE]
> **Branch & Feature Status:**
>
> - The live production deployment and `main` branch display Steady's initial **horizontal progress meter bar**.
> - The **180° circular ROM Goniometer Gauge** (`Gauge.tsx`), featuring radial SVG coordinate projection and dynamic target threshold ticks, is implemented and tested exclusively on the `anish/steady-gauge-integration` branch (commit `74d5177`) and is NOT present on `main` or current production.

---

## 2. Local Setup & Running Locally (Optional)

If you prefer to run the code locally from source:

### Prerequisites

- **Node.js:** v20.x or higher
- **pnpm:** v9.x or v10.x (`corepack enable`)

### Start the Local Services

```bash
git clone https://github.com/Kiroween2026/Haunt_Kit.git && cd Haunt_Kit
pnpm install

# Start local services across separate terminal tabs:
pnpm dev:relay          # WebSocket relay on ws://127.0.0.1:8787
pnpm dev:controller     # Phone controller & desktop simulator on http://localhost:5180
pnpm dev:seance         # Séance Party app on http://localhost:5183
pnpm dev:steady         # Steady physical therapy app on http://localhost:5184
```

### Local Physical-Device Testing via HTTPS Tunnels

Mobile browsers strictly require HTTPS to access accelerometer/gyroscope sensors (`DeviceMotionEvent`) and microphone input (`getUserMedia`). When testing locally with a physical smartphone rather than the live hosted links:

- **For Séance Party (Phone Controller):**
  1. In a terminal, run: `cloudflared tunnel --url http://localhost:5180`
  2. The controller dev server on port `5180` proxies `/relay` to the local WebSocket relay on `:8787`, so this single tunnel covers both the web client and WebSocket transport.
  3. On your computer, open Séance Party with the tunnel URL:
     `http://localhost:5183/?play=https://<your-tunnel>.trycloudflare.com`
  4. Scan the displayed QR code with your smartphone camera.
- **For Steady (Exercise Companion):**
  1. In a terminal, run: `cloudflared tunnel --url http://localhost:5184`
  2. Steady is a standalone, single-device application served on port `5184` (it does not use the controller on `5180` or relay on `8787`).
  3. On your smartphone browser, navigate directly to:
     `https://<your-tunnel>.trycloudflare.com`

---

## 3. Testing Gesture Detection & Benchmarks

Haunt Kit includes a zero-dependency, pure TypeScript gesture recognition engine in `packages/gestures/`:

### Automated Invariant & Benchmark Tests

From the project root, run:

```bash
# Run gesture detector tests, physical invariants, and real Ghost Recording benchmarks:
pnpm --filter @haunt-kit/gestures test
```

**Test counts & platform verification:**

- In PR #22, all 24 core gesture detector, property-based invariant, and benchmark test files (**389 tests**) pass locally on Windows without error.
- Across the entire package on `main` (which includes `packages/gestures/src/hook/work-order.test.ts` for 25 files and 401 tests total), all **401 tests pass** in GitHub Actions Linux CI.
- On local Windows, 400 of 401 tests pass, with 1 CLI test in `work-order.test.ts` failing due to Windows child-process spawning (`pnpm` vs `pnpm.cmd`).

**What is tested:**

- **Physical Invariants (`src/pbt/`):** Property-based tests via `fast-check` verifying stillness immunity (no triggers when motionless), SO(3) 3D spatial rotation invariance, sample rate invariance (30 Hz to 120 Hz), and temporal causality ($t_{\text{start}} \le t_{\text{event}} \le t_{\text{end}}$).
- **Ghost Recording Benchmarks (`src/recording/benchmark.test.ts`):** Replays 6 real Android phone sensor recordings from `recordings/`. Flat table recordings confirm zero false triggers for shake, flick, spin, flip, scream, or rep.
- _(Note on Tap Benchmark: Ghost Recordings record sensor streams without touch coordinates; tap detector correctly emits zero events due to absent touch data rather than physical false-positive rejection)_.

### Live Interactive Testing via Desktop Simulator

Open `http://localhost:5180/sim.html` (or click "Desktop simulator" from the phone controller page):

- Move your mouse over the simulated phone surface to stream live continuous tilt coordinates.
- Press **S** to simulate a shake gesture.
- Press **H** to simulate a hold-still gesture.

---

## 4. Testing Séance Party (Party Game)

### Option A: Solo with AI Ghost Bots (2 minutes — No Phone Needed)

1. Open **Séance Party** (https://kirohauntkit-seance.pages.dev). If testing locally without a relay, it operates in **Practice mode**.
2. In the lobby, click **Fill to 4**. Three AI ghost bots will join the room. Bots simulate human response delays and occasional steering errors.
3. Click **Start the séance**. The game cycles through three mini-games:
   - **Ouija Planchette:** The bots tilt to spell out mystery words.
   - **Hold Still:** When the ghost turns around, players must hold still or get eliminated.
   - **Banshee Scream-off:** Players scream into their microphones; loudest audio takes the round.
4. The game concludes with the final score scoreboard. Click **Play again** to restart.

### Option B: Solo as a Player via Desktop Simulator (3 minutes — No Phone Needed)

1. Open **Séance Party** (must be connected to a relay or live link).
2. Click **Join from this computer**. A controller tab opens.
3. Enter your player name and click **Join with this computer**. You appear in the lobby as a player ghost.
4. In the lobby tab, click **Fill to 4** to populate remaining slots with bots, then click **Start the séance**.
5. Switch to your controller tab to play:
   - **Move the mouse** inside the circle to steer the Ouija planchette.
   - Press **H** to freeze during Hold Still.
   - Press **S** to shake off spirits.
   - **Allow microphone access** to scream in the Banshee round.

### Option C: With a Real Smartphone (3 minutes)

1. Open **Séance Party** on your computer screen (live link https://kirohauntkit-seance.pages.dev or local setup with tunnel).
2. Scan the displayed QR code with your phone camera to open the controller.
3. Tap **Enter the séance** and allow Motion and Microphone permissions when prompted.
4. Start the game from the computer. Tilt your phone to steer the planchette, freeze your hands during Hold Still, and shout during the Banshee scream-off!
5. **Reconnection Test:** Lock your phone screen for 5 seconds and unlock it—your session will automatically resume with the same player ID and ghost color.

---

## 5. Testing Steady (Physical Therapy Companion)

### Option A: Interactive Demo Mode (2 minutes — No Phone Needed)

1. Open **Steady** (https://kirohauntkit-steady.pages.dev).
2. Read the non-medical companion notice and click **I understand**.
3. Select **Shoulder raise**, then click **Try the demo (no phone needed)**.
4. Watch the simulated exercise session execute five repetitions:
   - Live angle excursion tracks toward the target range marker:
     - _On `main` / production:_ Displayed on the horizontal progress bar.
     - _On `anish/steady-gauge-integration` branch (commit `74d5177`):_ Displayed on the circular 180° radial SVG goniometer dial.
   - **Form guidance:** Notice that one rep triggers **Not full range** (did not reach 70°) and another triggers **Too fast** (< 1.2s cadence).
   - Turn your sound on to hear automated rep counting and spoken audio feedback.
5. Click **Stop**, then **Report for my therapist**. An on-device printable summary is generated without uploading any data.
6. Return to the home screen and click **My sessions** to see your locally saved exercise history.

### Option B: On a Real Smartphone (2 minutes)

1. Open **Steady** on your smartphone browser (live link https://kirohauntkit-steady.pages.dev or local setup via `cloudflared tunnel --url http://localhost:5184`).
2. Select **Shoulder raise**, tap **Start**, and approve motion sensor access.
3. **Resting Baseline Calibration:** Hold the phone in your hand with your arm resting down for 2 seconds. The app calibrates your baseline resting angle and announces _"Ready. Start your reps."_
4. Raise your arm in front of you toward shoulder height and lower it, completing 5 smooth reps.
5. Listen for audible rep counts and observe live real-time feedback.

---

## 6. Verifying Accessibility & Privacy Features

From Steady's home screen, open **Settings** to test the accessibility suite:

1. **Voice Only Mode:**
   - Enable **Voice only**.
   - Start an exercise: notice the visual motion meters are intentionally unmounted, presenting an uncluttered high-contrast counter with full spoken cues. This is designed for exercises where looking at a screen impairs posture or creates a hazard.
2. **7:1+ High Contrast Theme:**
   - Select **High contrast**. The entire app switches to a high-contrast palette exceeding 7:1 contrast ratios.
3. **Large Text Scaling:**
   - Select **Large** text size. Observe typography scaling cleanly across all screens without truncation or overlapping.
4. **Reduced Motion:**
   - When device accessibility setting "Reduce Motion" is enabled, all non-essential UI animations are disabled via `@haunt-kit/ui`.
5. **Microphone Privacy:**
   - In both apps, microphone access computes only a local mathematical RMS volume value (0.0 to 1.0) inside an `AnalyserNode`. Raw audio is never recorded, stored, or sent over the network.
6. **Automated WCAG 2.1 AA Verification:**
   - Run `pnpm test:e2e` locally to execute Playwright and axe (`@axe-core/playwright`) accessibility assertions across Chromium and WebKit (0 violations). In the E2E suite, this covers key flows including all three design system themes, the Séance Party lobby, QR host view, mini-games, and scoreboard, as well as Steady's disclaimer, exercise selection, calibration, live tracking, therapist report, and settings screens.

---

## 7. Expected Results & Known Limitations

| Feature / Test               | Expected Result                                                                                                                            | Known Limitations & Notes                                                                                                                                                 |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Séance Party Lobby**       | Room code generated; bots/players appear with unique colors.                                                                               | In-memory rooms auto-close 2 minutes after host leaves.                                                                                                                   |
| **Desktop Simulator**        | Mouse coordinates stream normalized $-1.0 \dots 1.0$ tilt values.                                                                          | Click inside simulator window to focus keyboard for S/H keys.                                                                                                             |
| **Steady Exercise Tracking** | Counts reps; detects fast tempo (< 1.2s) and incomplete range.                                                                             | Companion tool only; strictly not a diagnostic or medical device.                                                                                                         |
| **Steady Gauge Display**     | Horizontal progress meter on `main` and production; 180° circular dial exclusively on `anish/steady-gauge-integration` (commit `74d5177`). | The circular SVG dial requires checking out the gauge integration branch.                                                                                                 |
| **Audio Feedback**           | Rep numbers and feedback spoken via Web Speech API.                                                                                        | On iOS Safari, speech synthesis requires an initial user screen tap.                                                                                                      |
| **Session Persistence**      | Session history saved across page reloads in IndexedDB.                                                                                    | Clearing browser website data will reset local exercise history.                                                                                                          |
| **Automated Test Suites**    | All 401 gesture tests and monorepo suites pass in GitHub Actions Linux CI.                                                                 | Local Windows runs of `pnpm test` report 3 OS-specific failures (path backslash assertions in `tools.test.ts` and `pnpm` vs `pnpm.cmd` spawning in `work-order.test.ts`). |

---

## 8. Troubleshooting

| Symptom                             | Cause                                       | Solution                                                                                        |
| :---------------------------------- | :------------------------------------------ | :---------------------------------------------------------------------------------------------- |
| **"Practice mode (no phones)"**     | Big screen cannot reach relay.              | Use the live hosted link or run `pnpm dev:relay` locally. Bots still function in Practice mode. |
| **"Motion is blocked" on iPhone**   | Sensor permission was previously denied.    | Close the Safari tab and rescan the QR code. Tap **Allow** when prompted.                       |
| **"This page needs HTTPS"**         | Web motion/mic APIs require secure context. | Use `https://` URLs or tunnel local ports via Cloudflare Quick Tunnel (`cloudflared`).          |
| **Steady says "no motion sensors"** | Browser reports no physical accelerometer.  | You are on a computer. Click **Try the demo** to test with the virtual player.                  |
| **Steady does not speak**           | Audio volume is muted or disabled.          | Ensure device volume is up and verify **Count reps out loud** is checked in Settings.           |
