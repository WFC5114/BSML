import { test, expect } from '@playwright/test';
import { languages, chinaBlockedHosts } from '../site.config.mjs';
import { crawl } from './helpers';

test('PERF-5: no page loads anything from services blocked in mainland China', async ({ page, request, baseURL }) => {
  test.skip(test.info().project.name !== 'desktop-chromium', 'runs once');
  const problems = new Set<string>();
  const ownHost = new URL(baseURL!).hostname; // a preview on *.workers.dev may load from itself
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (host !== ownHost && chinaBlockedHosts.some((re) => re.test(host))) problems.add(`${new URL(page.url()).pathname}: requests ${host}`);
  });
  for (const lang of languages) {
    for (const path of await crawl(request, baseURL!, lang)) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.mouse.wheel(0, 20000); // trigger lazy-loaded chapters and embeds
      // Plain <a> links to social sites are fine; only things the page loads are checked.
      await page.waitForTimeout(300);
      const html = await page.content();
      for (const m of html.matchAll(/<(?:script|img|iframe|link|source|video|audio|embed|object)\b[^>]*?\b(?:src|href|data)\s*=\s*["'](https?:\/\/[^"'/]+)/gi)) {
        const host = new URL(m[1]).hostname;
        if (host !== ownHost && chinaBlockedHosts.some((re) => re.test(host))) problems.add(`${path}: references ${host}`);
      }
    }
  }
  expect([...problems], [...problems].join('\n')).toEqual([]);
});
