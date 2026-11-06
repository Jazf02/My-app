// ═══════════════════════════════════════════════════════════
// auth/useAuth.ts — Hook para consumir el AuthContext
// ═══════════════════════════════════════════════════════════

import { useContext } from 'react';
import { AuthContext } from './provider';
import type { AuthContextValue } from '@/types';

/**
 * Hook que retorna el contexto de autenticación.
 * Lanza error si se usa fuera del AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error(
      'useAuth debe usarse dentro de <AuthProvider>. ' +
        'Asegúrate de que AuthProvider envuelva tu árbol de componentes.'
    );
  }
  return ctx;
}
