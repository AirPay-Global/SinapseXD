#!/bin/bash
# Sinapse session-start hook (Claude Code on the web).
#
# Primary job: defend against the ephemeral container re-cloning the repo at a
# stale commit — fast-forward the checkout to the true remote HEAD before the
# session begins. Secondary: restore Python + Node deps the fresh container
# loses, so tests and linters run.
#
# Non-fatal by design: every step is best-effort and the hook always exits 0,
# so a transient failure never blocks session start.
set -uo pipefail

# Only run in the remote (web/app) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# ── 1. Sync the checkout to the true remote HEAD ────────────────────────────
# Only fast-forwards a clean tree, and never destroys uncommitted work.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)"
  if [ "$BRANCH" != "HEAD" ]; then
    echo "session-start: fetching origin/$BRANCH"
    git fetch origin "$BRANCH" 2>/dev/null || true
    if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
      if git merge --ff-only "origin/$BRANCH" 2>/dev/null; then
        echo "session-start: fast-forwarded to $(git rev-parse --short HEAD)"
      else
        echo "session-start: already current or diverged; leaving checkout as-is"
      fi
    else
      echo "session-start: uncommitted changes present; skipping git sync"
    fi
  fi
fi

# ── 2. Restore Python pipeline deps ─────────────────────────────────────────
if [ -f packages/pipeline/requirements-dev.txt ]; then
  echo "session-start: installing Python pipeline deps"
  pip3 install -q -r packages/pipeline/requirements-dev.txt 2>/dev/null || \
    echo "session-start: pip install failed (non-fatal)"
fi

# ── 3. Restore Node workspace deps ──────────────────────────────────────────
if [ -f package.json ] && command -v pnpm >/dev/null 2>&1; then
  echo "session-start: installing Node workspace deps"
  pnpm install --silent 2>/dev/null || echo "session-start: pnpm install failed (non-fatal)"
fi

echo "session-start: done"
exit 0
