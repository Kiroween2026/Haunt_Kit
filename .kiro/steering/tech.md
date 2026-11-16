# Tech

## Stack

- TypeScript (strict, ES modules, `moduleResolution: "bundler"`), pnpm workspaces.
- Vite + React for apps. Canvas for game scenes.
- Relay: Cloudflare Workers + one Durable Object per room, using the WebSocket hibernation API. Fallback: Node `ws` on Fly.io.
- Static hosting: Cloudflare Pages.
- zod validates every message that crosses the network.
- Tests: Vitest, fast-check (property-based tests), Playwright on WebKit and Chromium.

## Why TypeScript 6 is pinned

`typescript-eslint` does not support TypeScript 7 yet (its peer range is `<6.1.0`). Keep `typescript` at `~6.0.x` until it does. Do not upgrade.

## iPhone rules (the team only has iPhones)

- Motion sensors and the mic need HTTPS. For local dev, use `cloudflared tunnel --url http://localhost:<port>`.
- Call `DeviceMotionEvent.requestPermission()` and `getUserMedia()` from the same user tap.
- Safari pauses pages when the screen locks. Use the Screen Wake Lock API, and auto-rejoin with a `playerId` kept in `localStorage`.
- `speechSynthesis` must start from a tap.
- iPhone Safari has no vibration. Give feedback with screen flash, color and sound.
- iOS and Android report some axes with opposite signs. Normalize them in one function, with tests.

## Code rules

- Gesture detectors are pure functions with no browser APIs.
- No secrets in code or logs. Secrets come from environment variables or GitHub secrets.
