import { Platform } from 'react-native';
import { esComputadoraWeb } from '../lib/dispositivo';

describe('lib/dispositivo - esComputadoraWeb', () => {
  const originalWindow = (globalThis as any).window;

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it('devuelve false si no hay window', () => {
    delete (globalThis as any).window;
    expect(esComputadoraWeb()).toBe(false);
  });

  it('devuelve false si el User-Agent es iPhone', () => {
    (globalThis as any).window = {
      navigator: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        maxTouchPoints: 5,
      },
      matchMedia: () => ({ matches: false } as any),
      innerWidth: 390,
    };
    expect(esComputadoraWeb()).toBe(false);
  });

  it('devuelve false si el User-Agent es Android', () => {
    (globalThis as any).window = {
      navigator: {
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S901B)',
        maxTouchPoints: 5,
      },
      matchMedia: () => ({ matches: false } as any),
      innerWidth: 412,
    };
    expect(esComputadoraWeb()).toBe(false);
  });

  it('devuelve false si está en modo standalone (PWA agregada a pantalla de inicio)', () => {
    (globalThis as any).window = {
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        standalone: true,
      },
      matchMedia: (query: string) => ({ matches: query.includes('standalone') } as any),
      innerWidth: 1200,
    };
    expect(esComputadoraWeb()).toBe(false);
  });

  it('devuelve true en una computadora de escritorio con pantalla ancha', () => {
    const originalOS = Platform.OS;
    // @ts-ignore
    Platform.OS = 'web';
    (globalThis as any).window = {
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        maxTouchPoints: 0,
      },
      matchMedia: () => ({ matches: false } as any),
      innerWidth: 1440,
    };
    try {
      expect(esComputadoraWeb()).toBe(true);
    } finally {
      // @ts-ignore
      Platform.OS = originalOS;
    }
  });
});
