/* BSML history scroll: one city, one camera, one hundred years.
   Everything is drawn in code as slightly wobbly pen lines, so the
   illustration feels hand-inked and stays tiny to download.
   Scroll progress p (0..1) drives drawing, colour, camera and captions. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const root = document.querySelector('.history');
  if (!root) return;
  const stage = root.querySelector('.stage');
  const svg = stage.querySelector('svg.scene');

  // Chapter boundaries in scroll progress. Order matches the captions.
  const CH = [0, 0.06, 0.21, 0.31, 0.40, 0.48, 0.58, 0.70, 0.78, 0.93, 1.0001];

  let seed = 1925;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const j = (a) => (rnd() - 0.5) * 2 * a;
  const f = (n) => Math.round(n * 10) / 10;

  // ---- path builders ----
  function seg(x1, y1, x2, y2, amp, first) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.round(d / 26));
    let s = first ? `M${f(x1 + j(amp))},${f(y1 + j(amp))}` : '';
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      s += ` L${f(x1 + (x2 - x1) * t + j(amp))},${f(y1 + (y2 - y1) * t + j(amp))}`;
    }
    return s;
  }
  const line = (x1, y1, x2, y2, amp = 0.9) => seg(x1, y1, x2, y2, amp, true);
  function poly(pts, closed, amp = 0.9) {
    let s = '';
    for (let i = 0; i < pts.length - 1; i++) s += seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], amp, i === 0);
    if (closed) s += seg(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], amp, false);
    return s;
  }
  function arc(cx, cy, rx, ry, a0, a1, amp = 0.7, steps) {
    const n = steps || Math.max(8, Math.round(Math.abs(a1 - a0) * Math.max(rx, ry) / 14));
    let s = '';
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      s += (i ? ' L' : 'M') + f(cx + Math.cos(a) * rx + j(amp)) + ',' + f(cy + Math.sin(a) * ry + j(amp));
    }
    return s;
  }
  const rect = (x, y, w, h, amp) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, amp);
  function gothic(x, y, w, h) { // pointed arch window, base at y+h
    const r = w * 0.9;
    let s = `M${f(x)},${f(y + h)} L${f(x)},${f(y + w * 0.6)}`;
    s += ' ' + arc(x + r, y + w * 0.6, r, w * 0.9, Math.PI, Math.PI * 1.33, 0.4, 6).replace('M', 'L');
    s += ' ' + arc(x + w - r, y + w * 0.6, r, w * 0.9, Math.PI * 1.67, Math.PI * 2, 0.4, 6).replace('M', 'L');
    s += ` L${f(x + w)},${f(y + h)}`;
    return s;
  }

  // ---- registry ----
  const paths = [];   // {el, len, a, b}
  const groups = [];  // {el, w:[in0,in1,out0,out1], max}
  let seqList = null;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }
  function G(parent, w, extra) {
    const g = el('g', extra || {}, parent);
    if (w) groups.push({ el: g, w, max: (extra && extra.max) || 1 });
    return g;
  }
  function P(parent, d, o = {}) {
    const e = el('path', { d, class: o.cls || 'ink', 'stroke-width': o.w || 1.3 }, parent);
    if (o.fill) { e.setAttribute('fill', o.fill); e.classList.add('filled'); }
    if (o.op) e.setAttribute('opacity', o.op);
    if (o.draw !== false) {
      const rec = { el: e, len: 0, a: 0, b: 0 };
      paths.push(rec);
      if (o.draw) { rec.a = o.draw[0]; rec.b = o.draw[1]; } else if (seqList) seqList.push(rec);
    }
    if (o.dbl) P(parent, d.replace(/-?\d+(\.\d+)?/g, (m) => f(+m + j(1.1))), { ...o, dbl: false, op: 0.4, w: (o.w || 1.3) * 0.7 });
    return e;
  }
  function seq(a, b, fn) {
    seqList = [];
    fn();
    const n = seqList.length;
    seqList.forEach((r, i) => { r.a = a + (b - a) * (i / n) * 0.78; r.b = r.a + (b - a) * 0.22; });
    seqList = null;
  }

  // ---- defs ----
  const defs = el('defs', {});
  defs.innerHTML = `
    <filter id="wash" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="4"/>
      <feDisplacementMap in="SourceGraphic" scale="60"/>
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <pattern id="halftone" width="9" height="9" patternUnits="userSpaceOnUse">
      <circle cx="4.5" cy="4.5" r="1.6" fill="#2B3A44"/>
    </pattern>
    <pattern id="photo" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="10" height="10" fill="#D9D5C8"/><line x1="0" y1="0" x2="0" y2="10" stroke="#C9C4B4" stroke-width="2"/>
    </pattern>`;

  const style = el('style', {});
  style.textContent = `
    .ink{fill:none;stroke:var(--sink);stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
    .ink.filled{stroke:var(--sink)}
    .gold{fill:none;stroke:#E9C987;stroke-linecap:round;stroke-linejoin:round}
    .chalk{fill:none;stroke:#E8E6DA;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
    text{font-family:"Cormorant Garamond",var(--display),serif}
    .hello{fill:var(--sink);font-size:30px;font-style:italic}
    .flabel{fill:#F3EFE4;font-size:30px}
    .fsub{fill:#AEB6C0;font-size:15px;font-family:"Instrument Sans",var(--body),sans-serif;letter-spacing:.12em;text-transform:uppercase}
    .ms{fill:#E9C987;font-size:14px;font-family:"Instrument Sans",var(--body),sans-serif;letter-spacing:.18em;text-transform:uppercase}`;

  // ---- layers ----
  const washes = G(svg, [CH[3], CH[3] + 0.04, CH[5] - 0.012, CH[5] + 0.015], { max: 0.55 });
  [[420, 640, 260, 120, '#C98F6A'], [980, 600, 300, 110, '#8FA9B8'], [1300, 650, 220, 100, '#B6A27A'], [700, 380, 380, 120, '#A9C1C9'], [180, 700, 200, 90, '#7E9DB0']]
    .forEach(([cx, cy, rx, ry, c]) => el('ellipse', { cx, cy, rx, ry, fill: c, filter: 'url(#wash)' }, washes));

  const world = G(svg, null, { id: 'world' });
  const city = G(world, [0, 0, CH[5] - 0.012, CH[5] + 0.015]);

  // Ground and rails
  seq(CH[1], CH[1] + 0.03, () => {
    P(city, line(-40, 780, 1640, 780, 0.6), { w: 1.6 });
    P(city, line(-40, 796, 1640, 796, 0.6), { w: 0.9 });
  });

  // 1925 Boston
  seq(CH[1] + 0.005, CH[1] + 0.095, () => {
    // Custom House Tower (1915), the city's tallest in 1925
    const tx = 730, tw = 64;
    P(city, poly([[tx, 560], [tx, 236], [tx + tw, 236], [tx + tw, 560]], false), { w: 1.5, dbl: true });
    P(city, poly([[tx - 8, 236], [tx + tw / 2, 168], [tx + tw + 8, 236]], false), { w: 1.4, dbl: true });
    P(city, line(tx + tw / 2, 168, tx + tw / 2, 140), { w: 1.2 });
    P(city, arc(tx + tw / 2, 272, 17, 17, 0, Math.PI * 2), { w: 1.2 });
    P(city, line(tx + tw / 2, 272, tx + tw / 2, 260, 0.2), { w: 1 });
    P(city, line(tx + tw / 2, 272, tx + tw / 2 + 9, 276, 0.2), { w: 1 });
    for (let y = 310; y < 540; y += 34) { P(city, rect(tx + 12, y, 10, 20, 0.4), { w: 0.9 }); P(city, rect(tx + tw - 22, y, 10, 20, 0.4), { w: 0.9 }); }
    for (let y = 300; y < 560; y += 9) P(city, line(tx + tw - 6, y, tx + tw - 1, y + 6, 0.3), { w: 0.6, op: 0.6 });

    // Brownstone row: bow fronts, cornices, stoops
    let x = 300;
    let i = 0;
    while (x < 1600) {
      const w = [118, 132, 104, 140, 122][i % 5];
      const top = 548 + [0, -24, 12, -10, 20][i % 5];
      const isSchool = x <= 760 && x + w > 760;
      P(city, poly([[x, 780], [x, top], [x + w, top], [x + w, 780]], false), { w: 1.4 });
      P(city, line(x - 4, top, x + w + 4, top, 0.5), { w: 1.6 });
      P(city, line(x - 2, top + 8, x + w + 2, top + 8, 0.5), { w: 0.8 });
      if (i % 2 === 0) { // bow front
        P(city, arc(x + w / 2, top + 30, w * 0.42, 14, 0, Math.PI, 0.5), { w: 1 });
        P(city, line(x + w * 0.08, top + 30, x + w * 0.08, 700), { w: 1 });
        P(city, line(x + w * 0.92, top + 30, x + w * 0.92, 700), { w: 1 });
      }
      const rows = Math.floor((700 - top - 26) / 52);
      for (let r = 0; r < rows; r++) for (let c = 0; c < 3; c++) {
        const wx = x + 14 + c * ((w - 28) / 3) + 4, wy = top + 26 + r * 52;
        const ww = (w - 28) / 3 - 8;
        P(city, rect(wx, wy, ww, 34, 0.4), { w: 0.9 });
        if (isSchool && r === rows - 1 && c === 1) svg._schoolWindow = [wx + ww / 2, wy + 17, wx, wy, ww];
      }
      // stoop and door
      P(city, poly([[x + w * 0.62, 780], [x + w * 0.62, 706], [x + w * 0.88, 706], [x + w * 0.88, 780]], false), { w: 1 });
      P(city, arc(x + w * 0.75, 706, w * 0.13, 12, Math.PI, Math.PI * 2, 0.3), { w: 0.9 });
      for (let s = 0; s < 4; s++) P(city, line(x + w * 0.5 - s * 5, 750 + s * 8, x + w * 0.62, 750 + s * 8, 0.3), { w: 0.8 });
      // etched shading on alternate facades
      if (i % 3 === 1) for (let y = top + 14; y < 776; y += 11) P(city, line(x + w - 14, y, x + w - 3, y + 9, 0.3), { w: 0.55, op: 0.55 });
      x += w;
      i++;
    }

    // State House on Beacon Hill, behind the row
    const sx = 1110;
    P(city, line(960, 560, 1260, 520, 1), { w: 1.1 });
    P(city, rect(1010, 452, 200, 80), { w: 1.3 });
    for (let c = 0; c < 6; c++) P(city, line(1030 + c * 32, 470, 1030 + c * 32, 530, 0.4), { w: 0.9 });
    P(city, poly([[1000, 452], [sx, 418], [1220, 452]], false), { w: 1.2 });
    P(city, arc(sx, 418, 66, 70, Math.PI, Math.PI * 2, 0.6), { w: 1.6, dbl: true });
    P(city, rect(sx - 10, 330, 20, 20, 0.3), { w: 1 });
    P(city, line(sx, 330, sx, 312, 0.3), { w: 1 });
    for (let k = -2; k <= 2; k++) P(city, arc(sx, 418, Math.abs(k) * 22 + 4, 70, Math.PI * 1.02, Math.PI * 1.98, 0.3), { w: 0.5, op: 0.5 });

    // Gas lamps
    [330, 640, 960, 1290].forEach((lx) => {
      P(city, line(lx, 780, lx, 712, 0.4), { w: 1.1 });
      P(city, poly([[lx - 7, 712], [lx + 7, 712], [lx + 4, 698], [lx - 4, 698]], true, 0.3), { w: 1 });
    });
    // Trolley wire
    P(city, line(-40, 640, 1640, 646, 0.8), { w: 0.7, op: 0.8 });
  });

  // Streetcar (moves along the street during 1925)
  const tram = G(city, null);
  seq(CH[1] + 0.06, CH[1] + 0.09, () => {
    P(tram, rect(160, 700, 180, 70), { w: 1.5, dbl: true });
    P(tram, poly([[150, 700], [250, 684], [350, 700]], false), { w: 1.2 });
    for (let k = 0; k < 6; k++) P(tram, rect(172 + k * 27, 712, 20, 22, 0.3), { w: 0.9 });
    P(tram, arc(200, 774, 10, 10, 0, Math.PI * 2, 0.3), { w: 1.1 });
    P(tram, arc(300, 774, 10, 10, 0, Math.PI * 2, 0.3), { w: 1.1 });
    P(tram, line(300, 684, 360, 642, 0.3), { w: 1 });
  });

  // School window glow (lights on while the school is open)
  const sw = svg._schoolWindow;
  const glowWin = G(city, [CH[1] + 0.07, CH[1] + 0.09, 2, 2]);
  el('rect', { x: sw[2] + 2, y: sw[3] + 2, width: sw[4] - 4, height: 30, fill: '#E9B95A', opacity: 0.85 }, glowWin);

  // 1930s-40s: harbour and the journeys
  const harbour = G(city, [CH[2] - 0.01, CH[2] + 0.01, 2, 2]);
  seq(CH[2] + 0.005, CH[2] + 0.06, () => {
    for (let k = 0; k < 5; k++) {
      let d = '';
      for (let xx = -40; xx < 300; xx += 24) d += (xx === -40 ? 'M' : ' Q') + (xx === -40 ? `${xx},${786 + k * 6}` : `${xx - 12},${780 + k * 6 + (k % 2 ? 3 : -3)} ${xx},${786 + k * 6}`);
      P(harbour, d, { w: 0.8, op: 0.8 });
    }
    // steamship
    P(harbour, poly([[20, 730], [260, 730], [236, 772], [44, 772]], true), { w: 1.5, dbl: true });
    P(harbour, rect(80, 700, 120, 30), { w: 1.1 });
    P(harbour, rect(116, 660, 18, 40, 0.4), { w: 1.1 });
    P(harbour, rect(150, 668, 18, 32, 0.4), { w: 1.1 });
    for (let k = 0; k < 7; k++) P(harbour, arc(56 + k * 28, 748, 5, 5, 0, Math.PI * 2, 0.2), { w: 0.8 });
    P(harbour, arc(118, 630, 18, 12, Math.PI * 0.8, Math.PI * 2.1, 1.2), { w: 0.8, op: 0.7 });
    P(harbour, arc(140, 600, 26, 14, Math.PI * 0.8, Math.PI * 2.1, 1.4), { w: 0.8, op: 0.5 });
  });
  // journey lines from beyond the sea to the school window
  const journeys = G(city, [CH[2], CH[2] + 0.01, CH[3] + 0.04, CH[3] + 0.07]);
  [[-60, 220], [-60, 360], [-60, 470], [-60, 120]].forEach(([x0, y0], k) => {
    const d = `M${x0},${y0} Q${300 + k * 60},${y0 - 140} ${sw[0]},${sw[1]}`;
    P(journeys, d, { cls: 'ink', w: 1, draw: [CH[2] + 0.02 + k * 0.012, CH[2] + 0.06 + k * 0.012], op: 0.75 }).setAttribute('stroke-dasharray', '0');
  });

  // 1950s-60s: Prudential (1964) and the Citgo sign (1965)
  seq(CH[3] + 0.005, CH[3] + 0.05, () => {
    P(city, rect(1330, 250, 72, 300), { w: 1.4, dbl: true });
    for (let y = 262; y < 540; y += 16) P(city, line(1336, y, 1396, y, 0.3), { w: 0.6, op: 0.7 });
    P(city, line(1366, 250, 1366, 200, 0.3), { w: 1 });
    P(city, line(915, 552, 915, 506, 0.3), { w: 1 });
    P(city, rect(875, 440, 80, 66, 0.5), { w: 1.3 });
  });
  const citgo = G(city, [CH[3] + 0.04, CH[3] + 0.06, 2, 2]);
  el('path', { d: 'M889,496 L915,452 L941,496 Z', fill: '#C8452E' }, citgo);

  // 1972-76: the Hancock tower, mid-century print feel
  seq(CH[4] + 0.005, CH[4] + 0.04, () => {
    P(city, poly([[1430, 560], [1442, 210], [1500, 196], [1512, 560]], false), { w: 1.4, dbl: true });
    for (let y = 230; y < 550; y += 22) P(city, line(1442, y, 1508, y - 4, 0.3), { w: 0.5, op: 0.6 });
  });
  const halftone = G(svg, [CH[4], CH[4] + 0.02, CH[5] - 0.01, CH[5] + 0.01], { max: 0.16 });
  el('rect', { x: -100, y: -100, width: 1800, height: 1100, fill: 'url(#halftone)' }, halftone);

  // Camera move into the 1925 classroom
  const classroom = G(svg, [CH[1] + 0.105, CH[1] + 0.115, CH[1] + 0.135, CH[1] + 0.145]);
  el('rect', { x: -100, y: -100, width: 1800, height: 1100, fill: '#F1F0EA' }, classroom);
  el('rect', { x: 430, y: 200, width: 740, height: 310, fill: '#2E3B33' }, classroom);
  seq(CH[1] + 0.11, CH[1] + 0.13, () => {
    P(classroom, rect(430, 200, 740, 310, 1.2), { w: 2, dbl: true });
    P(classroom, line(420, 520, 1180, 520, 0.8), { w: 1.6 });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const dx = 280 + c * 300 + r * 20 - 20, dy = 620 + r * 80;
      P(classroom, poly([[dx, dy], [dx + 180, dy], [dx + 200, dy + 26], [dx + 20, dy + 26]], true, 0.6), { w: 1.2 });
      P(classroom, line(dx + 26, dy + 26, dx + 26, dy + 70, 0.4), { w: 1 });
      P(classroom, line(dx + 190, dy + 26, dx + 190, dy + 70, 0.4), { w: 1 });
    }
    P(classroom, poly([[1240, 160], [1440, 160], [1440, 560], [1240, 560]], true), { w: 1.3 });
    P(classroom, line(1340, 160, 1340, 560, 0.5), { w: 1 });
    P(classroom, line(1240, 360, 1440, 360, 0.5), { w: 1 });
    P(classroom, poly([[160, 160], [360, 160], [360, 560], [160, 560]], true), { w: 1.3 });
    P(classroom, line(260, 160, 260, 560, 0.5), { w: 1 });
  });
  const chalk = el('text', { x: 470, y: 300, fill: '#E8E6DA', 'font-size': 64, 'font-style': 'italic', 'data-t': 'scene.lesson' }, classroom);
  chalk.textContent = 'Lesson One';
  const chalk2 = el('text', { x: 472, y: 380, fill: '#E8E6DA', 'font-size': 38, 'font-style': 'italic', opacity: 0.85, 'data-t': 'scene.goodmorning' }, classroom);
  chalk2.textContent = 'Good morning. My name is…';

  // 1984: the granite church beside the Arboretum
  const church = G(world, [CH[5] - 0.005, CH[5] + 0.02, CH[8] - 0.005, CH[8] + 0.012]);
  const trees = [];
  seq(CH[5] + 0.01, CH[5] + 0.06, () => {
    P(church, line(-40, 780, 1640, 780, 0.6), { w: 1.6 });
    // tower
    P(church, rect(640, 400, 100, 380), { w: 1.6, dbl: true });
    for (let k = 0; k < 5; k++) P(church, rect(640 + k * 20, 384, 12, 16, 0.3), { w: 1.1 });
    P(church, gothic(670, 450, 40, 90), { w: 1.1 });
    // nave
    P(church, poly([[740, 780], [740, 560], [880, 450], [1020, 560], [1020, 780]], false), { w: 1.6, dbl: true });
    [770, 840, 910, 975].forEach((wx) => P(church, gothic(wx, 600, 30, 100), { w: 1.1 }));
    P(church, gothic(845, 490, 70, 60), { w: 1 });
    P(church, gothic(855, 700, 50, 80), { w: 1.2 });
    // granite courses
    for (let y = 412; y < 780; y += 18) P(church, line(642, y, 738, y, 0.5), { w: 0.5, op: 0.55 });
    for (let y = 572; y < 780; y += 18) P(church, line(742, y, 1018, y, 0.5), { w: 0.5, op: 0.5 });
    // Arboretum trees
    [[200, 0.9], [330, 1.15], [470, 0.8], [1110, 1.1], [1250, 0.85], [1400, 1.2], [1530, 0.9]].forEach(([tx, s]) => {
      P(church, line(tx, 780, tx, 780 - 120 * s, 0.6), { w: 1.4 });
      P(church, line(tx, 780 - 70 * s, tx - 30 * s, 780 - 120 * s, 0.6), { w: 1 });
      P(church, line(tx, 780 - 90 * s, tx + 34 * s, 780 - 140 * s, 0.6), { w: 1 });
      trees.push([tx, 780 - 160 * s, s]);
    });
  });
  const canopy = G(church, [CH[5] + 0.04, CH[5] + 0.06, 2, 2]);
  const leaves = trees.map(([tx, ty, s]) => {
    const g = el('g', {}, canopy);
    for (let k = 0; k < 6; k++) el('circle', { cx: tx + j(50 * s), cy: ty + j(34 * s), r: 34 * s + j(8), fill: '#7D9465', opacity: 0.7, filter: 'url(#wash)' }, g);
    return g;
  });
  const churchGlow = G(church, [CH[5] + 0.05, CH[5] + 0.07, CH[7] + 0.01, CH[7] + 0.03]);
  [770, 840, 910, 975].forEach((wx) => el('path', { d: gothic(wx + 3, 606, 24, 92) + ' Z', fill: '#E9B95A', opacity: 0.8 }, churchGlow));

  // 1990s-2010s: archive photographs and many hellos
  const album = G(svg, [CH[6], CH[6] + 0.02, CH[7] - 0.005, CH[7] + 0.01]);
  [[900, 150, -6], [1080, 120, 4], [1260, 170, -3], [990, 320, 5], [1180, 330, -5]].forEach(([x, y, r], k) => {
    const g = el('g', { transform: `rotate(${r} ${x + 80} ${y + 70})` }, album);
    el('rect', { x, y, width: 160, height: 140, fill: '#FBFAF6', stroke: '#C9C4B4' }, g);
    el('rect', { x: x + 10, y: y + 10, width: 140, height: 98, fill: 'url(#photo)' }, g);
    const t = el('text', { x: x + 14, y: y + 128, 'font-size': 13, fill: '#6B6458', 'data-t': 'scene.archive' }, g);
    t.textContent = 'Archive photo';
  });
  const hellos = G(svg, [CH[6] + 0.005, CH[6] + 0.025, CH[7] - 0.01, CH[7] + 0.01]);
  const words = ['Hello', '你好', 'Hola', 'Bonjour', 'Ciao', 'Olá', 'こんにちは', '안녕하세요', 'Merhaba', 'Привет', 'مرحبا', 'Hallo', 'Γεια σας', 'Xin chào', 'नमस्ते', 'Sawubona', 'Hej', 'Shalom'];
  const helloEls = words.map((w, k) => {
    const t = el('text', { class: 'hello', x: 0, y: 0, opacity: 0.35 + rnd() * 0.5 }, hellos);
    t.textContent = w;
    return { t, x: 600 + ((k * 173) % 760), y: 130 + ((k * 97) % 300), sp: 0.4 + rnd() * 0.5 };
  });

  // The pen line: one thread through the whole century
  const threadD = (() => { let d = 'M-30,830'; for (let x = 0; x <= 1640; x += 40) d += ` Q${x - 20},${830 + Math.sin(x / 90) * 6} ${x},${830 + Math.sin(x / 70) * 4}`; return d; })();
  const thread = el('path', { d: threadD, class: 'ink', 'stroke-width': 1.6 }, svg);
  const nib = el('circle', { r: 3.5, fill: 'var(--sink)' }, svg);

  // 2026: the revival. A building assembles, then opens floor by floor.
  const revival = G(svg, [CH[8] + 0.005, CH[8] + 0.02, 2, 2]);
  const floorsG = el('g', {}, revival);
  const floorKeys = [['scene.f1', 'Languages', '#8FB7C9'], ['scene.f2', 'Ideas · The Agora', '#C9B98F'], ['scene.f3', 'Arts', '#C98F8F'], ['scene.f4', 'Music', '#9FC98F']];
  const floors = floorKeys.map(([key, label, tint], k) => {
    const g = el('g', {}, floorsG);
    const W = 250, D = 64, T = 26;
    el('path', { d: `M${800 - W},0 L800,${-D} L${800 + W},0 L800,${D} Z`, fill: tint, 'fill-opacity': 0.14, stroke: '#E9C987', 'stroke-width': 1.4 }, g);
    el('path', { d: `M${800 - W},0 L${800 - W},${T} L800,${D + T} L${800 + W},${T} L${800 + W},0`, fill: 'none', stroke: '#E9C987', 'stroke-width': 1.1, opacity: 0.8 }, g);
    el('path', { d: `M800,${D} L800,${D + T}`, stroke: '#E9C987', 'stroke-width': 1.1, opacity: 0.8 }, g);
    for (let c = 1; c < 6; c++) el('path', { d: `M${800 - W + c * (W / 6)},${c * (D / 6)} L${800 - W + c * (W / 6)},${c * (D / 6) + T}`, stroke: '#E9C987', 'stroke-width': 0.6, opacity: 0.5 }, g);
    const lab = el('g', { class: 'flab' }, g);
    const sub = el('text', { x: 800, y: -10, 'text-anchor': 'middle', class: 'fsub', 'data-t': 'scene.school' }, lab); sub.textContent = 'School of';
    const t = el('text', { x: 800, y: 20, 'text-anchor': 'middle', class: 'flabel', 'data-t': key }, lab); t.textContent = label;
    return { g, lab };
  });
  const ms = el('g', {}, revival);
  const msLine = el('path', { d: 'M800,880 L800,200', class: 'gold', 'stroke-width': 2, filter: 'url(#glow)' }, ms);
  const msText = el('text', { x: 520, y: 180, class: 'ms', 'data-t': 'scene.ms' }, ms); msText.textContent = 'Mindfulness · Movement · Momentum';
  const crestG = el('g', {}, revival);
  const crestDefs = [['Ethos', '#2B4A7A', 'Η'], ['Logos', '#2F5E4E', 'Λ'], ['Pathos', '#7B2D3B', 'Π'], ['Kairos', '#A8741F', 'Κ']];
  const crestX = [1140, 1250, 1360, 1470];
  const crests = crestDefs.map(([name, col, letter], k) => {
    const g = el('g', {}, crestG);
    const x = crestX[k];
    el('path', { d: `M${x - 36},0 L${x + 36},0 L${x + 36},38 Q${x + 36},76 ${x},92 Q${x - 36},76 ${x - 36},38 Z`, fill: col, stroke: '#E9C987', 'stroke-width': 1.6 }, g);
    const L = el('text', { x, y: 54, 'text-anchor': 'middle', fill: '#F3EFE4', 'font-size': 38 }, g); L.textContent = letter;
    const N = el('text', { x, y: 118, 'text-anchor': 'middle', class: 'fsub', style: 'font-size:13px' }, g); N.textContent = name;
    return g;
  });
  revival.appendChild(ms); // keep the thread in front of floors

  // ---- timing helpers ----
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ramp = (p, a, b) => clamp((p - a) / (b - a));
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function mix(c1, c2, t) {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
    const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
    const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  // colour script: [progress, background, ink]
  const COL = [
    [0, '#F1F0EA', '#1E2630'], [CH[2], '#F1F0EA', '#1E2630'], [CH[2] + 0.03, '#EADFC8', '#5A3F27'],
    [CH[3], '#EADFC8', '#5A3F27'], [CH[3] + 0.03, '#EFE9DC', '#36444E'], [CH[4] + 0.02, '#ECE4CF', '#2B3A44'],
    [CH[5] + 0.02, '#EEEBE2', '#383A36'], [CH[7], '#EEEBE2', '#383A36'], [CH[7] + 0.03, '#D8D8D4', '#8E8E8A'],
    [CH[8] - 0.01, '#D8D8D4', '#8E8E8A'], [CH[8] + 0.015, '#0F1A26', '#E9C987'], [1, '#0F1A26', '#E9C987']];
  function colourAt(p) {
    for (let i = 0; i < COL.length - 1; i++) if (p <= COL[i + 1][0]) {
      const t = ramp(p, COL[i][0], COL[i + 1][0]);
      return [mix(COL[i][1], COL[i + 1][1], t), mix(COL[i][2], COL[i + 1][2], t)];
    }
    return [COL[COL.length - 1][1], COL[COL.length - 1][2]];
  }
  const seasons = ['#7D9465', '#B9772F', '#D8D3C6', '#97B46F', '#7D9465'];

  // ---- measure ----
  paths.forEach((r) => { r.len = Math.ceil(r.el.getTotalLength()) + 2; r.el.style.strokeDasharray = r.len; r.el.style.strokeDashoffset = r.len; });
  const threadLen = thread.getTotalLength();
  thread.style.strokeDasharray = threadLen;

  // ---- captions and timebar ----
  const caps = [...stage.querySelectorAll('.cap')];
  const ticks = [...stage.querySelectorAll('.timebar button')];
  const fill = stage.querySelector('.timebar .fill');
  const hint = stage.querySelector('.scroll-hint');
  ticks.forEach((b) => b.addEventListener('click', () => goTo(+b.dataset.ch)));
  stage.querySelector('.skip').addEventListener('click', () => goTo(8));
  function goTo(ch) {
    const top = root.getBoundingClientRect().top + window.scrollY;
    const span = root.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * (CH[ch] + (CH[ch + 1] - CH[ch]) * 0.45), behavior: 'smooth' });
  }

  // ---- portrait framing ----
  let portrait = false;
  function frame() {
    portrait = window.innerWidth / window.innerHeight < 0.9;
    stage.classList.toggle('portrait', portrait);
    svg.setAttribute('viewBox', portrait ? '455 230 690 770' : '0 0 1600 900');
    svg.setAttribute('preserveAspectRatio', portrait ? 'xMidYMax meet' : 'xMidYMax slice');
  }
  frame();
  window.addEventListener('resize', () => { frame(); update(); });

  // ---- main update ----
  let lastCh = -1;
  function update() {
    if (!root.offsetParent && root.offsetHeight === 0) return;
    const r = root.getBoundingClientRect();
    const span = root.offsetHeight - window.innerHeight;
    const p = clamp(-r.top / span);

    const [bg, ink] = colourAt(p);
    stage.style.setProperty('--stage-bg', bg);
    stage.style.setProperty('--sink', ink);
    stage.classList.toggle('night', p > CH[8]);
    svg.style.filter = p > CH[7] && p < CH[8] + 0.01 ? `grayscale(${ramp(p, CH[7], CH[7] + 0.03)})` : '';

    for (const rec of paths) {
      const t = ramp(p, rec.a, rec.b);
      rec.el.style.strokeDashoffset = rec.len * (1 - t);
      rec.el.style.strokeDasharray = t >= 1 ? 'none' : rec.len;
    }
    for (const g of groups) {
      const [a, b, c, d] = g.w;
      const o = Math.min(b > a ? ramp(p, a, b) : (p >= a ? 1 : 0), c < 2 ? 1 - ramp(p, c, d) : 1) * g.max;
      g.el.style.opacity = o;
      g.el.style.display = o <= 0.001 ? 'none' : '';
    }

    // camera: push into the school window, then pull back
    const zin = ease(ramp(p, CH[1] + 0.09, CH[1] + 0.115));
    const zout = ease(ramp(p, CH[1] + 0.135, CH[1] + 0.155));
    const z = zin * (1 - zout);
    const s = 1 + z * 11;
    world.setAttribute('transform', `translate(${sw[0]} ${sw[1]}) scale(${s}) translate(${-sw[0]} ${-sw[1]})`);

    // streetcar rolls along in 1925
    tram.setAttribute('transform', `translate(${ramp(p, CH[1], CH[2] + 0.04) * 1100} 0)`);

    // seasons in the Arboretum
    const sp = ramp(p, CH[5] + 0.05, CH[7]) * (seasons.length - 1);
    const si = Math.min(seasons.length - 2, Math.floor(sp));
    const leafCol = mix(seasons[si], seasons[si + 1], sp - si);
    const bare = p > CH[7] ? 1 - ramp(p, CH[7], CH[7] + 0.03) : 1;
    leaves.forEach((g) => { g.style.opacity = bare; g.querySelectorAll('circle').forEach((c) => c.setAttribute('fill', leafCol)); });

    // hellos drift
    const hp = ramp(p, CH[6], CH[7]);
    helloEls.forEach((h) => h.t.setAttribute('transform', `translate(${f(h.x + hp * 200 * h.sp)} ${h.y})`));

    // the thread: drawn through 95 years, stops in 2020, starts again in 2026
    const tp = p < CH[7] ? ramp(p, CH[1], CH[7]) * 0.78 : p < CH[8] ? 0.78 : 0.78 + ramp(p, CH[8], CH[8] + 0.06) * 0.22;
    thread.style.strokeDashoffset = threadLen * (1 - tp);
    const pt = thread.getPointAtLength(threadLen * tp);
    nib.setAttribute('cx', pt.x); nib.setAttribute('cy', pt.y);
    nib.style.opacity = p < CH[1] - 0.01 || (p > CH[7] + 0.02 && p < CH[8]) ? 0.25 : 1;
    thread.setAttribute('filter', p > CH[8] ? 'url(#glow)' : '');
    thread.style.opacity = z > 0.05 ? 1 - z : 1;
    nib.style.display = z > 0.05 ? 'none' : '';

    // 2026 building: rise, then open into floors
    const rise = ease(ramp(p, CH[8] + 0.01, CH[8] + 0.06));
    const open = ease(ramp(p, CH[8] + 0.065, CH[8] + 0.11));
    floors.forEach((fl, k) => {
      const yAssembled = 690 - k * 34;
      const yOpen = 700 - k * 118;
      const y = (yAssembled + (yOpen - yAssembled) * open) + (1 - ramp(rise, k * 0.15, k * 0.15 + 0.55)) * 420;
      fl.g.setAttribute('transform', `translate(0 ${f(y)})`);
      fl.g.style.opacity = ramp(rise, k * 0.15, k * 0.15 + 0.4);
      fl.lab.style.opacity = ramp(open, 0.5 + k * 0.1, 0.8 + k * 0.05);
    });
    msLine.style.opacity = ramp(open, 0.6, 1);
    msText.style.opacity = ramp(open, 0.8, 1);
    const cr = ease(ramp(p, CH[8] + 0.1, CH[8] + 0.14));
    crests.forEach((g, k) => {
      const t = ramp(cr, k * 0.12, k * 0.12 + 0.6);
      const dx = portrait ? [565, 695, 905, 1035][k] - crestX[k] : 0;
      g.setAttribute('transform', `translate(${dx} ${f((portrait ? 860 : 590) + (1 - t) * 360)})`);
      g.style.opacity = t;
    });
    revival.style.opacity = Math.min(+revival.style.opacity || 0, p > CH[9] ? 1 - ramp(p, CH[9], CH[9] + 0.03) * 0.85 : 1);

    // captions
    let ch = 0;
    for (let i = 0; i < CH.length - 1; i++) if (p >= CH[i]) ch = i;
    if (z > 0.6) ch = -2; // inside the classroom: let the drawing speak
    if (ch !== lastCh) {
      caps.forEach((c, i) => c.classList.toggle('on', i === ch));
      ticks.forEach((b) => { const c = +b.dataset.ch; b.classList.toggle('on', c === ch || (c === 2 && ch === 3) ? c === ch : c === ch); });
      lastCh = ch;
    }
    let active = 0;
    ticks.forEach((b, i) => { if (p >= CH[+b.dataset.ch]) active = i; });
    ticks.forEach((b, i) => b.classList.toggle('on', i === active));
    fill.style.width = (p * 100).toFixed(2) + '%';
    hint.style.opacity = p > 0.01 ? 0 : 1;
  }

  let ticking = false;
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } }, { passive: true });
  window.BSMLScene = { update, goTo };
  update();
})();
