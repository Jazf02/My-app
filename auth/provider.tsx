// ═══════════════════════════════════════════════════════════
// auth/provider.tsx — Context de autenticación LOCAL (PIN)
// 100% offline-first. Sin Supabase, sin internet.
// ═══════════════════════════════════════════════════════════

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  tienePin,
  guardarPin,
  verificarPin,
  getSessionActive,
  setSessionActive,
} from './localAuth';
import type { AuthContextValue } from '@/types';

// ─── Contexto ────────────────────────────────────────────────
export const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────
interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);

  // Al arrancar, verificar si ya hay un PIN configurado
  useEffect(() => {
    (async () => {
      try {
        const pinExiste = await tienePin();
        setHasPin(pinExiste);
        // Si la sesión estaba activa en memoria (reinicio en caliente)
        if (getSessionActive()) {
          setIsLoggedIn(true);
        }
      } catch (err: unknown) {
        console.error('[Auth] Error al inicializar:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  /**
   * Verifica el PIN e inicia la sesión.
   * Lanza Error si el PIN es incorrecto.
   */
  const login = useCallback(async (pin: string): Promise<void> => {
    const ok = await verificarPin(pin);
    if (!ok) {
      throw new Error('PIN incorrecto. Intenta de nuevo.');
    }
    setSessionActive(true);
    setIsLoggedIn(true);
  }, []);

  /**
   * Crea el PIN por primera vez (onboarding).
   */
  const setupPin = useCallback(async (pin: string): Promise<void> => {
    await guardarPin(pin);
    setHasPin(true);
    setSessionActive(true);
    setIsLoggedIn(true);
  }, []);

  /**
   * Cierra la sesión. El usuario deberá ingresar el PIN de nuevo.
   */
  const logout = useCallback((): void => {
    setSessionActive(false);
    setIsLoggedIn(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isLoggedIn, isLoading, hasPin, login, setupPin, logout }),
    [isLoggedIn, isLoading, hasPin, login, setupPin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
