/**
 * Application Color System
 * Matches Tailwind theme with dark mode support
 */
export const COLORS = {
  // Brand Colors
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // Primary green
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  secondary: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6', // Secondary teal
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },
  // Status Colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  // Neutral Colors
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

/**
 * Text Color Classes (Tailwind)
 * Supports light and dark modes
 */
export const TEXT_COLORS = {
  primary: 'text-primary-600 dark:text-primary-400',
  secondary: 'text-secondary-600 dark:text-secondary-400',
  default: 'text-dark-900 dark:text-white',
  dark: 'text-dark-900 dark:text-white',
  danger: 'text-red-600 dark:text-red-400',
  muted: 'text-dark-600 dark:text-dark-300',
  subtle: 'text-dark-500 dark:text-dark-400',
  disabled: 'text-dark-400 dark:text-dark-500',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
  white: 'text-white',
  black: 'text-black',
};

/**
 * Font Size Classes (Tailwind)
 */
export const FONT_SIZES = {
  xs: 'text-xs',      // 12px
  sm: 'text-sm',      // 14px
  md: 'text-md',      // 16px
  base: 'text-base',  // 16px
  lg: 'text-lg',      // 18px
  xl: 'text-xl',      // 20px
  '2xl': 'text-2xl',  // 24px
  '3xl': 'text-3xl',  // 30px
  '4xl': 'text-4xl',  // 36px
  '5xl': 'text-5xl',  // 48px
};

/**
 * Font Weight Classes (Tailwind)
 */
export const FONT_WEIGHTS = {
  thin: 'font-thin',           // 100
  extralight: 'font-extralight', // 200
  light: 'font-light',         // 300
  normal: 'font-normal',       // 400
  medium: 'font-medium',       // 500
  semibold: 'font-semibold',   // 600
  bold: 'font-bold',           // 700
  extrabold: 'font-extrabold', // 800
  black: 'font-black',         // 900
};

/**
 * Border Radius Classes (Tailwind)
 */
export const RADIUS = {
  none: 'rounded-none',     // 0px
  sm: 'rounded-sm',         // 2px
  base: 'rounded',          // 4px
  md: 'rounded-md',         // 6px
  lg: 'rounded-lg',         // 8px
  xl: 'rounded-xl',         // 12px
  '2xl': 'rounded-2xl',     // 16px
  '3xl': 'rounded-3xl',     // 24px
  full: 'rounded-full',     // 9999px
};

/**
 * Spacing Scale (Tailwind)
 */
export const SPACING = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
};

/**
 * Z-Index Scale
 */
export const Z_INDEX = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
};