---
name: remote-bluegreen-deploy
description: Use when deploying this image repo from the local machine to a host-managed /image route via local linux/amd64 Docker build, GitHub commit and push for code changes, docker save over ssh, image-blue or image-green-amd64 replacement on ports 3200 and 3201, and nginx snippet cutover.
---

# Remote Blue/Green Deploy

## Overview

Use this skill for production deploys of this repo to a host that serves the frontend on a main-site `/image/` route.
The safe default is to finish local code changes first, commit and push them when code changed, then let the repo script build a local `linux/amd64` image, transfer it over ssh, replace the inactive color, and switch only the `/image/` nginx snippet.

Prefer the repo script:

- `/Users/ming/project/image/scripts/deploy/bluegreen-host.sh`

Reference docs live here:

- `/Users/ming/project/image/docs/installation/bluegreen-host-image-runbook.md`

## Default Example Shape

- Local repo: `/Users/ming/project/image`
- Git remote (SSH): `git@github.com:eve1329/image.git`
- Remote SSH alias: `newapi-16`
- Remote env file: `/root/image/deploy/bluegreen-host.env`
- Public URL: `https://artworkers.top/image/`
- Nginx site: `/etc/nginx/sites-enabled/artworkers.top`
- Nginx snippet: `/etc/nginx/snippets/gpt-image-playground-image.conf`
- Blue: `image-blue`, port `3200`
- Green: `image-green-amd64`, port `3201`
- Build policy: build locally as `linux/amd64`; do not rebuild from source on the remote host
- Runtime contract:
  - `DEFAULT_API_URL=https://artworkers.top/v1`
  - `ENABLE_API_PROXY=false`
  - `LOCK_API_PROXY=false`

If the target host differs, override `--remote`, `--nginx-site`, `--public-url`, or the matching `BLUEGREEN_*` env vars instead of editing app source.

## Safety Rules

- Do not edit app source files directly on the remote host or inside remote containers.
- Make code changes only in the local repo, verify locally, then deploy by building a local image and loading it remotely.
- When a deploy includes code changes, commit and push only the intended local files before deploying.
- Do not include unrelated dirty worktree changes in a deployment commit.
- Do not change the public route shape. Keep the site at `<main-site>/image/`.
- Do not enable container `/api-proxy/` for this deployment path.
- Keep rollback containers. The script renames the replaced color to `*-pre-deploy-*` and starts a fresh standard container name with `docker run`.

## Workflow

0. Finish local edits and focused validation in `/Users/ming/project/image`.

1. If code changed, commit and push first:

```bash
git status --short
git diff --stat
git remote -v
git add <files-for-this-deploy>
git commit -m "<deploy change summary>"
git push origin HEAD
```

2. Prefer the repo deployment script:

```bash
scripts/deploy/bluegreen-host.sh
```

Useful variants:

```bash
scripts/deploy/bluegreen-host.sh --skip-build --image-tag image:codex-20260612183000
```

```bash
scripts/deploy/bluegreen-host.sh --build-source worktree --allow-dirty-worktree
```

Behavior of the script:

- defaults to a clean `git archive HEAD` build context when the local worktree is dirty, so unrelated local changes are not deployed by accident;
- builds a local `linux/amd64` image;
- transfers it with `docker save | ssh <remote> docker load`;
- updates the inactive color image tag in `/root/image/deploy/bluegreen-host.env`;
- preserves the old color as a renamed `*-pre-deploy-*` rollback container;
- recreates the standard running container name with `docker run`;
- verifies the standby color over loopback for `/`, `/manifest.webmanifest`, and `/sw.js`;
- updates only the `/image/` nginx snippet and verifies public HTML contains `GPT Image Playground`.

3. If you must inspect topology before deploy:

```bash
ssh newapi-16 'docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}" | grep -E "^image-(blue|green-amd64)" || true'
ssh newapi-16 'grep -n "proxy_pass http://127.0.0.1:320[01]/" /etc/nginx/snippets/gpt-image-playground-image.conf || true'
ssh newapi-16 'for p in 3200 3201; do printf "%s " "$p"; curl -fsS --max-time 5 "http://127.0.0.1:$p/" | grep -qi "GPT Image Playground" && echo ok || echo fail; done'
```

4. If the remote env file is missing, initialize it from:

- `/Users/ming/project/image/deploy/bluegreen-host.env.example`

5. After deploy, verify:

```bash
curl -I https://artworkers.top/image/
curl -fsS https://artworkers.top/image/ | grep -i "GPT Image Playground"
```

## Rollback

- If the candidate fails before nginx cutover, keep nginx unchanged and inspect candidate logs.
- If the candidate fails after cutover, switch the snippet back to the old port and reload nginx.
- Do not remove renamed rollback containers until the new color is stable.

## Handoff

After deployment, update `/Users/ming/project/image/.agents/state/process.md` with:

- image tag built and transferred
- commit hash and pushed branch when code changed
- active public color and port
- verification commands that actually passed
- remaining rollback notes or follow-up checks
