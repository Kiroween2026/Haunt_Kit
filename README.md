# Haunt Kit

Turn any phone into a motion, sound and touch controller for a web app. Scan a QR code, tap once, and your phone's tilt, shakes, mic loudness and taps reach the app. Nothing to install.

Built for the Kiroween 2026 hackathon (Skeleton Crew category).

## Two apps, one kit

- **[Séance Party](apps/seance-party)**: a Halloween party game for 1 to 8 players. Tilt together to steer a Ouija planchette, hold still so the ghost doesn't see you, scream louder than the banshee.
- **[Steady](apps/steady)**: a home physical-therapy rep counter. It counts reps out loud, measures range of motion and builds a report for your therapist. Your data stays on your phone.

## Quickstart

Requirements: Node 22 and pnpm (`corepack enable`).

```bash
git clone https://github.com/Kiroween2026/haunt-kit.git
cd haunt-kit
pnpm install
pnpm test
pnpm dev:seance   # Séance Party
pnpm dev:steady   # Steady
```

To open a local page on an iPhone, motion sensors need HTTPS:

```bash
cloudflared tunnel --url http://localhost:5173
```

## Scripts

| Script                              | What it does                |
| ----------------------------------- | --------------------------- |
| `pnpm test`                         | Run all tests               |
| `pnpm lint`                         | ESLint                      |
| `pnpm typecheck`                    | TypeScript in every package |
| `pnpm format` / `pnpm format:check` | Prettier                    |
| `pnpm build`                        | Build both apps             |

See [CONTRIBUTING.md](CONTRIBUTING.md) for how the team works.

## License

[MIT](LICENSE)
