#!/usr/bin/env bash
# Post-deploy check: the site answers and carries the security headers.
# Usage: scripts/smoke.sh <base-url> [production|preview]
# Set PREVIEW_PASSWORD in the environment to check a password-protected preview.
set -euo pipefail
base="${1:?usage: smoke.sh <base-url> [production|preview]}"
mode="${2:-preview}"
base="${base%/}"
auth=()
[[ -n "${PREVIEW_PASSWORD:-}" ]] && auth=(-u "bsml:${PREVIEW_PASSWORD}")

fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }

for attempt in 1 2 3 4 5 6; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${auth[@]}" "$base/" || true)
  [[ "$code" == "200" ]] && break
  echo "Home page returned $code, retrying ($attempt)..."; sleep 5
done

headers=$(curl -sS -D - -o /dev/null "${auth[@]}" "$base/")
health=$(curl -sS "$base/__health")
lc=$(printf '%s' "$headers" | tr 'A-Z' 'a-z')

check "home page returns 200"            '[[ "$code" == "200" ]]'
check "health endpoint ok"               '[[ "$health" == *"\"status\":\"ok\""* ]]'
check "content-security-policy"          '[[ "$lc" == *"content-security-policy"* ]]'
check "x-content-type-options nosniff"   '[[ "$lc" == *"x-content-type-options: nosniff"* ]]'
check "x-frame-options deny"             '[[ "$lc" == *"x-frame-options: deny"* ]]'
check "referrer-policy"                  '[[ "$lc" == *"referrer-policy:"* ]]'
check "permissions-policy"               '[[ "$lc" == *"permissions-policy:"* ]]'
if [[ "$mode" == "production" ]]; then
  check "hsts on production"             '[[ "$lc" == *"strict-transport-security:"* ]]'
  check "production is indexable"        '[[ "$lc" != *"x-robots-tag"* ]]'
else
  check "preview is not indexed"         '[[ "$lc" == *"x-robots-tag: noindex"* ]]'
fi

echo "health: $health"
exit "$fail"
