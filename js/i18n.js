// i18n: all copy lives in data/menu.json ("ui" for interface strings,
// {tr, en} objects for menu content). This module only picks the language,
// remembers it and fills in placeholders.

const STORAGE_KEY = 'feeravun-lang';
const SUPPORTED = ['tr', 'en'];
const FALLBACK = 'tr';

let dict = {};
let lang = FALLBACK;
const listeners = new Set();

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* private mode / blocked storage: the choice just won't persist */
  }
}

function detect() {
  const stored = readStored();
  if (SUPPORTED.includes(stored)) return stored;
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('tr') ? 'tr' : nav ? 'en' : FALLBACK;
}

export function initI18n(uiStrings) {
  dict = uiStrings || {};
  lang = detect();
  document.documentElement.lang = lang;
  return lang;
}

export const getLang = () => lang;

export function setLang(next) {
  if (!SUPPORTED.includes(next) || next === lang) return;
  lang = next;
  writeStored(next);
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn(next));
}

export const toggleLang = () => setLang(lang === 'tr' ? 'en' : 'tr');

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Interface string by key, with {placeholder} substitution. */
export function t(key, vars = {}) {
  const str = dict[lang]?.[key] ?? dict[FALLBACK]?.[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

/** Localised value from a {tr, en} object. */
export function loc(obj) {
  if (obj == null || typeof obj === 'string') return obj ?? '';
  return obj[lang] ?? obj[FALLBACK] ?? '';
}

const locale = () => (lang === 'tr' ? 'tr-TR' : 'en-GB');

/** 150 -> "150", 37.5 -> "37,50" (tr) / "37.50" (en) */
export function formatAmount(value) {
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return value.toLocaleString(locale(), {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** 150 -> "150 ₺" */
export const formatPrice = (value) => `${formatAmount(value)} ₺`;

/** ["a","b","c"] -> "a, b ve c" / "a, b and c" */
export function formatList(parts) {
  try {
    return new Intl.ListFormat(locale(), { style: 'long', type: 'conjunction' }).format(parts);
  } catch {
    return parts.join(', ');
  }
}

export function capitalize(str) {
  return str ? str.charAt(0).toLocaleUpperCase(locale()) + str.slice(1) : str;
}

/**
 * Fill static markup: data-i18n (text), data-i18n-aria (aria-label),
 * data-i18n-content (meta content). Use data-i18n-vars='{"k":"v"}' for placeholders.
 */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n], [data-i18n-aria], [data-i18n-content]').forEach((el) => {
    let vars = {};
    if (el.dataset.i18nVars) {
      try {
        vars = JSON.parse(el.dataset.i18nVars);
      } catch {
        /* ignore malformed vars */
      }
    }
    if (el.dataset.i18n) el.textContent = t(el.dataset.i18n, vars);
    if (el.dataset.i18nAria) el.setAttribute('aria-label', t(el.dataset.i18nAria, vars));
    if (el.dataset.i18nContent) el.setAttribute('content', t(el.dataset.i18nContent, vars));
  });
}
