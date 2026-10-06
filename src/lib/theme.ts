// Utilities for dynamic accent color customization

export interface ColorShades {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) {
    return [59, 130, 246]; // Default to blue-500
  }
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function mix(rgb: [number, number, number], target: [number, number, number], factor: number): [number, number, number] {
  return [
    Math.round(rgb[0] + (target[0] - rgb[0]) * factor),
    Math.round(rgb[1] + (target[1] - rgb[1]) * factor),
    Math.round(rgb[2] + (target[2] - rgb[2]) * factor),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map(x => Math.min(255, Math.max(0, x)).toString(16).padStart(2, '0')).join('');
}

export function generateColorPalette(baseHex: string): ColorShades {
  const rgb = hexToRgb(baseHex);
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];

  return {
    50: rgbToHex(mix(rgb, white, 0.93)),
    100: rgbToHex(mix(rgb, white, 0.85)),
    200: rgbToHex(mix(rgb, white, 0.70)),
    300: rgbToHex(mix(rgb, white, 0.50)),
    400: rgbToHex(mix(rgb, white, 0.25)),
    500: rgbToHex(mix(rgb, white, 0.08)),
    600: baseHex,
    700: rgbToHex(mix(rgb, black, 0.15)),
    800: rgbToHex(mix(rgb, black, 0.32)),
    900: rgbToHex(mix(rgb, black, 0.52)),
    950: rgbToHex(mix(rgb, black, 0.72)),
  };
}

export const LOCAL_STORAGE_ACCENT_KEY = 'munago_accent_color';
export const LOCAL_STORAGE_THEME_KEY = 'munago_theme_preference';

export type ThemePreference = 'light' | 'dark' | 'system';

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    // Backward compatibility with legacy 'darkMode' boolean key
    const legacy = localStorage.getItem('darkMode');
    if (legacy !== null) {
      return legacy === 'false' ? 'light' : 'dark';
    }
    return 'dark';
  } catch {
    return 'dark';
  }
}

export function resolveEffectiveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return getSystemTheme();
  }
  return pref;
}

export function applyThemeToDOM(effectiveTheme: 'light' | 'dark') {
  if (typeof window === 'undefined') return;
  try {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
      if (document.body) document.body.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      if (document.body) document.body.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  } catch (err) {
    console.error('Failed to apply theme to DOM:', err);
  }
}

export function getStoredAccentColor(): string {
  try {
    return localStorage.getItem(LOCAL_STORAGE_ACCENT_KEY) || '#3b82f6';
  } catch {
    return '#3b82f6';
  }
}

export function applyAccentColorToDOM(colorHex: string) {
  if (!colorHex || typeof window === 'undefined') return;
  try {
    const root = document.documentElement;
    const shades = generateColorPalette(colorHex);

    // Apply Tailwind v4 --color-blue-* variables so all components automatically update
    root.style.setProperty('--color-blue-50', shades[50]);
    root.style.setProperty('--color-blue-100', shades[100]);
    root.style.setProperty('--color-blue-200', shades[200]);
    root.style.setProperty('--color-blue-300', shades[300]);
    root.style.setProperty('--color-blue-400', shades[400]);
    root.style.setProperty('--color-blue-500', shades[500]);
    root.style.setProperty('--color-blue-600', shades[600]);
    root.style.setProperty('--color-blue-700', shades[700]);
    root.style.setProperty('--color-blue-800', shades[800]);
    root.style.setProperty('--color-blue-900', shades[900]);
    root.style.setProperty('--color-blue-950', shades[950]);

    // Also set generic primary/accent CSS variables
    root.style.setProperty('--accent-color', shades[600]);
    root.style.setProperty('--primary-color', shades[600]);
    root.style.setProperty('--tw-ring-color', shades[500]);

    localStorage.setItem(LOCAL_STORAGE_ACCENT_KEY, colorHex);
  } catch (error) {
    console.error('Failed to apply accent color to DOM:', error);
  }
}
