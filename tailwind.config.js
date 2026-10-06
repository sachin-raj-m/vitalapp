/** @type {import('tailwindcss').Config} */

// Warm neutral scale. `gray` and `slate` both point here so every existing
// neutral utility in the app lands on the same paper/ink palette.
const neutral = {
  50: '#FAF8F5',
  100: '#F3F0EB',
  200: '#E7E2DA',
  300: '#D4CDC2',
  400: '#A9A197',
  500: '#7E776E',
  600: '#5F5951',
  700: '#47423C',
  800: '#2E2A26',
  900: '#1B1815',
  950: '#110F0D',
};

// The one brand colour. `red` and `primary` share it.
const blood = {
  50: '#FDF3F2',
  100: '#FBE4E2',
  200: '#F5C4C0',
  300: '#EC9690',
  400: '#DF5B53',
  500: '#CF2E28',
  600: '#B5161B',
  700: '#941016',
  800: '#740D12',
  900: '#550A0E',
  950: '#310507',
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
        ink: neutral[900],
        paper: neutral[50],
        success: {
          50: '#F1F7F2',
          100: '#DDEDE1',
          200: '#B9DBC2',
          300: '#8CC29C',
          400: '#5BA572',
          500: '#3A8A55',
          600: '#2C6F44',
          700: '#245938',
          800: '#1E472E',
          900: '#183A26',
        },
        warning: {
          50: '#FBF6EC',
          100: '#F5E9CF',
          200: '#EBD29C',
          300: '#DFB566',
          400: '#D29B3D',
          500: '#B97F25',
          600: '#99641D',
          700: '#7A4E1A',
          800: '#5F3D18',
          900: '#4C3115',
        },
        error: blood,
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
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
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        beat: 'beat 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
