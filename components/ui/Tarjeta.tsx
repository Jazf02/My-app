// components/ui/Tarjeta.tsx — Fase 2 implementa completo
// Fase 1: placeholder tipado con shadow cross-platform.

import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';

interface TarjetaProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Tarjeta({ children, style }: TarjetaProps): React.JSX.Element {
  return (
    <View style={[styles.tarjeta, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
});
