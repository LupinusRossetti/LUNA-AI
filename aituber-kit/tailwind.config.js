/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // デフォルトテーマ
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-press': 'var(--color-primary-press)',
        'primary-disabled': 'var(--color-primary-disabled)',
        secondary: 'var(--color-secondary)',
        'secondary-hover': 'var(--color-secondary-hover)',
        'secondary-press': 'var(--color-secondary-press)',
        'secondary-disabled': 'var(--color-secondary-disabled)',
        'text-primary': 'var(--color-text-primary)',
        'base-light': 'var(--color-base-light)',
        'base-dark': 'var(--color-base-dark)',

        // トースト用のより鮮明な色定義
        'toast-info': '#007BFF',
        'toast-info-hover': '#0056B3',
        'toast-error': '#DC3545',
        'toast-error-hover': '#BD2130',
        'toast-success': '#28A745',
        'toast-success-hover': '#218838',
        'toast-tool': '#9C27B0',
        'toast-tool-hover': '#7B1FA2',
      },
      fontFamily: {
        M_PLUS_2: ['Montserrat', 'M_PLUS_2', 'sans-serif'],
        Montserrat: ['Montserrat', 'sans-serif'],
        kei: ['Keifont', 'sans-serif'],
      },
      zIndex: {
        5: '5',
        15: '15',
      },
      width: {
        'col-span-2': '184px',
        'col-span-4': '392px',
        'col-span-7': '704px',
      },
      keyframes: {
        scalePop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-40px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        slideInRight: {
          '0%': { transform: 'translateX(40px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        }
      },
      animation: {
        scalePop: 'scalePop 0.25s ease-out',
        slideInLeft: 'slideInLeft 0.5s ease-out',
        slideInRight: 'slideInRight 0.5s ease-out',
      }
    },
  },
  plugins: [],
}
