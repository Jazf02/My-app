// ═══════════════════════════════════════════════════════════
// auth/provider.tsx — Context de autenticación Oficial con Correo Electrónico
// Respaldado por Supabase Auth + Verificación + Recuperación de Contraseña
// ═══════════════════════════════════════════════════════════

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Al arrancar, verificar sesión Supabase persistida
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session?.user) {
          setUserEmail(session.user.email || null);
          setIsLoggedIn(true);
        }
      } catch (err: unknown) {
        console.error('[Auth] Error al verificar sesión:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    // Suscripción reactiva a cambios de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        if (session?.user) {
          setUserEmail(session.user.email || null);
          setIsLoggedIn(true);
        } else {
          setUserEmail(null);
          setIsLoggedIn(false);
        }
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  /**
   * Iniciar sesión con Correo Electrónico y Contraseña en Supabase.
   */
  const loginWithEmail = useCallback(async (email: string, pass: string): Promise<void> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pass,
    });
    if (error) {
      throw new Error(error.message || 'Error al iniciar sesión con correo.');
    }
    if (data.user) {
      setUserEmail(data.user.email || null);
      setIsLoggedIn(true);
    }
  }, []);

  /**
   * Registrar nuevo usuario con Correo en Supabase.
   */
  const registerWithEmail = useCallback(
    async (email: string, pass: string): Promise<{ needsEmailConfirmation?: boolean }> => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: pass,
      });
      if (error) {
        throw new Error(error.message || 'Error al registrar usuario.');
      }
      if (data.session?.user) {
        setUserEmail(data.session.user.email || null);
        setIsLoggedIn(true);
        return { needsEmailConfirmation: false };
      }
      return { needsEmailConfirmation: true };
    },
    []
  );

  /**
   * Restablecer contraseña mediante correo de recuperación.
   */
  const resetPassword = useCallback(async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) {
      throw new Error(error.message || 'No se pudo enviar el correo de recuperación.');
    }
  }, []);

  /**
   * Cierra la sesión en Supabase y limpia el estado local.
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setUserEmail(null);
    setIsLoggedIn(false);
  }, []);

  /**
   * Elimina la cuenta y limpia los datos del usuario.
   */
  const deleteAccount = useCallback(async (): Promise<void> => {
    try {
      // Limpiar datos locales y cerrar sesión
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.clear();
      }
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Auth] Error al eliminar cuenta:', err);
    } finally {
      setUserEmail(null);
      setIsLoggedIn(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoggedIn,
      isLoading,
      userEmail,
      loginWithEmail,
      registerWithEmail,
      resetPassword,
      logout,
      deleteAccount,
    }),
    [isLoggedIn, isLoading, userEmail, loginWithEmail, registerWithEmail, resetPassword, logout, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
