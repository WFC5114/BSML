/* BSML mockup: language, routing and the clickable sample screens. */
(function () {
  const I = window.BSML_I18N || { en: {} };
  const LANGS = { en: 'English', 'zh-hans': '简体中文', 'zh-hant': '繁體中文', es: 'Español' };
  const HTML_LANG = { en: 'en', 'zh-hans': 'zh-Hans', 'zh-hant': 'zh-Hant', es: 'es-419' };
  let lang = 'en';
  let autoChosen = true;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  function t(key, fallback) {
    const d = I[lang] || {};
    if (d[key] != null) return d[key];
    if (I.en[key] != null) return I.en[key];
    return fallback != null ? fallback : key;
  }
  window.t = t;

  // Device language → site language. Manual choice always wins.
  function detect() {
    const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (const raw of list) {
      const l = raw.toLowerCase();
      if (l.startsWith('zh')) {
        if (/hant|tw|hk|mo/.test(l)) return 'zh-hant';
        return 'zh-hans';
      }
      if (l.startsWith('es')) return 'es';
      if (l.startsWith('en')) return 'en';
    }
    return 'en';
  }

  function applyLang(next, manual) {
    lang = LANGS[next] ? next : 'en';
    if (manual) { store.set('bsml-lang', lang); autoChosen = false; }
    document.documentElement.lang = HTML_LANG[lang];
    document.querySelectorAll('[data-t]').forEach((el) => {
      const k = el.getAttribute('data-t');
      if (!el.hasAttribute('data-en')) el.setAttribute('data-en', el.textContent);
      el.textContent = t(k, el.getAttribute('data-en'));
    });
    document.querySelectorAll('[data-tp]').forEach((el) => { el.placeholder = t(el.getAttribute('data-tp'), el.placeholder); });
    document.querySelectorAll('[data-ta]').forEach((el) => { el.setAttribute('aria-label', t(el.getAttribute('data-ta'), el.getAttribute('aria-label'))); });
    document.querySelectorAll('[data-now]').forEach((el) => el.setAttribute('data-now', t('ph.now', 'Now open')));
    document.getElementById('lang-current').textContent = LANGS[lang];
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lang === lang)));
    const note = document.getElementById('lang-note');
    note.textContent = autoChosen ? t('lang.auto', 'Chosen automatically from your device.') : t('lang.manual', 'Your choice is remembered on this device.');
    renderAdmin();
    updateBilling();
    if (window.BSMLScene) window.BSMLScene.update();
    setTitle();
  }

  // One title per screen, in the reader's language
  function setTitle() {
    const v = document.body.dataset.page || 'home';
    const names = {
      story: t('nav.story', 'Our Story'), schools: t('nav.schools', 'Schools'), houses: t('nav.houses', 'Houses'),
      life: t('nav.life', 'Life at BSML'), membership: t('nav.membership', 'Membership'), program: t('prog.name', 'Boston Immersion Week'),
      join: t('nav.join', 'Join the revival'), signin: t('nav.signin', 'Sign in'), account: t('rib.account', 'Member account'),
      checkout: t('rib.checkout', 'Checkout'), admin: t('rib.admin', 'Admin dashboard'),
    };
    const school = t('brand.sub', 'Boston School of Modern Languages');
    document.title = names[v] ? names[v] + ' · BSML' : school;
  }

  // Language menu
  const langBtn = document.getElementById('lang-btn');
  const langMenu = document.getElementById('lang-menu');
  langBtn.addEventListener('click', (e) => { e.stopPropagation(); langMenu.hidden = !langMenu.hidden; langBtn.setAttribute('aria-expanded', String(!langMenu.hidden)); });
  document.addEventListener('click', (e) => { if (!langMenu.contains(e.target)) { langMenu.hidden = true; langBtn.setAttribute('aria-expanded', 'false'); } });
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => { applyLang(b.dataset.lang, true); langMenu.hidden = true; }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !langMenu.hidden) { langMenu.hidden = true; langBtn.setAttribute('aria-expanded', 'false'); langBtn.focus(); } });

  // Skip link: focus the content without changing the route
  document.querySelector('.skip-link').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('main').focus(); });

  // Mobile menu
  const nav = document.getElementById('nav');
  const menuToggle = document.getElementById('menu-toggle');
  menuToggle.addEventListener('click', () => { nav.classList.toggle('open'); menuToggle.setAttribute('aria-expanded', String(nav.classList.contains('open'))); });

  // ---- routing (hash tokens: #schools, #schools-arts, #houses-logos ...) ----
  const views = [...document.querySelectorAll('[data-view]')];
  const YEARS = { 1925: 1, 1930: 2, 1950: 3, 1972: 4, 1984: 5, 1990: 6, 2020: 7, 2026: 8 };
  function route() {
    const h = (location.hash || '#home').slice(1);
    const year = YEARS[h];
    const base = year ? 'home' : h.split('-')[0];
    const view = views.find((v) => v.dataset.view === base) || views[0];
    views.forEach((v) => v.classList.toggle('active', v === view));
    document.querySelectorAll('.nav a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + view.dataset.view));
    nav.classList.remove('open');
    const target = h.includes('-') ? document.getElementById(h) : null;
    if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    else if (!year) window.scrollTo(0, 0);
    if (view.dataset.view === 'home' && window.BSMLScene) requestAnimationFrame(() => window.BSMLScene.update());
    // #1984 and friends open the history scroll at that year
    if (year && window.BSMLScene) requestAnimationFrame(() => {
      if (document.querySelector('.history').offsetHeight) window.BSMLScene.goTo(year);
      else document.querySelector('.history-static').scrollIntoView();
    });
    document.body.dataset.page = view.dataset.view;
    setTitle();
  }
  window.addEventListener('hashchange', route);

  // ---- toast ----
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }
  const TOASTS = {
    'toast.cal': 'Calendar invitation sent (preview).',
    'toast.inv': 'Invoices would download as PDF (preview).',
    'toast.pause': 'Membership paused until you return (preview).',
    'toast.data': 'We will email your data within 30 days (preview).',
    'toast.export': 'Waitlist exported (preview).',
    'toast.email': 'Draft email opened for this segment (preview).',
    'toast.new': 'New product form would open here (preview).',
    'toast.translate': 'Translation drafts queued for review (preview).',
    'toast.invite': 'Invitation sent. Two-step verification is required (preview).',
    'toast.journal': 'The full article would open here (preview).',
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.js-toast');
    if (b) toast(t(b.dataset.msg, TOASTS[b.dataset.msg]));
  });

  // ---- forms (no data leaves the page in this preview) ----
  document.querySelectorAll('.js-form').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.createElement('p');
    msg.className = 'done-msg full';
    msg.textContent = t(form.dataset.done, form.dataset.done === 'join.done' ? "Thank you. You're on the list, and we'll write when there is news." : 'Thank you. Our team will read your story and write back.');
    form.replaceChildren(msg);
  }));
  document.querySelectorAll('.js-quickjoin').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.createElement('p');
    msg.className = 'done-msg';
    msg.style.flexBasis = '100%';
    msg.textContent = t('join.done', "Thank you. You're on the list, and we'll write when there is news.");
    form.replaceChildren(msg);
  }));

  // ---- sign in ----
  document.querySelectorAll('[data-auth]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-auth]').forEach((x) => x.classList.toggle('on', x === b));
    const up = b.dataset.auth === 'up';
    document.querySelectorAll('.js-up').forEach((el) => { el.hidden = !up; });
    const go = document.querySelector('.js-signin-form [data-t="auth.go"], .js-signin-form [data-t="auth.create"]');
    go.setAttribute('data-t', up ? 'auth.create' : 'auth.go');
    go.textContent = up ? t('auth.create', 'Create my account') : t('auth.go', 'Sign in');
  }));
  document.querySelector('.js-signin-form').addEventListener('submit', (e) => { e.preventDefault(); location.hash = '#account'; });
  document.querySelectorAll('.js-signin').forEach((b) => b.addEventListener('click', () => { location.hash = '#account'; }));

  // ---- account tabs ----
  document.querySelectorAll('[data-acct]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-acct]').forEach((x) => x.classList.toggle('on', x === b));
    document.querySelectorAll('[data-acct-panel]').forEach((p) => { p.hidden = p.dataset.acctPanel !== b.dataset.acct; });
  }));
  const cancelBox = document.querySelector('.js-cancel-box');
  document.querySelector('.js-cancel').addEventListener('click', () => { cancelBox.hidden = false; });
  document.querySelector('.js-cancel-no').addEventListener('click', () => { cancelBox.hidden = true; });
  document.querySelector('.js-cancel-yes').addEventListener('click', () => { cancelBox.hidden = true; toast(t('toast.cancelled', 'Membership cancelled. Access continues until October 31 (preview).')); });

  // ---- membership billing toggle ----
  let bill = 'm';
  document.querySelectorAll('[data-bill]').forEach((b) => b.addEventListener('click', () => {
    bill = b.dataset.bill;
    document.querySelectorAll('[data-bill]').forEach((x) => x.classList.toggle('on', x === b));
    updateBilling();
  }));
  function updateBilling() {
    document.querySelectorAll('.js-price').forEach((p) => { p.textContent = '$' + Number(p.dataset[bill]).toLocaleString('en-US'); });
    document.querySelectorAll('.js-per').forEach((p) => { p.textContent = bill === 'm' ? t('per.m', '/ month') : t('per.y', '/ year'); });
  }

  // ---- checkout ----
  const fmt = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function totals() {
    let add = 0;
    document.querySelectorAll('.js-addon').forEach((a) => { if (a.checked) add += Number(a.dataset.price); });
    document.querySelector('.js-addons-total').textContent = fmt(add);
    document.querySelector('.js-total').textContent = fmt(2450 + add);
  }
  document.querySelectorAll('.js-addon').forEach((a) => a.addEventListener('change', totals));
  document.querySelector('.js-pay').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = t('co.paying', 'Processing…');
    setTimeout(() => {
      document.querySelector('.js-co-form').hidden = true;
      document.querySelector('.js-co-done').hidden = false;
      document.querySelectorAll('.steps span').forEach((s, i) => s.classList.toggle('on', i === 2));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 900);
  });

  // ---- admin ----
  document.querySelectorAll('[data-adm]').forEach((b) => b.addEventListener('click', () => showAdm(b.dataset.adm)));
  document.querySelectorAll('[data-adm-go]').forEach((b) => b.addEventListener('click', () => showAdm(b.dataset.admGo)));
  function showAdm(id) {
    document.querySelectorAll('[data-adm]').forEach((x) => x.classList.toggle('on', x.dataset.adm === id));
    document.querySelectorAll('[data-adm-panel]').forEach((p) => { p.hidden = p.dataset.admPanel !== id; });
  }

  const PEOPLE = [
    ['Mei Lin', 'China', 'Languages, Ideas', 'English', 'Oct 12', 'founding'],
    ['Lucía Herrera', 'Mexico', 'Arts', 'English', 'Oct 12', 'waitlist'],
    ['Daniel Okoye', 'United States', 'Languages', 'English', 'Oct 11', 'waitlist'],
    ['Chen Wei-Ting', 'Taiwan', 'Music', 'English', 'Oct 11', 'founding'],
    ['Margaret Sullivan', 'United States', 'Ideas', 'Italian', 'Oct 11', 'alumni'],
    ['Andrés Castillo', 'Colombia', 'Languages', 'English', 'Oct 10', 'waitlist'],
    ['Zhang Yifan', 'China', 'Languages, Music', 'English', 'Oct 10', 'waitlist'],
    ['Sofia Moretti', 'Italy', 'Ideas, Arts', 'English', 'Oct 10', 'founding'],
    ['Hiroshi Tanaka', 'Japan', 'Languages', 'English', 'Oct 9', 'alumni'],
    ['Ana Beatriz Lima', 'Brazil', 'Music', 'English', 'Oct 9', 'waitlist'],
  ];
  const statusPill = (s) => {
    const m = { founding: ['ok', t('ad.st.founding', 'Founding member')], waitlist: ['info', t('ad.st.waitlist', 'Waitlist')], alumni: ['warn', t('ad.st.alumni', 'Alumnus')] };
    return `<span class="pill ${m[s][0]}">${m[s][1]}</span>`;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const th = (cols) => '<thead><tr>' + cols.map((c) => `<th${c[1] ? ' class="r"' : ''}>${esc(c[0])}</th>`).join('') + '</tr></thead>';

  const PRODUCTS = [
    ['Scholar membership', 'Membership', 320, 'live'],
    ['Community membership', 'Membership', 45, 'live'],
    ['Fellow membership', 'Membership', 690, 'live'],
    ['Founding place deposit', 'Presale', 250, 'live'],
    ['Boston Immersion Week', 'Intensive', 2450, 'live'],
    ['The Good Life (10 weeks)', 'Programme', 980, 'draft'],
    ['Symposium Evening ticket', 'Event', 95, 'draft'],
    ['Gift membership, 3 months', 'Gift', 960, 'hidden'],
  ];
  const ORDERS = [
    ['#1042', 'Mei Lin', 'Founding place deposit', 250, 'Alipay', 'paid'],
    ['#1041', 'Sofia Moretti', 'Founding place deposit', 250, 'Card', 'paid'],
    ['#1040', 'Chen Wei-Ting', 'Boston Immersion Week', 2450, 'Apple Pay', 'paid'],
    ['#1039', 'Liam Walsh', 'Founding place deposit', 250, 'Card', 'refund'],
    ['#1038', 'Northbridge Health', '12 corporate seats', 18400, 'Invoice', 'due'],
  ];

  function renderAdmin() {
    const peopleCols = [[t('ad.c.name', 'Name')], [t('ad.c.country', 'Country')], [t('ad.c.interest', 'Interested in')], [t('ad.c.lang', 'Language')], [t('ad.c.date', 'Joined')], [t('ad.c.status', 'Status')]];
    const row = (p) => `<tr><td>${esc(p[0])}</td><td>${esc(p[1])}</td><td>${esc(p[2])}</td><td>${esc(p[3])}</td><td>${esc(p[4])}</td><td>${statusPill(p[5])}</td></tr>`;
    const su = document.querySelector('.js-signups');
    if (su) su.innerHTML = th(peopleCols) + '<tbody>' + PEOPLE.slice(0, 5).map(row).join('') + '</tbody>';
    const wl = document.querySelector('.js-waitlist');
    if (wl) wl.innerHTML = th(peopleCols) + '<tbody>' + PEOPLE.map(row).join('') + '</tbody>';

    const pStat = { live: ['ok', t('ad.p.live', 'On sale')], draft: ['warn', t('ad.p.draft', 'Draft')], hidden: ['off', t('ad.p.hidden', 'Hidden')] };
    const pr = document.querySelector('.js-products');
    if (pr) pr.innerHTML = th([[t('ad.c.product', 'Product')], [t('ad.c.type', 'Type')], [t('ad.c.price', 'Price'), 1], [t('ad.c.status', 'Status')], ['']]) + '<tbody>' +
      PRODUCTS.map((p, i) => `<tr><td>${esc(p[0])}</td><td>${esc(p[1])}</td><td class="r">$${p[2].toLocaleString('en-US')}</td><td><span class="pill ${pStat[p[3]][0]}">${pStat[p[3]][1]}</span></td><td class="r"><button class="link small js-edit" data-i="${i}">${esc(t('ad.edit', 'Edit'))}</button></td></tr>`).join('') + '</tbody>';

    const oStat = { paid: ['ok', t('ad.o.paid', 'Paid')], refund: ['warn', t('ad.o.refund', 'Refund requested')], due: ['info', t('ad.o.due', 'Invoice sent')] };
    const or = document.querySelector('.js-orders');
    if (or) or.innerHTML = th([[t('ad.c.order', 'Order')], [t('ad.c.member', 'Customer')], [t('ad.c.item', 'Item')], [t('ad.c.amount', 'Amount'), 1], [t('ad.c.method', 'Paid with')], [t('ad.c.status', 'Status')], ['']]) + '<tbody>' +
      ORDERS.map((o, i) => `<tr><td>${o[0]}</td><td>${esc(o[1])}</td><td>${esc(o[2])}</td><td class="r">$${o[3].toLocaleString('en-US')}</td><td>${esc(o[4])}</td><td><span class="pill ${oStat[o[5]][0]}">${oStat[o[5]][1]}</span></td><td class="r">${o[5] === 'refund' ? `<button class="btn small js-refund" data-i="${i}">${esc(t('ad.review', 'Review'))}</button>` : ''}</td></tr>`).join('') + '</tbody>';

    const S = { live: ['ok', t('ad.tr.live', 'Live')], draft: ['info', t('ad.tr.draft', 'AI draft')], review: ['warn', t('ad.tr.review', 'Needs review')], old: ['bad', t('ad.tr.old', 'Outdated')] };
    const pages = [['Home', 'live', 'live', 'live', 'live'], ['Our Story', 'live', 'live', 'review', 'live'], ['Schools', 'live', 'live', 'live', 'draft'], ['Houses', 'live', 'old', 'old', 'live'], ['Membership', 'live', 'review', 'draft', 'draft'], ['Refund policy', 'live', 'review', 'review', 'review']];
    const tr = document.querySelector('.js-trans');
    if (tr) tr.innerHTML = th([[t('ad.c.page', 'Page')], ['English'], ['简体中文'], ['繁體中文'], ['Español']]) + '<tbody>' +
      pages.map((p) => `<tr><td>${esc(p[0])}</td>${p.slice(1).map((s) => `<td><span class="pill ${S[s][0]}">${S[s][1]}</span></td>`).join('')}</tr>`).join('') + '</tbody>';

    const ho = document.querySelector('.js-houses');
    if (ho) ho.innerHTML = th([[t('ad.c.house', 'House')], [t('ad.c.members', 'Members'), 1], [t('ad.c.points', 'Points'), 1], [t('ad.c.next', 'Next event')], [t('ad.c.head', 'Head of House')]]) + '<tbody>' +
      [['Logos', 128, 1284, 'Inter-House Debate · Nov 20'], ['Kairos', 131, 1207, 'Arboretum run · Nov 2'], ['Ethos', 126, 1149, 'Speaking Cup heats · Nov 9'], ['Pathos', 127, 1102, 'Winter showcase · Dec 12']]
        .map((h) => `<tr><td><b>${h[0]}</b></td><td class="r">${h[1]}</td><td class="r">${h[2].toLocaleString('en-US')}</td><td>${esc(h[3])}</td><td>${esc(t('hb.tbc', 'To be appointed'))}</td></tr>`).join('') + '</tbody>';

    const st = document.querySelector('.js-staff');
    if (st) st.innerHTML = th([[t('ad.c.name', 'Name')], [t('ad.c.role', 'Role')], [t('ad.c.2fa', 'Two-step')], [t('ad.c.last', 'Last sign-in')]]) + '<tbody>' +
      [['Owner', t('ad.r.owner', 'Owner'), 'ok', 'Today 08:12 · Boston'], ['Wei', t('ad.r.admin', 'Admin'), 'ok', 'Today 07:55 · Boston'], ['Translator (sample)', t('ad.r.tr', 'Translator'), 'ok', 'Yesterday · Taipei'], ['Teacher (sample)', t('ad.r.teacher', 'Teacher'), 'warn', 'Invited, not yet signed in']]
        .map((s) => `<tr><td>${esc(s[0])}</td><td>${esc(s[1])}</td><td><span class="pill ${s[2]}">${s[2] === 'ok' ? esc(t('ad.on', 'On')) : esc(t('ad.pending', 'Pending'))}</span></td><td>${esc(s[3])}</td></tr>`).join('') + '</tbody>';

    const au = document.querySelector('.js-audit');
    if (au) au.innerHTML = th([[t('ad.c.time', 'Time')], [t('ad.c.who', 'Who')], [t('ad.c.what', 'What happened')]]) + '<tbody>' +
      [['08:14', 'Owner', t('ad.l.1', 'Approved price for Boston Immersion Week')], ['07:58', 'Wei', t('ad.l.2', 'Published Chinese translation of Our Story')], ['Yesterday 17:20', 'Wei', t('ad.l.3', 'Refunded order #1031 ($250)')], ['Yesterday 09:02', 'System', t('ad.l.4', 'Blocked 214 suspicious sign-in attempts')]]
        .map((a) => `<tr><td>${a[0]}</td><td>${esc(a[1])}</td><td>${esc(a[2])}</td></tr>`).join('') + '</tbody>';
  }

  // product editor
  const drawer = document.querySelector('.js-drawer');
  document.addEventListener('click', (e) => {
    const ed = e.target.closest('.js-edit');
    if (ed) {
      const p = PRODUCTS[+ed.dataset.i];
      drawer.hidden = false;
      drawer.querySelector('.js-drawer-title').textContent = p[0];
      drawer.querySelector('.js-d-price').value = p[2];
      drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const rf = e.target.closest('.js-refund');
    if (rf) {
      const o = ORDERS[+rf.dataset.i];
      const box = document.querySelector('.js-refund-box');
      box.hidden = false;
      box.querySelector('.js-refund-text').textContent = t('ad.refund.q', 'Refund $250 to Liam Walsh? The money returns to their card in 5 to 10 days and they are emailed in their language. This is logged.').replace('$250', '$' + o[3]).replace('Liam Walsh', o[1]);
    }
  });
  document.querySelector('.js-drawer-close').addEventListener('click', () => { drawer.hidden = true; });
  document.querySelector('.js-drawer-save').addEventListener('click', () => { drawer.hidden = true; toast(t('toast.approval', 'Sent to the owner for approval (preview).')); });
  document.querySelector('.js-refund-no').addEventListener('click', () => { document.querySelector('.js-refund-box').hidden = true; });
  document.querySelector('.js-refund-yes').addEventListener('click', () => {
    ORDERS[3][5] = 'paid';
    document.querySelector('.js-refund-box').hidden = true;
    renderAdmin();
    toast(t('toast.refunded', 'Refund approved and logged (preview).'));
  });

  // ---- start ----
  const saved = store.get('bsml-lang');
  if (saved && LANGS[saved]) autoChosen = false;
  applyLang(saved && LANGS[saved] ? saved : detect(), false);
  route();
})();
