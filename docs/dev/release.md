# Docker Image Release (CE)

CE image publishing is fully automated by two GitHub Actions workflows. Artifacts are pushed to `ghcr.io/geluzhiwei1/`:

| Trigger | Workflow | Image tags |
|---|---|---|
| every push to master | `snapshot.yml` | `<next-version>-snapshot.<yyyymmdd>.<sha>-ce` (immutable) + `snapshot-ce` (moving pointer) |
| push a `v*` tag | `release.yml` | `X.Y.Z-ce` / `X.Y.Z-ce-production` / `latest-ce` / `latest-ce-production` + GitHub Release |

Core rule: **`latest-*` belongs to formal releases only**. Snapshots never touch latest, so `snapshot-ce` can always be used to try the newest code without affecting production.

## Formal release steps

```bash
# 1. Make sure master is in good shape: both "build" and "snapshot"
#    workflows are green
#    https://github.com/geluzhiwei1/yinghuo-openlabel/actions

# 2. Tag the commit to release and push the tag (explicit key for this host)
git tag v0.4.2
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes" git push origin v0.4.2

# 3. Wait for the release workflow (frontend build + backend assemble check
#    + both images pushed + GitHub Release created)
```

The workflow already includes: frontend build (version stamped into package.json before build), backend `pip install -e .` + app import check (verify before pushing anything). If any step fails, no tag is pushed.

## Tag naming rules

| Tag shape | Behavior |
|---|---|
| `v0.4.2` (pure semver) | all 4 image tags, latest pointers moved, formal GitHub Release |
| `v0.5.0-rc.1` (prerelease suffix) | only `X.Y.Z-rc.1-ce(-production)`, **latest NOT moved**, Release marked prerelease |
| anything else | workflow fails immediately |

## Snapshot version algorithm

Take the newest full-semver git tag (`v0.3` and other legacy short tags are ignored), bump the patch, then append date and short sha. Example: latest tag `v0.4.1` → `0.4.2-snapshot.20260903.1a2b3c4-ce`. If no formal tag exists yet, fall back to the version in `apps/web-app/package.json`.

## Verifying a release

```bash
# Actual tags on ghcr (GITHUB_TOKEN needs write:packages)
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/user/packages/container/yinghuo-backend-ce/versions?per_page=3 \
  | python3 -c "import json,sys;[print(v['updated_at'],v['metadata']['container']['tags']) for v in json.load(sys.stdin)]"

# Once the container is up, hit the version endpoint (public, no auth)
curl http://<host>:8423/version
# → {"version":"0.4.2-ce","git_sha":"...","edition":"ce","channel":"stable"}
```

## Smoke test with docker compose

```bash
cd docker-production
cp env-templates/.env.ce.template .env.ce
# point the image tags in .env.ce at the version you want to verify
docker compose --env-file .env.ce -f docker-compose.ce.yaml up
```

After CE is up, open the [app](http://localhost:6600/guis/yinghuo/home.html), account `prod@geluzhiwei.com` password `yinghuo`.

## Known pitfalls

- **ghcr packages must be linked to the repo**: GITHUB_TOKEN can only push to packages linked to the repository, otherwise `denied: write_package`. For a new package (especially if the first version was pushed manually with a PAT), go to the package settings page → **Manage Actions access → Add repository → Write**. There is no API for this, UI only (both frontend/backend packages were linked on 2026-09-02).
- **ghcr push occasionally hangs**: all layers show "Layer already exists" but the manifest PUT never completes (repo-level failure; re-tagging doesn't help). Fix: tag the image to a brand-new repository name (e.g. `xxx-probe`) and push — layers cross-mount within seconds and the manifest usually succeeds immediately; pushing to the canonical repository afterwards typically works again.
- Don't trust the last line of a piped push; confirm the remote digest with `docker buildx imagetools inspect ghcr.io/...`.
- After changing the backend Dockerfile, run a full local `docker build` before pushing: a global `ARG` before `FROM` is not visible inside a stage (redeclare it in the stage); any file referenced by `COPY` must be committed to git.

## Legacy manual script (archive only)

`scripts/release_docker_image.sh` was the pre-CI manual release path. CE releases **no longer use it**; keep it as a fallback when GitHub Actions is unavailable:

```bash
export GITHUB_TOKEN=ghp_xxx
cd apps/web-app && pnpm install && pnpm run build && cd ../..
scripts/release_docker_image.sh release --version 0.4.2
```
