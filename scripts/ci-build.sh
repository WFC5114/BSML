#!/usr/bin/env bash
# Builds the site into ./dist for Cloudflare, whatever package manager the app uses.
# Until the app exists, publishes a one-page placeholder so the pipeline can be proven.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f package.json ]]; then
  echo "No package.json yet: publishing the placeholder page."
  rm -rf dist && mkdir -p dist
  cp scripts/placeholder/index.html dist/index.html
  cp scripts/placeholder/index.html dist/404.html
  exit 0
fi

if [[ -f pnpm-lock.yaml ]]; then
  corepack enable
  pnpm install --frozen-lockfile
  pnpm run build
elif [[ -f yarn.lock ]]; then
  corepack enable
  yarn install --immutable
  yarn build
elif [[ -f bun.lock || -f bun.lockb ]]; then
  bun install --frozen-lockfile
  bun run build
elif [[ -f package-lock.json ]]; then
  npm ci
  npm run build
else
  npm install
  npm run build
fi

if [[ ! -f dist/index.html ]]; then
  echo "::error::The build did not produce dist/index.html. The app must build its static output to ./dist (see wrangler.jsonc)."
  exit 1
fi
