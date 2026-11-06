import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // Polyfill de Alert para Web
  Alert.alert = (title: string, message?: string, buttons?: any[]) => {
    const fullMessage = [title, message].filter(Boolean).join('\n\n');

    if (!buttons || buttons.length <= 1) {
      window.alert(fullMessage);
      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
      return;
    }

    const confirmed = window.confirm(fullMessage);
    if (confirmed) {
      const confirmButton =
        buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
      confirmButton?.onPress?.();
    } else {
      const cancelButton = buttons.find((b) => b.style === 'cancel');
      cancelButton?.onPress?.();
    }
  };

  // Inyección de etiquetas PWA en el <head> para navegadores web
  if (typeof document !== 'undefined') {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.webmanifest';
      document.head.appendChild(manifestLink);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      themeMeta.content = '#2E7D32';
      document.head.appendChild(themeMeta);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const appleTouch = document.createElement('link');
      appleTouch.rel = 'apple-touch-icon';
      appleTouch.href = '/icons/icon-192.png';
      document.head.appendChild(appleTouch);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const capableMeta = document.createElement('meta');
      capableMeta.name = 'apple-mobile-web-app-capable';
      capableMeta.content = 'yes';
      document.head.appendChild(capableMeta);
    }
  }

  // Registro de Service Worker para PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado correctamente:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Error al registrar Service Worker:', err);
        });
    });
  }
}

