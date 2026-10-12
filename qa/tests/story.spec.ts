import { test, expect } from '@playwright/test';
import { languages, storyPath, storyChapters } from '../site.config.mjs';
import { mode } from '../site.config.mjs';

test.skip(mode !== 'paths', 'per-language address checks apply to the real site, not the hash-routed mockup');

const storyUrl = (langPath: string) => langPath + storyPath;

test.describe('history scroll', () => {
  for (const lang of languages) {
    test(`STORY-1: ${lang.code} story has every chapter as real text`, async ({ page }) => {
      await page.goto(storyUrl(lang.path));
      for (const year of storyChapters) {
        const chapter = page.locator(`[id="${year}"]`);
        await expect(chapter, `chapter #${year} missing`).toHaveCount(1);
        const text = (await chapter.textContent())?.trim() || '';
        expect(text.length, `chapter #${year} has no text`).toBeGreaterThan(10);
      }
    });
  }

  test('STORY-2: a deep link opens at that chapter', async ({ page }) => {
    await page.goto(storyUrl(languages[0].path) + '#1984');
    await expect(page.locator('[id="1984"]')).toBeInViewport({ ratio: 0.1, timeout: 5000 });
  });

  test('STORY-3: "Skip to today" lands on 2026', async ({ page }) => {
    await page.goto(storyUrl(languages[0].path));
    const skip = page.getByRole('link', { name: /skip to today/i }).or(page.getByRole('button', { name: /skip to today/i }));
    await expect(skip.first()).toBeVisible();
    await skip.first().click();
    await expect(page.locator('[id="2026"]')).toBeInViewport({ ratio: 0.1, timeout: 5000 });
  });

  test('STORY-4: with reduced motion nothing animates and every chapter is visible', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(storyUrl(languages[0].path));
    await page.waitForTimeout(300);
    const running = await page.evaluate(() => document.getAnimations()
      .filter((a) => a.playState === 'running')
      .map((a) => {
        const t = a.effect?.getTiming();
        return { name: (a as CSSAnimation).animationName || a.id || 'animation', d: Number(t?.duration) || 0, it: t?.iterations };
      })
      .filter((a) => a.d > 10 || a.it === Infinity));
    expect(running, `animations still running with reduced motion: ${JSON.stringify(running)}`).toEqual([]);
    for (const year of storyChapters) {
      await page.locator(`[id="${year}"]`).scrollIntoViewIfNeeded();
      const opacity = await page.locator(`[id="${year}"]`).evaluate((el) => {
        let o = 1; for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o;
      });
      expect(opacity, `chapter #${year} is hidden with reduced motion`).toBeGreaterThan(0.9);
    }
  });

  test('STORY-5: jumping to the end and back leaves no blank chapter or errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(storyUrl(languages[0].path));
    await page.keyboard.press('End');
    await page.waitForTimeout(600);
    await page.keyboard.press('Home');
    await page.waitForTimeout(300);
    await page.keyboard.press('End');
    await page.waitForTimeout(600);
    const last = page.locator(`[id="${storyChapters.at(-1)}"]`);
    await last.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const opacity = await last.evaluate((el) => {
      let o = 1; for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o;
    });
    expect(opacity, 'final chapter should have caught up after a fast jump').toBeGreaterThan(0.5);
    expect(errors).toEqual([]);
  });

  test('STORY-7: the 2020 chapter is told gently', async ({ page }) => {
    await page.goto(storyUrl(languages[0].path));
    const text = (await page.locator('[id="2020"]').textContent()) || '';
    expect(text).not.toMatch(/\b(closed|closure|failed|failure|shut ?down|bankrupt|collapse)/i);
  });
});
