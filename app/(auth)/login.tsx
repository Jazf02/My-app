// ═══════════════════════════════════════════════════════════
// app/(auth)/login.tsx — Pantalla de ingreso con PIN local
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Image,
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
  const { login, loginWithEmail, registerWithEmail } = useAuth();
  
  // Modo de acceso: 'pin' o 'email'
  const [modo, setModo] = useState<'pin' | 'email'>('pin');
  
  // Estados para PIN
  const [pin, setPin] = useState('');
  
  // Estados para Correo
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [esRegistro, setEsRegistro] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (): Promise<void> => {
    if (isLoading) return;
    setError(null);

    if (modo === 'pin') {
      if (!pin.trim()) {
        setError('Ingresa tu PIN de acceso.');
        return;
      }
      setIsLoading(true);
      try {
        await login(pin.trim());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al verificar el PIN.');
        setPin('');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Modo Correo Electrónico
      if (!email.trim() || !password.trim()) {
        setError('Ingresa correo y contraseña.');
        return;
      }
      setIsLoading(true);
      try {
        if (esRegistro) {
          await registerWithEmail(email, password);
        } else {
          await loginWithEmail(email, password);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error de autenticación con correo.');
      } finally {
        setIsLoading(false);
      }
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
            <Image
              source={require('@/assets/logo.png')}
              style={{ width: 120, height: 120, borderRadius: 20 }}
              accessibilityLabel="Logo AgroGámez"
            />
            <Text style={styles.titulo}>AgroGámez</Text>
            <Text style={styles.subtitulo}>Sistema de gestión agrícola</Text>
          </View>

          {/* Selector de Modo: PIN o Correo */}
          <View style={styles.selectorModo}>
            <Pressable
              style={[styles.btnModo, modo === 'pin' && styles.btnModoActivo]}
              onPress={() => { setModo('pin'); setError(null); }}
            >
              <Text style={[styles.btnModoTexto, modo === 'pin' && styles.btnModoTextoActivo]}>
                🔢 PIN Local
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btnModo, modo === 'email' && styles.btnModoActivo]}
              onPress={() => { setModo('email'); setError(null); }}
            >
              <Text style={[styles.btnModoTexto, modo === 'email' && styles.btnModoTextoActivo]}>
                ☁️ Correo Supabase
              </Text>
            </Pressable>
          </View>

          {/* Formulario */}
          <View style={styles.form}>
            {modo === 'pin' ? (
              <>
                <Text style={styles.label}>PIN de acceso local</Text>
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
              </>
            ) : (
              <>
                <Text style={styles.label}>Correo Electrónico</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor="#9E9E9E"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                  autoFocus
                />

                <Text style={[styles.label, { marginTop: 6 }]}>Contraseña</Text>
                <TextInput
                  style={styles.inputTexto}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#9E9E9E"
                  secureTextEntry
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />

                <Pressable
                  style={{ alignSelf: 'flex-end', paddingVertical: 4 }}
                  onPress={() => setEsRegistro(!esRegistro)}
                >
                  <Text style={{ fontSize: 13, color: '#2E7D32', fontWeight: '600' }}>
                    {esRegistro ? '¿Ya tienes cuenta? Iniciar Sesión' : '¿No tienes cuenta? Registrarse'}
                  </Text>
                </Pressable>
              </>
            )}

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
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.botonTexto}>
                  {modo === 'pin' ? 'Entrar con PIN' : esRegistro ? 'Registrar y Entrar' : 'Entrar con Correo'}
                </Text>
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
  selectorModo: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
  },
  btnModo: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnModoActivo: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  btnModoTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  btnModoTextoActivo: {
    color: '#166534',
    fontWeight: '700',
  },
  inputTexto: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
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
