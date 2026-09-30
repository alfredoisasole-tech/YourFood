/** @type {import('tailwindcss').Config} */

/** Couleur définie par une variable CSS (canaux RVB) : compatible avec l'opacité Tailwind (bg-ink/10) */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Variante dark: active quand <html data-theme="dark"> (interrupteur Mode sombre)
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        page: token('page'),
        surface: token('surface'),
        card: token('card'),
        ink: token('ink'),
        'ink-soft': token('ink-soft'),
        muted: token('muted'),
        line: token('line'),
        accent: token('accent'),
        'accent-strong': token('accent-strong'),
        'accent-bright': token('accent-bright'),
        'on-accent': token('on-accent'),
        field: token('field'),
        'field-focus': token('field-focus'),
        'field-ink': token('field-ink'),
        'nav-pill': token('nav-pill'),
        'nav-ink': token('nav-ink'),
        peach: token('peach'),
        'peach-ink': token('peach-ink'),
        danger: token('danger'),
        warn: token('warn'),
        star: token('star'),
        // Carte « Livraisons » : verte dans les deux modes (maquette)
        forest: '#1F7A4D',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(var(--c-shadow) / 0.04), 0 10px 28px rgb(var(--c-shadow) / 0.06)',
        nav: '0 0 0 1px rgb(var(--c-line) / 0.06), 0 14px 34px rgb(var(--c-shadow) / 0.12)',
        sheet: '0 -20px 60px rgb(0 0 0 / 0.18)',
        fab: '0 6px 16px rgb(var(--c-accent) / 0.35)',
      },
      borderRadius: {
        '4xl': '28px',
        '5xl': '36px',
      },
    },
  },
  plugins: [],
};
