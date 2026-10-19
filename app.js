import { sfx, setSound, soundOn, unlockAudio, speak } from './audio.js';
import { listPhotos, addPhoto, deletePhoto, processImage } from './store.js';

/* ------------------------------------------------------------------ data */
const BOOK = [
  ['b-cover', 'DJ Bean', '00-cover'],
  ['b-cousins', 'The Cousins', '01-cousins'],
  ['b-wrestle', 'Wrestle Time', '03-wrestling'],
  ['b-cookies', 'Cookie Jar', '04-cookies'],
  ['b-popcorn', 'Popcorn!', '05-popcorn'],
  ['b-game', 'Game Night', '06-videogame'],
  ['b-djbean', 'Bean on the Decks', '07-djbean'],
  ['b-party', 'Party Time', '14-party'],
].map(([id, title, f]) => ({ id, title, src: `art/${f}.webp`, thumb: `art/${f}-thumb.webp` }));

const KIDS = {
  tori: { name: 'Tori', sizes: [12, 24, 48], ghost: false, ghostToggle: true, snap: 0.34, autoHint: 0, countAloud: false },
  tj:   { name: 'TJ',   sizes: [4, 6, 9],    ghost: true,  ghostToggle: false, snap: 0.85, autoHint: 20000, countAloud: true },
};
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const settings = Object.assign({ kid: 'tori', sound: true, toriGhost: false }, store.get('kp-settings', {}));
const saveSettings = () => store.set('kp-settings', settings);
const doneLog = store.get('kp-done', { tori: {}, tj: {} });

let photos = [];          // [{id, blob, thumb, created}]
let thumbUrls = [];
let pendingAdds = 0;

/* ------------------------------------------------------------------ home */
function setKid(kid) {
  settings.kid = kid; saveSettings();
  document.body.dataset.kid = kid;
  document.querySelectorAll('.kid').forEach(b => b.setAttribute('aria-checked', String(b.dataset.kid === kid)));
  // Swap only the star badges, so the pictures don't flicker.
  document.querySelectorAll('#gallery [data-book], #gallery [data-photo]').forEach(card => {
    card.querySelector('.badge')?.remove();
    const html = badgeFor(card.dataset.book || card.dataset.photo);
    if (html) card.insertAdjacentHTML('afterbegin', html);
  });
}

function iconSvg(path) { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`; }
const PLUS = 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z';
const TRASH = 'M9 3h6l1 2h4v2H4V5h4l1-2zM6 8h12l-1 13H7L6 8z';

function badgeFor(id) {
  const n = doneLog[settings.kid]?.[id];
  return n ? `<span class="badge" aria-label="Finished with ${n} pieces">★ ${n}</span>` : '';
}

function renderGallery() {
  thumbUrls.forEach(u => URL.revokeObjectURL(u)); thumbUrls = [];
  const g = $('gallery');
  let html = '';
  for (let i = 0; i < pendingAdds; i++) html += `<div class="card add busy" aria-label="Adding picture"><span class="spinner"></span><span class="card-title">Adding…</span></div>`;
  for (const p of photos) {
    const u = URL.createObjectURL(p.thumb); thumbUrls.push(u);
    html += `<div class="card-wrap" style="position:relative">
      <button class="card" data-photo="${p.id}" aria-label="Your picture">${badgeFor(p.id)}<img src="${u}" alt=""><span class="card-title">Your picture</span></button>
      <button class="card-del" data-del="${p.id}" aria-label="Remove this picture">${iconSvg(TRASH)}</button>
    </div>`;
  }
  for (const b of BOOK) {
    html += `<button class="card" data-book="${b.id}">${badgeFor(b.id)}<img src="${b.thumb}" alt=""><span class="card-title">${b.title}</span></button>`;
  }
  // Last, and visually quiet: it's a grown-up action that opens the photo picker.
  html += `<button class="card add" id="addCard">
      <span class="plus">${iconSvg(PLUS)}</span>
      <span class="card-title">Add your picture<small>From the tablet's photos or camera</small></span>
    </button>`;
  g.innerHTML = html;
}

$('gallery').addEventListener('click', async e => {
  const t = e.target.closest('button');
  if (!t) return;
  sfx.tap();
  if (t.id === 'addCard') { $('fileInput').click(); return; }
  if (t.dataset.del) {
    const ok = await confirmBox('Remove this picture?', 'Keep it', 'Remove');
    if (ok) { await deletePhoto(t.dataset.del); photos = await listPhotos(); renderGallery(); toast('Picture removed'); }
    return;
  }
  if (t.dataset.book) openSizeSheet(BOOK.find(b => b.id === t.dataset.book));
  if (t.dataset.photo) {
    const p = photos.find(x => x.id === t.dataset.photo);
    openSizeSheet({ id: p.id, title: 'Your picture', blob: p.blob, thumbBlob: p.thumb });
  }
});

$('fileInput').addEventListener('change', async e => {
  const files = [...e.target.files]; e.target.value = '';
  if (!files.length) return;
  pendingAdds += files.length; renderGallery();
  let ok = 0, bad = 0;
  for (const f of files) {
    try { await addPhoto(await processImage(f)); ok++; }
    catch (err) { console.warn(err); bad++; }
    pendingAdds--;
  }
  photos = await listPhotos(); renderGallery();
  if (ok) { sfx.snap(1); toast(ok === 1 ? 'Picture added! Tap it to play.' : `${ok} pictures added!`); }
  if (bad) toast(bad === 1 ? "That picture didn't work. Try a different one." : `${bad} pictures didn't work. Try different ones.`);
});

document.querySelectorAll('.kid').forEach(b => b.addEventListener('click', () => { sfx.tap(); setKid(b.dataset.kid); }));
document.querySelector('.kids').addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  const next = settings.kid === 'tori' ? 'tj' : 'tori';
  setKid(next); document.querySelector(`.kid[data-kid="${next}"]`).focus(); e.preventDefault();
});

function renderSound() {
  const b = $('soundBtn');
  b.setAttribute('aria-pressed', String(settings.sound));
  b.setAttribute('aria-label', settings.sound ? 'Sound is on' : 'Sound is off');
  setSound(settings.sound);
}
$('soundBtn').addEventListener('click', () => {
  settings.sound = !settings.sound; saveSettings(); renderSound();
  if (settings.sound) { unlockAudio(); sfx.snap(0.5); }
  toast(settings.sound ? 'Sound on' : 'Sound off');
});

/* ------------------------------------------------------------- size sheet */
let sheetEntry = null, lastFocus = null;
function chooseGrid(n, aspect, preferWide) {
  let best = null;
  for (let c = 1; c <= n; c++) {
    if (n % c) continue;
    const r = n / c, score = Math.abs(Math.log(aspect * r / c)) + (preferWide ? (c < r ? 0.001 : 0) : (c > r ? 0.001 : 0));
    if (!best || score < best.score) best = { c, r, score };
  }
  return best;
}

function openSizeSheet(entry) {
  sheetEntry = entry; lastFocus = document.activeElement;
  const k = KIDS[settings.kid];
  const thumb = $('sizeThumb');
  thumb.src = entry.thumbBlob ? URL.createObjectURL(entry.thumbBlob) : entry.thumb;
  $('sizeOpts').innerHTML = k.sizes.map(n => {
    const g = chooseGrid(n, 1, true);
    return `<button class="size-opt" data-n="${n}" aria-label="${n} pieces">
      <span class="size-grid" style="grid-template-columns:repeat(${g.c},1fr);grid-template-rows:repeat(${g.r},1fr)">${'<i></i>'.repeat(n)}</span>
      <span class="size-num">${n}</span></button>`;
  }).join('');
  const sw = $('ghostSwitch');
  sw.hidden = !k.ghostToggle;
  sw.setAttribute('aria-checked', String(settings.toriGhost));
  $('sizeSheet').hidden = false;
  $('sizeOpts').querySelector('button').focus();
}
function closeSizeSheet() {
  $('sizeSheet').hidden = true;
  if ($('sizeThumb').src.startsWith('blob:')) URL.revokeObjectURL($('sizeThumb').src);
  lastFocus?.focus?.();
}
$('sizeClose').addEventListener('click', () => { sfx.tap(); closeSizeSheet(); });
$('sizeSheet').addEventListener('click', e => { if (e.target.id === 'sizeSheet') closeSizeSheet(); });
$('ghostSwitch').addEventListener('click', () => {
  settings.toriGhost = !settings.toriGhost; saveSettings(); sfx.tap();
  $('ghostSwitch').setAttribute('aria-checked', String(settings.toriGhost));
});
$('sizeOpts').addEventListener('click', e => {
  const b = e.target.closest('[data-n]'); if (!b) return;
  sfx.tap();
  const entry = sheetEntry;
  $('sizeSheet').hidden = true;
  startPuzzle(entry, Number(b.dataset.n));
});

/* ---------------------------------------------------------------- dialogs */
let confirmResolve = null;
function confirmBox(title, keepLabel, goLabel) {
  $('confirmTitle').textContent = title;
  $('confirmKeep').textContent = keepLabel;
  $('confirmGo').textContent = goLabel;
  $('confirm').hidden = false;
  $('confirmKeep').focus();
  return new Promise(res => { confirmResolve = res; });
}
function closeConfirm(v) { $('confirm').hidden = true; sfx.tap(); confirmResolve?.(v); confirmResolve = null; }
$('confirmKeep').addEventListener('click', () => closeConfirm(false));
$('confirmGo').addEventListener('click', () => closeConfirm(true));

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('confirm').hidden) closeConfirm(false);
  else if (!$('sizeSheet').hidden) closeSizeSheet();
});

let toastTimer = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
const announce = msg => { $('sr').textContent = msg; };

/* ----------------------------------------------------------------- puzzle */
const stage = $('stage'), boardEl = $('board'), boardCanvas = $('boardCanvas'), fxEl = $('fx');
const hitCtx = document.createElement('canvas').getContext('2d');
let S = null;               // current puzzle state
let zTop = 0;
const drags = new Map();    // pointerId -> piece

function rand(a, b) { return a + Math.random() * (b - a); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// fetch + createImageBitmap, not img.decode(): decode() can stall until the page paints
// a frame (seen right after a reload), which left kids staring at a spinner.
async function loadImage(entry) {
  const blob = entry.blob || await fetch(entry.src).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); });
  try {
    const bmp = await createImageBitmap(blob);
    return { img: bmp, w: bmp.width, h: bmp.height };
  } catch {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = URL.createObjectURL(blob); });
    return { img, w: img.naturalWidth, h: img.naturalHeight };
  }
}

function makeEdges(cols, rows) {
  const j = () => ({ a: rand(-.04, .04), b: rand(-.04, .04), c: rand(-.03, .03), d: rand(-.03, .03), e: rand(-.04, .04) });
  const s = () => (Math.random() < .5 ? 1 : -1);
  const H = [], V = [];
  for (let r = 0; r < rows - 1; r++) { H.push([]); for (let c = 0; c < cols; c++) H[r].push({ s: s(), j: j() }); }
  for (let r = 0; r < rows; r++) { V.push([]); for (let c = 0; c < cols - 1; c++) V[r].push({ s: s(), j: j() }); }
  return { H, V };
}

// One shared edge as 10 bezier control points (classic knob shape), in board coords.
function edgeCurve(ax, ay, bx, by, e, U) {
  const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = uy, ny = -ux;
  const { a, b, c, d, e: ee } = e.j, t = 0.1 * U, mid = L / 2 + b * U, s = e.s;
  const raw = [[0, 0], [0.2 * L, a * U], [mid + d * U, -t + c * U], [mid - t, t + c * U],
    [mid - 2 * t - d * U, 3 * t + c * U], [mid + 2 * t - d * U, 3 * t + c * U], [mid + t, t + c * U],
    [mid + d * U, -t + c * U], [0.8 * L, ee * U], [L, 0]];
  return raw.map(([u, v]) => ({ x: ax + ux * u + nx * v * s, y: ay + uy * u + ny * v * s }));
}

function piecePath(c, r, ox, oy) {
  const { pw, ph } = S.L, P = new Path2D();
  const x0 = c * pw, y0 = r * ph, x1 = x0 + pw, y1 = y0 + ph;
  const curve = (pts, rev) => {
    const q = rev ? [...pts].reverse() : pts;
    for (let i = 1; i < 10; i += 3) P.bezierCurveTo(q[i].x + ox, q[i].y + oy, q[i + 1].x + ox, q[i + 1].y + oy, q[i + 2].x + ox, q[i + 2].y + oy);
  };
  P.moveTo(x0 + ox, y0 + oy);
  if (r === 0) P.lineTo(x1 + ox, y0 + oy); else curve(S.curves.H[r - 1][c], false);
  if (c === S.cols - 1) P.lineTo(x1 + ox, y1 + oy); else curve(S.curves.V[r][c], false);
  if (r === S.rows - 1) P.lineTo(x0 + ox, y1 + oy); else curve(S.curves.H[r][c], true);
  if (c === 0) P.lineTo(x0 + ox, y0 + oy); else curve(S.curves.V[r][c - 1], true);
  P.closePath();
  return P;
}

function computeLayout() {
  const W = stage.clientWidth, H = stage.clientHeight;
  const m = Math.max(10, Math.min(W, H) * 0.02);
  const A = S.iw / S.ih, N = S.count;
  const frac = N <= 9 ? 0.54 : N <= 24 ? 0.58 : 0.58;
  let bw, bh, bx, by, trays;
  if (W >= H * 1.15) {           // landscape: board centered, trays left + right
    bh = H - 2 * m; bw = bh * A;
    if (bw > W * frac) { bw = W * frac; bh = bw / A; }
    bx = (W - bw) / 2; by = (H - bh) / 2;
    trays = [{ x: m, y: m, w: bx - 2 * m, h: H - 2 * m }, { x: bx + bw + m, y: m, w: W - bx - bw - 2 * m, h: H - 2 * m }];
  } else {                        // portrait: board on top, tray below
    bw = W - 2 * m; bh = bw / A;
    if (bh > H * frac) { bh = H * frac; bw = bh * A; }
    bx = (W - bw) / 2; by = m;
    trays = [{ x: m, y: by + bh + m, w: W - 2 * m, h: H - by - bh - 2 * m }];
  }
  const pw = bw / S.cols, ph = bh / S.rows, U = Math.min(pw, ph), pad = Math.ceil(U * 0.32);
  S.L = { W, H, m, bx, by, bw, bh, pw, ph, U, pad, cw: pw + 2 * pad, ch: ph + 2 * pad, trays };
  const { H: EH, V: EV } = S.edges;
  S.curves = {
    H: EH.map((row, r) => row.map((e, c) => edgeCurve(c * pw, (r + 1) * ph, (c + 1) * pw, (r + 1) * ph, e, U))),
    V: EV.map((row, r) => row.map((e, c) => edgeCurve((c + 1) * pw, r * ph, (c + 1) * pw, (r + 1) * ph, e, U))),
  };
  Object.assign(boardEl.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
}

function drawBoard() {
  const { bw, bh } = S.L, dpr = Math.min(2, devicePixelRatio || 1);
  boardCanvas.width = Math.round(bw * dpr); boardCanvas.height = Math.round(bh * dpr);
  const ctx = boardCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, bw, bh);
  if (S.done) { ctx.drawImage(S.img, 0, 0, bw, bh); return; }
  if (S.ghost) {
    ctx.globalAlpha = settings.kid === 'tj' ? 0.38 : 0.3;
    ctx.drawImage(S.img, 0, 0, bw, bh);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.22)';
    for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) ctx.stroke(piecePath(c, r, 0, 0));
  }
}

function renderPiece(p) {
  const { pw, ph, pad, cw, ch, bw, bh, U } = S.L, dpr = Math.min(2, devicePixelRatio || 1);
  const el = p.el;
  el.width = Math.round(cw * dpr); el.height = Math.round(ch * dpr);
  el.style.width = cw + 'px'; el.style.height = ch + 'px';
  const ctx = el.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ox = pad - p.c * pw, oy = pad - p.r * ph;
  const path = piecePath(p.c, p.r, ox, oy);
  ctx.save();
  ctx.clip(path);
  ctx.drawImage(S.img, ox, oy, bw, bh);
  const lw = Math.max(2, U * 0.035);
  ctx.lineWidth = lw * 2;
  ctx.translate(lw * 0.6, lw * 0.6); ctx.strokeStyle = 'rgba(0,0,0,.32)'; ctx.stroke(path);
  ctx.translate(-lw * 1.2, -lw * 1.2); ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.stroke(path);
  ctx.restore();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke(path);
  p.path = path;
}

function target(p) { const { bx, by, pw, ph, pad } = S.L; return { x: bx + p.c * pw - pad, y: by + p.r * ph - pad }; }

function apply(p) {
  const el = p.el;
  el.style.translate = `${p.x}px ${p.y}px`;
  el.style.transformOrigin = `${p.ox}px ${p.oy}px`;
  el.style.scale = String(p.s);
  el.style.zIndex = p.placed ? 1 : 10 + p.z;
}

// Pack loose pieces into the tray area, shrinking them (down to 50%) so they don't pile up.
// Below 50% they'd get too small to grab, so they overlap a little instead.
function scatter(list, animate) {
  const { cw, ch, pw, ph, U, trays, W, H } = S.L;
  const cellW = pw + U * 0.5, cellH = ph + U * 0.5;
  const minK = 0.5;
  let fit = null;
  for (let k = 1; k >= minK && !fit; k -= 0.025) {
    const cells = [];
    for (const t of trays) {
      const nx = Math.floor(t.w / (cellW * k)), ny = Math.floor(t.h / (cellH * k));
      if (nx < 1 || ny < 1) continue;
      const gx = t.w / nx, gy = t.h / ny;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) cells.push({ x: t.x + gx * (i + .5), y: t.y + gy * (j + .5), sx: (gx - cellW * k) / 2, sy: (gy - cellH * k) / 2 });
    }
    if (cells.length >= list.length) fit = { k, cells };
    else if (k - 0.025 < minK) fit = { k, cells: cells.length ? cells : [{ x: W / 2, y: H * .8, sx: W * .3, sy: 20 }] };
  }
  S.trayScale = fit.k;
  const cells = shuffle(fit.cells.slice());
  shuffle(list.slice()).forEach((p, i) => {
    const cell = cells[i % cells.length], over = i >= cells.length;
    const jx = Math.max(0, cell.sx) * 0.8 * rand(-1, 1) + (over ? rand(-.25, .25) * cellW * fit.k : 0);
    const jy = Math.max(0, cell.sy) * 0.8 * rand(-1, 1) + (over ? rand(-.25, .25) * cellH * fit.k : 0);
    p.ox = cw / 2; p.oy = ch / 2; p.s = fit.k;
    p.x = cell.x + jx - cw / 2; p.y = cell.y + jy - ch / 2;
    p.z = ++zTop;
    if (animate) { p.el.classList.add('flying'); p.el.style.transitionDelay = `${rand(0, .22).toFixed(2)}s`; }
    apply(p);
  });
  if (animate) setTimeout(() => list.forEach(p => { p.el.classList.remove('flying'); p.el.style.transitionDelay = ''; }), 950);
}

async function startPuzzle(entry, count) {
  unlockAudio();
  teardown();
  showScreen('play');
  if (!history.state?.play) history.pushState({ play: 1 }, '');
  const kid = KIDS[settings.kid];
  $('playTools').hidden = false;
  const spin = document.createElement('div');
  spin.className = 'spinner stage-spin'; spin.setAttribute('role', 'status'); spin.setAttribute('aria-label', 'Getting the puzzle ready');
  fxEl.appendChild(spin);
  let loaded;
  try { loaded = await loadImage(entry); }
  catch (e) { console.warn(e); spin.remove(); goHome(); toast("That picture didn't load. Try another one."); return; }
  spin.remove();
  const landscape = stage.clientWidth >= stage.clientHeight * 1.15;
  const g = chooseGrid(count, loaded.w / loaded.h, landscape);
  S = {
    entry, count, kidKey: settings.kid, img: loaded.img, iw: loaded.w, ih: loaded.h,
    cols: g.c, rows: g.r, edges: makeEdges(g.c, g.r), pieces: [], placed: 0,
    ghost: kid.ghostToggle ? settings.toriGhost : kid.ghost, done: false, intro: true, lastActivity: Date.now(),
  };
  $('ghostBtn').hidden = !kid.ghostToggle;
  $('tidyBtn').hidden = settings.kid === 'tj';
  renderGhostBtn();
  $('winPanel').hidden = true;
  boardEl.classList.remove('win-pulse');
  computeLayout();
  drawBoard();
  for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) {
    const el = document.createElement('canvas');
    el.className = 'piece placed';
    el.setAttribute('aria-hidden', 'true');
    const p = { c, r, el, x: 0, y: 0, s: 1, ox: 0, oy: 0, z: 0, placed: false };
    renderPiece(p);
    Object.assign(p, target(p), { ox: S.L.cw / 2, oy: S.L.ch / 2 });
    apply(p);
    stage.appendChild(el);
    S.pieces.push(p);
  }
  updateProgress();
  announce(`${count} piece puzzle. Look at the picture, then put it back together.`);
  // Show the whole picture first, then break it apart.
  const myS = S;
  setTimeout(() => {
    if (S !== myS) return;
    S.pieces.forEach(p => p.el.classList.remove('placed'));
    sfx.whoosh();
    scatter(S.pieces, true);
    setTimeout(() => { if (S === myS) { S.intro = false; S.lastActivity = Date.now(); } }, 700);
  }, 1100);
}

function teardown() {
  drags.clear();
  if (S) { S.pieces.forEach(p => p.el.remove()); S.img.close?.(); }
  S = null;
  fxEl.innerHTML = '';
  stopConfetti();
}

function updateProgress() {
  const n = S.count, k = S.placed;
  $('progressFill').style.width = `${(k / n) * 100}%`;
  $('progressText').textContent = `${k} / ${n}`;
}

function stagePoint(e) { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function toLocal(p, px, py) { return { x: p.ox + (px - p.x - p.ox) / p.s, y: p.oy + (py - p.y - p.oy) / p.s }; }
function screenCenter(p) { const { cw, ch } = S.L; return { x: p.x + p.ox + p.s * (cw / 2 - p.ox), y: p.y + p.oy + p.s * (ch / 2 - p.oy) }; }

function hitPiece(px, py) {
  const loose = S.pieces.filter(p => !p.placed && !p.dragging).sort((a, b) => b.z - a.z);
  for (const p of loose) {
    const l = toLocal(p, px, py);
    if (hitCtx.isPointInPath(p.path, l.x, l.y)) return { p, l };
  }
  // Forgiving fallback for small fingers: nearest piece center within reach.
  let best = null, bd = Infinity;
  const reach = settings.kid === 'tj' ? 0.8 : 0.6;
  for (const p of loose) {
    const c = screenCenter(p), d = Math.hypot(c.x - px, c.y - py);
    if (d < S.L.U * p.s * reach && d < bd) { bd = d; best = p; }
  }
  return best ? { p: best, l: toLocal(best, px, py) } : null;
}

stage.addEventListener('pointerdown', e => {
  unlockAudio();
  if (!S || S.intro || S.done) return;
  const pt = stagePoint(e);
  const hit = hitPiece(pt.x, pt.y);
  if (!hit) return;
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  const p = hit.p;
  p.home = { x: p.x, y: p.y, s: p.s, ox: p.ox, oy: p.oy };
  p.dragging = true;
  p.ox = hit.l.x; p.oy = hit.l.y;          // scale around the finger, so the piece grows under it
  p.x = pt.x - p.ox; p.y = pt.y - p.oy;
  p.s = 1; p.z = ++zTop;
  p.el.classList.add('lifted');
  apply(p);
  drags.set(e.pointerId, p);
  sfx.pick();
  touch();
});

stage.addEventListener('pointermove', e => {
  const p = drags.get(e.pointerId);
  if (!p) return;
  const pt = stagePoint(e);
  const x = Math.max(0, Math.min(S.L.W, pt.x)), y = Math.max(0, Math.min(S.L.H, pt.y));
  p.x = x - p.ox; p.y = y - p.oy;
  apply(p);
});

function endDrag(e) {
  const p = drags.get(e.pointerId);
  if (!p) return;
  drags.delete(e.pointerId);
  drop(p);
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

function drop(p) {
  p.dragging = false;
  p.el.classList.remove('lifted');
  const t = target(p);
  const snapR = Math.max(28, S.L.U * KIDS[S.kidKey].snap);
  if (Math.hypot(p.x - t.x, p.y - t.y) <= snapR) { place(p, t); return; }
  const c = screenCenter(p), { bx, by, bw, bh } = S.L;
  const onBoard = c.x > bx && c.x < bx + bw && c.y > by && c.y < by + bh;
  sfx.drop();
  touch();
  if (onBoard) {
    // Visible "not here" cue: a head-shake wiggle (works with sound off too).
    p.el.animate([{ rotate: '0deg' }, { rotate: '-8deg' }, { rotate: '8deg' }, { rotate: '-5deg' }, { rotate: '0deg' }], { duration: 320, easing: 'ease-in-out' });
    if (S.kidKey === 'tj' && p.home) {
      // TJ: the piece slides back to where it came from, so the board never fills with strays.
      setTimeout(() => {
        if (!S || p.placed || p.dragging) return;
        Object.assign(p, p.home);
        p.el.classList.add('flying'); apply(p);
        setTimeout(() => p.el.classList.remove('flying'), 700);
      }, 320);
      return;
    }
  }
  p.s = onBoard ? 1 : S.trayScale;
  apply(p);
}

function place(p, t) {
  p.placed = true;
  p.el.classList.add('placed', 'snapping');
  p.x = t.x; p.y = t.y; p.s = 1;
  apply(p);
  setTimeout(() => {
    p.el.classList.remove('snapping');
    p.ox = S ? S.L.cw / 2 : p.ox; p.oy = S ? S.L.ch / 2 : p.oy; apply(p);
    p.el.animate([{ scale: '1', filter: 'brightness(1)' }, { scale: '1.08', filter: 'brightness(1.4)' }, { scale: '1', filter: 'brightness(1)' }], { duration: 300, easing: 'ease-out' });
  }, 180);
  S.placed++;
  sparkle(t.x + S.L.cw / 2, t.y + S.L.ch / 2);
  sfx.snap(S.placed / S.count);
  navigator.vibrate?.(25);
  updateProgress();
  announce(`Piece fits! ${S.placed} of ${S.count}.`);
  if (KIDS[S.kidKey].countAloud && S.placed < S.count) speak(NUMBER_WORDS[S.placed] || String(S.placed), { rate: 1, pitch: 1.2 });
  clearHint();
  touch();
  if (S.placed === S.count) complete();
}

function sparkle(x, y) {
  const n = 10;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'spark'; s.textContent = i % 2 ? '★' : '✦';
    const a = (i / n) * Math.PI * 2 + rand(-.2, .2), d = rand(40, 90);
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--dx', `${Math.cos(a) * d}px`); s.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    fxEl.appendChild(s);
    setTimeout(() => s.remove(), 650);
  }
}

/* ------------------------------------------------------------ hints/tools */
function touch() { if (S) S.lastActivity = Date.now(); }
function clearHint() { fxEl.querySelectorAll('.slot-glow').forEach(n => n.remove()); }
function hint() {
  if (!S || S.intro || S.done) return;
  const loose = S.pieces.filter(p => !p.placed && !p.dragging);
  if (!loose.length) return;
  clearHint();
  const p = loose[Math.floor(Math.random() * loose.length)];
  const { bx, by, pw, ph } = S.L;
  const g = document.createElement('div');
  g.className = 'slot-glow';
  Object.assign(g.style, { left: bx + p.c * pw + 'px', top: by + p.r * ph + 'px', width: pw + 'px', height: ph + 'px' });
  fxEl.appendChild(g);
  setTimeout(() => g.remove(), 3000);
  p.z = ++zTop; apply(p);
  p.el.animate([{ rotate: '0deg' }, { rotate: '-9deg' }, { rotate: '9deg' }, { rotate: '-6deg' }, { rotate: '6deg' }, { rotate: '0deg' }], { duration: 900, easing: 'ease-in-out', iterations: 2 });
  sfx.hint();
  announce('This piece goes in the glowing spot.');
  touch();
}
$('hintBtn').addEventListener('click', hint);
$('tidyBtn').addEventListener('click', () => {
  if (!S || S.intro || S.done) return;
  sfx.whoosh(); scatter(S.pieces.filter(p => !p.placed), true); touch();
});
function renderGhostBtn() {
  const b = $('ghostBtn');
  b.setAttribute('aria-pressed', String(!!S?.ghost));
  b.setAttribute('aria-label', S?.ghost ? 'Picture helper is on' : 'Picture helper is off');
}
$('ghostBtn').addEventListener('click', () => {
  if (!S) return;
  S.ghost = !S.ghost; settings.toriGhost = S.ghost; saveSettings();
  sfx.tap(); renderGhostBtn(); drawBoard();
  toast(S.ghost ? 'Picture helper on' : 'Picture helper off');
});
setInterval(() => {
  if (!S || S.intro || S.done || drags.size) return;
  const ms = KIDS[S.kidKey].autoHint;
  if (ms && Date.now() - S.lastActivity > ms) hint();
}, 2000);

/* ------------------------------------------------------------- completion */
function complete() {
  S.done = true;
  $('playTools').hidden = true;      // hint/helper do nothing on a finished puzzle
  const myS = S, name = KIDS[S.kidKey].name;
  const log = doneLog[S.kidKey] || (doneLog[S.kidKey] = {});
  log[S.entry.id] = Math.max(log[S.entry.id] || 0, S.count);
  store.set('kp-done', doneLog);
  setTimeout(() => {
    if (S !== myS) return;
    drawBoard();                                  // the clean, seamless picture
    S.pieces.forEach(p => p.el.classList.add('gone'));
    boardEl.classList.add('win-pulse');
    sfx.win();
    confetti();
    setTimeout(() => speak(`You did it, ${name}!`), 900);
  }, 380);
  setTimeout(() => {
    if (S !== myS) return;
    $('winText').textContent = `You did it, ${name}!`;
    $('winPanel').hidden = false;
    placeWinPanel();
    $('againBtn').focus({ preventScroll: true });
    announce(`You did it, ${name}! The puzzle is finished.`);
  }, 1500);
}

// Keep the finished picture fully visible: panel goes beside the board (landscape),
// in the tray under it (portrait), or overlaps only as a last resort.
function placeWinPanel() {
  const P = $('winPanel'), { W, H, bx, by, bw, bh, m } = S.L, top = stage.offsetTop;
  P.classList.remove('side', 'below');
  P.style.left = P.style.top = '';
  const sideW = 300;
  if (W >= H * 1.15 && bw + sideW + 3 * m <= W) {
    const nbx = Math.max(m, (W - bw - sideW - m) / 2);
    boardEl.style.left = nbx + 'px';
    P.classList.add('side');
    P.style.left = nbx + bw + m + 'px';
    P.style.top = top + by + bh / 2 + 'px';
  } else if (H - by - bh >= 250) {
    boardEl.style.left = bx + 'px';
    P.classList.add('below');
    P.style.top = top + by + bh + (H - by - bh) / 2 + 'px';
  } else {
    boardEl.style.left = bx + 'px';
  }
}
$('againBtn').addEventListener('click', () => { sfx.tap(); if (S) startPuzzle(S.entry, S.count); });
$('newBtn').addEventListener('click', () => { sfx.tap(); goHome(); });

let confettiRaf = 0;
function confetti() {
  const cv = $('confetti'), dpr = Math.min(2, devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = ['#FF4FA3', '#FFC93C', '#7CE0FF', '#7DFFB0', '#FFFFFF', '#B18CFF'];
  const parts = Array.from({ length: reduce ? 40 : 170 }, (_, i) => ({
    x: W / 2 + rand(-60, 60), y: H * 0.45, vx: rand(-9, 9), vy: rand(-17, -6), r: rand(5, 11),
    a: rand(0, 6.28), va: rand(-.3, .3), c: colors[i % colors.length], sq: Math.random() < .5,
  }));
  const t0 = performance.now();
  cancelAnimationFrame(confettiRaf);
  const step = now => {
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.max(0, 1 - t / 3200);
      if (p.sq) ctx.fillRect(-p.r / 2, -p.r / 3, p.r, p.r * 0.66); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, 6.28); ctx.fill(); }
      ctx.restore();
    }
    if (t < 3200) confettiRaf = requestAnimationFrame(step); else ctx.clearRect(0, 0, W, H);
  };
  confettiRaf = requestAnimationFrame(step);
}
function stopConfetti() {
  cancelAnimationFrame(confettiRaf);
  const cv = $('confetti'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
}

/* ------------------------------------------------------------- navigation */
function showScreen(name) {
  $('home').hidden = name !== 'home';
  $('play').hidden = name !== 'play';
  document.body.style.overflow = name === 'play' ? 'hidden' : '';
}
function goHome() {
  teardown();
  showScreen('home');
  renderGallery();
  if (history.state?.play) history.back();
}
function needsConfirm() { return S && !S.done && S.placed > 0; }
async function askLeave() {
  if (!needsConfirm()) { goHome(); return; }
  if (await confirmBox('Stop this puzzle?', 'Keep playing', 'Stop')) goHome();
}
$('backBtn').addEventListener('click', () => { sfx.tap(); askLeave(); });
window.addEventListener('popstate', () => {
  if ($('play').hidden) return;
  if (needsConfirm()) { history.pushState({ play: 1 }, ''); askLeave(); }
  else { teardown(); showScreen('home'); renderGallery(); }
});

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!S || $('play').hidden) return;
    drags.clear();
    computeLayout(); drawBoard();
    const loose = [];
    for (const p of S.pieces) {
      p.dragging = false; p.el.classList.remove('lifted', 'flying', 'snapping');
      renderPiece(p);
      if (p.placed || S.intro) { Object.assign(p, target(p), { s: 1, ox: S.L.cw / 2, oy: S.L.ch / 2 }); apply(p); }
      else loose.push(p);
    }
    if (loose.length) scatter(loose, false);
    if (S.done && !$('winPanel').hidden) placeWinPanel();
  }, 160);
});

/* ------------------------------------------------------------ install/pwa */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('installBtn').hidden = false; });
$('installBtn').addEventListener('click', async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice.catch(() => null);
  installEvt = null; $('installBtn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; toast('Installed! Find Puzzles on the home screen.'); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
}

/* ------------------------------------------------------------------ boot */
document.addEventListener('pointerdown', unlockAudio, { once: true });
renderSound();
setKid(settings.kid);
listPhotos().then(p => { photos = p; renderGallery(); }).catch(err => console.warn('photos', err));

// Test hook: lets automated checks find piece + target positions.
window.__kp = {
  get state() { return S; },
  pieces() {
    if (!S) return [];
    const r = stage.getBoundingClientRect();
    return S.pieces.map(p => {
      const c = screenCenter(p), t = target(p);
      return { c: p.c, r: p.r, placed: p.placed, x: r.left + c.x, y: r.top + c.y, tx: r.left + t.x + S.L.cw / 2, ty: r.top + t.y + S.L.ch / 2 };
    });
  },
};
