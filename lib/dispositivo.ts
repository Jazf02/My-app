// ═══════════════════════════════════════════════════════════
// lib/dispositivo.ts — Detección precisa de entorno y dispositivo
// Diferencia computadora de escritorio vs móvil/PWA instalada
// ═══════════════════════════════════════════════════════════

import { Platform, Dimensions } from 'react-native';

/**
 * Determina si la aplicación está ejecutándose en una computadora de escritorio o laptop.
 * Devuelve FALSE en:
 * - Teléfonos iPhone o Android (navegador móvil)
 * - iPads o tablets
 * - Aplicación instalada en pantalla de inicio de iOS (PWA standalone)
 * - Aplicación instalada en Android (PWA standalone o APK nativo)
 * - Cualquier dispositivo móvil nativo
 */
export function esComputadoraWeb(): boolean {
  // Si no es Web (es APK de Android nativo o iOS nativo), no es computadora
  if (Platform.OS !== 'web') {
    return false;
  }

  // Comprobación de entorno de navegador seguro
  if (typeof window === 'undefined' || !window.navigator) {
    return false;
  }

  // 1. Si está instalada como PWA en pantalla de inicio (iOS o Android)
  const esStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    (window.matchMedia('(display-mode: fullscreen)').matches) ||
    (window.matchMedia('(display-mode: minimal-ui)').matches);

  if (esStandalone) {
    return false; // Es una app instalada en el dispositivo
  }

  // 2. Detección de móviles y tablets por User-Agent
  const ua = window.navigator.userAgent.toLowerCase();
  const esMovilPorUA =
    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|silk|kindle/i.test(ua);

  if (esMovilPorUA) {
    return false;
  }

  // 3. Detección de iPads con iOS 13+ (que reportan Macintosh pero tienen pantalla táctil)
  const esIPad =
    /macintosh/i.test(ua) &&
    Boolean(window.navigator.maxTouchPoints && window.navigator.maxTouchPoints > 2);

  if (esIPad) {
    return false;
  }

  // 4. Ancho de pantalla (pantallas de celular típicas son < 768px)
  try {
    const ancho =
      typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth > 0
        ? window.innerWidth
        : Dimensions.get('window').width;

    if (ancho && ancho < 768) {
      return false;
    }
  } catch {
    // Continuar si falla Dimensions
  }

  // Es una computadora de escritorio o laptop en navegador web
  return true;
}
