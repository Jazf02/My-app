// components/layout/ResumenBarra.tsx — Fase 2 implementa completo
// Fase 1: placeholder tipado.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ResumenBarraProps {
  ganado: number;
  adelantos: number;
  neto: number;
}

export function ResumenBarra({ ganado, adelantos, neto }: ResumenBarraProps): React.JSX.Element {
  return (
    <View style={styles.barra}>
      <Text style={styles.item}>Ganado: L.{ganado.toFixed(2)}</Text>
      <Text style={styles.separador}>|</Text>
      <Text style={styles.item}>Adelantos: L.{adelantos.toFixed(2)}</Text>
      <Text style={styles.separador}>|</Text>
      <Text style={[styles.item, styles.neto]}>NETO: L.{neto.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    flexWrap: 'wrap',
  },
  item: { fontSize: 14, color: '#424242', fontWeight: '500' },
  separador: { color: '#9E9E9E' },
  neto: { fontWeight: '700', color: '#1A1A1A' },
});
