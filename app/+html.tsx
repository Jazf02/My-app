import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML para la versión Web y PWA de AgroGámez.
 * Configura etiquetas meta, manifest y enlaces para instalación como PWA.
 */
export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>AgroGámez</title>
        <meta
          name="description"
          content="AgroGámez - Sistema Agrícola Offline y Gestión de Nómina"
        />
        <meta name="theme-color" content="#2E7D32" />

        {/* PWA: Manifest y Configuración de Instalación */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AgroGámez" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

