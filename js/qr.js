// qr.html: turn the menu URL into a printable QR card and download it as PNG.
// Uses the tiny `qrcode-generator` library (global `qrcode`, loaded from cdnjs).

import { initI18n, t, toggleLang, onLangChange, applyStatic } from './i18n.js';
import { initTheme, syncThemeButton } from './theme.js';

const $ = (id) => document.getElementById(id);

const CARD = { width: 1000, height: 1250, qrSize: 640, quietModules: 4 };
const INK = '#1e1611';
const ACCENT = '#a4441c';
const PAPER = '#fbf8f2';
const RULE = '#d6c7b2';

let captionTouched = false;

function defaultMenuUrl() {
  const url = new URL('./', location.href);
  url.search = '';
  url.hash = '';
  return url.href;
}

/** Validated target URL (with ?masa=N) or an error key. */
function buildTarget() {
  const raw = $('qr-url').value.trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: 'qr.invalid' };
  }
  if (!/^https?:$/.test(url.protocol)) return { error: 'qr.invalid' };

  const table = Number.parseInt($('qr-table').value, 10);
  if (Number.isInteger(table) && table > 0 && table < 1000) url.searchParams.set('masa', table);
  else url.searchParams.delete('masa');
  return { url: url.href, table: url.searchParams.get('masa') };
}

function makeQr(text) {
  const qr = window.qrcode(0, 'M');
  if (window.qrcode.stringToBytesFuncs?.['UTF-8']) window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
  qr.addData(text);
  qr.make();
  return qr;
}

/** QR matrix for a URL, cached so redraws (fonts, caption) don't recompute it. */
let cachedQr = { text: null, qr: null };
function qrFor(text) {
  if (cachedQr.text !== text) cachedQr = { text, qr: makeQr(text) };
  return cachedQr.qr;
}

/** Draw the card on `canvas`, scaled from the 1000×1250 design grid. */
function draw(canvas, { url, table }) {
  const { width, height, qrSize } = CARD;
  const scale = canvas.width / width;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  // inner hairline frame, like a printed table card
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  // wordmark: italic "Feeravun" + spaced "CAFE"
  const headerBaseline = 160;
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'italic 600 96px Fraunces, Georgia, serif';
  const nameWidth = ctx.measureText('Feeravun').width;
  ctx.font = '700 26px "Instrument Sans", system-ui, sans-serif';
  ctx.letterSpacing = '8px';
  const subWidth = ctx.measureText('CAFE').width;
  const startX = (width - (nameWidth + 18 + subWidth)) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = 'italic 600 96px Fraunces, Georgia, serif';
  ctx.letterSpacing = '0px';
  ctx.fillText('Feeravun', startX, headerBaseline);
  ctx.fillStyle = ACCENT;
  ctx.font = '700 26px "Instrument Sans", system-ui, sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('CAFE', startX + nameWidth + 18, headerBaseline);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'center';

  // QR (dark modules on light paper = best scan contrast), with a 4-module quiet zone.
  // All modules go into one path (horizontal runs merged) → a single fill call.
  const qr = qrFor(url);
  const count = qr.getModuleCount();
  const cell = Math.floor(qrSize / count);
  const size = cell * count;
  const quiet = CARD.quietModules * cell;
  const x0 = Math.round((width - size) / 2);
  const y0 = headerBaseline + 20 + quiet;
  const path = new Path2D();
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (!qr.isDark(r, c)) continue;
      let run = 1;
      while (c + run < count && qr.isDark(r, c + run)) run += 1;
      path.rect(x0 + c * cell, y0 + r * cell, run * cell, cell);
      c += run - 1;
    }
  }
  ctx.fillStyle = INK;
  ctx.fill(path);

  // caption + table
  const captionBaseline = y0 + size + quiet + 30;
  const caption = $('qr-caption').value.trim() || t('qr.captionDefault');
  ctx.fillStyle = INK;
  ctx.font = 'italic 500 58px Fraunces, Georgia, serif';
  ctx.fillText(caption, width / 2, captionBaseline, width - 160);
  if (table) {
    ctx.strokeStyle = RULE;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 60, captionBaseline + 34);
    ctx.lineTo(width / 2 + 60, captionBaseline + 34);
    ctx.stroke();
    ctx.fillStyle = ACCENT;
    ctx.font = '700 34px "Instrument Sans", system-ui, sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText(t('header.table', { n: table }).toLocaleUpperCase(document.documentElement.lang), width / 2, captionBaseline + 90);
    ctx.letterSpacing = '0px';
  }
}

let currentTarget = null;

function update() {
  const error = $('qr-error');
  const input = $('qr-url');
  const target = buildTarget();
  if (target.error || typeof window.qrcode !== 'function') {
    error.textContent = target.error ? t(target.error) : '';
    input.setAttribute('aria-invalid', String(Boolean(target.error)));
    $('qr-download').disabled = Boolean(target.error);
    return;
  }
  try {
    draw($('qr-canvas'), target);
  } catch {
    error.textContent = t('qr.tooLong');
    input.setAttribute('aria-invalid', 'true');
    $('qr-download').disabled = true;
    return;
  }
  currentTarget = target;
  error.textContent = '';
  input.setAttribute('aria-invalid', 'false');
  $('qr-download').disabled = false;
  $('qr-encoded').textContent = target.url;
  $('qr-canvas').setAttribute('aria-label', `${t('qr.preview')}: ${target.url}`);
}

/** Render a print-quality PNG (1200×1500) off-screen and download it. */
function download() {
  if (!currentTarget) return;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1500;
  draw(canvas, currentTarget);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `feeravun-menu-qr${currentTarget.table ? `-masa-${currentTarget.table}` : ''}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }, 'image/png');
}

function applyLanguage() {
  document.title = t('qr.metaTitle');
  applyStatic();
  syncThemeButton();
  if (!captionTouched) $('qr-caption').value = t('qr.captionDefault');
  update();
}

async function boot() {
  initTheme();
  try {
    const data = await (await fetch('data/menu.json')).json();
    initI18n(data.ui);
  } catch {
    initI18n({});
  }

  $('qr-url').value = defaultMenuUrl();
  $('qr-form').addEventListener('input', (event) => {
    if (event.target.id === 'qr-caption') captionTouched = true;
    update();
  });
  $('qr-form').addEventListener('submit', (event) => event.preventDefault());
  $('qr-download').addEventListener('click', download);
  $('lang-toggle').addEventListener('click', toggleLang);
  onLangChange(applyLanguage);

  applyLanguage();
  // redraw once web fonts are in, so the card uses Fraunces / Instrument Sans
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(update);
  // the QR library is a deferred classic script; make sure it is there
  if (typeof window.qrcode !== 'function') window.addEventListener('load', update, { once: true });
}

boot();
