const fs = require('fs');
const path = require('path');

const indexPath = path.resolve(__dirname, '..', 'dist', 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('manifest.webmanifest')) {
    const pwaTags = `    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#2E7D32" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="AgroGámez" />
  </head>`;
    html = html.replace('</head>', pwaTags);
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('✅ [PWA] Etiquetas de manifest e instalación inyectadas en dist/index.html');
  }
}
