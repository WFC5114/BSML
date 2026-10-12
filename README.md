# BSML — Boston School of Modern Language

Website for the revival of the Boston School of Modern Language (1925).

- Production hosting: Cloudflare (Workers with static assets), on BSML's own domain.
- Every pull request gets its own preview link.
- Runbooks for deployment and operations live in `docs/deploy/`.

## Mockup (design preview)

A clickable design preview of the new Boston School of Modern Languages website: the 1925 to 2026 history scroll, the four Schools and four Houses, membership, a sample programme with checkout, a member account and the owner's admin dashboard. All content and figures are samples; nothing is sent anywhere.

### Look at it

Open `index.html` through any local web server, for example:

```
python3 -m http.server 8000
```

then visit http://localhost:8000. Screens: `#home`, `#story`, `#schools`, `#houses`, `#life`, `#membership`, `#program`, `#join`, `#signin`, `#account`, `#checkout`, `#admin`.

### Languages

English, Simplified Chinese, Traditional Chinese and Latin American Spanish. The site picks the visitor's device language and remembers a manual choice from the switcher.

English lives in the page itself (`data-t="key"`). Translations live in `i18n/zh-hans.json` and `i18n/es.json`. Traditional Chinese is generated from Simplified (Taiwan phrasing); hand corrections go in `i18n/zh-hant-overrides.json`. After editing any text, rebuild:

```
python3 -m pip install opencc-python-reimplemented   # once
python3 tools/build.py            # refreshes js/i18n.js and lists missing translations
python3 tools/build.py --preview  # also writes dist/preview.html, one shareable file
```

### Images

Grey plates marked IMG-01 to IMG-19 are placeholders. Prompts for each are in `docs/image-prompts.md`.

### Hosting

Plain static files, no build step at deploy time, ready for Cloudflare Pages (build command: none, output directory: `/`). `_headers` sets security headers. Fonts are self-hosted so nothing loads from Google, which keeps the site fast inside mainland China.

### Files

- `index.html` all screens
- `css/site.css` design
- `js/scene.js` the history scroll, drawn in code
- `js/app.js` language switching, navigation and the sample screens
- `js/i18n.js` generated translations
- `assets/fonts/` Cormorant Garamond and Instrument Sans (SIL Open Font License)
