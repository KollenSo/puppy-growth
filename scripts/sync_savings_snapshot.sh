#!/usr/bin/env bash
# Copy Finance IB savings snapshot into puppy-growth for GitHub Pages.
# Does NOT call IBKR. Safe to run after:
#   python3 /workspace/ib/export_savings_snapshot.py
set -euo pipefail

SRC="${IB_SNAPSHOT:-/workspace/ib/savings_snapshot.json}"
DST_LOCAL="${PUPPY_DATA:-/workspace/puppy-growth/data/savings_snapshot.json}"
LOG="${SYNC_LOG:-/workspace/puppy-growth/scripts/sync_savings_snapshot.log}"

ts() { date '+%Y-%m-%d %H:%M:%S %Z'; }

if [[ ! -f "$SRC" ]]; then
  echo "$(ts) ERROR: missing source $SRC" | tee -a "$LOG"
  exit 1
fi

mkdir -p "$(dirname "$DST_LOCAL")"
cp -f "$SRC" "$DST_LOCAL"
echo "$(ts) Copied $SRC -> $DST_LOCAL ($(wc -c < "$DST_LOCAL") bytes)" | tee -a "$LOG"

# Optional: if gh is authenticated, push to GitHub so Pages rebuilds.
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  OWNER="${GH_OWNER:-KollenSo}"
  REPO="${GH_REPO:-puppy-growth}"
  PATH_IN_REPO="data/savings_snapshot.json"
  BRANCH="${GH_BRANCH:-main}"
  CONTENT=$(cat "$DST_LOCAL")
  SHA=$(gh api "repos/$OWNER/$REPO/contents/$PATH_IN_REPO" --jq .sha 2>/dev/null || true)
  if [[ -n "${SHA:-}" ]]; then
    # base64 without newlines
    B64=$(base64 -w0 "$DST_LOCAL" 2>/dev/null || base64 "$DST_LOCAL" | tr -d '\n')
    gh api --method PUT "repos/$OWNER/$REPO/contents/$PATH_IN_REPO" \
      -f message="chore: sync savings_snapshot $(date -u +%Y-%m-%dT%H:%MZ)" \
      -f content="$B64" \
      -f sha="$SHA" \
      -f branch="$BRANCH" >/dev/null
    echo "$(ts) Pushed to GitHub $OWNER/$REPO@$BRANCH:$PATH_IN_REPO via gh" | tee -a "$LOG"
  else
    echo "$(ts) WARN: could not read remote file SHA; local copy only" | tee -a "$LOG"
  fi
elif [[ "${REQUIRE_PUSH:-0}" == "1" ]]; then
  echo "$(ts) ERROR: gh not authenticated but REQUIRE_PUSH=1" | tee -a "$LOG"
  exit 2
else
  echo "$(ts) NOTE: gh not authenticated — local copy only; agent routine should push via GitHub connector" | tee -a "$LOG"
fi
