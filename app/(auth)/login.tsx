// ═══════════════════════════════════════════════════════════
// app/(auth)/login.tsx — Pantalla de ingreso con PIN local
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { BannerEstado } from '@/components/ui/BannerEstado';
import { useAuth } from '@/auth/useAuth';
import { useRouter } from 'expo-router';

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (): Promise<void> => {
    if (isLoading) return;
    setError(null);

    if (!pin.trim()) {
      setError('Ingresa tu PIN de acceso.');
      return;
    }

    setIsLoading(true);
    try {
      await login(pin.trim());
      // RouteGuard en _layout.tsx redirige automáticamente a /(tabs)/hoy
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al verificar el PIN.';
      setError(msg);
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDescargarApk = (): void => {
    const directUrl = process.env.EXPO_PUBLIC_APK_DOWNLOAD_URL;
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const defaultStorageUrl =
      supabaseUrl && !supabaseUrl.includes('placeholder')
        ? `${supabaseUrl}/storage/v1/object/public/apps/agrogamez.apk`
        : 'https://expo.dev/artifacts/eas/wT688ZiNAXKY4oQT3er_PF68VKoHSWRJzGUMw88-WfQ.apk';
    const apkUrl = directUrl || defaultStorageUrl;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(apkUrl, '_blank');
    } else {
      Linking.openURL(apkUrl).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado estado="offline" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
          {/* Logo / Título */}
          <View style={styles.header}>
            <Text style={styles.logo}>🌱</Text>
            <Text style={styles.titulo}>AgroGámez</Text>
            <Text style={styles.subtitulo}>Sistema de gestión agrícola</Text>
          </View>

          {/* Formulario PIN */}
          <View style={styles.form}>
            <Text style={styles.label}>PIN de acceso</Text>
            <TextInput
              id="login-pin-input"
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="●●●●"
              placeholderTextColor="#9E9E9E"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              editable={!isLoading}
              autoFocus
              accessibilityLabel="Campo de PIN de acceso"
            />

            {/* Error */}
            {error !== null && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorTexto}>{error}</Text>
              </View>
            )}

            {/* Botón de login */}
            <Pressable
              id="login-submit-btn"
              style={({ pressed }) => [
                styles.boton,
                pressed && styles.botonPresionado,
                isLoading && styles.botonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Ingresar con PIN"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.botonTexto}>Entrar</Text>
              )}
            </Pressable>

            {/* Enlace para configurar PIN / Primer uso */}
            <Pressable
              id="login-ir-primer-uso-btn"
              style={styles.botonSecundario}
              onPress={() => router.replace('/(auth)/primer-uso')}
              accessibilityRole="button"
              accessibilityLabel="Configurar PIN por primera vez"
            >
              <Text style={styles.botonSecundarioTexto}>
                ¿Primera vez en la app? Configurar PIN
              </Text>
            </Pressable>

            {/* Botón Descargar APK para Android (Web) */}
            {Platform.OS === 'web' && (
              <Pressable
                id="descargar-apk-btn"
                style={({ pressed }) => [
                  styles.botonApk,
                  pressed && styles.botonApkPresionado,
                ]}
                onPress={handleDescargarApk}
                accessibilityRole="button"
                accessibilityLabel="Descargar app para Android"
              >
                <Text style={styles.botonApkIcono}>🤖</Text>
                <View style={styles.botonApkTextos}>
                  <Text style={styles.botonApkTitulo}>Descargar para Android</Text>
                  <Text style={styles.botonApkSubtitulo}>Instalar archivo APK directamente</Text>
                </View>
              </Pressable>
            )}
          </View>

          <Text style={styles.pie}>
            Solo acceso autorizado. Los datos se guardan localmente.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    justifyContent: 'center',
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    fontSize: 72,
  },
  titulo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  subtitulo: {
    fontSize: 16,
    color: '#616161',
    fontWeight: '400',
  },
  form: {
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
    fontSize: 32,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
    minHeight: 72,
    letterSpacing: 12,
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
  },
  botonSecundarioTexto: {
    color: '#2E7D32',
    fontSize: 15,
    fontWeight: '600',
  },
  botonApk: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    borderColor: '#4CAF50',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  botonApkPresionado: {
    backgroundColor: '#E8F5E9',
    opacity: 0.9,
  },
  botonApkIcono: {
    fontSize: 24,
  },
  botonApkTextos: {
    flex: 1,
  },
  botonApkTitulo: {
    color: '#1B5E20',
    fontSize: 15,
    fontWeight: '700',
  },
  botonApkSubtitulo: {
    color: '#558B2F',
    fontSize: 12,
    fontWeight: '500',
  },
  pie: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9E9E9E',
  },
});
