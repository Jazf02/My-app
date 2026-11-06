# 🚀 Guía de Despliegue en Vercel — AgroGámez

Esta guía detalla los pasos para desplegar **AgroGámez** en Vercel como aplicación Web y **PWA (Progressive Web App)** instalable.

---

## 1. Variables de Entorno Requeridas en Vercel

En el panel de Vercel (**Project Settings → Environment Variables**), agrega las siguientes variables de entorno:

| Variable | Descripción | Ejemplo / Valor |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL de tu instancia de Supabase | `https://tu-proyecto.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima pública de Supabase | `eyJhbGciOiJIUzI1NiIsInR5c...` |

> ⚠️ **Importante**: Ambas variables deben tener el prefijo `EXPO_PUBLIC_` para que Expo las incluya en el bundle estático del navegador.

---

## 2. Configuración del Proyecto en Vercel

El archivo `vercel.json` ya está configurado en la raíz del proyecto con los parámetros óptimos:

- **Build Command**: `npx expo export -p web`
- **Output Directory**: `dist`
- **Rewrites (SPA)**: Redirige todas las rutas a `/index.html` para evitar errores 404 al recargar páginas.
- **Headers de Aislamiento Cruzado**:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: credentialless`
  *(Requeridos para el funcionamiento del motor SQLite en navegadores web).*

---

## 3. Pasos para Desplegar desde GitHub

1. Sube tu código al repositorio de GitHub:
   ```bash
   git push origin main
   ```
2. Entra a [vercel.com/new](https://vercel.com/new).
3. Selecciona tu repositorio `agrogamez`.
4. En **Framework Preset**, puedes dejar **Other**.
5. Despliega la sección **Environment Variables** y añade:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
6. Haz clic en **Deploy**.

---

## 4. Instalación como PWA (Móvil y Escritorio)

La app incluye:
- `manifest.webmanifest`: Con iconos en 192px y 512px, tema `#2E7D32` y modo `standalone`.
- `sw.js`: Service worker para soporte offline y almacenamiento en caché.

Una vez desplegada en Vercel, cualquier navegador compatible (Chrome, Edge, Safari) mostrará automáticamente el botón o banner de **"Instalar aplicación"** / **"Agregar a la pantalla de inicio"**.

---

## 5. Descarga de APK de Android desde la Web

En la pantalla de acceso (Login), los usuarios en versión web verán un botón destacado:
**🤖 Descargar para Android (.apk)**

Este botón apunta directamente a la URL pública de Supabase Storage:
`https://<TU-PROYECTO>.supabase.co/storage/v1/object/public/apps/agrogamez.apk`

