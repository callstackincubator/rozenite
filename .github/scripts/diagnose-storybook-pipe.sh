#!/usr/bin/env bash
# Second diagnostic: does the build's output PIPE close when the build ends?
#
# The first pass redirected stdout to a file and every variant exited in 15s.
# But Turborepo captures task output through a pipe, and a pipe is only at EOF
# once EVERY descendant holding the write end has let go. A build that finishes
# while some grandchild keeps that end open looks exactly like what CI shows:
# output stops, the supervisor waits forever, cleanup reports orphan processes.
#
# So: run the build with stdout on a pipe, wait for it to announce completion,
# then check whether the pipeline actually drains -- and if it does not, print
# what is still alive, which names the culprit.
set -uo pipefail

LABEL="$1"
WAIT="${SB_WAIT:-240}"
DRAIN="${SB_DRAIN:-30}"
MAIN_TS="apps/ui-storybook/.storybook/main.ts"
LOG="$RUNNER_TEMP/$LABEL.log"
SUMMARY="$RUNNER_TEMP/diagnose-summary.txt"

for addon in ${SB_DROP_ADDONS:-}; do
  sed -i "/$addon/d" "$MAIN_TS"
done

rm -rf apps/ui-storybook/storybook-static
: >"$LOG"

start=$(date +%s)
( pnpm --filter ui-storybook exec storybook build ${SB_EXTRA_ARGS:-} 2>&1 | cat >"$LOG" ) &
pipeline=$!

completed=0
for _ in $(seq 1 "$WAIT"); do
  if grep -q "Storybook build completed successfully" "$LOG" 2>/dev/null; then
    completed=1
    break
  fi
  sleep 1
done
completed_at=$(( $(date +%s) - start ))

# The build has said it is done. If the pipe is honest, `cat` sees EOF and the
# pipeline reaps within a second or two.
drained=0
for _ in $(seq 1 "$DRAIN"); do
  if ! kill -0 "$pipeline" 2>/dev/null; then
    drained=1
    break
  fi
  sleep 1
done
drained_at=$(( $(date +%s) - start ))

if [ "$drained" -eq 0 ]; then
  echo "--- $LABEL: pipe STILL OPEN ${drained_at}s in - who is holding it? ---"
  ps -eo pid,ppid,etime,rss,args | grep -E "node|esbuild|vite|storybook|rollup" | grep -v grep || true
  echo "--- descendants with the log pipe still open ---"
  for p in $(pgrep node 2>/dev/null); do
    if ls -l "/proc/$p/fd" 2>/dev/null | grep -q 'pipe:'; then
      printf 'pid %s: %s\n' "$p" "$(tr '\0' ' ' </proc/$p/cmdline 2>/dev/null | cut -c1-140)"
    fi
  done
  pkill -KILL -f 'storybook' 2>/dev/null || true
  kill -KILL "$pipeline" 2>/dev/null || true
fi

git checkout -- "$MAIN_TS"

echo "$LABEL saw-completion=$completed completed-at=${completed_at}s pipe-drained=$drained drained-at=${drained_at}s" | tee -a "$SUMMARY"
echo "--- $LABEL: last 12 log lines ---"
tail -12 "$LOG"
exit 0
