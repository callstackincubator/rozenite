#!/usr/bin/env bash
# Fourth diagnostic. Pass 3 caught the hang red-handed: `rspress build` alive
# for 4m58s with no output, Storybook never even reached (the `&&` had not
# fired). The website's plugin directory fetches api.github.com and
# registry.npmjs.org AT BUILD TIME, with no timeout and no AbortSignal, and
# undici's default headers timeout is 300s -- which is exactly how long that
# process had been sitting there.
#
# So: time both endpoints from a runner, then time a full rspress build with a
# generous ceiling to see whether it merely takes N x 300s or never finishes.
set -uo pipefail

SUMMARY="$RUNNER_TEMP/diagnose-summary.txt"

probe() {
  local label="$1" url="$2"
  local start elapsed status
  start=$(date +%s)
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 \
    -H 'User-Agent: rozenite-website' "$url" 2>/dev/null || echo "curl-failed")
  elapsed=$(( $(date +%s) - start ))
  echo "$label status=$status elapsed=${elapsed}s" | tee -a "$SUMMARY"
}

probe "NET-github-api" "https://api.github.com/repos/callstackincubator/rozenite"
probe "NET-npm-registry" "https://registry.npmjs.org/@rozenite/redux-devtools-plugin"

# The same call the build makes, through Node's fetch rather than curl, since
# undici is what actually governs the timeout behaviour here.
cat >"$RUNNER_TEMP/probe.mjs" <<'JS'
const urls = [
  'https://api.github.com/repos/callstackincubator/rozenite',
  'https://registry.npmjs.org/@rozenite/redux-devtools-plugin',
];
for (const url of urls) {
  const start = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'rozenite-website' } });
    console.log(`NODE-FETCH ${url} status=${res.status} elapsed=${Date.now() - start}ms`);
  } catch (error) {
    console.log(`NODE-FETCH ${url} threw=${error.message} elapsed=${Date.now() - start}ms`);
  }
}
JS
timeout --signal=SIGKILL 120 node "$RUNNER_TEMP/probe.mjs" 2>&1 | tee -a "$SUMMARY"
echo "NODE-FETCH-step exit=$?" | tee -a "$SUMMARY"

# Does rspress alone ever finish, given room?
start=$(date +%s)
timeout --signal=SIGKILL "${RSPRESS_TIMEOUT:-900}" \
  pnpm --filter @rozenite/docs exec rspress build >"$RUNNER_TEMP/rspress.log" 2>&1
code=$?
elapsed=$(( $(date +%s) - start ))
echo "RSPRESS-alone exit=$code elapsed=${elapsed}s" | tee -a "$SUMMARY"
echo "--- rspress log tail ---"
tail -25 "$RUNNER_TEMP/rspress.log"

exit 0
