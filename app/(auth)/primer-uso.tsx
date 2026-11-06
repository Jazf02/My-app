// ═══════════════════════════════════════════════════════════
// app/(auth)/primer-uso.tsx — Onboarding: crear PIN de acceso
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/auth/useAuth';
import { BannerEstado } from '@/components/ui/BannerEstado';
import { useRouter } from 'expo-router';

export default function PrimerUsoScreen(): React.JSX.Element {
  const router = useRouter();
  const { setupPin } = useAuth();
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paso, setPaso] = useState<'bienvenida' | 'crear-pin'>('bienvenida');

  const handleCrearPin = async (): Promise<void> => {
    if (isLoading) return;
    setError(null);

    if (!/^\d{4,6}$/.test(pin)) {
      setError('El PIN debe tener entre 4 y 6 dígitos numéricos.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('Los PINs no coinciden. Intenta de nuevo.');
      return;
    }

    setIsLoading(true);
    try {
      await setupPin(pin);
      // RouteGuard redirigirá a /(tabs)/hoy automáticamente
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar el PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Pantalla de bienvenida ────────────────────────────────
  if (paso === 'bienvenida') {
    return (
      <SafeAreaView style={styles.safe}>
        <BannerEstado estado="offline" />
        <View style={styles.container}>
          <Text style={styles.emoji}>🌱</Text>
          <Text style={styles.titulo}>Bienvenido a AgroGámez</Text>
          <Text style={styles.subtitulo}>
            Tu libreta digital de campo.{'\n'}
            Registra trabajadores, cosechas y gastos sin internet.
          </Text>

          <View style={styles.featuresContainer}>
            <FeatureItem emoji="👷" texto="Trabajadores y asistencia" />
            <FeatureItem emoji="📦" texto="Control de cosechas y lotes" />
            <FeatureItem emoji="💰" texto="Gastos y adelantos" />
            <FeatureItem emoji="🔒" texto="Tus datos, solo en tu dispositivo" />
          </View>

          <Pressable
            id="primer-uso-comenzar-btn"
            style={({ pressed }) => [
              styles.boton,
              pressed && styles.botonPresionado,
            ]}
            onPress={() => setPaso('crear-pin')}
            accessibilityRole="button"
            accessibilityLabel="Comenzar configuración"
          >
            <Text style={styles.botonTexto}>Comenzar →</Text>
          </Pressable>

          <Pressable
            id="primer-uso-ya-tengo-pin-btn"
            style={styles.botonSecundario}
            onPress={() => router.replace('/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel="Ya tengo un PIN"
          >
            <Text style={styles.botonSecundarioTexto}>
              ¿Ya configuraste tu PIN? Iniciar sesión
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Pantalla de creación de PIN ───────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado estado="offline" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
          <Text style={styles.emoji}>🔐</Text>
          <Text style={styles.titulo}>Crea tu PIN de acceso</Text>
          <Text style={styles.subtitulo}>
            Un PIN de 4 a 6 dígitos protege el acceso a la app.
            Nadie más podrá entrar sin él.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>PIN (4–6 dígitos)</Text>
            <TextInput
              id="primer-uso-pin-input"
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="Ej: 1234"
              placeholderTextColor="#9E9E9E"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              returnKeyType="next"
              editable={!isLoading}
              accessibilityLabel="Campo PIN"
            />

            <Text style={styles.label}>Confirmar PIN</Text>
            <TextInput
              id="primer-uso-pin-confirm-input"
              style={styles.input}
              value={pinConfirm}
              onChangeText={setPinConfirm}
              placeholder="Repite tu PIN"
              placeholderTextColor="#9E9E9E"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleCrearPin}
              editable={!isLoading}
              accessibilityLabel="Confirmar PIN"
            />

            {error !== null && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorTexto}>{error}</Text>
              </View>
            )}

            <Pressable
              id="primer-uso-guardar-pin-btn"
              style={({ pressed }) => [
                styles.boton,
                pressed && styles.botonPresionado,
                isLoading && styles.botonDisabled,
              ]}
              onPress={handleCrearPin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Guardar PIN y entrar"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.botonTexto}>Guardar y entrar</Text>
              )}
            </Pressable>

            <Pressable
              id="primer-uso-volver-btn"
              style={styles.botonSecundario}
              onPress={() => setPaso('bienvenida')}
              accessibilityRole="button"
              accessibilityLabel="Volver a la bienvenida"
            >
              <Text style={styles.botonSecundarioTexto}>← Volver</Text>
            </Pressable>
          </View>

          <Text style={styles.nota}>
            📱 Este PIN solo existe en tu dispositivo.{'\n'}
            Si lo olvidas, necesitarás reinstalar la app.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FeatureItem({ emoji, texto }: { emoji: string; texto: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <Text style={styles.featureTexto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  emoji: {
    fontSize: 80,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitulo: {
    fontSize: 17,
    color: '#616161',
    textAlign: 'center',
    lineHeight: 26,
  },
  featuresContainer: {
    width: '100%',
    gap: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureEmoji: {
    fontSize: 22,
  },
  featureTexto: {
    fontSize: 15,
    color: '#424242',
    fontWeight: '500',
  },
  form: {
    width: '100%',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
    marginBottom: -4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
    minHeight: 56,
    letterSpacing: 8,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#C62828',
  },
  errorTexto: {
    color: '#B71C1C',
    fontSize: 14,
    fontWeight: '500',
  },
  boton: {
    backgroundColor: '#2E7D32',
    borderRadius: 16,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 8,
  },
  botonPresionado: {
    opacity: 0.85,
  },
  botonDisabled: {
    opacity: 0.6,
  },
  botonTexto: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  botonSecundario: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    width: '100%',
  },
  botonSecundarioTexto: {
    color: '#2E7D32',
    fontSize: 15,
    fontWeight: '600',
  },
  nota: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 18,
  },
});
