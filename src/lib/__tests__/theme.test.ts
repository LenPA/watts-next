import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import {
  THEMES,
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  getStoredTheme,
  setStoredTheme,
  applyTheme
} from '../theme';

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockDoc = {
  documentElement: {
    attrs: {} as Record<string, string>,
    setAttribute(key: string, val: string) {
      this.attrs[key] = val;
    },
    getAttribute(key: string) {
      return this.attrs[key] ?? null;
    },
    removeAttribute(key: string) {
      delete this.attrs[key];
    }
  }
};

describe('Watts Next Theme Engine', () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  beforeAll(() => {
    const storage = new MockStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      writable: true,
      configurable: true
    });
    Object.defineProperty(globalThis, 'document', {
      value: mockDoc,
      writable: true,
      configurable: true
    });
    Object.defineProperty(globalThis, 'window', {
      value: globalThis,
      writable: true,
      configurable: true
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: originalLocalStorage, configurable: true });
    Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true });
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
  });

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('registers both dark-performance and ice-blue-pink themes', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(2);
    
    const darkTheme = THEMES.find(t => t.id === 'dark-performance');
    expect(darkTheme).toBeDefined();
    expect(darkTheme?.mode).toBe('dark');
    expect(darkTheme?.previewColors.background).toBe('#141824');
    expect(darkTheme?.previewColors.primary).toBe('#fc4c02');

    const lightTheme = THEMES.find(t => t.id === 'ice-blue-pink');
    expect(lightTheme).toBeDefined();
    expect(lightTheme?.mode).toBe('light');
    expect(lightTheme?.previewColors.background).toBe('#EAF4FF');
    expect(lightTheme?.previewColors.primary).toBe('#EC4899');
  });

  it('defaults to ice-blue-pink when no theme is saved', () => {
    expect(DEFAULT_THEME_ID).toBe('ice-blue-pink');
    expect(getStoredTheme()).toBe('ice-blue-pink');
  });

  it('persists and retrieves chosen theme from localStorage', () => {
    setStoredTheme('dark-performance');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark-performance');
    expect(getStoredTheme()).toBe('dark-performance');

    setStoredTheme('ice-blue-pink');
    expect(getStoredTheme()).toBe('ice-blue-pink');
  });

  it('falls back to default if stored theme is invalid', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid-non-existent-theme');
    expect(getStoredTheme()).toBe('ice-blue-pink');
  });

  it('applies data-theme attribute on documentElement', () => {
    applyTheme('ice-blue-pink');
    expect(document.documentElement.getAttribute('data-theme')).toBe('ice-blue-pink');

    applyTheme('dark-performance');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark-performance');
  });
});
