---
name: qa-release-check
description: Verifies repository status, branch sync with origin/main, unit test pass, environment config sanity, and smoke test build prior to deployment.
---

# QA Release Readiness Procedure

1. Confirm target branch is `main`, working tree is clean (`git status --porcelain`), and current branch is up to date with `origin/main`.
2. Run `npm test` and require zero failing tests.
3. Confirm `.env.example` is current and no `.env` is staged for commit.
4. Confirm `docker compose up -d --build` succeeds locally and `curl localhost:3000/stats` returns 200.
5. Output GO / NO-GO status: GO only if steps 1-4 all pass; otherwise NO-GO with the specific failing step.