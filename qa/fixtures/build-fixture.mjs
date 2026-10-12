// Builds a tiny four-language site that follows the QA contract (README "What the suite expects").
// It proves the suite itself works before the real app exists, and is a reference for the app's markup.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://www.bsml.com'; // placeholder until the domain is chosen
const out = join(dirname(fileURLToPath(import.meta.url)), 'sample-site');
rmSync(out, { recursive: true, force: true });

const langs = {
  en: { html: 'en', label: 'English', home: 'Home', houses: 'Houses', skip: 'Skip to content', today: 'Skip to today', lang: 'Language',
    title: 'Boston School of Modern Language', h1: 'A hundred years of new beginnings', housesH1: 'The four Houses', desc: 'BSML, founded in Boston in 1925, opens again.',
    housesDesc: 'Ethos, Logos, Pathos and Kairos: optional communities, like clubs or teams.',
    ch: { 1925: 'Boston, 1925. A small school opens its doors to people far from home.', 1984: 'A stone home among the trees.', 2020: 'After 95 years, the school rested.', 2026: 'A century later, the doors open again. Wider than ever.' },
    notFound: 'This page could not be found.' },
  'zh-hans': { html: 'zh-Hans', label: '简体中文', home: '首页', houses: '学院', skip: '跳到正文', today: '跳到今天', lang: '语言',
    title: '波士顿现代语言学校', h1: '百年新起点', housesH1: '四大学院', desc: '波士顿现代语言学校创立于一九二五年，如今再次启航。',
    housesDesc: 'Ethos、Logos、Pathos、Kairos：自愿参加的社团。',
    ch: { 1925: '一九二五年的波士顿，一所小小的学校向远离家乡的人们敞开大门。', 1984: '林间的一座石砌家园。', 2020: '九十五年之后，学校进入了休整。', 2026: '一个世纪之后，大门再次打开，比以往更加宽广。' },
    notFound: '找不到此页面。' },
  'zh-hant': { html: 'zh-Hant', label: '繁體中文', home: '首頁', houses: '學院', skip: '跳到正文', today: '跳到今天', lang: '語言',
    title: '波士頓現代語言學校', h1: '百年新起點', housesH1: '四大學院', desc: '波士頓現代語言學校創立於一九二五年，如今再次啟航。',
    housesDesc: 'Ethos、Logos、Pathos、Kairos：自願參加的社團。',
    ch: { 1925: '一九二五年的波士頓，一所小小的學校向遠離家鄉的人們敞開大門。', 1984: '林間的一座石砌家園。', 2020: '九十五年之後，學校進入了休整。', 2026: '一個世紀之後，大門再次打開，比以往更加寬廣。' },
    notFound: '找不到此頁面。' },
  es: { html: 'es', label: 'Español', home: 'Inicio', houses: 'Casas', skip: 'Saltar al contenido', today: 'Saltar a hoy', lang: 'Idioma',
    title: 'Boston School of Modern Language', h1: 'Cien años de nuevos comienzos', housesH1: 'Las cuatro Casas', desc: 'BSML, fundada en Boston en 1925, vuelve a abrir.',
    housesDesc: 'Ethos, Logos, Pathos y Kairos: comunidades opcionales, como clubes o equipos.',
    ch: { 1925: 'Boston, 1925. Una pequeña escuela abre sus puertas a personas lejos de casa.', 1984: 'Un hogar de piedra entre los árboles.', 2020: 'Después de 95 años, la escuela descansó.', 2026: 'Un siglo después, las puertas se abren de nuevo. Más amplias que nunca.' },
    notFound: 'No encontramos esta página.' },
};

const css = `:root{--ink:#1d1a16;--paper:#f7f2e8;--accent:#7a2e1f}*{box-sizing:border-box}body{margin:0;font:18px/1.6 system-ui,sans-serif;color:var(--ink);background:var(--paper)}
a{color:var(--accent)}:focus-visible{outline:3px solid var(--accent);outline-offset:2px}.skip{position:absolute;left:-9999px}.skip:focus{left:8px;top:8px;background:#fff;padding:8px}
header,footer{display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:16px}header a,footer a,nav a{display:inline-block;min-height:44px;padding:10px 4px}
.lang-menu{position:relative}.lang-menu ul{display:none;position:absolute;list-style:none;margin:0;padding:8px;background:#fff}.lang-menu[data-open] ul{display:block}
button{min-height:44px;font:inherit;padding:8px 12px}main{padding:16px;max-width:60rem;margin:auto}section{min-height:60vh;padding:24px 0}
@media (prefers-reduced-motion:no-preference){section{animation:rise .6s ease-out both}@keyframes rise{from{opacity:.4;transform:translateY(12px)}to{opacity:1;transform:none}}}`;

const js = `const KEY='bsml-lang';
document.querySelectorAll('[data-lang-link]').forEach(a=>a.addEventListener('click',()=>{try{localStorage.setItem(KEY,a.dataset.langLink)}catch{}}));
const t=document.querySelector('.lang-menu button');if(t)t.addEventListener('click',()=>{const m=t.parentElement;const o=!m.hasAttribute('data-open');m.toggleAttribute('data-open',o);t.setAttribute('aria-expanded',String(o))});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&t){t.parentElement.removeAttribute('data-open');t.setAttribute('aria-expanded','false')}});`;

function page(code, slug, body, { status } = {}) {
  const L = langs[code];
  const alternates = Object.entries(langs).map(([c, l]) => `<link rel="alternate" hreflang="${l.html}" href="${ORIGIN}/${c}/${slug}">`).join('') + `<link rel="alternate" hreflang="x-default" href="${ORIGIN}/en/${slug}">`;
  const switcher = Object.entries(langs).map(([c, l]) => `<li><a lang="${l.html}" hreflang="${l.html}" data-lang-link="${c}" href="/${c}/${slug}">${l.label}</a></li>`).join('');
  return `<!doctype html><html lang="${L.html}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${slug ? L.housesH1 + ' · ' : status ? '404 · ' : ''}${L.title}</title><meta name="description" content="${slug ? L.housesDesc : L.desc}">${alternates}<link rel="stylesheet" href="/assets/site.css"></head>
<body><a class="skip" href="#main">${L.skip}</a><header><a href="/${code}/">BSML</a><nav aria-label="${L.home}"><a href="/${code}/">${L.home}</a> <a href="/${code}/houses/">${L.houses}</a></nav>
<div class="lang-menu"><button type="button" aria-expanded="false" aria-label="${L.lang} (Language)">${L.lang}</button><ul>${switcher}</ul></div></header>
<main id="main">${body}</main><footer><a href="/${code}/">${L.title}</a></footer><script src="/assets/site.js" defer></script></body></html>`;
}

function write(rel, content) { const f = join(out, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); }

for (const [code, L] of Object.entries(langs)) {
  const chapters = Object.entries(L.ch).map(([y, t]) => `<section id="${y}" aria-labelledby="h${y}"><h2 id="h${y}">${y}</h2><p>${t}</p></section>`).join('');
  write(`${code}/index.html`, page(code, '', `<h1>${L.h1}</h1><p><a href="#2026">${L.today}</a></p>${chapters}`));
  write(`${code}/houses/index.html`, page(code, 'houses/', `<h1>${L.housesH1}</h1><p>${L.housesDesc}</p>`));
}
write('404.html', page('en', '', `<h1>404</h1><p>${langs.en.notFound}</p><p><a href="/en/">${langs.en.home}</a></p>`, { status: 404 }));
write('assets/site.css', css);
write('assets/site.js', js);
// Root: manual choice first, then device language (project map 1d).
write('index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BSML</title><meta name="description" content="Boston School of Modern Language">
<script>(function(){var c;try{c=localStorage.getItem('bsml-lang')}catch(e){}
if(!c){var l=(navigator.languages&&navigator.languages[0]||navigator.language||'en').toLowerCase();
c=/^zh-(tw|hk|mo|hant)/.test(l)?'zh-hant':/^zh/.test(l)?'zh-hans':/^es/.test(l)?'es':'en'}
location.replace('/'+c+'/')})()</script></head><body><main><h1>BSML</h1><a href="/en/">English</a></main></body></html>`);
console.log('fixture written to', out);
