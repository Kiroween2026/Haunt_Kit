# Contributing

## Branches, commits, pull requests

1. `git checkout main && git pull`
2. `git checkout -b <name>/<topic>` (for example `anish/recordings`)
3. Commit with conventional commits: `feat(gestures): add shake detector`.
4. Before pushing: `pnpm lint && pnpm typecheck && pnpm test`.
5. `git push -u origin <name>/<topic>` and open a pull request into `main`.
6. Never push to someone else's branch. Never push straight to `main`.
7. When you merge something others depend on, post "Merged X, pull main" in team chat.

## Review buddies

| Author  | Reviewer |
| ------- | -------- |
| Yadnesh | Viviana  |
| Anish   | Yadnesh  |
| Viviana | Anish    |

Pull requests that change `packages/protocol` need approval from **all three**.
Review within 12 hours.

## Ownership

See `.kiro/steering/structure.md`. Only change what you own. Ask the owner otherwise.

## Fixing a `pnpm-lock.yaml` conflict

```bash
git checkout origin/main -- pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
git commit
```
