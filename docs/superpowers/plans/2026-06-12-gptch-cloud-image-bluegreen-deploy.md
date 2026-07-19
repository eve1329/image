# Host-Managed /image Blue/Green Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add repo-owned deployment assets and documentation for rolling this frontend out to a host-managed `/image/` route on the existing API host, then verify and execute the rollout safely.

**Architecture:** Keep the app as a static SPA container built from this repo, ship a `linux/amd64` image to the existing server over `docker save | ssh <remote> docker load`, run blue/green containers on loopback ports `3200/3201`, and switch host nginx by editing only a dedicated `/image/` snippet include. The current default example keeps requesting `https://artworkers.online/v1` directly, with the container-side `/api-proxy/` disabled.

**Tech Stack:** Bash, Docker Buildx, Nginx, SSH/SCP, Node.js, Vite, Vitest

---

### Task 1: Add deployment assets and repo handoff state

**Files:**
- Modify: `.gitignore`
- Modify: `.agents/state/process.md`
- Create: `scripts/deploy/bluegreen-host.sh`
- Create: `deploy/bluegreen-host.env.example`
- Create: `deploy/nginx.image-snippet.conf.example`
- Create: `docs/installation/bluegreen-host-image-runbook.md`

- [x] **Step 1: Write the file changes**

```text
- Ignore `.agents/` in git so repo-local handoff state stays local.
- Replace placeholder content in `.agents/state/process.md` with the current task, inspected facts, constraints, and next step.
- Add `scripts/deploy/bluegreen-host.sh` with:
  - defaults:
    - remote=`newapi-16`
    - remote env file=`/root/image/deploy/bluegreen-host.env`
    - nginx site=`/etc/nginx/sites-enabled/artworkers.online`
    - nginx snippet=`/etc/nginx/snippets/gpt-image-playground-image.conf`
    - public url=`https://artworkers.online/image/`
  - flags:
    - `--image-tag`
    - `--skip-build`
    - `--build-source <head|worktree>`
    - `--allow-dirty-worktree`
    - `--remote`
    - `--remote-env-file`
    - `--nginx-site`
    - `--nginx-snippet`
    - `--public-url`
  - local behavior:
    - show git status
    - default to building from clean `HEAD`
    - refuse dirty worktree for `--build-source worktree` unless `--allow-dirty-worktree`
    - build `docker buildx build --platform linux/amd64 -f deploy/Dockerfile -t <tag> --load .`
    - verify image inspect reports `os=linux arch=amd64`
    - transfer with `docker save | ssh <remote> docker load`
  - remote behavior:
    - load env file
    - detect active port from the dedicated nginx snippet (`3200` or `3201`)
    - determine standby color and target port
    - stop any running `*-pre-deploy-*` backups for the target color
    - rename existing target container to `*-pre-deploy-*`
    - `docker run -d` target container with bridge networking and `-p 127.0.0.1:<port>:80`
    - pass `DEFAULT_API_URL=https://artworkers.online/v1`, `ENABLE_API_PROXY=false`, `LOCK_API_PROXY=false`, `HOST=0.0.0.0`, `PORT=80` from env defaults
    - health-check target loopback root, `manifest.webmanifest`, and `sw.js`
    - write or update the nginx snippet so only `/image/` is proxied to the active port
    - ensure the main nginx site includes that snippet before `location /`
    - run `nginx -t && systemctl reload nginx`
    - verify public URL HTML contains `GPT Image Playground`
    - keep the old color running for rollback
- Add `deploy/bluegreen-host.env.example` documenting:
  - `APP_BLUE_IMAGE`
  - `APP_GREEN_IMAGE`
  - `BLUE_CONTAINER`
  - `GREEN_CONTAINER`
  - `BLUE_PORT`
  - `GREEN_PORT`
  - `DEFAULT_API_URL`
  - `ENABLE_API_PROXY`
  - `LOCK_API_PROXY`
  - `HOST`
  - `PORT`
- Add `deploy/nginx.image-snippet.conf.example` with:
  - `location = /image { return 301 /image/; }`
  - `location ^~ /image/ { proxy_pass http://127.0.0.1:3200/; ... }`
- Add `docs/installation/bluegreen-host-image-runbook.md` covering:
  - remote prep
  - one-time nginx include integration
  - deploy command
  - rollback by switching snippet port
  - public and standby verification commands
```

- [x] **Step 2: Review the new files for contract consistency**

Run: `sed -n '1,260p' scripts/deploy/bluegreen-host.sh && printf '\n---\n' && sed -n '1,220p' deploy/bluegreen-host.env.example && printf '\n---\n' && sed -n '1,220p' deploy/nginx.image-snippet.conf.example && printf '\n---\n' && sed -n '1,260p' docs/installation/bluegreen-host-image-runbook.md`
Expected: defaults, ports, container names, snippet path, and public URL all match the approved plan.

- [ ] **Step 3: Commit the deployment assets**

```bash
git add .gitignore .agents/state/process.md \
  scripts/deploy/bluegreen-host.sh \
  deploy/bluegreen-host.env.example \
  deploy/nginx.image-snippet.conf.example \
  docs/installation/bluegreen-host-image-runbook.md
git commit -m "docs: add gptch cloud image deploy assets"
```

### Task 2: Update user-facing deployment documentation

**Files:**
- Modify: `README.md`
- Test: `README.md`

- [x] **Step 1: Update the Docker/deployment documentation**

```text
- Keep existing generic Docker usage docs, but add a focused subsection for the same-host `/image` deployment.
- State clearly that this deployment:
  - runs on the same host as `new-api`
  - publishes under `/image/`
  - keeps `new-api` on `/` and `/v1`
  - sets `DEFAULT_API_URL=https://artworkers.online/v1`
  - disables container `/api-proxy/`
- Link to `docs/installation/bluegreen-host-image-runbook.md`
- Include the main release command:
  - `bash scripts/deploy/bluegreen-host.sh`
- Include the image-tag-only refresh form:
  - `bash scripts/deploy/bluegreen-host.sh --skip-build --image-tag image:codex-<timestamp>`
```

- [x] **Step 2: Verify the README section renders as expected**

Run: `rg -n "artworkers.online/image|bluegreen-host.sh|bluegreen-host-image-runbook" README.md`
Expected: all three anchors appear in the deployment section.

- [ ] **Step 3: Commit the README update**

```bash
git add README.md
git commit -m "docs: document gptch cloud image rollout"
```

### Task 3: Run local verification

**Files:**
- Verify: `package-lock.json`
- Verify: `src/**/*.test.ts`
- Verify: `deploy/Dockerfile`

- [ ] **Step 1: Install dependencies**

Run: `npm ci`
Expected: install succeeds with exit code 0.

- [ ] **Step 2: Run the test suite**

Run: `npm run test`
Expected: Vitest exits 0 with no failing tests.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: TypeScript build and Vite build both succeed; `dist/` is produced.

- [ ] **Step 4: Build the production amd64 Docker image**

Run: `docker buildx build --platform linux/amd64 -f deploy/Dockerfile -t image:plancheck --load .`
Expected: image build succeeds and `docker image inspect image:plancheck --format 'os={{.Os}} arch={{.Architecture}}'` prints `os=linux arch=amd64`.

- [ ] **Step 5: Commit only if verification required code/doc fixes**

```bash
git add <files-fixed-during-verification>
git commit -m "fix: address local deploy verification issues"
```

### Task 4: Prepare remote host and execute rollout

**Files:**
- Remote: `/root/image/deploy/bluegreen-host.env`
- Remote: `/etc/nginx/sites-enabled/artworkers.online`
- Remote: `/etc/nginx/snippets/gpt-image-playground-image.conf`

- [ ] **Step 1: Copy the env example and fill the initial host values**

Run: `scp deploy/bluegreen-host.env.example root:/root/image/deploy/bluegreen-host.env`
Expected: remote env file exists for first-time editing.

- [ ] **Step 2: Apply the one-time nginx include integration**

Run: `ssh newapi-16 "python3 - <<'PY'\nfrom pathlib import Path\nsite = Path('/etc/nginx/sites-enabled/artworkers.online')\ntext = site.read_text()\nneedle = '    location / {'\ninclude = '    include /etc/nginx/snippets/gpt-image-playground-image.conf;\\n'\nif include not in text:\n    text = text.replace(needle, include + needle, 1)\n    site.write_text(text)\nPY\nnginx -t && systemctl reload nginx"`
Expected: nginx config test passes and the site now includes the image snippet before the root location.

- [ ] **Step 3: Run the deploy script**

Run: `bash scripts/deploy/bluegreen-host.sh`
Expected: local build, image transfer, standby container replacement, snippet cutover, nginx reload, standby curl checks, and public verification all succeed.

- [ ] **Step 4: Verify the public route and static assets**

Run: `curl -I https://artworkers.online/image/ && curl -fsS https://artworkers.online/image/ | grep -i "GPT Image Playground"`
Expected: HTTP headers return success/redirect as expected and HTML contains `GPT Image Playground`.

- [ ] **Step 5: Verify API path assumptions manually**

```text
- Open `https://artworkers.online/image/` in a browser.
- Confirm static resources load from `/image/assets/...`.
- Confirm the default API URL in the UI resolves to `https://artworkers.online/v1`.
- Confirm network requests go to `/v1/...`, not `/image/api-proxy/...`.
- Use a valid test key to verify at least `GET /v1/models` or one minimal image-generation request.
```

- [ ] **Step 6: Record rollback command path**

Run: `ssh root "sed -n '1,200p' /etc/nginx/snippets/gpt-image-playground-image.conf"`
Expected: snippet clearly shows the active port so rollback can switch it back to the old color with `nginx -t && systemctl reload nginx`.

### Task 5: Final verification and handoff refresh

**Files:**
- Modify: `.agents/state/process.md`

- [ ] **Step 1: Refresh the handoff file with actual verification outcomes**

```text
- Update `Done`, `Verification`, and `Next Step` in `.agents/state/process.md`.
- Record exact local verification commands and remote/public verification results.
- If the deployment is live, note the active color and rollback target.
```

- [ ] **Step 2: Verify git status is understandable**

Run: `git status --short`
Expected: only intentional tracked changes remain, plus ignored local `.agents/`.

- [ ] **Step 3: Prepare the completion summary**

```text
- Summarize:
  - what was added
  - what passed locally
  - what was deployed remotely
  - any residual risk (for example, if browser/manual API verification was limited)
```
