import { useState } from 'react';

export type Theme = 'light' | 'dark' | 'auto';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'auto';
    return (localStorage.getItem('theme') as Theme) ?? 'auto';
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (t === 'auto') {
      root.removeAttribute('data-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(t);
      root.setAttribute('data-theme', t);
    }
  };

  return { theme, setTheme };
}
