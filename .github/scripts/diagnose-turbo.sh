#!/usr/bin/env bash
# Third diagnostic: the hang is not in the Storybook build, so look at the
# supervisor.
#
# Every hung CI run has the same shape: all visible tasks finish, no
# `Tasks: N successful` summary is ever printed, and cleanup terminates an
# orphan `turbo`. That is turbo failing to shut down, not a task failing to
# finish. Two things turbo does at exit could block on a runner -- send its
# anonymous telemetry (the hung runs printed the first-run telemetry notice,
# so it was unconfigured there) and talk to its daemon.
#
# Each variant runs the same small graph under a hard timeout and reports
# whether the summary line was ever printed.
set -uo pipefail

LABEL="$1"
TIMEOUT="${TURBO_TIMEOUT:-300}"
LOG="$RUNNER_TEMP/$LABEL.log"
SUMMARY="$RUNNER_TEMP/diagnose-summary.txt"

start=$(date +%s)
timeout --signal=SIGKILL "$TIMEOUT" \
  pnpm turbo run build --filter=@rozenite/docs --force ${TURBO_EXTRA_ARGS:-} >"$LOG" 2>&1
code=$?
elapsed=$(( $(date +%s) - start ))

summary_printed=0
grep -qE "Tasks:[[:space:]]+[0-9]+ successful" "$LOG" && summary_printed=1

echo "$LABEL exit=$code elapsed=${elapsed}s summary-printed=$summary_printed" | tee -a "$SUMMARY"
echo "--- $LABEL: last 15 log lines ---"
tail -15 "$LOG"

if [ "$summary_printed" -eq 0 ]; then
  echo "--- $LABEL: processes still alive ---"
  ps -eo pid,ppid,etime,args | grep -E "turbo|node|storybook" | grep -v grep || true
  pkill -KILL -f turbo 2>/dev/null || true
fi

exit 0
