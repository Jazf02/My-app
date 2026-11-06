// components/ui/CampoNumero.tsx — Fase 2 implementa completo
// Fase 1: placeholder tipado.

import React from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

interface CampoNumeroProps {
  valor: string;
  onChange: (val: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function CampoNumero({ valor, onChange, placeholder = '0', editable = true }: CampoNumeroProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={valor}
        onChangeText={onChange}
        keyboardType={Platform.select({ android: 'numeric', ios: 'number-pad', default: 'numeric' })}
        placeholder={placeholder}
        placeholderTextColor="#9E9E9E"
        editable={editable}
        maxLength={6}
      />
      <Text style={styles.sufijo}>L.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: { minHeight: 56, fontSize: 22, color: '#1A1A1A', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 12, minWidth: 100 },
  sufijo: { fontSize: 18, color: '#616161', fontWeight: '600' },
});
