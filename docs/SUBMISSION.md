# Submission Checklist & Devpost Guide

**Team Representative:** Yadnesh Deshpande  
**Team Members:** Anish Pant, Viviana, Yadnesh Deshpande  
**Project Name:** Haunt Kit  
**Hackathon Category:** Skeleton Crew (one reusable template plus two distinct showcase applications)  
**Public Repository:** https://github.com/Kiroween2026/Haunt_Kit

**Key Deadlines:**

- **Code Freeze:** Tue Dec 1, 2026
- **Team Submission Target:** Thu Dec 3, 2026 at 12:00 pm PT (1:30 am IST Dec 4)
- **Hard Hackathon Deadline:** Fri Dec 4, 2026 at 2:00 pm PT (3:30 am IST Dec 5)

---

## 1. Submission Checklist

### Tue Dec 1: Code Freeze

- [ ] Only critical fixes and documentation refinement from this point forward.
- [x] Production deployment verified live:
  - **Séance Party:** https://haunt-kit-seance.pages.dev
  - **Steady:** https://haunt-kit-steady.pages.dev
  - **Phone Controller:** https://haunt-kit-play.pages.dev
- [ ] Run GitHub Actions → **Deploy production** following final merges.
- [ ] Run `pnpm check:submission` locally to verify all automated submission checks pass.

### Wed Dec 2: Devpost Preparation

- [ ] Fill Devpost submission fields:
  - **Project Name:** Haunt Kit
  - **Category:** Skeleton Crew
  - **Repository URL:** https://github.com/Kiroween2026/Haunt_Kit
  - **Live Showcase URLs:** Listed above
  - **YouTube Video Link (Public, under 3:00):** <!-- TODO: Viviana to provide video URL -->
  - **Description:** Use the complete Devpost project description drafted in Section 2 below.
  - **"How we used Kiro":** Paste contents of [docs/KIRO_WRITEUP.md](./KIRO_WRITEUP.md).
  - **Judge Testing Instructions:** Paste contents of [docs/JUDGE_TESTING.md](./JUDGE_TESTING.md).
- [ ] Bonus Category Deliverables:
  - [ ] **Best Demo:** Included in YouTube submission video.
  - [ ] **Blog Post Link:** <!-- TODO: Anish to provide blog post URL -->
  - [ ] **Social Blitz Link:** <!-- TODO: Anish to provide social post URL -->
  - [ ] **Ghost of Kiroween Past:** <!-- TODO: Team confirmation if any member registered in 2025 -->
- [ ] Invite team members (Anish and Viviana) to the Devpost project.

### Thu Dec 3: Final Verification & Submit (Target: 12:00 pm PT)

- [ ] Perform live smoke check in iPhone Safari **Private Browsing** mode over **cellular data**.
- [ ] Run `pnpm check:submission` one final time.
- [ ] Submit on Devpost, capture confirmation screenshot, and share in team chat.

---

## 2. Devpost Project Description (Submission Draft)

### Tagline

Turn any smartphone into an instant, zero-install spatial motion controller for web apps in seconds via a simple QR code scan.

### The Problem & Motivation

Building mobile-controlled web experiences has traditionally been painful and fragile:

- **Device Fragmentation:** iOS and Android report device motion and orientation with differing coordinate conventions, sign reversals, and permission models.
- **Barrier to Entry:** Requiring users to install native mobile apps or configure local network IP addresses kills spontaneous multiplayer participation.
- **Testing Bottlenecks:** Developing gesture-driven applications typically requires holding and moving a physical phone for every code change, making automated CI regression testing nearly impossible.
- **Neglected Accessibility:** Motion-controlled interfaces frequently overlook physical fatigue, screen glare, visual impairments, and ergonomic safety.

### The Solution: Haunt Kit

**Haunt Kit** is a modern, full-stack open-source starter kit that turns any smartphone into a responsive spatial motion, orientation, acoustic, and touch controller for web applications:

- **Zero Install:** Players scan a QR code on a shared screen, tap once to approve browser permissions, and immediately begin interacting.
- **Pure TypeScript Gesture Engine:** Zero DOM dependencies, deterministic execution, and mathematical invariants verified by property-based testing.
- **Ghost Recordings:** A capture and replay format that turns real phone motions into reproducible JSON datasets for regression benchmarks and automated CI without physical hardware in the loop.
- **Low-Latency Edge Relay:** Powered by Cloudflare Workers and Durable Objects utilizing WebSocket hibernation for minimal latency and automatic idle sleep.
- **Two Complete Showcase Applications:** Built to prove the framework in real-world environments—a high-energy multiplayer game (**Séance Party**) and a clinical home exercise companion (**Steady**).

---

### Core Components & Features

#### 1. Pure Gesture Recognition & Ghost Recordings (`@haunt-kit/gestures`)

- **9 Specialized Detectors:**
  - _Spatial & Motion:_ `tilt` (continuous pitch/roll with dead zones), `shake` (rotation-invariant magnitude peaks), `hold-still` (motion stillness detector), `flick` (fast angular impulse), `spin` (rapid yaw rate), `flip` (face-up to face-down detection).
  - _Interaction & Bio-Acoustic:_ `scream` (real-time RMS loudness thresholding), `tap` (touch impulse), and `rep` (periodic Range of Motion excursion counter with baseline calibration).
- **Physical Invariants & Property-Based Testing:**
  - Verified with `fast-check` across 5 physical invariants: stillness non-firing, SO(3) 3D spatial rotation invariance, sample rate invariance (30 Hz to 120 Hz), inclusive temporal causality ($t_{\text{start}} \le t_{\text{event}} \le t_{\text{end}}$), and rep counting determinism. All 24 core detector, PBT, and benchmark test files (389 tests) pass locally on Windows, with all 401 package tests passing in GitHub Actions Linux CI.
- **Ghost Recording Benchmarks:**
  - Six real Android recordings benchmark all detectors: stationary table recordings confirm zero false triggers for shake, flick, spin, flip, scream, or rep (tap emitted zero events because recordings contain no touch coordinates), and dynamic lateral rocking confirms that `minDeltaMs2: 8` suppresses high-frequency sensor noise false flicks while preserving genuine impulse detection.

#### 2. Showcase Application: Séance Party (`apps/seance-party`)

A cooperative and competitive party game for 1 to 8 players on a shared display:

- **Ouija Planchette:** Players tilt their smartphones in real time; the game computes an averaged directional vector to collectively steer a mystical planchette across the board.
- **Hold Still or the Ghost Sees You:** A tense freeze-frame challenge where players must freeze in place the moment the ghost turns around.
- **Banshee Scream-off:** An energetic acoustic mini-game where the loudest scream takes the round.
- **Solo & Desktop Playability:** Includes intelligent AI ghost bots that simulate human response latencies and errors, plus a desktop mouse simulator, allowing judges to test multiplayer game loops and simulated exercise flows directly on a laptop without extra players. Real physical motion gestures (tilt, shake, scream, ROM) can then be tested on a smartphone over HTTPS.

#### 3. Showcase Application: Steady (`apps/steady`)

An accessible home physical therapy companion for joint Range of Motion (ROM) tracking and repetition counting:

- **On-Device Biomechanical Tracking:** Uses device motion sensors to measure joint excursion in radial degrees relative to an initial 2.0-second resting baseline calibration.
- **Circular ROM Goniometer Dial (Branch Feature):** Implemented on the `anish/steady-gauge-integration` branch (commit `74d5177`), replacing the horizontal progress bar present on `main` and current production with an accessible 180° circular SVG arc dial with target threshold ticks and dynamic completion feedback.
- **Dual Visual & Spoken Feedback:** Speaks rep counts aloud via the Web Speech API and delivers immediate clinical form guidance if movement tempo is too fast (< 1.2s) or range is incomplete.
- **Voice Only Mode:** Designed specifically for active arm exercises where looking at a screen is ergonomically impractical or hazardous. Unmounts the visual meters in favor of an uncluttered counter and spoken cues.
- **Local Persistence & Printable Reports:** Stores session summaries in IndexedDB without external servers and formats an accessible, on-device printable report that integrates directly with native browser print preview (allowing printing or saving to PDF).
- **Safety First:** Includes an explicit non-medical disclaimer confirming the app is an exercise companion, not a diagnostic or medical device.

---

### Accessibility & Privacy Highlights

- **7:1+ High Contrast Theme:** Custom accessible palette meeting strict AAA/AA contrast criteria across all UI components.
- **Scalable Typography & Reduced Motion:** Text scales gracefully without clipping, and UI animations respect system `@media (prefers-reduced-motion: reduce)` settings.
- **Automated WCAG 2.1 AA Verification:** Playwright and axe (`@axe-core/playwright`) test key flows across Chromium and WebKit with zero violations: all three design system themes, Séance Party lobby, QR host screen, mini-games, and scores, plus Steady's disclaimer, exercise selection, calibration, active tracking, therapist report, and settings screens.
- **Acoustic Privacy:** Raw audio never leaves the phone; microphone input is processed entirely in an on-device `AnalyserNode` to emit a single unitless RMS loudness value (0.0 to 1.0).
- **Data Sovereignty:** Steady exercise sessions remain strictly on the user's device in local IndexedDB.

---

### How We Used Kiro

Haunt Kit was built around **Kiro's spec-driven development and verification workflow**:

- **Spec-Driven Architecture:** Authored formal specifications (`requirements.md`, `design.md`, `tasks.md`) in `.kiro/specs/` across protocols, gesture detectors, and applications before implementing code.
- **Steering Rules:** Maintained shared architecture, privacy, and iPhone compatibility rules in `.kiro/steering/`.
- **Yadnesh's Documented Kiro Workflows:** Yadnesh used Kiro in the IDE in chat across 13 documented interactive sessions to write specifications (`protocol`, `platform`, `seance-party`, `steady`), generate property-based tests with `fast-check`, intentionally plant bugs ("testing the tests") to catch protocol edge cases and prototype pollution, and harden CI/CD pipelines.
- **Anish's Assigned Contributions:** Anish authored the `gestures` specification (`gestures.md`), the Ghost Recording schema, property-based tests across the 5 physical gesture invariants, and the circular ROM gauge specification.
- **Automated Quality Hooks & Custom Agents:** Configured Kiro hooks (`gesture-from-spec.json`, `design-check-on-save.json`) and specialized agents (`gesture-tuner.md`, `spook-designer.md`) to enforce design consistency and detector validation.
- **Séance MCP Server:** Integrated an 8-tool MCP server (`packages/mcp-server`) allowing an AI agent to snapshot phone motion, replay recordings, and inspect room states in real time.
