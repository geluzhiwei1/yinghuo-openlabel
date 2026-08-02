import {
  defineConfig,
  presetUno,
  presetAttributify,
  presetIcons,
  presetTypography,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

// Lab design system — UnoCSS config
//
// design.md uses atomic classes (bg-cream, text-ink, rounded-full, etc.).
// This config wires those names to our lab palette so new Paper components
// and any future Vue template can use them directly without scoped SCSS.
//
// The project also has hand-written utilities in src/styles/utilities.scss
// under the .y-* namespace — those coexist with UnoCSS classes.

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    presetTypography(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  theme: {
    colors: {
      // Lab palette — design.md §1
      paper: 'var(--lab-paper)',
      cream: 'var(--lab-cream)',
      snow: 'var(--lab-snow)',
      ink: {
        DEFAULT: 'var(--lab-ink)',
        graphite: 'var(--lab-graphite)',
      },
      graphite: 'var(--lab-graphite)',
      slate: 'var(--lab-slate)',
      ash: 'var(--lab-ash)',
      fog: 'var(--lab-fog)',
      line: 'var(--lab-line)',
      hairline: 'var(--lab-hairline)',
      lime: {
        DEFAULT: 'var(--lab-lime)',
        ink: 'var(--lab-lime-ink)',
      },
      coral: 'var(--lab-coral)',
      sky: 'var(--lab-sky)',
      lilac: 'var(--lab-lilac)',
      mint: 'var(--lab-mint)',
      butter: 'var(--lab-butter)',
    },
    fontFamily: {
      display: 'var(--y-font-family-display)',
      sans: 'var(--y-font-family-base)',
      mono: 'var(--y-font-family-mono)',
    },
    borderRadius: {
      pill: 'var(--lab-radius-pill)',
      '3xl': 'var(--lab-radius-3xl)',
      '2xl': 'var(--lab-radius-2xl)',
      xl: 'var(--lab-radius-xl)',
    },
    boxShadow: {
      soft: 'var(--lab-shadow-soft)',
      lift: 'var(--lab-shadow-lift)',
      pop: 'var(--lab-shadow-pop)',
      glow: 'var(--lab-shadow-lime-glow)',
    },
  },
  shortcuts: {
    // Button variants — used by PaperButton and any ad-hoc button
    'lab-btn-base': 'inline-flex items-center justify-center gap-2 font-sans font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none',
    'lab-btn-primary': 'lab-btn-base h-10 px-4 rounded-full bg-ink text-white hover:bg-[#2a2a2e] active:bg-black',
    'lab-btn-secondary': 'lab-btn-base h-9 px-4 rounded-full bg-cream text-slate hover:bg-line',
    'lab-btn-danger': 'lab-btn-base h-9 px-4 rounded-full bg-coral text-white',
    'lab-btn-ghost': 'lab-btn-base h-9 w-9 rounded-full text-slate hover:bg-cream',

    // Card
    'lab-card': 'rounded-3xl bg-snow shadow-soft',
    'lab-card-flat': 'rounded-2xl bg-cream',

    // Inputs
    'lab-input': 'h-10 px-3.5 rounded-full bg-cream border border-transparent text-ink placeholder:text-ash focus:outline-none focus:border-ink transition-colors',

    // Badges
    'lab-badge-base': 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-medium leading-none',
    'lab-badge-sky': 'lab-badge-base bg-sky text-[#1e3a5f]',
    'lab-badge-lilac': 'lab-badge-base bg-lilac text-[#3d2a6b]',
    'lab-badge-mint': 'lab-badge-base bg-mint text-[#1f4a2e]',
    'lab-badge-butter': 'lab-badge-base bg-butter text-[#6b4a16]',
    'lab-badge-ink': 'lab-badge-base bg-ink text-white',
    'lab-badge-coral': 'lab-badge-base bg-coral text-white',
    'lab-badge-ash': 'lab-badge-base bg-cream text-slate',

    // Mono label
    'lab-mono-label': 'font-mono text-[10px] tracking-[0.2em] uppercase text-ash',

    // Hero title
    'lab-hero': 'font-display italic text-[54px] leading-none tracking-tight text-ink',
  },
  safelist: [
    // Animations
    'lab-animate-blink',
    'lab-animate-marquee',
    'lab-animate-sweep',
    'lab-animate-float',
  ],
})
