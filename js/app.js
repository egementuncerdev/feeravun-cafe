import {
  initI18n, t, loc, getLang, toggleLang, onLangChange, applyStatic, formatAmount, formatList, capitalize,
} from './i18n.js';
import { art, BEAN } from './art.js';
import { recommend, pairFood } from './recommend.js';
import { initCart } from './cart.js';
import { initTheme, syncThemeButton } from './theme.js';

/* ==========================================================================
   State & helpers
   ========================================================================== */

const state = {
  data: null,
  itemsById: new Map(),
  filters: new Set(),
  cart: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => motionQuery.matches;
/** GSAP if loaded and motion is allowed, otherwise null. */
const anim = () => (!reducedMotion() && window.gsap) || null;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('data-') || key.startsWith('aria-') || key === 'role') node.setAttribute(key, value);
    else node[key] = value;
  }
  for (const child of [].concat(children)) {
    if (child != null) node.append(child);
  }
  return node;
}

const announcer = () => $('#announcer');
function announce(message) {
  const node = announcer();
  node.textContent = '';
  requestAnimationFrame(() => { node.textContent = message; });
}

const label = (group, key) => loc(state.data.labels[group][key]);

/* ==========================================================================
   Table badge (?masa=5 from the QR page)
   ========================================================================== */

function tableNumber() {
  const params = new URLSearchParams(location.search);
  const raw = params.get('masa') || params.get('table');
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 && n < 1000 ? n : null;
}

function renderTableBadge() {
  const badge = $('#table-badge');
  const n = tableNumber();
  badge.hidden = n == null;
  if (n != null) badge.textContent = t('header.table', { n });
  $('#cart-table').textContent = n != null ? t('header.table', { n }) : '';
}

/* ==========================================================================
   Menu rendering
   ========================================================================== */

const PLUS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CAFFEINE_LEVEL = { none: 0, low: 1, medium: 2, high: 3 };
const pad2 = (n) => String(n).padStart(2, '0');

/** "160" + small currency sign, as on a printed menu. */
function priceNode(value, className = 'item__price') {
  return el('p', { class: className }, [formatAmount(value), el('small', { text: '₺' })]);
}

function beans(level) {
  const wrap = el('span', { class: 'beans', 'aria-hidden': 'true' });
  wrap.innerHTML = [0, 1, 2].map((i) => BEAN.replace('<svg', `<svg class="${i < CAFFEINE_LEVEL[level] ? 'on' : ''}"`)).join('');
  return wrap;
}

function allergenCodes(codes) {
  return el('ul', { class: 'codes', role: 'list', 'aria-label': t('card.allergens') },
    codes.map((a) => el('li', {}, [
      el('span', { 'aria-hidden': 'true', text: loc(state.data.labels.allergens[a].code) }),
      el('span', { class: 'visually-hidden', text: label('allergens', a) }),
    ])));
}

/** Name ······ price line (shared by the menu and the assistant's results). */
function itemLine(item, { headingTag = 'h3', id } = {}) {
  return el('div', { class: 'item__line' }, [
    el(headingTag, { class: 'item__name', id }, [
      loc(item.name),
      item.signature ? el('span', { class: 'item__sig', text: t('item.signature') }) : null,
    ]),
    el('span', { class: 'item__leader', 'aria-hidden': 'true' }),
    priceNode(item.price),
  ]);
}

function renderItem(item) {
  const name = loc(item.name);
  const line = itemLine(item, { id: `name-${item.id}` });
  line.append(el('button', {
    class: 'add', type: 'button', 'data-add': item.id,
    'aria-label': t('card.add', { name }),
    html: `${PLUS_ICON}<span class="add__qty" hidden></span>`,
  }));

  const tags = ['temp', 'taste', 'body'].map((k) => label('tags', item.tags[k]));

  return el('li', {
    class: 'item', id: `item-${item.id}`, 'data-id': item.id, tabIndex: -1,
    'aria-labelledby': `name-${item.id}`,
  }, [
    line,
    el('p', { class: 'item__desc', text: loc(item.description) }),
    el('div', { class: 'item__foot' }, [
      el('p', { class: 'item__meta' }, [
        beans(item.caffeine),
        label('caffeine', item.caffeine),
        el('span', { 'aria-hidden': 'true', text: '·' }),
        tags.join(' · '),
      ]),
      item.allergens.length
        ? allergenCodes(item.allergens)
        : el('span', { class: 'visually-hidden', text: t('card.noAllergens') }),
    ]),
    el('p', { class: 'item__flag', text: t('card.unavailable') }),
  ]);
}

function renderMenu() {
  const { categories, items } = state.data;

  $('#tabs').replaceChildren(
    ...categories.map((cat, i) => el('a', { class: 'tab', href: `#cat-${cat.id}`, 'data-cat': cat.id }, [
      el('span', { class: 'tab__num', 'aria-hidden': 'true', text: pad2(i + 1) }),
      loc(cat.name),
    ])),
    el('span', { class: 'tabs__indicator', 'aria-hidden': 'true' }),
  );

  $('#menu').replaceChildren(...categories.map((cat, i) => {
    const catItems = items.filter((item) => item.category === cat.id);
    return el('section', { class: 'cat', id: `cat-${cat.id}`, 'aria-labelledby': `title-${cat.id}` }, [
      el('div', { class: 'cat__head' }, [
        el('span', { class: 'cat__num', 'aria-hidden': 'true', text: pad2(i + 1) }),
        el('h2', { class: 'cat__title', id: `title-${cat.id}`, text: loc(cat.name) }),
        el('span', { class: 'cat__art', html: art(cat.art) }),
      ]),
      el('p', { class: 'cat__empty', hidden: true, text: t('filters.sectionEmpty') }),
      el('ul', { class: 'items', role: 'list' }, catItems.map(renderItem)),
    ]);
  }));

  // allergen key
  const { allergens } = state.data.labels;
  $('#legend').replaceChildren(...Object.keys(allergens).map((key) => el('li', {}, [
    el('ul', { class: 'codes', role: 'list', 'aria-hidden': 'true' }, [el('li', { text: loc(allergens[key].code) })]),
    label('allergens', key),
  ])));
  $('#hero-count').textContent = t('hero.count', { n: items.length });

  applyFilters();
  state.cart?.render();
  updateActiveTab(true);
}

/* ==========================================================================
   Filters: Kafeinsiz / Sütsüz / Glutensiz
   ========================================================================== */

const FILTERS = {
  caffeineFree: (item) => item.caffeine === 'none',
  dairyFree: (item) => !item.allergens.includes('milk'),
  glutenFree: (item) => !item.allergens.includes('gluten'),
};

const passesFilters = (item) => [...state.filters].every((key) => FILTERS[key](item));

function applyFilters() {
  let matching = 0;
  $$('.cat').forEach((section) => {
    let visible = 0;
    $$('.item', section).forEach((card) => {
      const ok = passesFilters(state.itemsById.get(card.dataset.id));
      card.classList.toggle('is-dimmed', !ok);
      if (ok) visible += 1;
    });
    matching += visible;
    $('.cat__empty', section).hidden = visible > 0;
  });

  $$('[data-filter]').forEach((chip) => chip.setAttribute('aria-pressed', String(state.filters.has(chip.dataset.filter))));
  $('#filters-clear').hidden = state.filters.size === 0;
  $('#filters-count').textContent = state.filters.size
    ? t('filters.count', { n: matching, total: state.data.items.length })
    : '';
}

function initFilters() {
  $('.filters').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-filter]');
    if (chip) {
      const key = chip.dataset.filter;
      if (state.filters.has(key)) state.filters.delete(key);
      else state.filters.add(key);
    } else if (event.target.closest('#filters-clear')) {
      state.filters.clear();
      $('[data-filter]').focus();
    } else {
      return;
    }
    applyFilters();
  });
}

/* ==========================================================================
   Sticky tabs: smooth scroll + scroll-spy
   ========================================================================== */

let lockedCat = null;
let lockTimer = 0;

function setActiveTab(catId) {
  const track = $('#tabs');
  let active = null;
  $$('.tab', track).forEach((tab) => {
    const isActive = tab.dataset.cat === catId;
    tab.setAttribute('aria-current', isActive ? 'true' : 'false');
    if (isActive) active = tab;
  });
  if (!active) return;
  // slide the underline to the active tab
  const indicator = $('.tabs__indicator', track);
  if (indicator) indicator.style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth})`;
  // keep the active tab visible inside the horizontal track (without moving the page)
  const left = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2;
  track.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function updateActiveTab(force = false) {
  if (lockedCat && !force) return;
  const sections = $$('.cat');
  if (!sections.length) return;
  const offset = $('.tabs').offsetHeight + 24;
  let current = sections[0].id;
  for (const section of sections) {
    if (section.getBoundingClientRect().top - offset <= 0) current = section.id;
  }
  // at the very bottom, the last section wins even if it is short
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
    current = sections[sections.length - 1].id;
  }
  const catId = current.replace(/^cat-/, '');
  if ($('#tabs').dataset.active !== catId || force) {
    $('#tabs').dataset.active = catId;
    setActiveTab(catId);
  }
}

function releaseLock() {
  lockedCat = null;
  updateActiveTab();
}

function initTabs() {
  $('#tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;
    event.preventDefault();
    const target = document.getElementById(`cat-${tab.dataset.cat}`);
    if (!target) return;
    lockedCat = tab.dataset.cat;
    $('#tabs').dataset.active = lockedCat;
    setActiveTab(lockedCat);
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${target.id}`);
    // release the lock when the smooth scroll settles
    clearTimeout(lockTimer);
    lockTimer = setTimeout(releaseLock, 1000);
  });

  window.addEventListener('scrollend', () => {
    if (lockedCat) {
      clearTimeout(lockTimer);
      releaseLock();
    }
  });

  let ticking = false;
  let lastY = window.scrollY;
  const fab = $('#quiz-open');
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateActiveTab();
      // compact FAB while scrolling down, full label when scrolling up / near the top
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 8) {
        fab.classList.toggle('is-compact', y > lastY && y > 240);
        lastY = y;
      }
      ticking = false;
    });
  }, { passive: true });
}

/* ==========================================================================
   Entrance animations (GSAP, skipped with reduced motion)
   ========================================================================== */

let revealObserver = null;

function animateEntrance() {
  const gsap = anim();
  if (!gsap) return;

  gsap.from('.hero__rule', { scaleX: 0, duration: 0.9, ease: 'power3.inOut', delay: 0.1, clearProps: 'transform' });
  gsap.from('.filters, .hero__cta', { y: 10, opacity: 0, duration: 0.5, stagger: 0.08, delay: 0.25, ease: 'power2.out', clearProps: 'transform,opacity' });

  const rows = $$('.cat__head, .item');
  const fold = window.innerHeight;
  const below = rows.filter((c) => c.getBoundingClientRect().top > fold);
  const above = rows.filter((c) => c.getBoundingClientRect().top <= fold);

  gsap.from(above, {
    y: 14, opacity: 0, duration: 0.5, stagger: 0.04, delay: 0.2, ease: 'power2.out', clearProps: 'transform,opacity',
  });

  if (!('IntersectionObserver' in window) || !below.length) return;
  gsap.set(below, { opacity: 0, y: 14 });
  revealObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    if (!visible.length) return;
    visible.forEach((node) => revealObserver.unobserve(node));
    gsap.to(visible, {
      y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power2.out', clearProps: 'transform,opacity',
    });
  }, { rootMargin: '0px 0px -6% 0px' });
  below.forEach((node) => revealObserver.observe(node));
}

/** Make every card visible immediately (used before re-render / jump-to). */
function revealAll() {
  if (revealObserver) {
    revealObserver.disconnect();
    revealObserver = null;
  }
  if (window.gsap) window.gsap.set('.cat__head, .item', { clearProps: 'transform,opacity' });
}

/* ==========================================================================
   Bottom sheets (native <dialog>): animated open/close, Esc, backdrop click
   ========================================================================== */

function openSheet(dialog, opener) {
  if (dialog.open) return;
  dialog._opener = opener || document.activeElement;
  dialog.classList.remove('is-closing');
  dialog.showModal();
  const gsap = anim();
  if (gsap) {
    gsap.fromTo(dialog.querySelector('.sheet__panel'),
      { yPercent: 100 }, { yPercent: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform' });
  }
}

/** @param {{restoreFocus?: boolean}} [opts] */
function closeSheet(dialog, { restoreFocus = true } = {}) {
  if (!dialog.open || dialog.classList.contains('is-closing')) return Promise.resolve();
  dialog._restoreFocus = restoreFocus;
  dialog.classList.add('is-closing');
  const gsap = anim();
  return new Promise((resolve) => {
    const finish = () => {
      dialog.close();
      resolve();
    };
    if (!gsap) return finish();
    gsap.to(dialog.querySelector('.sheet__panel'), {
      yPercent: 100, duration: 0.28, ease: 'power2.in', onComplete: finish,
    });
  });
}

function initSheet(dialog) {
  // Esc → animated close instead of the instant native one
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSheet(dialog);
  });
  // click on the dimmed area (the dialog box itself, outside the panel)
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeSheet(dialog);
  });
  dialog.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => closeSheet(dialog)));
  dialog.addEventListener('close', () => {
    dialog.classList.remove('is-closing');
    if (window.gsap) window.gsap.set(dialog.querySelector('.sheet__panel'), { clearProps: 'transform' });
    if (dialog._restoreFocus !== false) {
      const opener = dialog._opener;
      // the opener may be gone (e.g. the cart bar hides when the list is cleared)
      if (opener?.isConnected && opener.getClientRects().length) opener.focus();
      else $('#quiz-open').focus();
    }
    dialog._restoreFocus = true;
  });
}

/* ==========================================================================
   "Ne içsem?" quiz
   ========================================================================== */

const quiz = {
  step: 0, // 0..steps.length-1, steps.length = results
  answers: {},
  busy: false,
};

const quizSteps = () => state.data.quiz.steps;

function optionFor(key, value) {
  return quizSteps().find((s) => s.key === key)?.options.find((o) => o.value === value);
}

function buildStepView(index) {
  const step = quizSteps()[index];
  const total = quizSteps().length;
  const qId = `quiz-q-${step.key}`;
  return el('div', { class: 'quiz__view' }, [
    el('p', { class: 'quiz__count' }, [
      el('span', { 'aria-hidden': 'true', text: `${pad2(index + 1)} / ${pad2(total)}` }),
      el('span', { class: 'visually-hidden', text: t('quiz.step', { n: index + 1, total }) }),
    ]),
    el('h3', { class: 'quiz__q', id: qId, tabIndex: -1, text: loc(step.question) }),
    el('div', { class: 'quiz__options', role: 'group', 'aria-labelledby': qId },
      step.options.map((opt, i) => el('button', {
        class: 'option', type: 'button', 'data-value': opt.value,
        'aria-pressed': String(quiz.answers[step.key] === opt.value),
      }, [
        el('span', { class: 'option__num', 'aria-hidden': 'true', text: pad2(i + 1) }),
        el('span', { class: 'option__label', text: loc(opt.label) }),
        el('span', { class: 'option__hint', text: loc(opt.hint) }),
        el('span', { class: 'option__arrow', 'aria-hidden': 'true', text: '→' }),
      ]))),
    index > 0
      ? el('div', { class: 'quiz__nav' }, [
        el('button', { class: 'quiz__back', type: 'button', 'data-back': '', text: `← ${t('quiz.back')}` }),
      ])
      : null,
  ]);
}

function reasonFor(result) {
  const { item, matches } = result;
  const parts = ['mood', 'temp', 'taste']
    .filter((key) => matches[key])
    .map((key) => loc(optionFor(key, quiz.answers[key]).said));
  const vars = { caffeine: label('caffeineAdj', item.caffeine), item: loc(item.name) };
  return parts.length
    ? capitalize(t('quiz.reason', { ...vars, parts: formatList(parts) }))
    : t('quiz.reasonFallback', vars);
}

function matchMark(text, matched) {
  return el('li', { class: matched ? 'is-match' : '' }, [
    text,
    matched ? el('span', { class: 'visually-hidden', text: ` (${t('quiz.match')})` }) : null,
  ]);
}

function buildResultsView() {
  const allow = quizFilter();
  const results = recommend(state.data.items, quiz.answers, { allow });
  const pairing = results.length ? pairFood(state.data.items, quiz.answers, { allow }) : null;
  const filterNote = activeFilterLabels();
  const catArt = (item) => art(state.data.categories.find((c) => c.id === item.category)?.art);

  const recs = results.map((result, i) => {
    const { item, matches } = result;
    return el('li', { class: 'rec' }, [
      el('span', { class: 'rec__rank', 'aria-hidden': 'true', text: pad2(i + 1) }),
      el('div', { class: 'rec__body' }, [
        itemLine(item, { headingTag: 'h4' }),
        el('p', { class: 'rec__why', text: reasonFor(result) }),
        el('p', {
          class: 'rec__note',
          text: i === 0 && matches.mood ? loc(state.data.quiz.moodNotes[quiz.answers.mood]) : loc(item.description),
        }),
        el('ul', { class: 'rec__marks', role: 'list' }, [
          matchMark(label('caffeine', item.caffeine), matches.mood),
          matchMark(label('tags', item.tags.temp), matches.temp),
          matchMark(label('tags', item.tags.taste), matches.taste),
        ]),
        el('div', { class: 'rec__actions' }, [
          el('button', { class: 'btn btn--primary', type: 'button', 'data-show': item.id, text: `${t('quiz.show')} →` }),
          ...recExtraActions(item),
        ]),
      ]),
    ]);
  });

  return el('div', { class: 'quiz__view' }, [
    el('p', { class: 'quiz__count', 'aria-hidden': 'true', text: '✓' }),
    el('h3', { class: 'quiz__q', id: 'quiz-results-title', tabIndex: -1, text: t('quiz.resultsTitle') }),
    filterNote ? el('p', { class: 'quiz__note', text: t('quiz.filtersNote', { filters: filterNote }) }) : null,
    results.length
      ? el('ol', { class: 'recs', role: 'list', 'aria-labelledby': 'quiz-results-title' }, recs)
      : el('p', { class: 'quiz__note', text: t('quiz.noResults') }),
    pairing
      ? el('div', { class: 'pairing' }, [
        el('span', { class: 'pairing__art', html: catArt(pairing) }),
        el('p', {}, [
          el('span', { class: 'pairing__label', text: t('quiz.pairing') }),
          el('a', { href: `#item-${pairing.id}`, 'data-show': pairing.id, text: loc(pairing.name) }),
        ]),
      ])
      : null,
    el('div', { class: 'quiz__nav' }, [
      el('button', { class: 'btn btn--outline', type: 'button', 'data-retry': '', text: `↺ ${t('quiz.retry')}` }),
    ]),
  ]);
}

function setProgress() {
  $$('#quiz-progress span').forEach((seg, i) => seg.classList.toggle('is-done', i <= quiz.step));
}

/** Swap the visible quiz view; direction 1 = forward, -1 = back. */
function showQuizView(direction = 1, { focus = true } = {}) {
  const stage = $('#quiz-stage');
  const next = quiz.step >= quizSteps().length ? buildResultsView() : buildStepView(quiz.step);
  const prev = stage.firstElementChild;
  const gsap = anim();
  setProgress();

  const enter = () => {
    stage.replaceChildren(next);
    quiz.busy = false; // the new view is interactive right away, even while it animates in
    if (focus) next.querySelector('.quiz__q')?.focus();
    if (!gsap) return Promise.resolve();
    const tl = gsap.timeline();
    tl.from(next, { x: 32 * direction, opacity: 0, duration: 0.3, ease: 'power2.out', clearProps: 'transform,opacity' });
    const rows = next.querySelectorAll('.option, .rec, .pairing');
    if (rows.length) {
      tl.from(rows, {
        y: 12, opacity: 0, duration: 0.32, stagger: 0.06, ease: 'power2.out', clearProps: 'transform,opacity',
      }, '-=0.15');
    }
    return tl.then();
  };

  if (!prev || !gsap) return enter();
  quiz.busy = true;
  return gsap.to(prev, { x: -32 * direction, opacity: 0, duration: 0.18, ease: 'power1.in' }).then(enter);
}

function resetQuiz() {
  quiz.step = 0;
  quiz.answers = {};
}

function initQuiz() {
  const dialog = $('#quiz');
  const opener = $('#quiz-open');
  initSheet(dialog);

  const open = (event) => {
    if (quiz.step >= quizSteps().length) resetQuiz();
    $('#quiz-stage').replaceChildren();
    openSheet(dialog, event.currentTarget);
    showQuizView(1);
  };
  opener.addEventListener('click', open);
  $$('[data-open-quiz]').forEach((btn) => btn.addEventListener('click', open));

  $('#quiz-stage').addEventListener('click', (event) => {
    if (quiz.busy) return;
    const option = event.target.closest('.option');
    const back = event.target.closest('[data-back]');
    const retry = event.target.closest('[data-retry]');
    const show = event.target.closest('[data-show]');
    const addRec = event.target.closest('[data-add-rec]');

    if (addRec) {
      state.cart.add(addRec.dataset.addRec);
      addRec.textContent = t('quiz.added');
      return;
    }

    if (option) {
      const step = quizSteps()[quiz.step];
      quiz.answers[step.key] = option.dataset.value;
      $$('.option', option.parentElement).forEach((o) => o.setAttribute('aria-pressed', String(o === option)));
      quiz.step += 1;
      showQuizView(1);
    } else if (back) {
      quiz.step = Math.max(0, quiz.step - 1);
      showQuizView(-1);
    } else if (retry) {
      resetQuiz();
      showQuizView(-1);
    } else if (show) {
      event.preventDefault();
      closeSheet(dialog, { restoreFocus: false }).then(() => highlightItem(show.dataset.show));
    }
  });
}

/** Scroll to a product card, flash it and move focus to it. */
function highlightItem(id) {
  const card = document.getElementById(`item-${id}`);
  if (!card) return;
  revealAll();
  $$('.item.is-highlight').forEach((c) => c.classList.remove('is-highlight'));
  card.classList.add('is-highlight');
  card.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  card.focus({ preventScroll: true });

  const gsap = anim();
  if (gsap) {
    gsap.fromTo(card.querySelector('.item__name'), { x: 0 }, {
      x: 6, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut', delay: 0.45, clearProps: 'transform',
    });
  }
  clearTimeout(highlightItem.timer);
  highlightItem.timer = setTimeout(() => card.classList.remove('is-highlight'), 4000);
}

// The assistant respects the active menu filters (e.g. dairy-free).
function quizFilter() {
  return passesFilters;
}

function activeFilterLabels() {
  return formatList([...state.filters].map((key) => t(`filters.${key}`).toLocaleLowerCase(getLang())));
}

function recExtraActions(item) {
  return [el('button', { class: 'btn btn--outline', type: 'button', 'data-add-rec': item.id, text: `+ ${t('quiz.add')}` })];
}

/* ==========================================================================
   Language
   ========================================================================== */

function applyLanguage() {
  document.title = t('meta.title');
  applyStatic();
  renderTableBadge();
  syncThemeButton();
}

function initLanguage() {
  $('#lang-toggle').addEventListener('click', toggleLang);
  onLangChange(() => {
    revealAll();
    applyLanguage();
    renderMenu();
    // re-render an open quiz in the new language without animating
    if ($('#quiz').open) showQuizView(1, { focus: false });
  });
}

/* ==========================================================================
   Boot
   ========================================================================== */

async function loadMenu() {
  const res = await fetch('data/menu.json');
  if (!res.ok) throw new Error(`menu.json: ${res.status}`);
  return res.json();
}

async function boot() {
  initTheme();
  let data;
  try {
    data = await loadMenu();
  } catch (err) {
    console.warn(err);
    $('#menu').replaceChildren(el('p', { class: 'menu__status', role: 'alert', text: 'Menü yüklenemedi. / The menu couldn’t be loaded.' }));
    return;
  }

  state.data = data;
  data.items.forEach((item) => state.itemsById.set(item.id, item));

  initI18n(data.ui);
  applyLanguage();
  renderMenu();
  initTabs();
  initLanguage();
  initQuiz();
  initFilters();
  state.cart = initCart({
    itemsById: state.itemsById, openSheet, closeSheet, initSheet, anim, announce,
  });
  $('#menu').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-add]');
    if (!btn) return;
    state.cart.add(btn.dataset.add);
    const gsap = anim();
    if (gsap) gsap.fromTo(btn, { scale: 0.75 }, { scale: 1, duration: 0.4, ease: 'back.out(3)', clearProps: 'transform' });
  });
  animateEntrance();

  // the menu is rendered after load, so honour a #cat-… hash manually
  const target = location.hash && document.getElementById(location.hash.slice(1));
  if (target) {
    revealAll();
    target.scrollIntoView({ block: 'start' });
  }
}

boot();
