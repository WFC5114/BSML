import { APIRequestContext, Page, expect } from '@playwright/test';
import { languages, maxPagesPerLanguage } from '../site.config.mjs';

export type Lang = (typeof languages)[number];

const crawlCache = new Map<string, string[]>();

/** Breadth-first crawl of same-origin HTML pages under a language prefix. Returns paths. */
export async function crawl(request: APIRequestContext, baseURL: string, lang: Lang): Promise<string[]> {
  if (crawlCache.has(lang.code)) return crawlCache.get(lang.code)!;
  const origin = new URL(baseURL).origin;
  const seen = new Set<string>([lang.path]);
  const queue = [lang.path];
  const pages: string[] = [];
  while (queue.length && pages.length < maxPagesPerLanguage) {
    const path = queue.shift()!;
    const res = await request.get(path);
    if (!res.ok() || !(res.headers()['content-type'] || '').includes('text/html')) continue;
    pages.push(path);
    for (const href of extractLinks(await res.text())) {
      let url: URL;
      try { url = new URL(href, origin + path); } catch { continue; }
      if (url.origin !== origin || !url.pathname.startsWith(lang.path)) continue;
      if (/\.(png|jpe?g|webp|avif|gif|svg|pdf|zip|mp4|webm|css|js|json|xml|txt|ico|woff2?)$/i.test(url.pathname)) continue;
      if (!seen.has(url.pathname)) { seen.add(url.pathname); queue.push(url.pathname); }
    }
  }
  crawlCache.set(lang.code, pages);
  return pages;
}

export function extractLinks(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)[^"']*["']/gi)].map((m) => m[1]).filter((h) => !/^(mailto|tel|javascript):/i.test(h));
}

export function extractAssets(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<(?:img|script|source|video|audio)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) out.push(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\brel\s*=\s*["'](?:stylesheet|icon|preload|manifest|apple-touch-icon)["'][^>]*>/gi)) {
    const href = m[0].match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (href) out.push(href[1]);
  }
  for (const m of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const part of m[1].split(',')) { const u = part.trim().split(/\s+/)[0]; if (u) out.push(u); }
  }
  return out.filter((u) => !u.startsWith('data:'));
}

/** Visible text of the page in its own language: drops elements marked with a different lang (e.g. switcher labels). */
export async function ownLanguageText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const pageLang = (document.documentElement.lang || '').toLowerCase();
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript, template').forEach((el) => el.remove());
    clone.querySelectorAll('[lang]').forEach((el) => {
      if ((el.getAttribute('lang') || '').toLowerCase() !== pageLang) el.remove();
    });
    return clone.textContent || '';
  });
}

/** All human-readable text including title, meta description and alt text. */
export async function allCopy(page: Page): Promise<string> {
  return page.evaluate(() => {
    const bits = [document.title, document.querySelector('meta[name="description"]')?.getAttribute('content') || ''];
    document.querySelectorAll('[alt], [aria-label], [title]').forEach((el) => {
      bits.push(el.getAttribute('alt') || '', el.getAttribute('aria-label') || '', el.getAttribute('title') || '');
    });
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
    bits.push(clone.innerText || clone.textContent || '');
    return bits.join('\n');
  });
}

/** Uses whatever language switcher the site has: a <select>, a menu button, or plain links. */
export async function switchLanguage(page: Page, label: string) {
  const name = /language|语言|語言|idioma/i;
  const select = page.getByRole('combobox', { name });
  if (await select.count()) {
    await select.first().selectOption({ label });
    return;
  }
  const direct = page.getByRole('link', { name: label, exact: true }).or(page.getByRole('menuitem', { name: label, exact: true })).or(page.getByRole('button', { name: label, exact: true }));
  if (!(await direct.first().isVisible().catch(() => false))) {
    const toggle = page.getByRole('button', { name });
    await expect(toggle.first(), 'language switcher control with an accessible name containing "Language"').toBeVisible();
    await toggle.first().click();
  }
  await direct.first().click();
}

export const htmlLangOf = (page: Page) => page.evaluate(() => document.documentElement.lang);

export function langFromPath(pathname: string): Lang | undefined {
  return languages.find((l) => pathname.startsWith(l.path));
}
