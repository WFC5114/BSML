import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { autoDetect, chinaBlockedHosts, hashScreens, languages, mode } from '../site.config.mjs';

// Checks for the hash-routed clickable mockup (one index.html, language switched in place, choice in localStorage).
test.skip(mode !== 'hash', 'mockup checks only');
test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop-chromium', 'runs once'));

const rules = JSON.parse(readFileSync(new URL('../copy-rules.json', import.meta.url), 'utf8'));
const htmlLang: Record<string, string> = { en: 'en', 'zh-hans': 'zh-Hans', 'zh-hant': 'zh-Hant', es: 'es' };

async function open(page: Page, code: string, screen: string) {
  await page.goto('/');
  await page.evaluate((c) => localStorage.setItem('bsml-lang', c), code);
  await page.goto('/#' + screen);
  await page.reload();
  await page.waitForTimeout(250);
}

for (const lang of languages) {
  test(`${lang.code}: every screen runs without errors, loads nothing blocked in China, and passes axe`, async ({ page, baseURL }) => {
    const problems: string[] = [];
    const own = new URL(baseURL!).hostname;
    page.on('pageerror', (e) => problems.push(`script error: ${e.message}`));
    // The browser's automatic /favicon.ico request is not a page error.
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location().url)) problems.push(`console: ${m.text()} (${m.location().url})`); });
    page.on('request', (r) => { const h = new URL(r.url()).hostname; if (h !== own && chinaBlockedHosts.some((re) => re.test(h))) problems.push(`requests ${h}`); });
    for (const s of hashScreens) {
      await open(page, lang.code, s);
      expect(await page.evaluate(() => document.documentElement.lang)).toMatch(new RegExp('^' + htmlLang[lang.code]));
      const { violations } = await new AxeBuilder({ page }).include('[data-view].active').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      for (const v of violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')) {
        problems.push(`#${s}: [${v.impact}] ${v.id} (${v.nodes.length}x, e.g. ${v.nodes[0]?.target.join(' ')})`);
      }
    }
    expect([...new Set(problems)], [...new Set(problems)].join('\n')).toEqual([]);
  });

  test(`${lang.code}: copy passes the guardrails and is fully translated`, async ({ page }) => {
    const f = lang.code.startsWith('zh') ? 'zh' : lang.code;
    const cjk = f === 'zh';
    const re = (w: string[], c: boolean) => new RegExp(c ? `(${w.join('|')})` : `(?<![\\p{L}])(${w.join('|')})(?![\\p{L}])`, 'giu');
    const checks: [string, RegExp][] = [['cult-like wording', re(rules.cultLike[f], cjk)], ['Harry Potter IP', re(rules.ip, false)], ['medical claim', re(rules.medical[f], cjk)]];
    const problems: string[] = [];
    for (const s of hashScreens) {
      await open(page, lang.code, s);
      let text = await page.locator('[data-view].active').innerText();
      for (const phrase of rules.allow as string[]) text = text.split(phrase).join(' ');
      for (const [label, r] of checks) {
        const hits = [...new Set([...text.matchAll(r)].map((m) => m[0]))];
        if (hits.length) problems.push(`#${s}: ${label}: ${hits.join(', ')}`);
      }
      if (lang.code !== 'en') {
        // Elements marked for translation that still show their English original (the app keeps it in data-en).
        const untranslated = await page.locator('[data-view].active [data-t]').evaluateAll((els, keep) => els
          .map((e) => [(e.textContent || '').trim(), (e.getAttribute('data-en') || '').trim()])
          .filter(([t, en]) => t && t === en && /\p{L}{2,}\W+\p{L}{2,}/u.test(t) && !keep.includes(t) && !/^(Dr|Mr|Mrs|Ms|Prof)\.? \p{Lu}\p{L}+$/u.test(t))
          .map(([t]) => t), rules.keepInEnglish as string[]);
        if (untranslated.length) problems.push(`#${s}: still in English: "${[...new Set(untranslated)].slice(0, 5).join('", "')}"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

test('device language picks the site language, and a manual choice is remembered', async ({ browser, baseURL }) => {
  const wrong: string[] = [];
  for (const [locale, expected] of autoDetect) {
    const c = await browser.newContext({ locale, baseURL });
    const p = await c.newPage();
    await p.goto('/');
    await p.waitForTimeout(200);
    const got = await p.evaluate(() => document.documentElement.lang);
    if (!got.startsWith(htmlLang[expected])) wrong.push(`${locale}: got ${got}, want ${htmlLang[expected]}`);
    await c.close();
  }
  expect(wrong, wrong.join('\n')).toEqual([]);
  const c = await browser.newContext({ locale: 'zh-CN', baseURL });
  const p = await c.newPage();
  await p.goto('/');
  await p.locator('#lang-btn').click();
  await p.getByRole('menuitemradio', { name: 'Español' }).click();
  await p.reload();
  expect(await p.evaluate(() => document.documentElement.lang)).toMatch(/^es/);
  await c.close();
});

test('on a phone, no screen scrolls sideways and the main controls are at least 24px', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const c = await browser.newContext({ baseURL, viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await c.newPage();
  const problems: string[] = [];
  for (const code of ['en', 'es', 'zh-hans']) {
    for (const s of hashScreens) {
      await open(page, code, s);
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (o > 1) problems.push(`${code} #${s}: ${o}px wider than the screen`);
    }
  }
  await open(page, 'en', 'home');
  const small = await page.locator('[data-view].active button:visible, header button:visible').evaluateAll((els) => els
    .map((e) => ({ r: e.getBoundingClientRect(), t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 25) }))
    .filter(({ r }) => r.width > 0 && (r.width < 24 || r.height < 24)).map(({ r, t }) => `"${t}" is ${Math.round(r.width)}x${Math.round(r.height)}`));
  problems.push(...small);
  await c.close();
  expect(problems, problems.join('\n')).toEqual([]);
});

test('reduced motion stops all animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'en', 'home');
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  expect(running).toBe(0);
});
