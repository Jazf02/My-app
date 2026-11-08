// ═══════════════════════════════════════════════════════════
// auth/provider.tsx — Context de autenticación HÍBRIDO (PIN local + Supabase Cloud)
// 100% offline-first con opción de sincronizar y acceder desde cualquier dispositivo
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
import { supabase } from '@/lib/supabase';
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
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Al arrancar, verificar sesión Supabase y PIN local
  useEffect(() => {
    (async () => {
      try {
        const pinExiste = await tienePin();
        setHasPin(pinExiste);

        // Verificar si hay sesión activa en Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserEmail(session.user.email || null);
          setSessionActive(true);
          setIsLoggedIn(true);
          return;
        }

        // Si no hay Supabase o estamos offline, verificar memoria local
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
   * Verifica el PIN local e inicia la sesión.
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
   * Iniciar sesión con Correo Electrónico en Supabase (Multi-dispositivo).
   */
  const loginWithEmail = useCallback(async (email: string, pass: string): Promise<void> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (error) {
      throw new Error(error.message || 'Error al iniciar sesión con correo.');
    }
    if (data.user) {
      setUserEmail(data.user.email || null);
      setSessionActive(true);
      setIsLoggedIn(true);
    }
  }, []);

  /**
   * Registrar nuevo usuario con Correo en Supabase.
   */
  const registerWithEmail = useCallback(async (email: string, pass: string): Promise<void> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
    });
    if (error) {
      throw new Error(error.message || 'Error al registrar usuario.');
    }
    if (data.user) {
      setUserEmail(data.user.email || null);
      setSessionActive(true);
      setIsLoggedIn(true);
    }
  }, []);

  /**
   * Crea el PIN por primera vez (onboarding local).
   */
  const setupPin = useCallback(async (pin: string): Promise<void> => {
    await guardarPin(pin);
    setHasPin(true);
    setSessionActive(true);
    setIsLoggedIn(true);
  }, []);

  /**
   * Cierra la sesión (local y en Supabase).
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setUserEmail(null);
    setSessionActive(false);
    setIsLoggedIn(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoggedIn,
      isLoading,
      hasPin,
      userEmail,
      login,
      loginWithEmail,
      registerWithEmail,
      setupPin,
      logout,
    }),
    [isLoggedIn, isLoading, hasPin, userEmail, login, loginWithEmail, registerWithEmail, setupPin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
