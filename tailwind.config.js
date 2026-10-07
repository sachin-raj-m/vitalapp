/** @type {import('tailwindcss').Config} */

// Clean, cool neutral scale. `gray` and `slate` both point here so every
// existing neutral utility in the app lands on the same palette.
// Text contrast on white: 500 = 5.05:1, 600 = 7.97:1, 900 = 17.8:1.
const neutral = {
  50: '#FAFAFA',
  100: '#F4F4F5',
  200: '#E6E6E9',
  300: '#D2D2D7',
  400: '#A0A0A8',
  500: '#6E6E77',
  600: '#50505A',
  700: '#3D3D45',
  800: '#26262C',
  900: '#16181D',
  950: '#0D0E12',
};

// The brand red: vivid and warm. `red`, `primary` and `error` share it.
// White on 600 = 4.75:1 (AA for all text), white on 700 = 6.43:1.
const blood = {
  50: '#FFF2F2',
  100: '#FFE2E3',
  200: '#FFC9CC',
  300: '#FFA0A6',
  400: '#F96A74',
  500: '#F03A47',
  600: '#E11D2E',
  700: '#BC1424',
  800: '#9B1220',
  900: '#7F131F',
  950: '#450509',
};

// The one supporting accent: a warm blush for highlighted areas.
const blush = {
  50: '#FFF7F7',
  100: '#FFE9EC',
  200: '#FFD5DB',
};

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: neutral,
        slate: neutral,
        red: blood,
        primary: blood,
        blush,
        ink: neutral[900],
        paper: '#FCFCFB',
        success: {
          50: '#EFFAF2',
          100: '#D7F3DF',
          200: '#B0E6C0',
          300: '#7DD29A',
          400: '#45B86F',
          500: '#1F9D55',
          600: '#15803D',
          700: '#136B35',
          800: '#14552D',
          900: '#134627',
        },
        warning: {
          50: '#FFF8EB',
          100: '#FFEDC7',
          200: '#FFD98A',
          300: '#FFC14D',
          400: '#FBA71F',
          500: '#F08C00',
          600: '#B45309',
          700: '#92400E',
          800: '#78350F',
          900: '#5C2A0C',
        },
        error: blood,
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['var(--font-serif)', 'Cormorant', 'Garamond', 'Baskerville', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        beat: {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '80%, 100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        // Lub-dub: two quick swells, then rest. Roughly 70 bpm.
        heartbeat: {
          '0%, 40%, 100%': { transform: 'scale(1)' },
          '10%': { transform: 'scale(1.08)' },
          '20%': { transform: 'scale(1)' },
          '28%': { transform: 'scale(1.05)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        // For SVG paths with pathLength="1" and stroke-dasharray="1".
        draw: {
          from: { strokeDashoffset: '1' },
          to: { strokeDashoffset: '0' },
        },
        // A short bright pulse travelling along a pathLength="1" trace.
        trace: {
          '0%': { strokeDashoffset: '0.15' },
          '60%, 100%': { strokeDashoffset: '-1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        beat: 'beat 1.7s cubic-bezier(0, 0, 0.2, 1) infinite',
        heartbeat: 'heartbeat 1.7s ease-in-out infinite',
        marquee: 'marquee var(--marquee-duration, 40s) linear infinite',
        draw: 'draw 1.4s cubic-bezier(0.65, 0, 0.35, 1) 0.4s both',
        trace: 'trace 2.6s cubic-bezier(0.45, 0, 0.55, 1) 2s infinite',
      },
    },
  },
  plugins: [],
};
