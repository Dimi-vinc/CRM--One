/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette: mint sidebar, coral/orange accent, card edge colors
        mint: {
          50: '#f0fdf6',
          100: '#dcfce9',
          200: '#bbf7d3',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        coral: {
          50: '#fff5f0',
          100: '#ffe8da',
          200: '#ffcfb5',
          300: '#ffac7f',
          400: '#ff7e3f',
          500: '#fb5d1f',
          600: '#ec4a0c',
          700: '#c43a09',
          800: '#9c3110',
          900: '#7e2c11',
        },
        tealx: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
        violetx: {
          50: '#f5f3ff',
          100: '#ede9fe',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        cardHover: '0 8px 24px rgba(16,24,40,0.08)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [],
};
