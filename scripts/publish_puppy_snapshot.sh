#!/usr/bin/env bash
# Publish IB savings snapshot (secret-free JSON only) to GitHub Pages repo.
# Called AFTER: python3 /workspace/ib/export_savings_snapshot.py
# Usage: bash /workspace/puppy-growth/scripts/publish_puppy_snapshot.sh
# Env: IB_SNAPSHOT, PUPPY_DATA, GH_OWNER, GH_REPO, GH_BRANCH
set -euo pipefail
exec bash /workspace/puppy-growth/scripts/sync_savings_snapshot.sh "$@"
