# 🚀 Guía de Conexión Supabase para AgroGámez

Cuando estés listo para conectar Supabase y tener sincronización multidispositivo en la nube (conservando tu funcionamiento offline):

---

### Paso 1: Crear tu Proyecto en Supabase
1. Ingresa a [https://supabase.com](https://supabase.com) y regístrate gratis.
2. Pulsa en **"New Project"**.
3. Ingresa:
   - **Name:** `agrogamez`
   - **Database Password:** Guarda una contraseña segura.
   - **Region:** Selecciona una región cercana (ej. US East / US West).
4. Espera 1 a 2 minutos mientras se prepara el proyecto.

---

### Paso 2: Crear las Tablas y Seguridad
1. En el menú izquierdo de Supabase, haz clic en el icono **SQL Editor** (terminal).
2. Haz clic en **"New query"**.
3. Abre el archivo en este proyecto: `supabase/migrations/003_schema_completo.sql`.
4. Copia todo su contenido, pégalo en el editor de Supabase y pulsa **"Run"**.
5. ¡Listo! Todas las tablas, índices y políticas de seguridad RLS quedarán configuradas automáticamente.

---

### Paso 3: Copiar tus Credenciales
1. En Supabase, ve a **Project Settings** (icono de engranaje abajo a la izquierda) > **API**.
2. Copia:
   - **Project URL** (ejemplo: `https://xyzcompany.supabase.co`)
   - **Project API Keys** -> `anon` `public` (empieza con `eyJ...`)

---

### Paso 4: Conectar a Vercel
1. Ingresa a tu panel en [Vercel](https://vercel.com).
2. Selecciona tu proyecto AgroGámez.
3. Ve a **Settings** > **Environment Variables**.
4. Agrega estas 2 variables:
   - `EXPO_PUBLIC_SUPABASE_URL` = tu Project URL copiado
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = tu anon key copiada
5. Haz un nuevo **Redeploy** en Vercel.

---

### 🛡️ ¿Qué pasa si estás sin conexión o en el campo?
- La aplicación está diseñada con arquitectura **Offline-First**.
- Puedes pasar lista, registrar pagos dominicales manuales, cosechas y adelantos **sin internet**.
- Todo se almacena localmente de forma segura en SQLite (móvil) o localStorage (web).
- Tan pronto tu dispositivo tenga conexión, el sistema podrá sincronizar los cambios sin perder información histórica.

