// O DESIGN SYSTEM do motor (dono, 2026-10-23): cores em variável CSS, escala de fonte, alturas e
// breakpoints por dispositivo. As variáveis que ele usa são definidas em src/styles/index.css, que é
// também a entrada do Tailwind (`@config` aponta para cá). Mora no Core porque é o Core que o define;
// até 2026-10-23 morava no App do ERP, e o CSS do Core apontava para o SaaS.
//
// `content` lista só o fonte do Core. As classes do SaaS entram pela detecção automática do
// Tailwind v4 (a partir da raiz do projeto Vite do SaaS) — a plataforma não conhece SaaS nenhum.
//
// Sem `import 'tailwindcss/plugin'`: o Tailwind é dependência do SaaS, não do Core, e o import
// resolveria a partir DESTA pasta. Um plugin é só uma função que recebe a API.

// Responsive breakpoints are gated by DEVICE, not viewport width.
// `data-device` is set on <html> at startup by initDeviceDetection() (UA-based) and
// the page reloads on device change. A phone stays "mobile" in any orientation, so a
// phone rotated to landscape (e.g. 740px wide) must NOT flip to the desktop layout.
// Each sm:/md:/lg:/xl:/2xl: utility therefore requires BOTH its min-width AND
// html[data-device="desktop"]; on a mobile device every breakpoint collapses to the
// base (mobile-first) styles regardless of width. :where() keeps zero specificity so
// the generated utilities behave exactly as the stock media-only variants on desktop.
const DEVICE_BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    // Disable the stock media-only responsive variants; redefined as device-gated below.
    screens: {},
    extend: {
      colors: {
        // Brand Colors (using CSS variables with HSL for alpha support)
        brand: {
          primary: 'hsl(var(--brand-primary) / <alpha-value>)',
          'primary-light': 'hsl(var(--brand-primary-light) / <alpha-value>)',
          'primary-dark': 'hsl(var(--brand-primary-dark) / <alpha-value>)',
          background: 'hsl(var(--brand-background) / <alpha-value>)',
          surface: 'hsl(var(--brand-surface) / <alpha-value>)',
          'text-primary': 'hsl(var(--text-primary) / <alpha-value>)',
          'text-secondary': 'hsl(var(--text-secondary) / <alpha-value>)',
          'text-muted': 'hsl(var(--text-muted) / <alpha-value>)',
        },
        // Border colors
        border: {
          DEFAULT: 'hsl(var(--border-color) / <alpha-value>)',
          light: 'hsl(var(--border-light) / <alpha-value>)',
        },
        // Semantic status colors
        danger: {
          DEFAULT: 'hsl(var(--danger) / <alpha-value>)',
          bg: 'hsl(var(--danger-bg) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          bg: 'hsl(var(--success-bg) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          bg: 'hsl(var(--warning-bg) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          bg: 'hsl(var(--info-bg) / <alpha-value>)',
        },
        // Interactive states
        hover: 'hsl(var(--hover) / <alpha-value>)',
        active: 'hsl(var(--active) / <alpha-value>)',
        'muted-bg': 'hsl(var(--muted-bg) / <alpha-value>)',
        // Legacy aliases (for backward compatibility during migration)
        background: 'hsl(var(--brand-background) / <alpha-value>)',
        surface: 'hsl(var(--brand-surface) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--brand-primary) / <alpha-value>)',
          light: 'hsl(var(--brand-primary-light) / <alpha-value>)',
          dark: 'hsl(var(--brand-primary-dark) / <alpha-value>)',
        },
        text: {
          primary: 'hsl(var(--text-primary) / <alpha-value>)',
          secondary: 'hsl(var(--text-secondary) / <alpha-value>)',
          muted: 'hsl(var(--text-muted) / <alpha-value>)',
        }
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'ui': ['var(--ui-font-size)', { lineHeight: '1.5' }],
        'ui-sm': ['var(--ui-font-size-sm)', { lineHeight: '1.4' }],
        'ui-xs': ['var(--ui-font-size-xs)', { lineHeight: '1.3' }],
      },
      spacing: {
        'row': 'var(--row-height)',
        'header': 'var(--header-height)',
      },
      height: {
        'header': 'var(--header-height)',
        'row': 'var(--row-height)',
        'editor': 'var(--editor-height)',
      },
      maxHeight: {
        'row': 'var(--row-height)',
      },
      minHeight: {
        'row': 'var(--row-height)',
        'editor': 'var(--editor-height)',
        'touch': 'var(--touch-target-min)',
      },
      minWidth: {
        'touch': 'var(--touch-target-min)',
      },
      padding: {
        'header': 'var(--header-height)',
        'row': 'var(--row-height)',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      for (const [name, min] of Object.entries(DEVICE_BREAKPOINTS))
        addVariant(name, `@media (min-width: ${min}px) { :where(html[data-device="desktop"]) & }`);
    },
  ],
}
