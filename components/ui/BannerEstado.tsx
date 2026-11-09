// ═══════════════════════════════════════════════════════════
// components/ui/BannerEstado.tsx — Banner de estado de sync en tiempo real
// Conectado automáticamente con el Sync Engine y Supabase
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { EstadoSync } from '@/types';
import { getEstadoSync, suscribirEstadoSync } from '@/sync/status';

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
    label: '● En línea',
    color: '#1B5E20',
    backgroundColor: '#E8F5E9',
  },
  sincronizando: {
    label: '🔄 Sincronizando...',
    color: '#1565C0',
    backgroundColor: '#E3F2FD',
  },
  pendiente: {
    label: '⚠️ Pendiente',
    color: '#E65100',
    backgroundColor: '#FFF3E0',
  },
  offline: {
    label: '● Modo Offline',
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
 * Se suscribe automáticamente al estado global del motor de sincronización.
 */
export function BannerEstado({ estado: propEstado }: BannerEstadoProps): React.JSX.Element {
  const [estadoGlobal, setEstadoGlobal] = useState<EstadoSync>(getEstadoSync());

  useEffect(() => {
    // Si viene forzado por props, no suscribir
    if (propEstado) return;

    const desuscribir = suscribirEstadoSync((nuevoEstado) => {
      setEstadoGlobal(nuevoEstado);
    });

    return () => {
      desuscribir();
    };
  }, [propEstado]);

  const estadoFinal = propEstado || estadoGlobal;
  const config = ESTADO_CONFIG[estadoFinal] || ESTADO_CONFIG.offline;

  return (
    <View
      style={[styles.container, { backgroundColor: config.backgroundColor }]}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Estado de sincronización: ${config.label}`}
    >
      <View style={styles.logoWrapper}>
        <Image
          source={require('@/assets/logo.png')}
          style={styles.logoSmall}
          resizeMode="cover"
          accessibilityLabel="Logo AgroGámez"
        />
      </View>
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
  logoWrapper: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#1B5E20',
    overflow: 'hidden',
  },
  logoSmall: {
    width: 28,
    height: 28,
  },
  texto: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
