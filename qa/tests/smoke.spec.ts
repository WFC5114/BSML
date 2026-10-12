import { test, expect } from '@playwright/test';
import { languages } from '../site.config.mjs';
import { mode } from '../site.config.mjs';
import { crawl, extractAssets } from './helpers';

test.skip(mode !== 'paths', 'per-language address checks apply to the real site, not the hash-routed mockup');

// Site-wide crawls run once, on desktop Chromium; device projects cover the key pages elsewhere.
test.describe('smoke and navigation', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop-chromium', 'site-wide crawl runs once'));

  for (const lang of languages) {
    test(`NAV-1/2: every ${lang.code} page loads with its assets and no console errors`, async ({ page, request, baseURL }) => {
      const pages = await crawl(request, baseURL!, lang);
      expect(pages.length, `no pages found under ${lang.path}`).toBeGreaterThan(0);
      const problems: string[] = [];
      const checkedAssets = new Set<string>();
      for (const path of pages) {
        const errors: string[] = [];
        page.removeAllListeners('console');
        page.removeAllListeners('pageerror');
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', (e) => errors.push(e.message));
        const res = await page.goto(path, { waitUntil: 'load' });
        if (res?.status() !== 200) problems.push(`${path}: HTTP ${res?.status()}`);
        errors.forEach((e) => problems.push(`${path}: console error: ${e}`));
        const html = await page.content();
        for (const asset of extractAssets(html)) {
          const url = new URL(asset, page.url());
          if (url.origin !== new URL(baseURL!).origin || checkedAssets.has(url.pathname)) continue;
          checkedAssets.add(url.pathname);
          const r = await request.get(url.pathname);
          if (!r.ok()) problems.push(`${path}: missing asset ${url.pathname} (HTTP ${r.status()})`);
        }
      }
      expect(problems, problems.join('\n')).toEqual([]);
    });

    test(`NAV-6: every ${lang.code} page has a unique title and a meta description`, async ({ page, request, baseURL }) => {
      const pages = await crawl(request, baseURL!, lang);
      const titles = new Map<string, string>();
      const problems: string[] = [];
      for (const path of pages) {
        await page.goto(path);
        const title = (await page.title()).trim();
        const desc = await page.locator('meta[name="description"]').getAttribute('content').catch(() => null);
        if (!title) problems.push(`${path}: empty <title>`);
        else if (titles.has(title)) problems.push(`${path}: same <title> as ${titles.get(title)} ("${title}")`);
        else titles.set(title, path);
        if (!desc?.trim()) problems.push(`${path}: missing meta description`);
      }
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }

  test('NAV-4: unknown URL returns a 404 page with a way home', async ({ page }) => {
    const res = await page.goto('/en/this-page-does-not-exist-qa/');
    expect(res?.status()).toBe(404);
    await expect(page.locator('a[href="/"], a[href="/en/"], a[href^="/en/"]').first()).toBeVisible();
  });
});
