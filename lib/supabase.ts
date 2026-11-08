// ═══════════════════════════════════════════════════════════
// lib/supabase.ts — Cliente Supabase configurado
// Solo Auth + Storage. NO sync en tiempo real.
// ═══════════════════════════════════════════════════════════

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Variables de entorno con credenciales oficiales como respaldo seguro
const SUPABASE_URL =
  process.env['EXPO_PUBLIC_SUPABASE_URL'] &&
  !process.env['EXPO_PUBLIC_SUPABASE_URL'].includes('placeholder')
    ? process.env['EXPO_PUBLIC_SUPABASE_URL']
    : 'https://xsmzhzabgonzjgxakktt.supabase.co';

const SUPABASE_ANON_KEY =
  process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] &&
  !process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'].includes('placeholder')
    ? process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY']
    : 'sb_publishable_2QbpK1fVSnf8sIqfnZdWIA_msYfw-PF';

if (!process.env['EXPO_PUBLIC_SUPABASE_URL']) {
  console.warn(
    '[Supabase] EXPO_PUBLIC_SUPABASE_URL no definida. Usando URL temporal. Configura .env para conectar tu cuenta real.'
  );
}

/**
 * Cliente Supabase singleton.
 * - Auth: email + password
 * - Storage: backup de la BD SQLite
 * - NO realtime (desactivado para reducir recursos)
 * - Token guardado en AsyncStorage (no la contraseña)
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persistir sesión en AsyncStorage (token de sesión, NO la contraseña)
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    // Desactivar realtime — no se usa en esta app
    params: {
      eventsPerSecond: 0,
    },
  },
});
