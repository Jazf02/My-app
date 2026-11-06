// components/ui/ToggleCheck.tsx — Fase 2 implementa completo
// Fase 1: placeholder tipado.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TipoAsistencia } from '@/types';

interface ToggleCheckProps {
  valor: TipoAsistencia | null;
  onChange: (tipo: TipoAsistencia) => void;
  disabled?: boolean;
}

export function ToggleCheck({ valor, onChange, disabled = false }: ToggleCheckProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      {(['presente', 'inactivo', 'adelanto'] as TipoAsistencia[]).map((tipo) => (
        <TouchableOpacity
          key={tipo}
          style={[styles.btn, valor === tipo && styles.activo, disabled && styles.disabled]}
          onPress={() => onChange(tipo)}
          disabled={disabled}
        >
          <Text style={styles.label}>
            {tipo === 'presente' ? '✓' : tipo === 'inactivo' ? '✗' : 'A'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: { width: 72, height: 72, borderRadius: 12, borderWidth: 2, borderColor: '#9E9E9E', alignItems: 'center', justifyContent: 'center' },
  activo: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  disabled: { opacity: 0.4 },
  label: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
});
