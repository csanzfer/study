import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'tai-study:theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>(this.resolveInitialTheme());

  constructor() {
    effect(() => {
      const current = this.mode();
      const root = this.document.documentElement;
      root.classList.toggle('dark', current === 'dark');

      try {
        localStorage.setItem(THEME_STORAGE_KEY, current);
      } catch {
        // Ignore storage errors in restricted environments.
      }
    });
  }

  toggle(): void {
    this.mode.update((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private resolveInitialTheme(): ThemeMode {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // Ignore storage access errors.
    }

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return 'light';
  }
}
