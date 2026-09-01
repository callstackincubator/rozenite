#!/usr/bin/env bash
# One variant of the Storybook hang diagnostic (see
# .github/workflows/diagnose-storybook-hang.yml). Never fails the step: a
# timeout is a RESULT here, not an error.
#
# SB_EXTRA_ARGS  extra flags passed to `storybook build`
# SB_DROP_ADDONS space-separated substrings; matching lines are removed from
#                .storybook/main.ts before building, then restored after
set -uo pipefail

LABEL="$1"
TIMEOUT="${SB_TIMEOUT:-300}"
MAIN_TS="apps/ui-storybook/.storybook/main.ts"
LOG="$RUNNER_TEMP/$LABEL.log"
SUMMARY="$RUNNER_TEMP/diagnose-summary.txt"

for addon in ${SB_DROP_ADDONS:-}; do
  sed -i "/$addon/d" "$MAIN_TS"
done

echo "--- $LABEL: addons in play ---"
sed -n '/addons: \[/,/\]/p' "$MAIN_TS"

rm -rf apps/ui-storybook/storybook-static

start=$(date +%s)
# SIGKILL rather than SIGTERM: a process that will not exit on its own may
# well ignore a polite signal, and then the step hangs instead of reporting.
timeout --signal=SIGKILL "$TIMEOUT" \
  pnpm --filter ui-storybook exec storybook build ${SB_EXTRA_ARGS:-} >"$LOG" 2>&1
code=$?
elapsed=$(( $(date +%s) - start ))

# Restore main.ts so the next variant starts from the committed state.
git checkout -- "$MAIN_TS"

completed=0
grep -q "Storybook build completed successfully" "$LOG" && completed=1

output_present=0
[ -d apps/ui-storybook/storybook-static ] && output_present=1

line="$LABEL exit=$code elapsed=${elapsed}s saw-completion=$completed output-dir=$output_present"
echo "$line" | tee -a "$SUMMARY"

echo "--- $LABEL: last 25 log lines ---"
tail -25 "$LOG"

exit 0
