# How we used Kiro

Haunt Kit was built by three people in 19 days. This page is based on `KIRO_LOG.md` and the team's documented work. Each section identifies the person responsible for the contributions described.

## Spec-driven development

_Yadnesh:_ Every component has a spec in `.kiro/specs/` written before the code: requirements, design, then tasks ticked off one by one. The specs are `protocol`, `platform`, `seance-mcp`, `seance-party` and `steady`. Writing the protocol design first showed a gap in our plan: the message list had no way for a host to create a room or get it back after a disconnect. We added `create_room`, `resume_room` and `room_ready` before any code depended on the old list.

_Anish:_ Wrote the `gestures` spec (`.kiro/specs/gestures/`: requirements, design, and tasks), the Ghost Recording schema, the initial detectors (tilt, shake, hold-still), and the secondary detectors (flick, spin, flip, scream, tap, rep, and catalog). When teammates built the initial main-branch detectors and the horizontal progress bar for Steady, I designed the specification for the circular ROM Gauge (implemented on the `anish/steady-gauge-integration` branch, commit `74d5177`, awaiting merge into `main`): a 180° radial SVG dial gauge with polar-to-Cartesian trigonometric projection, dedicated target threshold ticks, and completion sectors. During the 2.0-second baseline hold, the screen displays a dedicated calibration progress bar before activating the circular goniometer.

_Yadnesh, for Séance Party and Steady:_ The specs describe the game and the app in plain requirements, and the game rules were built as pure functions behind a thin React layer. That is what let the property tests attack the rules directly.

## Steering

_Yadnesh:_ On day one we wrote `product.md`, `tech.md` and `structure.md`, so all three of our Kiro sessions started with the same rules: raw audio never leaves the phone, the iPhone limits (HTTPS, one-tap permissions, no vibration), who owns which folder, and why TypeScript is pinned to 6. Later each shared part got its own steering file: `protocol.md` tells every teammate's Kiro to use the channel `encode`/`decode` and never trust a `playerId` from a phone, and `mcp-usage.md` says when to use each Séance MCP tool and never to change a detector threshold without data. `design.md` holds the visual and accessibility rules for both apps, and the design hook checks the mechanical ones.

_Anish:_ Wrote `gestures.md`: units, the rule that detectors are pure with no browser APIs, and "never change a threshold without testing against the recordings".

## Vibe chat and interactive debugging

_Yadnesh:_ The project log documents 13 explicit entries where Kiro's conversational chat interface was used to diagnose build failures, debug asynchronous race conditions, and verify deployment scripts:

- **Dependency and environment management:** Kiro inspected peer dependency ranges (`typescript >=4.8.4 <6.1.0`) and pinned TypeScript to ~6.0.3 to prevent broken lint configurations. It also resolved pnpm 12 `frozen-lockfile` blocking of build scripts by approving `esbuild` and `workerd` in `pnpm-workspace.yaml`.
- **Relay and protocol parity:** Ran interactive smoke tests against the Node.js relay and the Cloudflare Durable Object in `wrangler dev` to confirm identical behavior across environments. Diagnosed in-memory test relay dropped socket messages prior to closure and matched behavior to real WebSockets.
- **E2E test fixes and process management:** Handled Chromium's `DeviceMotionEvent.requestPermission()` denial in automated tests, and diagnosed a 15-minute CI job hang caused by dev server wrapper processes, converting them to direct `node` processes with graceful shutdown.
- **Physical data cross-checks:** Replayed synthetic desktop simulator models against Anish's real Android recordings, immediately revealing that synthetic gravity had inverted $a_x$ and $a_y$ signs.
- **UI edge cases and accessibility:** Debugged CSS parser rules in component tests, resolved WebKit-specific tab and button focus differences, handled Chrome desktop null Devicemotion events in Steady, and aligned Steady's smoothed angle math with clinician feedback.
- **Deployment troubleshooting:** Fixed Cloudflare Pages deployment shell scripts (`set -euo pipefail`), resolved account ID and API token mismatches (Cloudflare errors 7003 and 9109), and added DNS retry loops for new domains.

## Property-based testing

_Yadnesh:_ fast-check found or prevented real bugs:

- **Batch size overflow.** The first protocol draft allowed 64 samples per batch. The round-trip property passed, because fast-check makes short arrays by default. A worst-case check showed 64 long numbers are about 21 KB, over our 16 KB message limit: a batch could pass the schema and still fail to send. We lowered the limit to 32 and added a property that a full worst-case batch always fits.
- **`__proto__` in gesture data.** The round-trip property failed in CI with a new random seed: `{"__proto__": 0}` decoded as `{}`, because zod drops that key. The host would have received a different message than the phone sent. Keys like that are now rejected.
- **No player spoofing.** A property checks that any `playerId` a phone adds to its input is dropped, and another runs random joins, drops, rejoins and waits against a room and checks every frame reaches the host under its sender's id.
- **Testing the tests.** We planted bugs on purpose and checked the properties failed. That showed the generator rarely waited around the 60-second rejoin limit, and that a "a leaver never wins" property over whole games passed even with the bug in, because a leaver rarely leads. A direct property over random scores and leavers failed correctly.
- **Detectors.** Properties cover the five invariants in the gestures spec: a still phone never fires shake, flick or spin; shake gives the same result however the phone is rotated; real gestures are detected at any sample rate from 30 to 120 Hz; events fall inside the input's time range; and N synthetic reps count as exactly N. Bugs found while building: the rep detector crashed on its first sample (a unit vector can have a norm of 0.99999999 and a free-fall guard rejected it), and a flick made during the cooldown was reported late, when the cooldown ended.
- **Séance Party.** Averaged tilt always stays on the board, scores are never negative, a player who left never wins, and a game with only bots always finishes with a winner for any seed. They found that a perfectly aimed bot could never spell BOO or SPOOK, because a letter can't be picked twice until the planchette leaves it.
- **Design system.** Every text color pair reaches 4.5:1 in all three themes (and 7:1 in the high-contrast one), checked by a property test and then by axe in real browsers.
- **Steady.** A summary always agrees with its reps, and history never loses a saved session, even after the database is closed and reopened.
- **A bug the tests only found against real data.** Anish's real Android recordings showed our synthetic gravity had the x and y signs backwards (error 8 to 19 m/s² on tilted recordings, under 0.6 once fixed). Every earlier test passed because they were written with the same wrong formula. A test now checks the model against every file in `recordings/`.

_Anish:_ Wrote the property-based testing and real-recording benchmark suites across `packages/gestures/src/pbt/` and `packages/gestures/src/recording/`:

- **Physical Invariants:**
  - **Stillness Invariant (`stillness.test.ts`):** a still or noisy phone ($|a - 9.81| < 0.2$ m/s², $|\omega| < 2$°/s) never fires shake, flick, or spin across 30 Hz, 68 Hz, and 120 Hz.
  - **SO(3) Rotation Invariance (`rotation.test.ts`):** shake detection is invariant under arbitrary 3D spatial rotation matrices in SO(3).
  - **Sample-Rate Invariance (`sample-rate.test.ts`):** rep counting yields identical results from 30 Hz to 120 Hz.
  - **Temporal Causality (`causality.test.ts`):** every emitted gesture event satisfies the inclusive sample time bounds ($t_{\text{start}} \le t_{\text{event}} \le t_{\text{end}}$).
  - **Rep Counting Determinism (`rep-counter.test.ts`):** $N$ synthetic reps with noise count as exactly $N$, and sub-threshold motions below minRomDeg (45°) never increment count.
- **Real Ghost Recording Benchmarks (`benchmark.test.ts`):**
  - Replayed six real Android recordings from `recordings/` through all nine detectors.
  - On stationary table recordings, tilt clamps cleanly to zero within the $\pm 5$° dead zone, hold-still activates and never breaks, and zero false events fire for shake, flick, spin, flip, scream, or rep. Tap emitted zero events because the benchmark recordings contain no touch coordinates.
  - On dynamic lateral rocking (`android-left-right`), the addition of `minDeltaMs2: 8` eliminated high-frequency sensor noise false flicks while preserving genuine flick impulse detection.
- **Test Suite Results:** In PR #22, all 24 core gesture detector, property-based invariant, and benchmark test files (389 tests) pass locally on Windows without error. Across the entire gestures package on `main` (which incorporates the 12-test hook CLI test suite in `packages/gestures/src/hook/work-order.test.ts` for a total of 25 files and 401 tests), all 401 tests pass in GitHub Actions Linux CI. On local Windows, 400 of 401 tests pass, with the single failing test in `work-order.test.ts` attributable to child-process spawning differences on Windows (`pnpm` vs `pnpm.cmd`).

## MCP

_Yadnesh:_ The **Séance MCP** (`packages/mcp-server`) connects Kiro to real phones while developing. Kiro can list the phones in a room, take a sensor snapshot (min, max, mean and variance per axis), record a motion into `recordings/`, replay a recording as a fake player, and fire a gesture. We tested it through a real MCP client against a real relay with a ghost phone doing a ±30° tilt circle: the snapshot reported beta within ±30° and a mean acceleration of 9.81, which matches the motion. It only works against the local dev relay, behind a token that's never logged.

The `gesture-tuner` agent is set up to use these tools. It has not yet been run on a real misfire, because that needs a person with a phone and a detector that is wrong.

## Hooks

_Yadnesh, built for Anish and Viviana:_ Kiro's current hooks (`.kiro/hooks/*.json`) fire when Kiro itself saves a file, and a command hook receives the event as JSON on STDIN. So each hook runs a small tested script.

- **Gesture from spec.** When Kiro saves a `*.gesture.md`, a script checks the spec has all seven sections and prints an exact work order: write the detector, a property test for every "Must NOT fire when" line, register it, run the tests, log it. An incomplete spec gets "do not write a detector yet". The proof run was `double-shake.gesture.md`, which produced a detector and 11 tests, 5 of them property tests. Planting bugs (no calm-pause rule, no time window) was caught by those tests. A second hook runs the gesture tests whenever Kiro saves a file in the package.
- **Design check on save.** When Kiro saves a `.tsx` or `.css` file in the apps or the UI package, a script reports hard-coded colors, removed focus outlines, small text and tap targets, missing alt text, missing reduced-motion fallbacks, raw buttons and shouty wording, with file and line. Its first run flagged four real problems in the design system's own `PlayerGhost`.
- **Not verified:** the IDE firing these hooks itself. The hook files were created in the same session that used them, so we ran each hook's command by hand and tested the script.

## Custom agents

_Yadnesh, built for Anish and Viviana:_ Kiro's current agent format is a Markdown file with YAML front matter.

- **gesture-tuner** (`.kiro/agents/gesture-tuner.md`): uses the Séance tools, may only write under `packages/gestures`, `recordings` and `KIRO_LOG.md`, may only run test commands, and must show before and after numbers for every recording before it changes a threshold.
- **spook-designer** (`.kiro/agents/spook-designer.md`): reviews UI against `design.md` and reports problems with file and line. It runs `pnpm design-check` first, can't edit files, and says which checks it ran.

## CI and testing

_Yadnesh:_ CI runs lint, format check, typecheck, unit and property tests, the build, and Playwright end-to-end tests on WebKit (Safari's engine, since our team only has iPhones) and Chromium. Things Kiro caught along the way:

- CI's `pnpm install --frozen-lockfile` failed because pnpm 12 blocks install scripts, and wrangler needs esbuild and workerd. We allowed just those two.
- The same 7-step smoke test runs against the Node relay and against the Cloudflare Durable Object in `wrangler dev`, so both relays behave the same.
- Two controller tests timed out. The bug was in our in-memory test relay: it dropped a message sent right before closing, which a real WebSocket delivers. The mock now matches the real thing.
- In Playwright, Chromium now has `DeviceMotionEvent.requestPermission` too and refuses motion unless the test grants it. The controller showed "Motion is blocked", which is the correct screen.
- The end-to-end job once hung for 15 minutes after all tests passed, because the dev servers were started through `pnpm` and didn't exit. They now run as plain `node` processes, and every job has a time limit.
- A "no motion sensors" test found a real bug: desktop Chrome fires one motion event with every value null, so Steady believed a laptop had sensors and waited forever. The sampler now ignores empty events.
- Automated accessibility checks with `@axe-core/playwright` reported zero violations across the tested flows in Chromium and WebKit (WCAG 2.0/2.1 levels A and AA, including rendered color contrast). In the E2E suite, this covers the design system across all three themes, Séance Party's lobby, QR host view, mini-games, and final scores, and Steady's disclaimer, exercise selection, calibration, active tracking, therapist report, and settings screens (automated scans verify programmatic rules without implying complete manual WCAG certification).

_Anish, on Steady Integration & iPhone Physical Testing:_
We verified the complete Steady application and circular ROM Gauge on an iPhone running iOS Safari over a live Cloudflare Quick Tunnel (`cloudflared`):

- **Physical Rep Tracking:** Completed 5 repetitions of Shoulder Raise (observed live peak angles between 80° and 84°) and 5 repetitions of Bicep Curl, confirming accurate counting and auditory announcements with zero unexpected warnings.
- **Accessibility & Dual-Modality Design:**
  - **Circular ROM Goniometer:** Implemented on the `anish/steady-gauge-integration` branch (commit `74d5177`), replacing `main`'s initial horizontal bar with a 180° circular SVG arc dial. Formatted with WAI-ARIA `role="meter"` attributes (`aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax`, `aria-valuetext`), high-contrast styling (7:1+ contrast ratio), and instant SVG coordinate updates per frame without laggy CSS transitions.
  - **Voice Only Mode:** Designed specifically for active arm exercises where watching a screen is ergonomically impractical or unsafe. When enabled, the visual gauge is intentionally unmounted, presenting a high-visibility counter with full Web Speech API cues (_"Hold still at the start position for two seconds"_, _"Ready. Start your reps"_).
  - **Visual & Contrast Scaling:** Confirmed the high-contrast theme activates cleanly across all screens, and verified increased text scaling without visible overlap or clipping.
  - **Reduced Motion:** Verified an observed reduction in UI animations after enabling iOS Reduce Motion (interactive components disable animations via `@haunt-kit/ui`, while the SVG dial renders direct, frame-accurate motion).
- **Persistence & Export:** Confirmed that non-medical disclaimer consent and completed exercise sessions persist in IndexedDB across browser refreshes, and verified native iOS print preview generation for the therapist summary report.
- **Automated Verification:** On the `anish/steady-gauge-integration` branch (commit `74d5177`), all **38 unit tests** pass (Gauge 7/7, App 1/1, Steady domain 30/30) and all **18 Playwright E2E tests** pass across Chromium and WebKit (compared to 31 unit tests on `main`).

## Kiro IDE vs CLI vs Web

_Yadnesh:_ All of my logged work used Kiro in the IDE, in chat. Kiro ran commands in the terminal (tests, `wrangler dev`, Playwright, `gh` for pull requests), read the failures and fixed them. I did not use Kiro CLI or Kiro Web for this project.

_Team note on modalities:_

- Yadnesh's hands-on development was conducted using Kiro in the IDE.
- Anish authored specs (such as `gestures` in Spec mode) and conducted hardware testing and gauge implementation.
- Viviana was assigned design system and game assets.
- _Pending team confirmation:_ Anish and Viviana to confirm their individual Kiro client environments (IDE, CLI, or Web) for their respective sessions.
