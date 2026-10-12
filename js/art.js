// Hand-drawn style line illustrations for categories (stroke = currentColor).
// Keys match `categories[].art` in data/menu.json.

const wrap = (body) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ART = {
  // cup on a saucer with steam
  cup: wrap(`
    <path d="M11 21h21v8.5A9.5 9.5 0 0 1 22.5 39h-2A9.5 9.5 0 0 1 11 29.5V21Z"/>
    <path d="M32 24h2.5a4.25 4.25 0 0 1 0 8.5H31"/>
    <path d="M7 42.5h30"/>
    <path d="M17.5 8.5c-2 2.4 2 4.6 0 7.5M24.5 8.5c-2 2.4 2 4.6 0 7.5"/>`),

  // tall iced glass with straw and cubes
  iced: wrap(`
    <path d="M13 13h22l-3.2 29H16.2L13 13Z"/>
    <path d="M27.5 13 31 4.5h4.5"/>
    <path d="M14.6 27.5h18.8"/>
    <rect x="17.5" y="17" width="6" height="6" rx="1.2" transform="rotate(-12 20.5 20)"/>
    <rect x="24.5" y="20.5" width="6" height="6" rx="1.2" transform="rotate(10 27.5 23.5)"/>`),

  // teapot
  teapot: wrap(`
    <path d="M13 23h22v4a11 11 0 0 1-11 11 11 11 0 0 1-11-11v-4Z"/>
    <path d="M35 25.5h2a4.5 4.5 0 0 1 0 9h-3.6"/>
    <path d="M13 27 6.5 21.5l.8 6.3c.6 3.9 3.4 6.7 7 7.2"/>
    <path d="M16.5 23v-1.2c0-2.4 3.4-4.3 7.5-4.3s7.5 1.9 7.5 4.3V23"/>
    <path d="M24 13.5v4"/>
    <path d="M14 42.5h20"/>`),

  // slice of layered cake with a cherry
  cake: wrap(`
    <path d="M6.5 41V31.5L40 21v20H6.5Z"/>
    <path d="M6.5 36.2 40 28"/>
    <path d="M6.5 31.5C14 30 18 26 22 26.5"/>
    <circle cx="35" cy="17" r="2.6"/>
    <path d="M35.5 14.4c.2-2.4 1.4-4 3.6-5"/>`),

  // slice of toast
  toast: wrap(`
    <path d="M12 41V22.5c-3.2-.8-5-3.2-5-6C7 11.8 11 8 17 8h14c6 0 10 3.8 10 8.5 0 2.8-1.8 5.2-5 6V41H12Z"/>
    <path d="M16.5 37V21.3c-2-.6-3-2-3-3.6 0-2.8 2.7-5 6.5-5h8c3.8 0 6.5 2.2 6.5 5 0 1.6-1 3-3 3.6V37h-15Z" stroke-dasharray="1.5 3"/>`),
};

export const art = (key) => ART[key] || '';

/** Small coffee-bean glyph used for caffeine level. */
export const BEAN = '<svg viewBox="0 0 10 12" aria-hidden="true" focusable="false"><ellipse cx="5" cy="6" rx="4" ry="5.2" transform="rotate(18 5 6)"/><path d="M3.6 1.6c2.4 2.4-.6 6.4 2.8 8.8" fill="none"/></svg>';

/** 4-point sparkle for the assistant. */
export const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2c.6 4.9 2.6 8.4 10 10-7.4 1.6-9.4 5.1-10 10-.6-4.9-2.6-8.4-10-10 7.4-1.6 9.4-5.1 10-10Z" fill="currentColor"/></svg>';
