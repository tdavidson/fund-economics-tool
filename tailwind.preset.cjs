/**
 * Tailwind preset for @hemrock/fund-economics-ui.
 *
 * Consumers: add this to their tailwind.config.js to get the design tokens
 * the UI components expect (border, foreground/muted-foreground, background,
 * muted, accent, destructive). Tokens are wired through CSS variables so
 * consumers can override them for light/dark themes.
 *
 * Usage (consumer's tailwind.config.js):
 *   module.exports = {
 *     presets: [require('@hemrock/fund-economics-ui/tailwind.preset')],
 *     content: ['./src/**\/*.{ts,tsx}', './node_modules/@hemrock/fund-economics-ui/dist/**\/*.js'],
 *   };
 *
 * Usage (consumer's global CSS, e.g. app/globals.css):
 *   @import '@hemrock/fund-economics-ui/tokens.css';
 *   (or paste the :root block manually — see tokens.css)
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      borderRadius: {
        sm: 'var(--radius, 0.125rem)',
        md: 'var(--radius, 0.125rem)',
        lg: 'var(--radius, 0.125rem)',
      },
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
      },
    },
  },
};
