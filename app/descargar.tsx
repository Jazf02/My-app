// ═══════════════════════════════════════════════════════════
// app/descargar.tsx — Página inteligente de descarga e instalación
// Detecta Android, iOS o Web y muestra instrucciones precisas + PWA
// ═══════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

export default function DescargarScreen(): React.JSX.Element {
  const router = useRouter();

  // Detección de plataforma de usuario
  const dispositivo = useMemo(() => {
    if (Platform.OS === 'android') return 'android';
    if (Platform.OS === 'ios') return 'ios';

    if (typeof window !== 'undefined' && window.navigator) {
      const ua = window.navigator.userAgent.toLowerCase();
      if (/android/i.test(ua)) return 'android';
      if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    }
    return 'web';
  }, []);

  const handleDescargarAPK = () => {
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
      <ScrollView contentContainerStyle={styles.container}>
        {/* Cabecera con Logo Oficial */}
        <View style={styles.header}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.titulo}>AgroGámez</Text>
          <Text style={styles.subtitulo}>Sistema Agrícola de Gestión Integral</Text>
        </View>

        {/* Sección Android */}
        {dispositivo === 'android' && (
          <View style={styles.cardInstalacion}>
            <View style={styles.badgePlataforma}>
              <Text style={styles.badgeTexto}>Dispositivo Android detectado</Text>
            </View>
            <Text style={styles.cardTitulo}>Instalar Aplicación para Android</Text>
            <Text style={styles.cardTexto}>
              Descarga la aplicación nativa en formato APK para utilizarla con todas sus funciones y soporte offline sin internet.
            </Text>

            <Pressable style={styles.btnPrincipal} onPress={handleDescargarAPK}>
              <Text style={styles.btnPrincipalTexto}>⬇️ Descargar APK de AgroGámez</Text>
            </Pressable>

            <View style={styles.cajaPasos}>
              <Text style={styles.pasosTitulo}>Instrucciones de instalación:</Text>
              <Text style={styles.pasoItem}>1. Toca el botón "Descargar APK".</Text>
              <Text style={styles.pasoItem}>2. Si el navegador pregunta si deseas descargar el archivo, selecciona "Descargar de todos modos".</Text>
              <Text style={styles.pasoItem}>3. Al finalizar, abre la descarga y pulsa "Instalar".</Text>
              <Text style={styles.pasoItem}>4. Si tu teléfono solicita permiso de orígenes desconocidos, habilita "Permitir desde esta fuente".</Text>
            </View>
          </View>
        )}

        {/* Sección iOS (iPhone / iPad) */}
        {dispositivo === 'ios' && (
          <View style={styles.cardInstalacion}>
            <View style={[styles.badgePlataforma, styles.badgeIOS]}>
              <Text style={[styles.badgeTexto, styles.badgeIOSTexto]}>Dispositivo iPhone / iPad detectado</Text>
            </View>
            <Text style={styles.cardTitulo}>Instalar en Pantalla de Inicio (PWA)</Text>
            <Text style={styles.cardTexto}>
              En iOS puedes instalar AgroGámez como una aplicación completa directamente desde Safari sin App Store:
            </Text>

            <View style={styles.cajaPasos}>
              <Text style={styles.pasosTitulo}>Sigue estos pasos en Safari:</Text>
              <Text style={styles.pasoItem}>1. Abre esta página en el navegador Safari.</Text>
              <Text style={styles.pasoItem}>2. Toca el botón <Text style={styles.bold}>Compartir</Text> (el icono cuadrado con una flecha hacia arriba ⎋).</Text>
              <Text style={styles.pasoItem}>3. Desplaza las opciones hacia abajo y selecciona <Text style={styles.bold}>"Agregar a pantalla de inicio"</Text> (icono ➕).</Text>
              <Text style={styles.pasoItem}>4. Confirma tocando <Text style={styles.bold}>"Agregar"</Text> en la esquina superior derecha.</Text>
            </View>

            <Pressable style={styles.btnSecundario} onPress={() => router.push('/(tabs)/hoy' as any)}>
              <Text style={styles.btnSecundarioTexto}>Abrir Versión Web Directa</Text>
            </Pressable>
          </View>
        )}

        {/* Sección PC / Computadora / Web */}
        {dispositivo === 'web' && (
          <View style={styles.cardInstalacion}>
            <View style={[styles.badgePlataforma, styles.badgeWeb]}>
              <Text style={[styles.badgeTexto, styles.badgeWebTexto]}>Computadora / Navegador Web</Text>
            </View>
            <Text style={styles.cardTitulo}>Versión Web de AgroGámez</Text>
            <Text style={styles.cardTexto}>
              Puedes utilizar todo el sistema de Asistencia, Trabajadores, Cosecha y Reportes cómodamente desde tu laptop o computadora de escritorio.
            </Text>

            <Pressable style={styles.btnPrincipal} onPress={() => router.push('/(tabs)/hoy' as any)}>
              <Text style={styles.btnPrincipalTexto}>💻 Ingresar al Sistema Web</Text>
            </Pressable>

            <View style={styles.separador} />

            <Text style={styles.subseccionTitulo}>¿Deseas descargar el APK para Android?</Text>
            <Pressable style={styles.btnDescargaApkDesktop} onPress={handleDescargarAPK}>
              <Text style={styles.btnDescargaApkDesktopTexto}>🤖 Descargar APK para transferir a celular</Text>
            </Pressable>
          </View>
        )}

        {/* Botón Volver */}
        <Pressable style={styles.btnVolver} onPress={() => router.replace('/(tabs)/hoy' as any)}>
          <Text style={styles.btnVolverTexto}>Ir a la pantalla principal</Text>
        </Pressable>
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
    alignItems: 'center',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logo: {
    width: 110,
    height: 110,
    borderRadius: 22,
    marginBottom: 12,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1B5E20',
  },
  subtitulo: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  cardInstalacion: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 20,
  },
  badgePlataforma: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeTexto: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeIOS: {
    backgroundColor: '#F3F4F6',
  },
  badgeIOSTexto: {
    color: '#1F2937',
  },
  badgeWeb: {
    backgroundColor: '#EFF6FF',
  },
  badgeWebTexto: {
    color: '#1D4ED8',
  },
  cardTitulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  cardTexto: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 16,
  },
  btnPrincipal: {
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  btnPrincipalTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecundario: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnSecundarioTexto: {
    color: '#166534',
    fontSize: 15,
    fontWeight: '700',
  },
  cajaPasos: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 6,
  },
  pasosTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  pasoItem: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
    color: '#111827',
  },
  separador: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  subseccionTitulo: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  btnDescargaApkDesktop: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDescargaApkDesktopTexto: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  btnVolver: {
    paddingVertical: 12,
  },
  btnVolverTexto: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '700',
  },
});

