# BSML QA suite

Automated checks for the BSML website, run by `.github/workflows/qa.yml` on every pull request. The full test plan (what is tested, why, and what stays manual) is kept in the project files as `bsml/qa/test-plan.md`; the IDs below (LANG-3, COPY-1…) match it.

| File | Covers |
|---|---|
| `tests/smoke.spec.ts` | NAV: every page in every language loads, assets exist, no console errors, unique titles, 404 page |
| `tests/languages.spec.ts` | LANG: `/en/ /zh-hans/ /zh-hant/ /es/`, `<html lang>`, absolute hreflang, auto-detect from device language, manual choice remembered, same-page switching, Simplified vs Traditional characters, untranslated English, no overflow at 320/768/1440px |
| `tests/story.spec.ts` | STORY: chapters as real text, deep links (`#1984`), "Skip to today", reduced motion, fast jumps, gentle 2020 copy |
| `tests/a11y.spec.ts` | A11Y: axe WCAG 2.2 AA (serious/critical fail), one h1, landmarks, skip link, keyboard focus, aria-expanded, alt text, 24px touch targets |
| `tests/copy.spec.ts` + `copy-rules.json` | COPY: nothing cult-like (EN/ZH/ES word lists), no Harry Potter IP, no placeholders, no medical claims, AI never the headline |
| `tests/china-safe.spec.ts` | PERF-5: nothing loaded from Google, YouTube, Facebook, X, `pages.dev`, `workers.dev` |
| `lighthouserc.cjs` | PERF-1..3: Lighthouse mobile scores and LCP/CLS/TBT/weight budgets |

## Run it

```bash
cd qa && npm ci && npx playwright install chromium webkit
QA_SITE_DIR=../dist npm test                 # test a built site folder
QA_BASE_URL=https://preview.example npm test # test a deployed preview
npm run test:fixture                         # self-test against the bundled sample site
npm run lighthouse                           # Lighthouse budgets (uses QA_SITE_DIR or QA_BASE_URL)
```

## What the suite expects from the site

The suite is written against the project map's decisions. If the app chooses differently, change `site.config.mjs` (routes, chapter ids, story path) rather than the tests.

- Language home pages at `/en/`, `/zh-hans/`, `/zh-hant/`, `/es/` with `<html lang="en|zh-Hans|zh-Hant|es">`, and absolute `hreflang` alternates for all four plus `x-default`.
- `/` sends a first-time visitor to their device language (zh-CN/SG → Simplified, zh-TW/HK/MO → Traditional, es-* → Spanish, else English); a language picked in the switcher is remembered and wins.
- The switcher is a `<select>`, or a button whose accessible name contains "Language" (or 语言 / 語言 / Idioma) that opens links labelled English, 简体中文, 繁體中文, Español. Labels in another language carry their own `lang` attribute.
- A skip link is the first Tab stop and points into `<main>`; one `<h1>` per page; header, main and footer landmarks.
- History chapters have ids by year (`1925`, `1984`, `2020`, `2026` at least) on the language home page (or `QA_STORY_PATH`), plus a "Skip to today" link or button.
- A `404.html` with a link home.

The clickable mockup (one `index.html` at the repo root, screens at `#home`, `#schools`…) is tested in `QA_MODE=hash` by `tests/mockup.spec.ts`: script errors, China-blocked hosts, axe, copy guardrails, untranslated text, auto-detect, phone layout and reduced motion. CI picks this mode automatically when the repo root has an `index.html` and no build.

`fixtures/build-fixture.mjs` builds a tiny site that meets all of this; it is the reference markup.

## Copy guardrail exceptions

If a banned word is genuinely fine in context, add the exact phrase to `allow` in `copy-rules.json` and say why in the pull request.
