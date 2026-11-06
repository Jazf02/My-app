// ═══════════════════════════════════════════════════════════
// app/index.tsx — Ruta raíz: pantalla de carga mientras
// RouteGuard en _layout.tsx decide a dónde navegar.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Esta pantalla se muestra brevemente mientras el AuthProvider
 * termina de verificar si existe un PIN configurado.
 * RouteGuard en _layout.tsx redirige automáticamente a:
 *   - /(auth)/primer-uso  → si es la primera vez (sin PIN)
 *   - /(auth)/login       → si ya existe un PIN
 *   - /(tabs)/hoy         → si la sesión ya estaba activa
 */
export default function Index(): React.JSX.Element {
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
