// Masa listesi: a bill-splitting calculator. Nothing is ever sent anywhere;
// the list only lives in this browser (localStorage, best effort).

import { t, loc, formatPrice } from './i18n.js';

const STORAGE_KEY = 'feeravun-table';
export const MIN_PEOPLE = 1;
export const MAX_PEOPLE = 10;

/* ---------- Pure calculation ---------- */

/** Sum of price × qty for every line. */
export function totalOf(lines, itemsById) {
  let total = 0;
  for (const [id, qty] of lines) total += (itemsById.get(id)?.price ?? 0) * qty;
  return total;
}

/** Per-person share, rounded up to the kuruş so the bill is always covered. */
export function perPerson(total, people) {
  return Math.ceil((total / people) * 100) / 100;
}

const clampPeople = (n) => Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, Math.round(n) || MIN_PEOPLE));

/* ---------- Store ---------- */

function load(itemsById) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw) return null;
    const lines = new Map((raw.lines || [])
      .filter(([id, qty]) => itemsById.has(id) && Number.isInteger(qty) && qty > 0)
      .map(([id, qty]) => [id, Math.min(qty, 99)]));
    return { lines, people: clampPeople(raw.people) };
  } catch {
    return null;
  }
}

function save(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines: [...store.lines], people: store.people }));
  } catch {
    /* storage unavailable: the list just won't survive a reload */
  }
}

/* ---------- UI ---------- */

/**
 * @param {object} ctx
 * @param {Map<string, object>} ctx.itemsById
 * @param {(dialog: HTMLDialogElement, opener?: Element) => void} ctx.openSheet
 * @param {(dialog: HTMLDialogElement) => Promise<void>} ctx.closeSheet
 * @param {(dialog: HTMLDialogElement) => void} ctx.initSheet
 * @param {() => object|null} ctx.anim       GSAP or null (reduced motion)
 * @param {(msg: string) => void} ctx.announce
 */
export function initCart({ itemsById, openSheet, closeSheet, initSheet, anim, announce }) {
  const store = load(itemsById) || { lines: new Map(), people: 2 };

  const dock = document.getElementById('cart-dock');
  const dialog = document.getElementById('cart');
  const linesEl = document.getElementById('cart-lines');
  const emptyEl = document.getElementById('cart-empty');
  const splitEl = document.getElementById('cart-split');
  const openBtn = document.getElementById('cart-open');

  const count = () => [...store.lines.values()].reduce((a, b) => a + b, 0);

  function setQty(id, qty) {
    if (qty <= 0) store.lines.delete(id);
    else store.lines.set(id, Math.min(qty, 99));
    commit();
  }

  function add(id) {
    if (!itemsById.has(id)) return;
    setQty(id, (store.lines.get(id) || 0) + 1);
    announce(t('card.added', { name: loc(itemsById.get(id).name) }));
    const gsap = anim();
    if (gsap && !dock.hidden) gsap.fromTo(openBtn, { scale: 1 }, { scale: 1.04, duration: 0.12, yoyo: true, repeat: 1 });
  }

  function setPeople(n) {
    store.people = clampPeople(n);
    commit();
  }

  function clear() {
    store.lines.clear();
    commit();
  }

  function commit() {
    save(store);
    render();
  }

  /* --- rendering --- */

  function syncAddButtons() {
    document.querySelectorAll('[data-add]').forEach((btn) => {
      const item = itemsById.get(btn.dataset.add);
      if (!item) return;
      const qty = store.lines.get(item.id) || 0;
      btn.classList.toggle('has-qty', qty > 0);
      const badge = btn.querySelector('.add__qty');
      if (badge) {
        badge.hidden = qty === 0;
        badge.textContent = qty;
      }
      const name = loc(item.name);
      btn.setAttribute('aria-label', qty ? t('card.addMore', { name, n: qty }) : t('card.add', { name }));
    });
  }

  function lineRow(id, qty) {
    const item = itemsById.get(id);
    const name = loc(item.name);
    const li = document.createElement('li');
    li.className = 'line';
    li.innerHTML = `
      <span class="line__info"><span class="line__name"></span><span class="line__unit"></span></span>
      <span class="stepper">
        <button type="button" class="stepper__btn" data-line="${id}" data-delta="-1">−</button>
        <span class="stepper__value"></span>
        <button type="button" class="stepper__btn" data-line="${id}" data-delta="1">+</button>
      </span>
      <span class="line__total"></span>`;
    li.querySelector('.line__name').textContent = name;
    li.querySelector('.line__unit').textContent = `× ${formatPrice(item.price)}`;
    li.querySelector('.stepper__value').textContent = qty;
    li.querySelector('.line__total').textContent = formatPrice(item.price * qty);
    const [dec, inc] = li.querySelectorAll('.stepper__btn');
    dec.setAttribute('aria-label', t('cart.dec', { name }));
    inc.setAttribute('aria-label', t('cart.inc', { name }));
    return li;
  }

  function render() {
    const n = count();
    const total = totalOf(store.lines, itemsById);
    const share = perPerson(total, store.people);

    // dock bar
    const wasHidden = dock.hidden;
    dock.hidden = n === 0;
    document.getElementById('cart-count').textContent = t('cart.barCount', { n });
    document.getElementById('cart-total-bar').textContent = formatPrice(total);
    openBtn.setAttribute('aria-label', t('cart.open', { n, total: formatPrice(total) }));
    document.documentElement.style.setProperty('--dock', n ? `${dock.offsetHeight}px` : '0px');
    const gsap = anim();
    if (gsap && wasHidden && n) gsap.from(dock, { yPercent: 110, duration: 0.4, ease: 'power3.out', clearProps: 'transform' });

    // sheet
    linesEl.replaceChildren(...[...store.lines].map(([id, qty]) => lineRow(id, qty)));
    emptyEl.hidden = n > 0;
    splitEl.hidden = n === 0;
    document.getElementById('cart-total').textContent = formatPrice(total);
    document.getElementById('people-value').textContent = store.people;
    document.getElementById('per-person').textContent = formatPrice(share);
    dialog.querySelector('[data-people="-1"]').disabled = store.people <= MIN_PEOPLE;
    dialog.querySelector('[data-people="1"]').disabled = store.people >= MAX_PEOPLE;

    syncAddButtons();
  }

  /* --- events --- */

  initSheet(dialog);
  openBtn.addEventListener('click', () => openSheet(dialog, openBtn));

  dialog.addEventListener('click', (event) => {
    const stepBtn = event.target.closest('[data-line]');
    const peopleBtn = event.target.closest('[data-people]');
    if (stepBtn) {
      const { line, delta } = stepBtn.dataset;
      const nextQty = (store.lines.get(line) || 0) + Number(delta);
      setQty(line, nextQty);
      // keep focus inside the list after re-render
      const same = linesEl.querySelector(`[data-line="${line}"][data-delta="${delta}"]`);
      (same || dialog.querySelector('[data-close]')).focus();
    } else if (peopleBtn) {
      setPeople(store.people + Number(peopleBtn.dataset.people));
      if (peopleBtn.disabled) dialog.querySelector(`[data-people="${-peopleBtn.dataset.people}"]`).focus();
    }
  });

  document.getElementById('cart-clear').addEventListener('click', () => {
    clear();
    closeSheet(dialog);
  });

  window.addEventListener('resize', () => {
    if (!dock.hidden) document.documentElement.style.setProperty('--dock', `${dock.offsetHeight}px`);
  });

  render();

  return { add, render, count };
}
