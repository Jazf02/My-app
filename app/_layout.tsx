// ═══════════════════════════════════════════════════════════
// app/_layout.tsx — Layout raíz con AuthProvider + ErrorBoundary
// ═══════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import '@/lib/webPolyfill';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { AuthProvider } from '@/auth/provider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/auth/useAuth';
import { initTables } from '@/database/local';
import { iniciarSyncEnSegundoPlano, detenerSyncEnSegundoPlano, ejecutarSincronizacion } from '@/sync/syncEngine';

// ─── Guard de rutas según sesión ─────────────────────────────
function RouteGuard(): null {
  const { isLoggedIn, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Control del ciclo de vida del Sync Engine según sesión
  useEffect(() => {
    if (isLoggedIn) {
      iniciarSyncEnSegundoPlano();
      ejecutarSincronizacion().catch(() => {});
    } else {
      detenerSyncEnSegundoPlano();
    }
    return () => {
      detenerSyncEnSegundoPlano();
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const authScreen = segments[1];

    if (!isLoggedIn) {
      // Debe estar en login
      if (authScreen !== 'login') {
        router.replace('/(auth)/login');
      }
    } else {
      // Sesión iniciada: si está en (auth) o en la pantalla raíz, ir a la app
      if (inAuthGroup || (segments[0] as string) === 'index') {
        router.replace('/(tabs)/hoy');
      }
    }
  }, [isLoggedIn, isLoading, segments, router]);

  return null;
}

// ─── Pantalla de carga inicial ────────────────────────────────
function SplashLoader(): React.JSX.Element {
  return (
    <View style={styles.splashContainer}>
      <ActivityIndicator size="large" color="#2E7D32" />
    </View>
  );
}

// ─── Inicializador de BD ──────────────────────────────────────
function DBInitializer({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [dbReady, setDbReady] = React.useState(false);

  useEffect(() => {
    initTables()
      .then(() => setDbReady(true))
      .catch((err: unknown) => {
        console.error('[DB] Error al inicializar tablas:', err);
        setDbReady(true); // Continuar aunque falle (ErrorBoundary lo atrapará)
      });
  }, []);

  if (!dbReady) {
    return <SplashLoader />;
  }

  return <>{children}</>;
}

// ─── Layout Raíz ─────────────────────────────────────────────
export default function RootLayout(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DBInitializer>
          <RouteGuard />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#FFFFFF' },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </DBInitializer>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
