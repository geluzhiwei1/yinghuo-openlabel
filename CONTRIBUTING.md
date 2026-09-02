# Contributing to Yinghuo-OpenLabel

Thanks for your interest in Yinghuo-OpenLabel! Contributions of any form are welcome: filing issues, fixing bugs, adding features, improving docs.

## Environment

- **Node**: pnpm (enforced by `preinstall` via `only-allow pnpm`). Node 20+ recommended.
- **Python**: 3.12+. Package manager is **uv** (`uv sync`).
- **Infrastructure**: PostgreSQL / FerretDB / Redis. For local dev, bring them up with `docker/docker-compose-dev.yaml`.

Full dev setup: see [docs/dev/start-ce.md](docs/dev/start-ce.md) and `scripts/dev/start-ce.bash`.

## Workflow

1. Fork and clone the repo, then branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
2. Before changing anything, make sure the existing tests pass. After your change:
   - Frontend (in `apps/web-app/`): `pnpm type-check`, `pnpm test:unit`
   - Backend (in `services/web-api/`): `pytest`
3. Open a PR. Title and description in **Simplified Chinese** (matches repo convention) — explain the motivation, the change, and how you verified it.
4. Wait for a maintainer review, then merge.

## Conventions

- **Language**: code comments, commit messages, and issue/PR discussion use Simplified Chinese. User-visible UI strings are also in Chinese.
- **Config**: services load config from a YAML pointed to by `YH_CONFIG_FILE`. Never commit configs containing real secrets or internal addresses.
- **Annotation contract**: the `Mission` enum in `apps/web-app/src/constants.ts` is the wire contract with backend Mongo collections. Changing it requires coordinated frontend + backend changes; call it out in the PR.
- **API style**: new routers are mounted in `services/web-api/src/yinghuo_app/apps/init_app.py`. Follow the existing prefix and auth conventions — see [docs/dev/architecture.md](docs/dev/architecture.md).
- **Roadmap status**: features are tagged `[√]` done / `[-]` in progress / `[ ]` planned in the two top-level READMEs. When a new feature lands, update the relevant row.

## Reporting issues

Before opening an issue:

1. Search existing issues to avoid duplicates.
2. Use the issue templates (bug / feature) and include: version, deployment mode (Docker / source), browser and backend logs.

**Security issues**: do **not** open a public issue. See [SECURITY.md](SECURITY.md).

## License

By submitting a contribution, you agree to release it under AGPL-3.0.
