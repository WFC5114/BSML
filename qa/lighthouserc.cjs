// Lighthouse budgets (test plan PERF-1..3). Mobile, simulated 4G, the Lighthouse default.
const base = process.env.QA_BASE_URL || `http://localhost:${process.env.QA_PORT || 4173}`;
const paths = (process.env.QA_LH_PATHS || '/en/,/zh-hans/,/es/').split(',');

module.exports = {
  ci: {
    collect: {
      url: paths.map((p) => base + p),
      numberOfRuns: 3,
      ...(process.env.QA_BASE_URL ? {} : { startServerCommand: 'node scripts/serve.mjs', startServerReadyPattern: 'Serving' }),
      ...(process.env.QA_CHROMIUM_PATH ? { chromePath: process.env.QA_CHROMIUM_PATH } : {}),
      settings: { chromeFlags: '--no-sandbox --headless=new' },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'resource-summary:script:size': ['error', { maxNumericValue: 300000 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 1500000 }],
        'resource-summary:font:size': ['warn', { maxNumericValue: 500000 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
