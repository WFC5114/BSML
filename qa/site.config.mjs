// Single place to adapt the suite to the app. If the app changes a route or label, change it here, not in the tests.
export const languages = [
  { code: 'en', path: '/en/', htmlLang: 'en', label: 'English' },
  { code: 'zh-hans', path: '/zh-hans/', htmlLang: 'zh-Hans', label: '简体中文' },
  { code: 'zh-hant', path: '/zh-hant/', htmlLang: 'zh-Hant', label: '繁體中文' },
  { code: 'es', path: '/es/', htmlLang: 'es', label: 'Español' },
];

// Device language -> expected site language on first visit to "/" (project map 1d).
export const autoDetect = [
  ['en-US', 'en'], ['en-GB', 'en'], ['fr-FR', 'en'], ['ja-JP', 'en'], ['ar-EG', 'en'],
  ['zh-CN', 'zh-hans'], ['zh-SG', 'zh-hans'], ['zh', 'zh-hans'],
  ['zh-TW', 'zh-hant'], ['zh-HK', 'zh-hant'], ['zh-MO', 'zh-hant'],
  ['es-MX', 'es'], ['es-ES', 'es'], ['es-CO', 'es'], ['es-419', 'es'],
];

// History scroll chapters that must be deep-linkable (project map 7).
export const storyPath = process.env.QA_STORY_PATH || ''; // '' = story lives on the language home page
export const storyChapters = ['1925', '1984', '2020', '2026'];

// Hosts that are blocked or unreliable in mainland China (project map 5b). Any request to these fails the test.
export const chinaBlockedHosts = [
  /(^|\.)google\.com$/, /(^|\.)googleapis\.com$/, /(^|\.)gstatic\.com$/, /(^|\.)google-analytics\.com$/,
  /(^|\.)googletagmanager\.com$/, /(^|\.)doubleclick\.net$/, /(^|\.)recaptcha\.net$/, /(^|\.)youtube\.com$/,
  /(^|\.)ytimg\.com$/, /(^|\.)facebook\.(com|net)$/, /(^|\.)twitter\.com$/, /(^|\.)x\.com$/, /(^|\.)instagram\.com$/,
  /(^|\.)pages\.dev$/, /(^|\.)workers\.dev$/,
];

// Max pages to crawl per language for site-wide checks.
export const maxPagesPerLanguage = Number(process.env.QA_MAX_PAGES || 60);

// 'paths': the real site, one address per language (/en/, /zh-hans/...).
// 'hash': the clickable mockup (PR #3): one index.html, screens at #home, #schools..., language switched in place.
export const mode = process.env.QA_MODE || 'paths';
export const hashScreens = ['home', 'story', 'schools', 'houses', 'life', 'membership', 'program', 'join', 'signin', 'account', 'checkout', 'admin'];
