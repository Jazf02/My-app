// ═══════════════════════════════════════════════════════════
// app/(tabs)/configuracion.tsx — Pantalla de Configuración y Cuenta
// Cierre de sesión, cambio de cuenta y eliminación definitiva con confirmación
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BannerEstado } from '@/components/ui/BannerEstado';
import { useAuth } from '@/auth/useAuth';

export default function ConfiguracionScreen(): React.JSX.Element {
  const router = useRouter();
  const { userEmail, logout, deleteAccount } = useAuth();
  const [procesando, setProcesando] = useState(false);

  const handleCerrarSesion = () => {
    if (procesando) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirma = window.confirm(
        '¿Deseas cerrar tu sesión actual?\n\nPodrás ingresar nuevamente con este correo o iniciar sesión con una cuenta diferente.'
      );
      if (confirma) {
        ejecutarLogout();
      }
      return;
    }

    Alert.alert(
      'Cerrar Sesión',
      '¿Deseas cerrar tu sesión actual? Podrás ingresar con este u otro correo en cualquier momento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'default',
          onPress: ejecutarLogout,
        },
      ]
    );
  };

  const ejecutarLogout = async () => {
    try {
      setProcesando(true);
      await logout();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error('[Config] Error al cerrar sesión:', err);
      Alert.alert('Error', 'No se pudo cerrar la sesión.');
    } finally {
      setProcesando(false);
    }
  };

  const handleEliminarCuenta = () => {
    if (procesando) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const primerPaso = window.confirm(
        '⚠️ PELIGRO: ¿Deseas ELIMINAR tu cuenta permanentemente?\n\nEsta acción borrará tus datos y tu usuario de forma definitiva e irreversible.'
      );
      if (!primerPaso) return;

      const confirmacionFinal = window.confirm(
        'Última confirmación: ¿Estás totalmente seguro de que deseas borrar tu cuenta para siempre?'
      );
      if (confirmacionFinal) {
        ejecutarEliminarCuenta();
      }
      return;
    }

    Alert.alert(
      '⚠️ Eliminar Cuenta Definitivamente',
      'Esta acción borrará tus datos y tu cuenta de forma permanente e irreversible.\n\n¿Estás totalmente seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Eliminar Mi Cuenta',
          style: 'destructive',
          onPress: ejecutarEliminarCuenta,
        },
      ]
    );
  };

  const ejecutarEliminarCuenta = async () => {
    try {
      setProcesando(true);
      await deleteAccount();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error('[Config] Error al eliminar cuenta:', err);
      Alert.alert('Error', 'No se pudo eliminar la cuenta.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Cabecera */}
        <View style={styles.header}>
          <Text style={styles.titulo}>Configuración</Text>
          <Text style={styles.subtitulo}>Gestión de cuenta y sistema</Text>
        </View>

        {/* Tarjeta de Cuenta Activa */}
        <View style={styles.card}>
          <View style={styles.cardHeaderFila}>
            <View style={styles.avatarCirculo}>
              <Text style={styles.avatarEmoji}>🧑‍🌾</Text>
            </View>
            <View style={styles.infoCuenta}>
              <Text style={styles.labelCuenta}>Cuenta Activa</Text>
              <Text style={styles.emailCuenta} numberOfLines={1}>
                {userEmail || 'usuario@agrogamez.hn'}
              </Text>
              <View style={styles.badgeSincronizado}>
                <Text style={styles.badgeTexto}>● Sesión persistida y sincronizada</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sección Seguridad y Cuenta */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Sesión y Cuenta</Text>
          <Text style={styles.seccionDesc}>
            Puedes cerrar tu sesión para cambiar de usuario o ingresar desde otro dispositivo.
          </Text>

          {/* Botón Cerrar Sesión */}
          <Pressable
            style={({ pressed }) => [
              styles.btnCerrarSesion,
              pressed && styles.btnPresionado,
              procesando && styles.btnDeshabilitado,
            ]}
            onPress={handleCerrarSesion}
            disabled={procesando}
          >
            {procesando ? (
              <ActivityIndicator color="#1B5E20" size="small" />
            ) : (
              <>
                <Text style={styles.btnIcono}>🚪</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.btnCerrarSesionTitulo}>Cerrar Sesión</Text>
                  <Text style={styles.btnCerrarSesionSub}>
                    Salir para ingresar con otra cuenta de correo
                  </Text>
                </View>
                <Text style={styles.btnFlecha}>›</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Zona de Peligro */}
        <View style={[styles.seccion, styles.seccionPeligro]}>
          <Text style={styles.peligroTitulo}>Zona de Peligro</Text>
          <Text style={styles.peligroDesc}>
            Elimina tu cuenta de usuario de la plataforma permanentemente. Esta acción no se puede deshacer.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.btnEliminarCuenta,
              pressed && { opacity: 0.85 },
              procesando && styles.btnDeshabilitado,
            ]}
            onPress={handleEliminarCuenta}
            disabled={procesando}
          >
            <Text style={styles.btnEliminarCuentaTexto}>
              🗑️ Eliminar Cuenta Definitivamente
            </Text>
          </Pressable>
        </View>

        {/* Acerca de AgroGámez */}
        <View style={styles.cardAcercaDe}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logoAcercaDe}
            resizeMode="contain"
            accessibilityLabel="Logo AgroGámez"
          />
          <Text style={styles.acercaTitulo}>AgroGámez</Text>
          <Text style={styles.acercaVersion}>Versión 1.0.0 Oficial</Text>
          <Text style={styles.acercaDesc}>
            Sistema de Gestión Integral Agrícola con soporte Offline-First y respaldo en la nube.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAF8',
  },
  container: {
    padding: 20,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  header: {
    marginBottom: 4,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1B5E20',
  },
  subtitulo: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCirculo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 26,
  },
  infoCuenta: {
    flex: 1,
    gap: 2,
  },
  labelCuenta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emailCuenta: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  badgeSincronizado: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeTexto: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  seccion: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  seccionTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  seccionDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  btnCerrarSesion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  btnPresionado: {
    opacity: 0.85,
    backgroundColor: '#DCFCE7',
  },
  btnDeshabilitado: {
    opacity: 0.6,
  },
  btnIcono: {
    fontSize: 22,
  },
  btnCerrarSesionTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  btnCerrarSesionSub: {
    fontSize: 12,
    color: '#15803D',
  },
  btnFlecha: {
    fontSize: 20,
    color: '#166534',
    fontWeight: '700',
  },
  seccionPeligro: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FFFBFB',
  },
  peligroTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },
  peligroDesc: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  btnEliminarCuenta: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEliminarCuentaTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardAcercaDe: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  logoAcercaDe: {
    width: 64,
    height: 64,
    marginBottom: 6,
  },
  acercaTitulo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B5E20',
  },
  acercaVersion: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  acercaDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 320,
    lineHeight: 16,
  },
});

