#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@68.183.212.112}"
REMOTE_DIR="${REMOTE_DIR:-~/timecafe/Time-cafe-backend}"
MODE="${1:-dry-run}"

if [[ "$MODE" == "execute" ]]; then
  ssh "$VPS_HOST" "cd $REMOTE_DIR && npx ts-node scripts/cleanup-demo-guest-bookings.ts --execute"
else
  ssh "$VPS_HOST" "cd $REMOTE_DIR && npx ts-node scripts/cleanup-demo-guest-bookings.ts"
fi
