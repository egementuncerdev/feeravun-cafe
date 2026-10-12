// Light/dark theme: follows the system until the user picks one manually.
// The saved choice is applied before first paint by an inline script in <head>.

import { t } from './i18n.js';

const THEME_KEY = 'feeravun-theme';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function currentTheme() {
  const forced = document.documentElement.getAttribute('data-theme');
  if (forced === 'light' || forced === 'dark') return forced;
  return darkQuery.matches ? 'dark' : 'light';
}

export function syncThemeButton(btn = document.getElementById('theme-toggle')) {
  if (!btn) return;
  const mode = currentTheme();
  btn.dataset.mode = mode;
  btn.setAttribute('aria-label', t(mode === 'dark' ? 'theme.toLight' : 'theme.toDark'));
}

export function initTheme(btn = document.getElementById('theme-toggle')) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable: theme still applies for this visit */
    }
    syncThemeButton(btn);
  });
  darkQuery.addEventListener('change', () => syncThemeButton(btn));
  syncThemeButton(btn);
}
