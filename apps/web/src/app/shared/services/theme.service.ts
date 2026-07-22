import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  isDarkMode = signal<boolean>(false);

  constructor() {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = savedTheme === 'dark' || (!savedTheme && prefersDark);
      this.setDarkMode(dark);
    }
  }

  toggleTheme() {
    this.setDarkMode(!this.isDarkMode());
  }

  public setDarkMode(dark: boolean) {
    this.isDarkMode.set(dark);
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      if (dark) {
        root.classList.add('app-dark');
        localStorage.setItem('theme', 'dark');
      } else {
        root.classList.remove('app-dark');
        localStorage.setItem('theme', 'light');
      }
    }
  }
}
