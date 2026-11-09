// ═══════════════════════════════════════════════════════════
// app/(auth)/login.tsx — Inicio de Sesión Oficial Profesional
// Autenticación con Correo Electrónico y Contraseña vía Supabase
// Recuperación de Contraseña + Código QR EXCLUSIVO en COMPUTADORA/DESKTOP
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { BannerEstado } from '@/components/ui/BannerEstado';
import { useAuth } from '@/auth/useAuth';
import { useRouter } from 'expo-router';
import { esComputadoraWeb } from '@/lib/dispositivo';

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const { loginWithEmail, registerWithEmail, resetPassword } = useAuth();

  // Estados: 'login' | 'registro' | 'recuperar'
  const [vista, setVista] = useState<'login' | 'registro' | 'recuperar'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [verConfirmPassword, setVerConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // El código QR SOLO se muestra en computadora de escritorio / laptop.
  // En iPhone, Android, o PWA agregada a pantalla de inicio JAMÁS se muestra.
  const [mostrarQrWeb, setMostrarQrWeb] = useState(false);

  useEffect(() => {
    setMostrarQrWeb(esComputadoraWeb());
  }, []);

  // Validación estricta de formato de correo
  const validarEmail = (correo: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(correo.trim());
  };

  const handleSubmit = async (): Promise<void> => {
    if (isLoading) return;
    setError(null);
    setMensajeExito(null);

    const correoLimpio = email.trim().toLowerCase();

    if (!validarEmail(correoLimpio)) {
      setError('Por favor ingresa un correo electrónico válido y existente.');
      return;
    }

    // Modo: Recuperar contraseña
    if (vista === 'recuperar') {
      setIsLoading(true);
      try {
        await resetPassword(correoLimpio);
        setMensajeExito(
          'Se ha enviado un enlace seguro a tu correo electrónico para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.'
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al enviar correo de recuperación.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Modo: Registro o Login requiere contraseña
    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    // Modo: Registro
    if (vista === 'registro') {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden. Intenta de nuevo.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await registerWithEmail(correoLimpio, password);
        if (res.needsEmailConfirmation) {
          setMensajeExito(
            '¡Cuenta creada exitosamente! Te hemos enviado un correo de confirmación. Por favor verifica tu cuenta para iniciar sesión.'
          );
          setVista('login');
          setPassword('');
          setConfirmPassword('');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al registrar la cuenta.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Modo: Iniciar Sesión
    setIsLoading(true);
    try {
      await loginWithEmail(correoLimpio, password);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message === 'Invalid login credentials'
            ? 'Correo o contraseña incorrectos. Verifica tus datos.'
            : err.message
          : 'Error al iniciar sesión.'
      );
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
      <BannerEstado />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cardPrincipal}>
            {/* Logo Oficial — Badge con forma de app icon */}
            <View style={styles.header}>
              <View style={styles.logoWrapper}>
                <Image
                  source={require('@/assets/logo.png')}
                  style={styles.logo}
                  resizeMode="cover"
                  accessibilityLabel="Logo AgroGámez"
                />
              </View>
              <Text style={styles.titulo}>AgroGámez</Text>
              <Text style={styles.subtitulo}>Sistema Integral Agrícola</Text>
            </View>

            {/* Formulario Profesional */}
            <View style={styles.form}>
              <Text style={styles.label}>Correo Electrónico</Text>
              <TextInput
                id="login-email-input"
                style={styles.inputTexto}
                value={email}
                onChangeText={(text) => { setEmail(text); setError(null); }}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />

              {vista !== 'recuperar' && (
                <>
                  <Text style={[styles.label, { marginTop: 6 }]}>Contraseña</Text>
                  <View style={styles.inputConOjito}>
                    <TextInput
                      id="login-password-input"
                      style={styles.inputTextoConOjito}
                      value={password}
                      onChangeText={(text) => { setPassword(text); setError(null); }}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!verPassword}
                      editable={!isLoading}
                      returnKeyType={vista === 'registro' ? 'next' : 'done'}
                      onSubmitEditing={vista === 'login' ? handleSubmit : undefined}
                    />
                    <Pressable
                      style={styles.btnOjito}
                      onPress={() => setVerPassword(!verPassword)}
                      hitSlop={10}
                      accessibilityLabel={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      <Text style={styles.btnOjitoIcono}>{verPassword ? '👁️' : '🔒'}</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {vista === 'registro' && (
                <>
                  <Text style={[styles.label, { marginTop: 6 }]}>Confirmar Contraseña</Text>
                  <View style={styles.inputConOjito}>
                    <TextInput
                      id="login-password-confirm-input"
                      style={styles.inputTextoConOjito}
                      value={confirmPassword}
                      onChangeText={(text) => { setConfirmPassword(text); setError(null); }}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!verConfirmPassword}
                      editable={!isLoading}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                    <Pressable
                      style={styles.btnOjito}
                      onPress={() => setVerConfirmPassword(!verConfirmPassword)}
                      hitSlop={10}
                      accessibilityLabel={verConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      <Text style={styles.btnOjitoIcono}>{verConfirmPassword ? '👁️' : '🔒'}</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {/* Enlaces contextuales (Olvidé contraseña / Cambiar a registro) */}
              <View style={styles.filaEnlaces}>
                {vista === 'login' ? (
                  <>
                    <Pressable onPress={() => { setVista('recuperar'); setError(null); setMensajeExito(null); }}>
                      <Text style={styles.enlaceTexto}>¿Olvidaste tu contraseña?</Text>
                    </Pressable>
                    <Pressable onPress={() => { setVista('registro'); setError(null); setMensajeExito(null); }}>
                      <Text style={[styles.enlaceTexto, styles.enlaceVerde]}>Crear cuenta nueva</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable onPress={() => { setVista('login'); setError(null); setMensajeExito(null); }} style={{ width: '100%', alignItems: 'center' }}>
                    <Text style={[styles.enlaceTexto, styles.enlaceVerde]}>← Volver a Iniciar Sesión</Text>
                  </Pressable>
                )}
              </View>

              {/* Mensajes de Alerta y Éxito */}
              {error !== null && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorTexto}>⚠️ {error}</Text>
                </View>
              )}

              {mensajeExito !== null && (
                <View style={styles.exitoContainer}>
                  <Text style={styles.exitoTexto}>✅ {mensajeExito}</Text>
                </View>
              )}

              {/* Botón Principal */}
              <Pressable
                id="login-submit-btn"
                style={({ pressed }) => [
                  styles.boton,
                  pressed && styles.botonPresionado,
                  isLoading && styles.botonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isLoading}
                accessibilityRole="button"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.botonTexto}>
                    {vista === 'login'
                      ? 'Iniciar Sesión'
                      : vista === 'registro'
                      ? 'Crear Cuenta Segura'
                      : 'Enviar Enlace de Recuperación'}
                  </Text>
                )}
              </Pressable>

              {/* ════════════════════════════════════════════════════════════ */}
              {/* CÓDIGO QR: EXCLUSIVAMENTE EN COMPUTADORAS / LAPTOPS          */}
              {/* En iPhone, Android, Safari móvil o PWA JAMÁS aparecerá     */}
              {/* ════════════════════════════════════════════════════════════ */}
              {mostrarQrWeb && (
                <View style={styles.cardQrWeb}>
                  <View style={styles.qrHeader}>
                    <Text style={styles.qrIcono}>📲</Text>
                    <View style={styles.qrTextosHeader}>
                      <Text style={styles.qrTitulo}>Usar en tu Celular</Text>
                      <Text style={styles.qrSubtitulo}>Escanea con la cámara de tu celular</Text>
                    </View>
                  </View>

                  <View style={styles.qrContenido}>
                    <View style={styles.qrMarco}>
                      <Image
                        source={require('@/assets/qr-descargar.png')}
                        style={styles.qrImagen}
                        resizeMode="contain"
                        accessibilityLabel="Código QR para instalar en tu celular"
                      />
                    </View>

                    <View style={styles.qrPuntos}>
                      <View style={styles.qrFilaItem}>
                        <Text style={styles.qrItemEmoji}>🤖</Text>
                        <Text style={styles.qrItemTexto}>
                          <Text style={styles.qrItemNegrita}>Android:</Text> Descarga el archivo APK oficial.
                        </Text>
                      </View>

                      <View style={styles.qrFilaItem}>
                        <Text style={styles.qrItemEmoji}>🍏</Text>
                        <Text style={styles.qrItemTexto}>
                          <Text style={styles.qrItemNegrita}>iPhone:</Text> Instrucciones para Safari y pantalla de inicio.
                        </Text>
                      </View>

                      <Pressable
                        style={({ pressed }) => [
                          styles.btnDescargaDirectaPC,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={handleDescargarApk}
                      >
                        <Text style={styles.btnDescargaDirectaPCTexto}>
                          ⬇️ Descargar APK en esta computadora
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
            </View>

            <Text style={styles.pie}>
              Protegido con cifrado seguro y autenticación en la nube.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  flex: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  cardPrincipal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 28,
    paddingVertical: 32,
    maxWidth: 480,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    gap: 18,
  },
  header: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  logo: {
    width: 110,
    height: 110,
    borderRadius: 0,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: '#1B5E20',
    overflow: 'hidden',
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1B5E20',
    letterSpacing: -0.5,
  },
  subtitulo: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  form: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: -2,
  },
  inputTexto: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  inputConOjito: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  inputTextoConOjito: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  btnOjito: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnOjitoIcono: {
    fontSize: 18,
  },
  filaEnlaces: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginTop: 2,
  },
  enlaceTexto: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  enlaceVerde: {
    color: '#166534',
    fontWeight: '700',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  errorTexto: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
  },
  exitoContainer: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
  },
  exitoTexto: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  boton: {
    backgroundColor: '#2E7D32',
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  botonPresionado: {
    backgroundColor: '#1B5E20',
  },
  botonDisabled: {
    opacity: 0.6,
  },
  botonTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // ─── Tarjeta QR Exclusiva de Escritorio ──────────────────
  cardQrWeb: {
    backgroundColor: '#F8FAF8',
    borderColor: '#E2E8F0',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    gap: 12,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qrIcono: {
    fontSize: 24,
  },
  qrTextosHeader: {
    flex: 1,
  },
  qrTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  qrSubtitulo: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  qrContenido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  qrMarco: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  qrImagen: {
    width: 120,
    height: 120,
  },
  qrPuntos: {
    flex: 1,
    minWidth: 180,
    gap: 8,
  },
  qrFilaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  qrItemEmoji: {
    fontSize: 14,
  },
  qrItemTexto: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
    flex: 1,
  },
  qrItemNegrita: {
    fontWeight: '700',
    color: '#0F172A',
  },
  btnDescargaDirectaPC: {
    marginTop: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignSelf: 'flex-start',
  },
  btnDescargaDirectaPCTexto: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  pie: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
