// ═══════════════════════════════════════════════════════════
// app/index.tsx — Ruta raíz: pantalla de carga mientras
// RouteGuard en _layout.tsx decide a dónde navegar.
// ═══════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/useAuth';

export default function Index(): React.JSX.Element {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isLoggedIn) {
        router.replace('/(tabs)/hoy');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [isLoading, isLoggedIn, router]);

  // Fallback de seguridad: si tras 3 segundos sigue en index, forzar navegación
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        router.replace('/(tabs)/hoy');
      } catch {}
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2E7D32" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
