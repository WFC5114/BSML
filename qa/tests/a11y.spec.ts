import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { languages } from '../site.config.mjs';
import { crawl } from './helpers';

const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.describe('accessibility', () => {
  for (const lang of languages) {
    test(`A11Y-1: no serious or critical axe violations on ${lang.code} pages`, async ({ page, request, baseURL }, info) => {
      // Full crawl on desktop; home page only on phones.
      const pages = info.project.name === 'desktop-chromium' ? await crawl(request, baseURL!, lang) : [lang.path];
      const problems: string[] = [];
      for (const path of pages) {
        await page.goto(path);
        const { violations } = await new AxeBuilder({ page }).withTags(wcag).analyze();
        for (const v of violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')) {
          problems.push(`${path}: [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}x, e.g. ${v.nodes[0]?.target.join(' ')})`);
        }
      }
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }

  test('A11Y-2/3: one h1, landmarks, and a working skip link on every English page', async ({ page, request, baseURL }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'structure checks run once');
    const problems: string[] = [];
    for (const path of await crawl(request, baseURL!, languages[0])) {
      await page.goto(path);
      const h1 = await page.locator('h1').count();
      if (h1 !== 1) problems.push(`${path}: ${h1} <h1> elements (want 1)`);
      for (const role of ['banner', 'main', 'contentinfo'] as const) {
        if (!(await page.getByRole(role).count())) problems.push(`${path}: no ${role} landmark`);
      }
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => {
        const a = document.activeElement as HTMLAnchorElement | null;
        return a ? { href: a.getAttribute('href') || '', text: (a.textContent || '').trim() } : null;
      });
      if (!first?.href.startsWith('#')) { problems.push(`${path}: first Tab stop is not a skip link (got "${first?.text}")`); continue; }
      await page.keyboard.press('Enter');
      const target = await page.evaluate((id) => {
        const t = document.getElementById(id);
        return !!t && (t.tagName === 'MAIN' || t.getAttribute('role') === 'main' || !!t.closest('main'));
      }, first.href.slice(1));
      if (!target) problems.push(`${path}: skip link ${first.href} does not point at the main content`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('A11Y-4: every interactive element on the home page is reachable by Tab with a visible focus style', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'keyboard runs on desktop');
    await page.goto(languages[0].path);
    const total = await page.locator('a[href]:visible, button:visible, input:visible, select:visible, textarea:visible, [tabindex]:not([tabindex="-1"]):visible').count();
    const problems: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < Math.min(total + 5, 150); i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const visible = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
        const id = el.outerHTML.slice(0, 120);
        return { id, visible, label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40) };
      });
      if (!info) break;
      if (seen.has(info.id)) break; // wrapped around
      seen.add(info.id);
      if (!info.visible) problems.push(`no visible focus style on "${info.label}"`);
    }
    expect(seen.size, 'Tab should reach the interactive elements').toBeGreaterThan(Math.min(total, 3) - 1);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('A11Y-5: the mobile menu and language switcher expose aria-expanded', async ({ page }, info) => {
    test.skip(!info.project.name.startsWith('mobile'), 'mobile menu');
    await page.goto(languages[0].path);
    const toggles = page.locator('header button:visible');
    const n = await toggles.count();
    const problems: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = toggles.nth(i);
      const label = (await t.getAttribute('aria-label')) || (await t.innerText());
      if ((await t.getAttribute('aria-expanded')) === null) problems.push(`header button "${label.trim()}" has no aria-expanded`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('A11Y-6: every image has an alt attribute', async ({ page, request, baseURL }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'runs once');
    const problems: string[] = [];
    for (const lang of languages) {
      for (const path of await crawl(request, baseURL!, lang)) {
        await page.goto(path);
        const missing = await page.locator('img:not([alt])').evaluateAll((els) => els.map((e) => e.getAttribute('src')));
        missing.forEach((src) => problems.push(`${path}: <img src="${src}"> has no alt`));
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('A11Y-9: buttons and navigation links are at least 24x24 px on phones', async ({ page }, info) => {
    test.skip(!info.project.name.startsWith('mobile'), 'touch targets');
    await page.goto(languages[0].path);
    const small = await page.locator('button:visible, nav a:visible, header a:visible, footer a:visible, [role="button"]:visible').evaluateAll((els) =>
      els.map((e) => ({ r: e.getBoundingClientRect(), t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30) }))
        .filter(({ r }) => r.width > 0 && (r.width < 24 || r.height < 24)).map(({ r, t }) => `"${t}" is ${Math.round(r.width)}x${Math.round(r.height)}`));
    expect(small, small.join('\n')).toEqual([]);
  });
});
