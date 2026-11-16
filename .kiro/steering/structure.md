# Structure

```
haunt-kit/
├── apps/
│   ├── seance-party/     Viviana  Party game (big screen)
│   └── steady/           Anish    Physical-therapy rep counter (one phone)
├── packages/
│   ├── protocol/         Yadnesh  Message types and schemas (shared contract)
│   ├── relay/            Yadnesh  Cloudflare Worker + Durable Object
│   ├── controller/       Yadnesh  Phone controller web app + desktop simulator
│   ├── host-sdk/         Yadnesh  SDK apps use to create rooms and read input
│   ├── mcp-server/       Yadnesh  Séance MCP server for Kiro
│   ├── gestures/         Anish    Detectors, Ghost Recordings, replay
│   └── ui/               Viviana  Design system (haunted + lantern themes)
├── recordings/           Anish    Ghost Recordings (real phone sensor data, JSON)
├── spikes/               anyone   Throwaway experiments, not part of the build
├── .kiro/                         Steering, specs, hooks, agents (always committed)
└── KIRO_LOG.md           everyone Real Kiro events, for the writeup
```

## Rules

- Only change packages you own. Ask the owner before touching theirs.
- Changes to `packages/protocol` need all three owners to agree.
- Apps use the kit only through `@haunt-kit/host-sdk`, `@haunt-kit/gestures` and `@haunt-kit/ui`.
- Each component has a spec in `.kiro/specs/<name>/`.
- Branches: `<name>/<topic>`, e.g. `yadnesh/protocol`.
- Conventional commits: `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, `chore: ...`, `test: ...`, `ci: ...`.
- Tests live next to the code as `*.test.ts` or `*.test.tsx`.
- Log real Kiro wins (bugs caught, time saved) in `KIRO_LOG.md`.
