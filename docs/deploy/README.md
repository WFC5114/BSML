# Deployment

The site runs on Cloudflare Workers with static assets. Step-by-step runbooks for setup, releases, rollback and monitoring are kept with the project files (`bsml/deploy/setup.md` and `bsml/deploy/operations.md`); this page is the technical summary.

## Contract with the app
- `scripts/ci-build.sh` produces `./dist`: with a `package.json` it installs with the lockfile's package manager and runs `build` (which must write a static site to `./dist`); with only a root `index.html` (the current mockup) it copies the site files and leaves out docs, tools, i18n sources, QA, config and Markdown; with neither it publishes a placeholder.
- Same-origin only: no third-party scripts, fonts, analytics or embeds (the CSP in `worker/index.ts` blocks them, and many are unreachable from mainland China). Self-host fonts. Avoid inline `<script>`; inline styles are allowed.
- Fingerprinted files under `/_astro/`, `/assets/`, `/_next/static/` or with a hash in the name are cached for a year.

## Workers
| Worker | Config | Serves |
|---|---|---|
| `bsml-site` | top level of `wrangler.jsonc` | production, custom domain only |
| `bsml-site-preview` | `env.preview` | staging (`main`) and per-PR preview aliases `pr-<n>` |

## Workflows
| File | Trigger | Does |
|---|---|---|
| `deploy-preview.yml` | PR, push to `main` | build, upload preview alias / deploy staging, smoke test, PR comment |
| `deploy-production.yml` | manual, type `deploy` | build, deploy production, smoke test |
| `rollback-production.yml` | manual | `wrangler rollback` to previous or given version |
| `uptime.yml` | every 30 min | smoke test production and staging |
| `security.yml` | PR, push | gitleaks secret scan, worker typecheck and local smoke test |

Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, optional `PREVIEW_PASSWORD`. Variables: `PRODUCTION_URL`, `STAGING_URL`.

## Local check
```sh
scripts/ci-build.sh
npx wrangler@4.149.0 dev --env preview
scripts/smoke.sh http://localhost:8787 preview
```
