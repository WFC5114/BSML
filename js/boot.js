/* BSML: choose the language before the first paint, so a Chinese or Spanish
   visitor never sees the English page flash and then reflow. Runs in <head>. */
(function () {
  function detect() {
    const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (const raw of list) {
      const l = raw.toLowerCase();
      if (l.startsWith('zh')) return /hant|tw|hk|mo/.test(l) ? 'zh-hant' : 'zh-hans';
      if (l.startsWith('es')) return 'es';
      if (l.startsWith('en')) return 'en';
    }
    return 'en';
  }
  let saved = null;
  try { saved = localStorage.getItem('bsml-lang'); } catch (e) { /* private mode */ }
  const ok = { en: 1, 'zh-hans': 1, 'zh-hant': 1, es: 1 };
  const lang = saved && ok[saved] ? saved : detect();
  window.BSML_BOOT = { lang, manual: !!(saved && ok[saved]) };
  if (lang !== 'en' && !(window.BSML_I18N && window.BSML_I18N[lang])) {
    const root = document.documentElement;
    root.classList.add('i18n-wait');
    const l = document.createElement('link');
    l.rel = 'preload'; l.as = 'script'; l.href = 'js/i18n/' + lang + '.js';
    document.head.appendChild(l);
  }
})();
