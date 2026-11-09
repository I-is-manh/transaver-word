/* Hiệu ứng theme Transaver Word (hạt, nền động, ăn mừng, streak). BẢN MẪU THIẾT KẾ, chưa phải code của app.
   Không phụ thuộc thư viện. Cần themes.css + effects.css.

   Dùng:
     const fx = TVEffects.create({ container: document.body, set: 'autumn' });
     fx.flip(cardEl); fx.correct(el); fx.wrong(el); fx.save(buttonEl, targetEl);
     fx.complete({ title, sub }); fx.streak(30); fx.announce({ title, sub });
     fx.setSet('ocean'); fx.setMotion(false); fx.refresh(); fx.destroy();

   Tôn trọng prefers-reduced-motion và data-tv-motion="off": khi đó không vẽ hạt, không nền động.
   SETS phải khớp effect_sets trong themes.json. Mọi thông số nằm ở các bảng AMBIENT, BURST, PALETTE. */
(function (global) {
  'use strict';

  const SETS = {
    basic:     { background: 'none',           save: 'pulse',       flip: 'flip3d',        correct: 'glow',          wrong: 'shake',          progress: 'fill',          complete: 'check-pop',     streak: 'flame' },
    starry:    { background: 'stars',          save: 'star-trail',  flip: 'stardust',      correct: 'shooting-star', wrong: 'dim-flicker',    progress: 'constellation', complete: 'starburst',     streak: 'nova' },
    autumn:    { background: 'falling-leaves', save: 'leaf-fly',    flip: 'page-turn',     correct: 'leaf-burst',    wrong: 'branch-sway',    progress: 'branch-grow',   complete: 'leaf-shower',   streak: 'maple-glow' },
    ocean:     { background: 'bubbles',        save: 'bubble-rise', flip: 'ripple',        correct: 'bubble-burst',  wrong: 'wave-wobble',    progress: 'wave-fill',     complete: 'wave-sweep',    streak: 'pearl' },
    sakura:    { background: 'petals',         save: 'petal-fly',   flip: 'bloom',         correct: 'petal-burst',   wrong: 'petal-droop',    progress: 'blossom',       complete: 'petal-shower',  streak: 'sakura-bloom' },
    firefly:   { background: 'fireflies',      save: 'firefly-fly', flip: 'light-up',      correct: 'firefly-glow',  wrong: 'flicker-out',    progress: 'glow-fill',     complete: 'firefly-swarm', streak: 'lantern' },
    grid:      { background: 'grid-paper',     save: 'ink-drop',    flip: 'notebook-flip', correct: 'check-draw',    wrong: 'erase',          progress: 'pencil-line',   complete: 'stamp-10',      streak: 'star-sticker' },
    map:       { background: 'map-lines',      save: 'pin-drop',    flip: 'unfold',        correct: 'coin-burst',    wrong: 'compass-wobble', progress: 'route',         complete: 'treasure',      streak: 'compass' },
    halloween: { background: 'bats',           save: 'candy-fly',   flip: 'light-up',      correct: 'candy-burst',   wrong: 'shake',          progress: 'glow-fill',     complete: 'candy-shower',  streak: 'jack-o-lantern' },
    teachers:  { background: 'petals',         save: 'petal-fly',   flip: 'page-turn',     correct: 'flower-burst',  wrong: 'shake',          progress: 'blossom',       complete: 'flower-shower', streak: 'bouquet' },
    christmas: { background: 'snow',           save: 'snow-fly',    flip: 'flip3d',        correct: 'snow-burst',    wrong: 'shake',          progress: 'fill',          complete: 'snow-shower',   streak: 'gift' },
    tet:       { background: 'mai-blossoms',   save: 'lixi-fly',    flip: 'bloom',         correct: 'mai-burst',     wrong: 'shake',          progress: 'blossom',       complete: 'firework-soft', streak: 'lixi' },
    midautumn: { background: 'lanterns',       save: 'lantern-fly', flip: 'light-up',      correct: 'lantern-glow',  wrong: 'flicker-out',    progress: 'glow-fill',     complete: 'lantern-rise',  streak: 'full-moon' },
  };

  // Hình dạng hạt đặc trưng của từng bộ
  const SHAPE = {
    basic: 'dot', starry: 'star', autumn: 'leaf', ocean: 'bubble', sakura: 'petal', firefly: 'firefly',
    grid: 'ink', map: 'coin', halloween: 'candy', teachers: 'flower', christmas: 'snow', tet: 'flower', midautumn: 'lantern',
  };

  // Màu hạt theo bộ. 'token:x' = lấy biến CSS --x của theme; còn lại là màu cố định của họa tiết.
  const PALETTE = {
    basic:     ['token:brand', 'token:accent', 'token:brand-strong'],
    starry:    ['token:accent', 'token:brand', 'mode:ink|brand-strong'],
    autumn:    ['token:brand', 'token:accent', '#C2552B', '#D98A2B'],
    ocean:     ['token:brand', 'token:brand-strong'],
    sakura:    ['token:brand', 'token:brand-strong', '#F7B6D2', '#FFD9E8'],
    firefly:   ['mode:brand|accent'],
    grid:      ['token:brand', 'token:brand-strong'],
    map:       ['token:accent', '#D9A520'],
    halloween: ['#F28C28', 'token:brand', 'token:accent', 'token:info'],
    teachers:  ['#E8577A', '#F4A3B5', '#F7C948', 'token:brand'],
    christmas: ['mode:#FFFFFF|#9DBFD6', 'mode:#FFFFFF|#9DBFD6', 'token:brand', 'token:info'],
    tet:       ['#F2B705', '#F48FB1', '#D7263D', '#F2B705'],
    midautumn: ['#F28C28', 'token:accent', '#E5484D'],
  };

  // Nền động. alpha: [sáng, tối]. dir: down | up | side
  const AMBIENT = {
    'falling-leaves': { shape: 'leaf',    n: 4,  dir: 'down', size: [5, 9],     speed: [12, 24], sway: [14, 28], alpha: [0.28, 0.25] },
    bubbles:          { shape: 'bubble',  n: 8,  dir: 'up',   size: [2.5, 7],   speed: [10, 22], sway: [6, 14],  alpha: [0.22, 0.28], noSpin: true },
    petals:           { shape: 'petal',   n: 6,  dir: 'down', size: [4, 7],     speed: [14, 26], sway: [10, 22], alpha: [0.32, 0.3], drift: [6, 16] },
    snow:             { shape: 'snow',    n: 12, dir: 'down', size: [2, 4.5],   speed: [10, 22], sway: [8, 18],  alpha: [0.55, 0.55] },
    'mai-blossoms':   { shape: 'flower',  n: 6,  dir: 'down', size: [3.5, 6],   speed: [12, 22], sway: [10, 20], alpha: [0.4, 0.38] },
    lanterns:         { shape: 'lantern', n: 5,  dir: 'up',   size: [5, 8],     speed: [6, 12],  sway: [6, 12],  alpha: [0.35, 0.5], noSpin: true },
    bats:             { shape: 'bat',     n: 4,  dir: 'side', size: [6, 9],     speed: [14, 26], sway: [10, 20], alpha: [0.2, 0.3], noSpin: true },
    // 'stars', 'fireflies' vẽ riêng; 'none', 'grid-paper', 'map-lines' là nền tĩnh bằng CSS (effects.css)
  };

  // Bùng hạt khi trả lời đúng / ăn mừng, theo hình dạng
  const BURST = {
    dot:     { n: 8, speed: 170, gravity: 220, size: [2, 3.5], max: 0.9 },
    star:    { n: 6, speed: 110, gravity: 0,   size: [2, 4],   max: 0.9 },
    leaf:    { n: 8, speed: 190, gravity: 160, size: [5, 8],   max: 1.4, sway: 30 },
    bubble:  { n: 9, speed: 130, gravity: -120, size: [3, 7],  max: 1.3, sway: 18 },
    petal:   { n: 9, speed: 170, gravity: 90,  size: [4, 7],   max: 1.5, sway: 26 },
    firefly: { n: 6, speed: 60,  gravity: -40, size: [1.6, 2.6], max: 1.6 },
    ink:     { n: 6, speed: 140, gravity: 240, size: [2, 4],   max: 0.8 },
    coin:    { n: 8, speed: 200, gravity: 300, size: [3.5, 5.5], max: 1.1 },
    candy:   { n: 8, speed: 190, gravity: 220, size: [4, 6],   max: 1.2 },
    flower:  { n: 9, speed: 170, gravity: 90,  size: [4, 6.5], max: 1.5, sway: 20 },
    snow:    { n: 9, speed: 150, gravity: 50,  size: [2.5, 4.5], max: 1.6, sway: 20 },
    lantern: { n: 6, speed: 70,  gravity: -60, size: [5, 7],   max: 1.8 },
  };

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];

  /* ---------- Biểu tượng (SVG, tô bằng biến màu của theme) ---------- */
  const svg = (inner) => `<svg viewBox="0 0 100 100" class="tv-overlay__icon" aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    flame: svg(`<path style="fill:var(--accent)" d="M50 6c4 16 22 26 22 50a22 22 0 0 1-44 0c0-12 6-20 12-26 0 8 4 13 9 15-3-13 0-27 1-39z"/>
      <path style="fill:var(--accent-tint)" d="M50 48c2 8 11 12 11 23a11 11 0 0 1-22 0c0-6 4-10 7-13 0 4 2 6 4 7-1-6 0-12 0-17z"/>`),
    nova: svg(`<circle cx="50" cy="50" r="30" style="fill:none;stroke:var(--brand);stroke-width:3;opacity:.6"/>
      <path style="fill:var(--accent)" d="M50 8l7 30 30-8-24 20 24 20-30-8-7 30-7-30-30 8 24-20-24-20 30 8z"/>
      <circle cx="50" cy="50" r="8" style="fill:var(--accent-tint)"/>`),
    'maple-glow': svg(`<path style="fill:var(--accent)" d="M50 8l7 16 10-6-2 15 15-4-7 13 12 6-15 8 3 8-17-3-3 13h-6l-3-13-17 3 3-8-15-8 12-6-7-13 15 4-2-15 10 6z"/>
      <path style="stroke:var(--brand);stroke-width:2.5;fill:none" d="M50 30v62"/>`),
    pearl: svg(`<defs><radialGradient id="tvPearl" cx="38%" cy="35%" r="70%"><stop offset="0" style="stop-color:var(--surface-1)"/><stop offset=".55" style="stop-color:var(--brand-tint)"/><stop offset="1" style="stop-color:var(--brand)"/></radialGradient></defs>
      <path style="fill:var(--brand);opacity:.35" d="M8 70c10-24 74-24 84 0-8 14-76 14-84 0z"/>
      <circle cx="50" cy="52" r="24" fill="url(#tvPearl)"/><circle cx="42" cy="44" r="5" style="fill:var(--surface-1);opacity:.85"/>`),
    'sakura-bloom': svg(`${[0, 72, 144, 216, 288].map(a => `<path transform="rotate(${a} 50 50)" style="fill:var(--brand);opacity:.92" d="M50 50c-12-8-14-26-6-36 2 3 4 4 6 4s4-1 6-4c8 10 6 28-6 36z"/>`).join('')}
      <circle cx="50" cy="50" r="7" style="fill:var(--accent)"/>`),
    lantern: svg(`<rect x="44" y="8" width="12" height="8" rx="2" style="fill:var(--ink-muted)"/>
      <rect x="28" y="16" width="44" height="64" rx="18" style="fill:var(--accent)"/>
      <rect x="36" y="24" width="28" height="48" rx="12" style="fill:var(--accent-tint)"/>
      <rect x="40" y="80" width="20" height="8" rx="2" style="fill:var(--ink-muted)"/>`),
    'star-sticker': svg(`<g transform="rotate(-8 50 50)"><path style="fill:var(--accent);stroke:var(--surface-1);stroke-width:5;stroke-linejoin:round" d="M50 8l12 26 28 3-21 19 6 28-25-14-25 14 6-28-21-19 28-3z"/>
      <path style="fill:var(--accent-tint);opacity:.7" d="M50 22l6 13 14 2-10 9 3 14-13-7z"/></g>`),
    compass: svg(`<circle cx="50" cy="50" r="38" style="fill:var(--surface-1);stroke:var(--brand);stroke-width:5"/>
      <circle cx="50" cy="50" r="30" style="fill:none;stroke:var(--line-strong);stroke-width:1.5;stroke-dasharray:3 4"/>
      <path style="fill:var(--accent)" d="M50 16l8 34H42z"/><path style="fill:var(--ink-muted)" d="M50 84l-8-34h16z"/>
      <circle cx="50" cy="50" r="4" style="fill:var(--brand)"/>`),
    'jack-o-lantern': svg(`<path style="fill:#4E7D3A" d="M48 10h6l-2 14h-4z"/>
      <ellipse cx="32" cy="58" rx="20" ry="28" style="fill:#E07B1F"/><ellipse cx="68" cy="58" rx="20" ry="28" style="fill:#E07B1F"/>
      <ellipse cx="50" cy="58" rx="22" ry="30" style="fill:#F28C28"/>
      <path style="fill:var(--ink)" d="M36 48l8 8h-12zM64 48l4 8H56zM34 68c8 8 24 8 32 0l-4 8c-6 4-18 4-24 0z"/>`),
    bouquet: svg(`<path style="fill:var(--brand)" d="M36 60h28l-8 34H44z"/>
      <path style="stroke:#4E7D3A;stroke-width:3" d="M50 60V36M42 60l-8-20M58 60l8-20"/>
      <circle cx="50" cy="28" r="11" style="fill:#E8577A"/><circle cx="32" cy="36" r="9" style="fill:#F7C948"/><circle cx="68" cy="36" r="9" style="fill:#F4A3B5"/>
      <circle cx="50" cy="28" r="4" style="fill:var(--accent-tint)"/>`),
    gift: svg(`<rect x="18" y="40" width="64" height="48" rx="6" style="fill:var(--brand)"/>
      <rect x="14" y="30" width="72" height="14" rx="4" style="fill:var(--brand-strong)"/>
      <rect x="45" y="30" width="10" height="58" style="fill:#D7263D"/>
      <path style="fill:none;stroke:#D7263D;stroke-width:6;stroke-linecap:round" d="M50 30c-6-14-22-14-20-4 2 6 14 4 20 4zM50 30c6-14 22-14 20-4-2 6-14 4-20 4z"/>`),
    lixi: svg(`<rect x="24" y="10" width="52" height="80" rx="6" style="fill:#D7263D"/>
      <path style="fill:#B51E33" d="M24 16l26 22 26-22v-2a4 4 0 0 0-4-4H28a4 4 0 0 0-4 4z"/>
      <circle cx="50" cy="56" r="14" style="fill:var(--accent)"/><circle cx="50" cy="56" r="8" style="fill:none;stroke:#D7263D;stroke-width:2.5"/>`),
    'full-moon': svg(`<defs><radialGradient id="tvMoon" cx="40%" cy="38%" r="65%"><stop offset="0" style="stop-color:var(--accent-tint)"/><stop offset="1" style="stop-color:var(--accent)"/></radialGradient></defs>
      <circle cx="50" cy="46" r="32" fill="url(#tvMoon)"/><circle cx="40" cy="38" r="5" style="fill:var(--accent);opacity:.35"/><circle cx="60" cy="54" r="7" style="fill:var(--accent);opacity:.3"/>
      <path style="fill:var(--surface-1);opacity:.9" d="M22 80c4-10 18-10 22-4 6-6 20-4 22 4z"/>`),
    check: svg(`<circle cx="50" cy="50" r="40" style="fill:var(--brand)"/>
      <path d="M32 51l12 12 24-26" style="fill:none;stroke:var(--on-brand);stroke-width:8;stroke-linecap:round;stroke-linejoin:round"/>`),
    stamp: svg(`<g transform="rotate(-12 50 50)"><circle cx="50" cy="50" r="40" style="fill:none;stroke:var(--brand);stroke-width:5"/>
      <circle cx="50" cy="50" r="32" style="fill:none;stroke:var(--brand);stroke-width:1.5"/>
      <text x="50" y="62" text-anchor="middle" style="fill:var(--brand);font:700 34px var(--tv-font-display, sans-serif)">10</text>
      <text x="50" y="30" text-anchor="middle" style="fill:var(--brand);font:600 9px sans-serif;letter-spacing:1px">HOÀN THÀNH</text></g>`),
    treasure: svg(`<circle cx="30" cy="30" r="5" style="fill:var(--accent)"/><circle cx="72" cy="24" r="4" style="fill:var(--accent)"/><circle cx="56" cy="16" r="3" style="fill:var(--accent)"/>
      <rect x="16" y="52" width="68" height="36" rx="4" style="fill:#8A5A2B"/>
      <path style="fill:#A06A33" d="M16 52c0-14 10-20 34-20s34 6 34 20z"/>
      <rect x="16" y="50" width="68" height="6" style="fill:var(--accent)"/><rect x="44" y="50" width="12" height="16" rx="2" style="fill:var(--accent)"/>`),
  };
  const COMPLETE_ICON = { 'stamp-10': 'stamp', treasure: 'treasure' };

  /* ---------- Vẽ từng loại hạt ---------- */
  function drawShape(ctx, p) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    const s = p.size;
    ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
    switch (p.shape) {
      case 'star': {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const r = i % 2 === 0 ? s : s * 0.32, a = (i / 8) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); break;
      }
      case 'leaf': {
        ctx.beginPath(); ctx.moveTo(0, -s);
        ctx.bezierCurveTo(s * 0.9, -s * 0.5, s * 0.7, s * 0.6, 0, s);
        ctx.bezierCurveTo(-s * 0.7, s * 0.6, -s * 0.9, -s * 0.5, 0, -s); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = Math.max(0.6, s * 0.08);
        ctx.beginPath(); ctx.moveTo(0, -s * 0.8); ctx.lineTo(0, s * 1.25); ctx.stroke(); break;
      }
      case 'bubble': {
        ctx.lineWidth = Math.max(1, s * 0.14); ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke();
        ctx.globalAlpha *= 0.7; ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.35, s * 0.28, 0, TAU); ctx.fill(); break;
      }
      case 'petal': {
        ctx.beginPath(); ctx.moveTo(0, s);
        ctx.bezierCurveTo(-s * 1.1, s * 0.2, -s * 0.6, -s, -s * 0.12, -s * 0.8);
        ctx.lineTo(0, -s * 0.55); ctx.lineTo(s * 0.12, -s * 0.8);
        ctx.bezierCurveTo(s * 0.6, -s, s * 1.1, s * 0.2, 0, s); ctx.fill(); break;
      }
      case 'flower': { // hoa 5 cánh (hoa mai, hoa tặng thầy cô)
        for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55, s * 0.5, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,240,200,.95)'; ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, TAU); ctx.fill(); break;
      }
      case 'firefly': {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 3);
        g.addColorStop(0, p.color); g.addColorStop(0.25, p.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 3, 0, TAU); ctx.fill(); break;
      }
      case 'ink': { // giọt mực
        ctx.beginPath(); ctx.moveTo(0, -s * 1.3);
        ctx.bezierCurveTo(s * 0.9, -s * 0.2, s, s * 0.9, 0, s);
        ctx.bezierCurveTo(-s, s * 0.9, -s * 0.9, -s * 0.2, 0, -s * 1.3); ctx.fill(); break;
      }
      case 'coin': {
        ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(120,80,0,.45)'; ctx.lineWidth = Math.max(0.8, s * 0.18);
        ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, TAU); ctx.stroke(); break;
      }
      case 'candy': { // kẹo gói giấy
        ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.7, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(-s * 1.8, -s * 0.6); ctx.lineTo(-s * 1.8, s * 0.6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(s * 1.8, -s * 0.6); ctx.lineTo(s * 1.8, s * 0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-s * 0.3, -s * 0.25, s * 0.35, s * 0.18, 0, 0, TAU); ctx.fill(); break;
      }
      case 'snow': { // bông tuyết 6 nhánh
        ctx.lineWidth = Math.max(1, s * 0.28); ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * s, -Math.sin(a) * s); ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); ctx.stroke(); }
        break;
      }
      case 'lantern': { // đèn lồng nhỏ
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.4);
        g.addColorStop(0, hexToRgba(p.color, 0.45)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 2.4, 0, TAU); ctx.fill();
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.75, s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(60,40,20,.7)'; ctx.fillRect(-s * 0.4, -s * 1.15, s * 0.8, s * 0.3); ctx.fillRect(-s * 0.4, s * 0.88, s * 0.8, s * 0.3); break;
      }
      case 'bat': { // dơi nhỏ, dáng dễ thương
        const flap = Math.sin((p.life || 0) * 10 + p.phase) * 0.35;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-s * 0.8, -s * (0.9 + flap), -s * 1.6, -s * 0.2);
        ctx.quadraticCurveTo(-s, -s * 0.1, -s * 0.9, s * 0.35);
        ctx.quadraticCurveTo(-s * 0.4, s * 0.1, 0, s * 0.45);
        ctx.quadraticCurveTo(s * 0.4, s * 0.1, s * 0.9, s * 0.35);
        ctx.quadraticCurveTo(s, -s * 0.1, s * 1.6, -s * 0.2);
        ctx.quadraticCurveTo(s * 0.8, -s * (0.9 + flap), 0, 0); ctx.fill(); break;
      }
      case 'ring': { ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); ctx.stroke(); break; }
      case 'confetti': { ctx.fillRect(-s, -s * 0.45, s * 2, s * 0.9); break; }
      case 'streak': { // sao băng: đầu sáng, đuôi mờ dần
        const len = p.len, ang = Math.atan2(p.vy, p.vx);
        ctx.rotate(-p.rot + ang);
        const g = ctx.createLinearGradient(-len, 0, 0, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, p.color);
        ctx.strokeStyle = g; ctx.lineWidth = s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, s * 1.2, 0, TAU); ctx.fill(); break;
      }
      default: { ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  function hexToRgba(hex, a) {
    const h = String(hex).replace('#', '').trim();
    if (!/^[0-9a-f]{3,6}$/i.test(h)) return `rgba(255,230,128,${a})`;
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function luminance(hex) {
    const n = parseInt(String(hex).replace('#', '').trim(), 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  }

  function create(options) {
    const container = options.container || document.body;
    const isBody = container === document.body;
    let setName = SETS[options.set] ? options.set : 'basic';
    let motionOn = options.motion !== false;
    const mq = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;

    if (!isBody && getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.style.isolation = 'isolate';

    const mkCanvas = (z) => {
      const c = document.createElement('canvas');
      c.setAttribute('aria-hidden', 'true');
      Object.assign(c.style, { position: isBody ? 'fixed' : 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: z });
      return c;
    };
    const bg = mkCanvas('-1');
    const fx = mkCanvas('40');
    container.prepend(bg);
    container.append(fx);
    const bctx = bg.getContext('2d');
    const fctx = fx.getContext('2d');

    let W = 0, H = 0, dpr = 1;
    let particles = [], ambient = [];
    let raf = 0, last = 0, t = 0, nextShoot = 6;
    let colors = {}, cs = null;

    const allowed = () => motionOn && !(mq && mq.matches) && container.getAttribute('data-tv-motion') !== 'off';

    function readColors() {
      cs = getComputedStyle(container);
      const v = n => cs.getPropertyValue(n).trim() || '#888888';
      colors = { brand: v('--brand'), strong: v('--brand-strong'), accent: v('--accent'), ink: v('--ink'), surface: v('--surface-0') };
      colors.dark = luminance(colors.surface) < 0.25;
    }
    // Giải mã một mục trong PALETTE thành mã màu
    function resolveColor(spec) {
      if (spec.startsWith('token:')) return cs.getPropertyValue('--' + spec.slice(6)).trim() || '#888888';
      if (spec.startsWith('mode:')) {
        const [d, l] = spec.slice(5).split('|');
        const one = colors.dark ? d : l;
        return one.startsWith('#') ? one : (cs.getPropertyValue('--' + one).trim() || '#888888');
      }
      return spec;
    }
    const palette = () => (PALETTE[setName] || PALETTE.basic).map(resolveColor);

    function resize() {
      const r = isBody ? { width: global.innerWidth, height: global.innerHeight } : container.getBoundingClientRect();
      dpr = Math.min(2, global.devicePixelRatio || 1);
      W = Math.max(1, r.width); H = Math.max(1, isBody ? r.height : container.scrollHeight || r.height);
      for (const c of [bg, fx]) { c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px'; }
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedAmbient();
    }

    function point(el, fx_ = 0.5, fy = 0.5) {
      const r = el.getBoundingClientRect();
      const base = isBody ? { left: 0, top: 0 } : container.getBoundingClientRect();
      return { x: r.left - base.left + r.width * fx_, y: r.top - base.top + r.height * fy, w: r.width, h: r.height };
    }

    function makeParticle(shape, x, y, o = {}) {
      for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
      const col = o.color || pick(palette());
      o.color = col;
      return Object.assign({
        shape, x, y, vx: 0, vy: 0, gravity: 0, drag: 0.985, life: 0, max: 1.2,
        size: 6, rot: rand(0, TAU), vr: rand(-2, 2), alpha: 1, glow: hexToRgba(col, 0.45),
        sway: 0, phase: rand(0, TAU), fade: true,
      }, o);
    }

    /* ---------- Nền động ---------- */
    function seedAmbient() {
      ambient = [];
      if (!allowed()) return;
      const kind = SETS[setName].background;
      const scale = Math.min(2, Math.max(0.5, (W * H) / 120000));
      const n = base => Math.round(base * scale);
      if (kind === 'stars') {
        for (let i = 0; i < n(36); i++) ambient.push({ x: rand(0, W), y: rand(0, H), s: rand(0.5, 1.7), sp: rand(0.6, 1.8), ph: rand(0, TAU) });
        return;
      }
      if (kind === 'fireflies') {
        for (let i = 0; i < n(8); i++) ambient.push(makeParticle('firefly', rand(0, W), rand(0, H), { size: rand(1.4, 2.4), fade: false, sp: rand(0.3, 0.8), ax: rand(20, 60), ay: rand(15, 45) }));
        return;
      }
      const cfg = AMBIENT[kind];
      if (!cfg) return; // none, grid-paper, map-lines: nền tĩnh bằng CSS
      for (let i = 0; i < n(cfg.n); i++) {
        const sp = rand(...cfg.speed);
        ambient.push(makeParticle(cfg.shape, rand(0, W), rand(0, H), {
          size: rand(...cfg.size), sway: rand(...cfg.sway), fade: false, alpha: cfg.alpha[colors.dark ? 1 : 0],
          vy: cfg.dir === 'down' ? sp : cfg.dir === 'up' ? -sp : rand(-4, 4),
          vx: cfg.dir === 'side' ? sp : (cfg.drift ? rand(...cfg.drift) : 0),
          vr: cfg.noSpin ? 0 : rand(-1.5, 1.5), rot: cfg.noSpin ? 0 : rand(0, TAU),
        }));
      }
    }

    function drawAmbient(dt) {
      bctx.clearRect(0, 0, W, H);
      const kind = SETS[setName].background;
      if (!ambient.length) return;
      if (kind === 'stars') {
        const col = colors.dark ? colors.ink : colors.brand;
        for (const s of ambient) {
          bctx.globalAlpha = (colors.dark ? 0.25 : 0.12) + (colors.dark ? 0.55 : 0.25) * Math.abs(Math.sin(t * s.sp + s.ph));
          bctx.fillStyle = col; bctx.beginPath(); bctx.arc(s.x, s.y, s.s, 0, TAU); bctx.fill();
        }
        bctx.globalAlpha = 1;
        if (t > nextShoot) { // thỉnh thoảng một ngôi sao băng
          nextShoot = t + rand(14, 24);
          particles.push(makeParticle('streak', rand(0, W * 0.6), rand(0, H * 0.3), { vx: rand(260, 360), vy: rand(90, 150), size: 1.6, len: 70, max: 1.1, color: col, alpha: 0.8, rot: 0, vr: 0, drag: 1 }));
        }
        return;
      }
      for (const p of ambient) {
        p.life += dt;
        if (kind === 'fireflies') {
          const glow = 0.25 + 0.6 * Math.max(0, Math.sin(t * 1.6 + p.phase * 3));
          const col = colors.dark ? colors.brand : colors.accent;
          drawShape(bctx, Object.assign({}, p, { x: p.x + Math.sin(t * p.sp + p.phase) * p.ax, y: p.y + Math.cos(t * p.sp * 0.8 + p.phase * 1.3) * p.ay, alpha: colors.dark ? glow : glow * 0.6, color: col, glow: hexToRgba(col, 0.35) }));
          continue;
        }
        p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(t * 0.9 + p.phase) * p.sway * dt; p.rot += p.vr * dt * 0.3;
        if (p.y > H + 20) { p.y = -20; p.x = rand(0, W); }
        if (p.y < -20) { p.y = H + 20; p.x = rand(0, W); }
        if (p.x > W + 30) { p.x = -30; p.y = rand(0, H); }
        drawShape(bctx, p);
      }
    }

    /* ---------- Vòng lặp vẽ ---------- */
    function frame(now) {
      raf = 0;
      if (document.hidden) { last = 0; return; }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now; t += dt;
      if (allowed()) drawAmbient(dt); else bctx.clearRect(0, 0, W, H);
      fctx.clearRect(0, 0, W, H);
      particles = particles.filter(p => {
        p.life += dt;
        if (p.delay) { p.delay -= dt; if (p.delay > 0) { p.life = 0; return true; } p.delay = 0; }
        if (p.path) { // bay theo đường cong (hiệu ứng nút Lưu)
          const k = Math.min(1, p.life / p.max), e = 1 - Math.pow(1 - k, 3);
          const { x0, y0, cx, cy, x1, y1 } = p.path;
          p.x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * x1;
          p.y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * y1;
          if (Math.random() < 0.6) particles.push(makeParticle(p.trail || 'dot', p.x, p.y, { size: rand(1, 2.2), max: 0.5, vx: rand(-15, 15), vy: rand(-15, 15), color: p.color }));
          if (k >= 1) { burst(p.x, p.y, { n: 5, speed: 60, size: [2, 4], max: 0.6 }); return false; }
        } else {
          p.vx *= p.drag; p.vy = p.vy * p.drag + p.gravity * dt;
          p.x += p.vx * dt + (p.sway ? Math.sin(p.life * 3 + p.phase) * p.sway * dt : 0);
          p.y += p.vy * dt; p.rot += p.vr * dt;
          if (p.grow) p.size += p.grow * dt;
        }
        const k = p.life / p.max;
        if (p.fade) p.alpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45);
        if (p.shape === 'firefly') p.alpha *= 0.75 + 0.25 * Math.sin(p.life * 9 + p.phase);
        drawShape(fctx, p);
        return p.life < p.max;
      });
      if (particles.length || (allowed() && ambient.length)) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    /* ---------- Bùng hạt ---------- */
    function burst(x, y, o = {}) {
      const shape = o.shape || SHAPE[setName];
      const base = Object.assign({}, BURST[shape] || BURST.dot, o);
      for (let i = 0; i < base.n; i++) {
        const a = base.angle != null ? base.angle + rand(-base.spread, base.spread) : rand(0, TAU);
        const sp = rand(0.4, 1) * base.speed;
        particles.push(makeParticle(shape, x + rand(-(base.jitter || 0), base.jitter || 0), y + rand(-(base.jitterY || 0), base.jitterY || 0), {
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gravity: base.gravity || 0, size: rand(...base.size),
          max: rand(0.7, 1) * base.max, sway: base.sway || 0, drag: base.drag || 0.97,
          delay: base.stagger ? rand(0, base.stagger) : (base.delay || 0), color: base.color,
        }));
      }
      kick();
    }
    // Mưa hạt từ trên xuống (hoặc từ dưới lên với hạt nhẹ như bọt, đèn lồng)
    function shower(shape, count, up) {
      for (let i = 0; i < count; i++) {
        particles.push(makeParticle(shape, rand(-W * 0.1, W), up ? H + rand(10, 40) : rand(-60, -10), {
          vy: up ? -rand(60, 140) : rand(60, 130), vx: rand(-20, 50), sway: rand(25, 55), size: rand(...(BURST[shape] || BURST.dot).size) * 1.15,
          max: rand(2.6, 3.8), delay: rand(0, 0.8), vr: up ? 0 : rand(-2, 2),
        }));
      }
      kick();
    }

    function addClass(el, cls, ms) {
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), ms);
    }

    /* ---------- Lớp phủ ăn mừng ---------- */
    function overlay(iconKey, title, sub, extraClass) {
      const old = container.querySelector(':scope > .tv-overlay'); if (old) old.remove();
      const o = document.createElement('div');
      o.className = 'tv-overlay' + (extraClass ? ' ' + extraClass : ''); o.setAttribute('role', 'status');
      o.innerHTML = `<div class="tv-overlay__box">${ICONS[iconKey] || ICONS.check}<div class="tv-overlay__title"></div><div class="tv-overlay__sub"></div></div>`;
      o.querySelector('.tv-overlay__title').textContent = title;
      o.querySelector('.tv-overlay__sub').textContent = sub || '';
      if (isBody) o.style.position = 'fixed';
      const close = () => { o.classList.add('is-leaving'); setTimeout(() => o.remove(), 330); };
      o.addEventListener('click', close);
      setTimeout(close, 2200);
      container.append(o);
      return o;
    }
    const center = () => ({ x: W / 2, y: (isBody ? H : Math.min(H, container.clientHeight || H)) / 2 });

    // Dấu tích vẽ bằng nét bút trên phần tử (bộ Giấy Kẻ Ô)
    function drawCheck(el) {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      const s = document.createElement('span');
      s.className = 'tv-check'; s.setAttribute('aria-hidden', 'true');
      s.innerHTML = '<svg viewBox="0 0 60 50"><path d="M6 28l16 14L54 8"/></svg>';
      el.appendChild(s);
      setTimeout(() => s.remove(), 1400);
    }

    /* ---------- API ---------- */
    const api = {
      get set() { return setName; },
      get effects() { return SETS[setName]; },

      setSet(name) {
        setName = SETS[name] ? name : 'basic';
        container.querySelectorAll('.tv-card').forEach(c => c.setAttribute('data-tv-flip', SETS[setName].flip));
        container.querySelectorAll('.tv-progress').forEach(p => p.setAttribute('data-tv-progress', SETS[setName].progress));
        api.refresh();
      },
      refresh() { readColors(); particles = []; resize(); kick(); },
      setMotion(on) { motionOn = !!on; api.refresh(); },

      flip(card) {
        card.classList.toggle('is-flipped');
        if (!allowed()) return;
        const p = point(card), f = SETS[setName].flip, shape = SHAPE[setName];
        if (f === 'stardust') burst(p.x, p.y, { shape: 'star', n: 12, speed: 120, jitter: p.w * 0.35, jitterY: p.h * 0.3, size: [1.5, 3.5], max: 0.9, drag: 0.94 });
        if (f === 'ripple') for (let i = 0; i < 3; i++) particles.push(makeParticle('ring', p.x, p.y, { size: 10, grow: 160 + i * 40, max: 0.9, delay: i * 0.12, color: colors.brand, vr: 0, rot: 0 }));
        if (f === 'bloom') burst(p.x, p.y, { n: 6, speed: 140, max: 1, gravity: 40, drag: 0.95 });
        if (f === 'light-up') burst(p.x, p.y, { n: 5, speed: 70, max: 1.2, gravity: shape === 'candy' ? 120 : -30 });
        kick();
      },

      correct(el) {
        addClass(el, 'tv-fx-correct', 950);
        if (setName === 'basic') addClass(el, 'tv-fx-correct-pop', 450);
        if (!allowed()) return;
        const p = point(el), c = SETS[setName].correct;
        if (c === 'shooting-star') {
          particles.push(makeParticle('streak', p.x - p.w * 0.6, p.y - p.h * 0.7, { vx: 520, vy: 210, size: 2.2, len: 90, max: 0.75, color: colors.accent, rot: 0, vr: 0, drag: 1 }));
          burst(p.x + p.w * 0.25, p.y - p.h * 0.1);
        } else if (c === 'check-draw') {
          drawCheck(el); burst(p.x + p.w * 0.3, p.y - p.h * 0.2, { n: 5 });
        } else {
          burst(p.x, p.y - (setName === 'basic' ? p.h * 0.2 : 0));
        }
      },

      wrong(el) { addClass(el, 'tv-fx-wrong-' + SETS[setName].wrong, 700); },

      save(btn, target) {
        if (SETS[setName].save === 'pulse' || !allowed()) { addClass(btn, 'tv-fx-pulse', 720); return; }
        const a = point(btn);
        const b = target ? point(target) : { x: a.x + 40, y: a.y - 110 };
        const shape = SHAPE[setName];
        particles.push(makeParticle(shape, a.x, a.y, {
          path: { x0: a.x, y0: a.y, cx: (a.x + b.x) / 2 + 30, cy: Math.min(a.y, b.y) - 70, x1: b.x, y1: b.y },
          max: 0.75, size: shape === 'firefly' ? 2.6 : shape === 'snow' ? 4 : 6, trail: setName === 'starry' ? 'star' : 'dot', fade: false, alpha: 1,
        }));
        addClass(btn, 'tv-fx-pulse', 720);
        kick();
      },

      complete(o = {}) {
        const c = SETS[setName].complete, shape = SHAPE[setName];
        overlay(COMPLETE_ICON[c] || 'check', o.title || 'Xong buổi ôn hôm nay!', o.sub || '', c === 'stamp-10' ? 'tv-overlay--stamp' : '');
        if (!allowed()) return;
        const { x: cx, y: cy } = center();
        switch (c) {
          case 'starburst': burst(cx, cy, { shape: 'star', n: 30, speed: 340, size: [2, 6], max: 1.6, drag: 0.95 }); break;
          case 'leaf-shower': case 'petal-shower': case 'candy-shower': case 'snow-shower': case 'flower-shower': shower(shape, 26); break;
          case 'lantern-rise': shower('lantern', 14, true); break;
          case 'wave-sweep':
            shower('bubble', 20, true);
            for (let i = 0; i < 3; i++) particles.push(makeParticle('ring', cx, cy, { size: 20, grow: 420, max: 1.3, delay: i * 0.18, color: colors.brand, rot: 0, vr: 0 }));
            break;
          case 'firefly-swarm':
            for (let i = 0; i < 20; i++) {
              const a = rand(0, TAU), r = Math.max(W, cy * 2) * 0.55;
              particles.push(makeParticle('firefly', cx + Math.cos(a) * r, cy + Math.sin(a) * r, { vx: -Math.cos(a) * rand(140, 220), vy: -Math.sin(a) * rand(140, 220), drag: 0.965, size: rand(1.6, 2.8), max: rand(2, 2.8) }));
            }
            break;
          case 'firework-soft': // 3 chùm pháo hoa nhẹ bằng hoa mai, đào
            [[0.3, 0.35, 0], [0.7, 0.3, 0.35], [0.5, 0.2, 0.7]].forEach(([fx_, fy, d]) => burst(W * fx_, cy * 2 * fy, { shape: 'flower', n: 12, speed: 160, gravity: 60, size: [3, 5], max: 1.4, delay: d }));
            break;
          case 'treasure': burst(cx, cy + 30, { shape: 'coin', n: 20, speed: 320, gravity: 420, angle: -Math.PI / 2, spread: 0.8, max: 1.5 }); break;
          case 'stamp-10': burst(cx, cy - 20, { shape: 'ink', n: 6, speed: 120, max: 0.7, delay: 0.35 }); break;
          default: burst(cx, cy - 40, { shape: 'confetti', n: 20, speed: 380, gravity: 420, size: [3, 5], max: 1.5, angle: -Math.PI / 2, spread: 1.1 });
        }
      },

      streak(days, o = {}) {
        overlay(SETS[setName].streak, o.title || `${days} ngày liên tiếp!`, o.sub || 'Giữ vững nhịp học mỗi ngày nhé.');
        if (!allowed()) return;
        const { x: cx, y } = center(), cy = y - 20, shape = SHAPE[setName] === 'dot' ? 'star' : SHAPE[setName];
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          particles.push(makeParticle(shape, cx, cy, { vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, drag: 0.93, size: rand(3, 6), max: 1.4, color: setName === 'basic' ? colors.accent : undefined }));
        }
        kick();
      },

      /** Thông báo ngắn kèm biểu tượng streak của bộ hiện tại (dùng khi theme theo dịp tự bật) */
      announce(o = {}) {
        overlay(SETS[setName].streak, o.title || '', o.sub || '');
        if (allowed()) { const { x, y } = center(); burst(x, y - 20, { n: 10, speed: 160 }); }
      },

      destroy() {
        cancelAnimationFrame(raf); raf = 0;
        bg.remove(); fx.remove();
        global.removeEventListener('resize', onResize);
        if (ro) ro.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        if (mq && mq.removeEventListener) mq.removeEventListener('change', api.refresh);
      },
    };

    const onResize = () => resize();
    const onVis = () => { if (!document.hidden) kick(); };
    global.addEventListener('resize', onResize);
    let lastSize = '';
    const ro = !isBody && global.ResizeObserver ? new ResizeObserver(() => {
      const size = container.clientWidth + 'x' + container.scrollHeight;
      if (size !== lastSize) { lastSize = size; resize(); kick(); }
    }) : null;
    if (ro) ro.observe(container);
    document.addEventListener('visibilitychange', onVis);
    if (mq && mq.addEventListener) mq.addEventListener('change', api.refresh);

    api.setSet(setName);
    return api;
  }

  global.TVEffects = { create, SETS, SHAPE, PALETTE, AMBIENT, BURST };
})(window);
