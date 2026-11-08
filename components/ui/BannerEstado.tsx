// ═══════════════════════════════════════════════════════════
// components/ui/BannerEstado.tsx — Banner de estado de sync
// Fase 1: siempre muestra "● Offline" (Fase 5 lo activa)
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { EstadoSync } from '@/types';

interface BannerEstadoProps {
  estado?: EstadoSync;
}

interface EstadoConfig {
  label: string;
  color: string;
  backgroundColor: string;
}

const ESTADO_CONFIG: Record<EstadoSync, EstadoConfig> = {
  sincronizado: {
    label: '● Sincronizado',
    color: '#1B5E20',
    backgroundColor: '#E8F5E9',
  },
  pendiente: {
    label: '⚠️ Pendiente',
    color: '#E65100',
    backgroundColor: '#FFF3E0',
  },
  offline: {
    label: '● Offline',
    color: '#424242',
    backgroundColor: '#F5F5F5',
  },
  error: {
    label: '⚠️ Error de sync',
    color: '#B71C1C',
    backgroundColor: '#FFEBEE',
  },
};

/**
 * Banner que muestra el estado de sincronización en la parte superior.
 * Por defecto muestra 'offline'. Fase 5 lo conecta al estado real.
 */
export function BannerEstado({ estado = 'offline' }: BannerEstadoProps): React.JSX.Element {
  const config = ESTADO_CONFIG[estado];

  return (
    <View
      style={[styles.container, { backgroundColor: config.backgroundColor }]}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Estado de sincronización: ${config.label}`}
    >
      <Image
        source={require('@/assets/logo.png')}
        style={styles.logoSmall}
        accessibilityLabel="Logo AgroGámez"
      />
      <Text style={[styles.texto, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  logoSmall: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  texto: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
