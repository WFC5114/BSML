import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { languages } from '../site.config.mjs';
import { allCopy, crawl } from './helpers';

const rules = JSON.parse(readFileSync(new URL('../copy-rules.json', import.meta.url), 'utf8'));
const family = (code: string) => (code.startsWith('zh') ? 'zh' : code);
// Latin words need word boundaries ("robe" must not match "wardrobe"); CJK has no spaces, so match plainly.
const toRegex = (words: string[], cjk: boolean) => new RegExp(cjk ? `(${words.join('|')})` : `(?<![\\p{L}])(${words.join('|')})(?![\\p{L}])`, 'giu');

function findHits(text: string, re: RegExp): string[] {
  let t = text;
  for (const phrase of rules.allow as string[]) t = t.split(phrase).join(' ');
  return [...new Set([...t.matchAll(re)].map((m) => m[0].toLowerCase()))];
}

test.describe('content guardrails', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop-chromium', 'text checks run once'));

  for (const lang of languages) {
    test(`COPY-1..5: ${lang.code} copy passes the guardrails`, async ({ page, request, baseURL }) => {
      const f = family(lang.code);
      const cjk = f === 'zh';
      const checks: [string, RegExp][] = [
        ['cult-like wording (project map 1c)', toRegex(rules.cultLike[f], cjk)],
        ['Harry Potter IP', toRegex(rules.ip, false)],
        ['placeholder text', new RegExp(rules.placeholders.join('|'), 'g')],
        ['medical claim (wellness only)', toRegex(rules.medical[f], cjk)],
      ];
      const aiHeadline = new RegExp(rules.aiHeadline.join('|'), 'i');
      const problems: string[] = [];
      for (const path of await crawl(request, baseURL!, lang)) {
        await page.goto(path);
        const text = await allCopy(page);
        for (const [label, re] of checks) {
          const hits = findHits(text, re);
          if (hits.length) problems.push(`${path}: ${label}: ${hits.join(', ')}`);
        }
        const headlines = await page.locator('h1, h2, nav, header').allInnerTexts();
        const ai = headlines.find((h) => aiHeadline.test(h));
        if (ai) problems.push(`${path}: AI is the headline ("${ai.trim().slice(0, 60)}"), quiet AI rule`);
      }
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
});
