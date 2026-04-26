/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand: terracotta from RIHLA logo ───────────────────────
        rihla: {
          DEFAULT: '#B43E20',  // matches the new logo R
          dark:    '#8A2D17',
          light:   '#D45735',
          50:      '#FCF3F0',
          100:     '#F8DBD3',
          200:     '#F0B0A0',
          600:     '#A23519',
          700:     '#7E2814',
        },
        // ── Moroccan accent palette ─────────────────────────────────
        majorelle: {           // bleu Majorelle (Yves Saint Laurent gardens)
          DEFAULT: '#2C4A7C',
          dark:    '#1F3559',
          light:   '#4A6FA8',
          50:      '#EEF3FB',
        },
        sahara: {              // gold / desert sand
          DEFAULT: '#D4A574',
          dark:    '#A07B4C',
          light:   '#E5C19A',
          50:      '#FAF3E8',
        },
        atlas: {               // mint-green of Moroccan tea
          DEFAULT: '#3A7D5C',
          dark:    '#285A41',
          light:   '#5BA67E',
          50:      '#EAF5EE',
        },
        zellige: '#0E6E6E',    // turquoise-teal of Fes tilework
        henna:   '#7A2E1F',    // deep burgundy / henna stain
        argan:   '#A6794A',    // warm argan-oil ochre
        // ── Existing UI tokens (kept) ───────────────────────────────
        saffron: {
          DEFAULT: '#D68910',
          50:      '#FDF6E6',
          100:     '#FAE6B8',
        },
        sand:      '#E8DCC4',
        cream:     '#F5E6D3',  // matches calligraphy "RIHLA" cream
        ivory:     '#FBF4E5',  // softer cream for backgrounds
        parchment: '#F5EFE3',
        'warm-yellow': '#FBF4E5',
        ink:      '#1A1614',   // warm charcoal (logo bg)
        klein:    '#1628A9',
        graphite: '#2D2B26',
        slate:    '#6B6862',
        fog:      '#9B978F',
        line: {
          DEFAULT: '#D9D3C4',
          soft:    '#EDE7D7',
        },
        teal:   '#0E6E6E',
        indigo: '#1E3A8A',
        bordeaux: {
          DEFAULT: '#C0392B',
          dark:    '#9C2E21',
          50:      '#FDF3F1',
          100:     '#FADBD6',
        },
        royal: {
          DEFAULT: '#2C4A7C',
          50:      '#EEF3FB',
          100:     '#C7D7EC',
        },
        muted: '#6B6862',
        warm:  '#FBF4E5',
      },
      backgroundImage: {
        // 8-pointed star tessellation, low opacity by default
        'zellige':       "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='none' stroke='currentColor' stroke-width='1' stroke-opacity='0.18'%3E%3Cpath d='M40 8l8 24 24 8-24 8-8 24-8-24L8 40l24-8z'/%3E%3Cpath d='M40 0v80M0 40h80M11.7 11.7l56.6 56.6M68.3 11.7l-56.6 56.6'/%3E%3C/g%3E%3C/svg%3E\")",
        'zellige-dense': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill='currentColor' fill-opacity='0.06'%3E%3Cpath d='M20 0l4 12h12l-10 8 4 12-10-8-10 8 4-12-10-8h12z'/%3E%3C/g%3E%3C/svg%3E\")",
        // Berber rug stripe
        'berber-stripe': "linear-gradient(90deg, #B43E20 0 8px, transparent 8px 14px, #D4A574 14px 18px, transparent 18px 28px, #2C4A7C 28px 32px, transparent 32px 40px)",
      },
      fontFamily: {
        serif:   ['Playfair Display', 'Georgia', 'serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      fontSize: {
        'label':   ['0.6875rem', { lineHeight: '1.4', fontWeight: '700', letterSpacing: '0.08em' }],
        'eyebrow': ['0.625rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.1em' }],
      },
      borderRadius: {
        'brand':'10px',
        'card': '14px',
        'pill': '999px',
      },
      boxShadow: {
        'xs':    '0 1px 2px rgba(15,14,13,0.04)',
        'sm':    '0 1px 3px rgba(15,14,13,0.06), 0 1px 2px rgba(15,14,13,0.04)',
        'md':    '0 4px 12px rgba(15,14,13,0.06), 0 2px 4px rgba(15,14,13,0.04)',
        'lg':    '0 12px 32px rgba(15,14,13,0.08), 0 4px 8px rgba(15,14,13,0.05)',
        'xl':    '0 24px 48px rgba(15,14,13,0.10), 0 8px 16px rgba(15,14,13,0.06)',
        'card':  '0 1px 2px rgba(15,14,13,0.04), 0 2px 8px rgba(15,14,13,0.05)',
        'float': '0 12px 32px rgba(15,14,13,0.08), 0 4px 8px rgba(15,14,13,0.05)',
        'glow':  '0 0 0 3px rgba(192,57,43,0.12)',
      },
      animation: {
        'fade-in':     'fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-up':     'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in':    'slide-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in':    'scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'shimmer':     'shimmer 1.8s linear infinite',
      },
      keyframes: {
        'fade-in':     { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up':     { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-right': { from: { opacity: '0', transform: 'translateX(-12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'scale-in':    { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'shimmer':     { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
