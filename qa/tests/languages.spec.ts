import { test, expect } from '@playwright/test';
import { languages, autoDetect } from '../site.config.mjs';
import { mode } from '../site.config.mjs';
import { crawl, htmlLangOf, langFromPath, ownLanguageText, switchLanguage } from './helpers';

test.skip(mode !== 'paths', 'per-language address checks apply to the real site, not the hash-routed mockup');

test.describe('languages', () => {
  for (const lang of languages) {
    test(`LANG-1/2: ${lang.path} has lang="${lang.htmlLang}" and hreflang alternates`, async ({ page }) => {
      const res = await page.goto(lang.path);
      expect(res?.status()).toBe(200);
      expect(await htmlLangOf(page)).toBe(lang.htmlLang);
      const alternates = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) =>
        els.map((e) => [e.getAttribute('hreflang')!.toLowerCase(), e.getAttribute('href')!]));
      const hreflangs = alternates.map(([h]) => h);
      for (const l of languages) expect(hreflangs, `missing hreflang for ${l.htmlLang}`).toContain(l.htmlLang.toLowerCase());
      expect(hreflangs, 'missing hreflang x-default').toContain('x-default');
      const relative = alternates.filter(([, href]) => !/^https:\/\//.test(href)).map(([h, href]) => `${h} -> ${href}`);
      expect(relative, 'hreflang links must be absolute https URLs (Google ignores relative ones)').toEqual([]);
    });
  }

  for (const [locale, expected] of autoDetect) {
    test(`LANG-3: first visit with device language ${locale} lands on ${expected}`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ locale, baseURL });
      const page = await context.newPage();
      await page.goto('/');
      await page.waitForURL((u) => u.pathname !== '/', { timeout: 5000 }).catch(() => {});
      expect(langFromPath(new URL(page.url()).pathname)?.code, `landed on ${page.url()}`).toBe(expected);
      await context.close();
    });
  }

  test('LANG-4: manual choice beats the device language and is remembered', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: 'zh-CN', baseURL });
    const page = await context.newPage();
    await page.goto('/en/');
    await switchLanguage(page, 'Español');
    await page.waitForURL(/\/es\//);
    expect(await htmlLangOf(page)).toBe('es');
    await page.goto('/');
    await page.waitForURL((u) => u.pathname !== '/', { timeout: 5000 }).catch(() => {});
    expect(new URL(page.url()).pathname, 'returning visitor should get their chosen language, not the device one').toMatch(/^\/es\//);
    await context.close();
  });

  test('LANG-5: a shared link in one language is respected regardless of device language', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ locale: 'zh-CN', baseURL });
    const page = await context.newPage();
    await page.goto('/es/');
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toMatch(/^\/es\//);
    await context.close();
  });

  test('LANG-6: switching language keeps you on the same page', async ({ page, request, baseURL }) => {
    const pages = await crawl(request, baseURL!, languages[0]);
    const subpage = pages.find((p) => p !== languages[0].path);
    test.skip(!subpage, 'site has only a home page so far');
    await page.goto(subpage!);
    const from = new URL(page.url()).pathname;
    await switchLanguage(page, '繁體中文');
    await page.waitForURL(/\/zh-hant\//);
    const enAlternate = await page.locator('link[rel="alternate"][hreflang="en"]').getAttribute('href');
    expect(enAlternate && new URL(enAlternate, page.url()).pathname, 'the Traditional page should be the translation of the page we came from').toBe(from);
  });

  // Character pairs that differ between Simplified and Traditional. Text inside elements with another lang attribute
  // (for example the switcher's "繁體中文" label) is ignored.
  const pairs = '学學 语語 国國 历歷 艺藝 乐樂 体體 时時 华華 会會 们們 这這 来來 发發 书書 为為 门門 东東 车車 长長 开開 说說 读讀 写寫 级級 课課 员員 现現 欢歡 迎迎 园園 区區 让讓 认認 识識 习習 简簡 业業 点點 万萬 与與 个個 从從 边邊 过過 还還 进進 运運 动動 终終 经經 线線 网網 页頁 关關 联聯 务務 计計 设設 师師 帮幫 话話 将將 应應 实實 称稱 岁歲 钟鐘 乐樂 灵靈 术術 馆館 图圖 节節 纪紀 记記 选選 择擇 费費 价價 买買 卖賣'
    .split(' ').filter((p) => p[0] !== p[1]);
  const simplifiedOnly = new RegExp(`[${pairs.map((p) => p[0]).join('')}]`, 'g');
  const traditionalOnly = new RegExp(`[${pairs.map((p) => p[1]).join('')}]`, 'g');

  for (const [code, wrong, name] of [['zh-hans', traditionalOnly, 'Traditional'], ['zh-hant', simplifiedOnly, 'Simplified']] as const) {
    test(`LANG-8: ${code} pages contain no ${name} characters`, async ({ page, request, baseURL }) => {
      test.skip(test.info().project.name !== 'desktop-chromium', 'text checks run once');
      const lang = languages.find((l) => l.code === code)!;
      const problems: string[] = [];
      for (const path of await crawl(request, baseURL!, lang)) {
        await page.goto(path);
        const hits = [...new Set((await ownLanguageText(page)).match(wrong) || [])];
        if (hits.length) problems.push(`${path}: ${hits.join(' ')}`);
      }
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }

  test('LANG-7: no untranslated English sentences on Chinese and Spanish pages', async ({ page, request, baseURL }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'text checks run once');
    const allow = /\b(BSML|Boston|School|of|Modern|Language|Ethos|Logos|Pathos|Kairos|Agora|Back Bay|Roslindale|Arnold Arboretum|English|Español)\b/g;
    const problems: string[] = [];
    for (const lang of languages.filter((l) => l.code !== 'en')) {
      for (const path of await crawl(request, baseURL!, lang)) {
        await page.goto(path);
        const text = (await ownLanguageText(page)).replace(allow, ' ');
        const pattern = lang.code === 'es'
          ? /\b(the|and|your|with|our|join|learn|more)\b(?:\W+\w+){0,3}\W+\b(the|and|your|with|our|you)\b/gi
          : /\b[A-Za-z]{2,}(?:[\s,.'-]+[A-Za-z]{2,}){3,}/g; // four or more Latin words in a row
        const hits = text.match(pattern) || [];
        if (hits.length) problems.push(`${path}: "${hits.slice(0, 3).join('", "')}"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  for (const width of [320, 768, 1440]) {
    test(`LANG-10: no horizontal overflow at ${width}px in any language`, async ({ page, request, baseURL }) => {
      test.skip(test.info().project.name !== 'desktop-chromium', 'viewport sweep runs once');
      await page.setViewportSize({ width, height: 900 });
      const problems: string[] = [];
      for (const lang of languages) {
        for (const path of await crawl(request, baseURL!, lang)) {
          await page.goto(path);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (overflow > 1) problems.push(`${path}: ${overflow}px wider than the screen`);
        }
      }
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
});
