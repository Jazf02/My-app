// components/ui/ButtonSeguro.tsx — Fase 2 implementa con useDebounceAction
// Fase 1: botón básico funcional para que compilen los layouts.

import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

interface ButtonSeguroProps {
  onPress: () => void;
  label: string;
  color?: string;
  disabled?: boolean;
  style?: ViewStyle;
  id?: string;
}

export function ButtonSeguro({
  onPress,
  label,
  color = '#2E7D32',
  disabled = false,
  style,
  id,
}: ButtonSeguroProps): React.JSX.Element {
  return (
    <Pressable
      id={id}
      style={({ pressed }) => [
        styles.boton,
        { backgroundColor: color },
        pressed && styles.presionado,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.texto}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    minHeight: 64,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presionado: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  texto: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
