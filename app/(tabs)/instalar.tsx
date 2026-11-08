// ═══════════════════════════════════════════════════════════
// app/(tabs)/instalar.tsx — Código QR y Descarga para la Web
// Permite escanear con el móvil para instalar en Android/iOS
// ═══════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import {
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

export default function InstalarScreen(): React.JSX.Element {
  const router = useRouter();

  // URL permanente de producción
  const urlDescarga = useMemo(() => {
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.origin}/descargar`;
    }
    return 'https://agrogamez.vercel.app/descargar';
  }, []);

  // Generador de código QR usando servicio SVG/PNG estándar confiable
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    urlDescarga
  )}&color=1b5e20`;

  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado estado="offline" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.titulo}>📲 Descargar e Instalar en Celular</Text>
          <Text style={styles.subtitulo}>
            Escanea este código QR con la cámara de tu teléfono Android o iPhone para abrir las instrucciones de instalación inteligente.
          </Text>

          {/* Contenedor del Código QR */}
          <View style={styles.qrContainer}>
            <Image
              source={{ uri: qrImageUrl }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.urlTexto}>{urlDescarga}</Text>

          {/* Opciones directas */}
          <View style={styles.beneficios}>
            <View style={styles.beneficioItem}>
              <Text style={styles.beneficioIcono}>🤖</Text>
              <View style={styles.beneficioTextos}>
                <Text style={styles.beneficioTitulo}>Android</Text>
                <Text style={styles.beneficioDesc}>Detecta el dispositivo y descarga el instalador APK directamente.</Text>
              </View>
            </View>

            <View style={styles.beneficioItem}>
              <Text style={styles.beneficioIcono}>🍏</Text>
              <View style={styles.beneficioTextos}>
                <Text style={styles.beneficioTitulo}>iPhone / iPad</Text>
                <Text style={styles.beneficioDesc}>Explica paso a paso cómo agregarlo a la pantalla de inicio desde Safari (PWA).</Text>
              </View>
            </View>

            <View style={styles.beneficioItem}>
              <Text style={styles.beneficioIcono}>⚡</Text>
              <View style={styles.beneficioTextos}>
                <Text style={styles.beneficioTitulo}>100% Offline</Text>
                <Text style={styles.beneficioDesc}>Funciona en el campo aunque no haya señal de internet.</Text>
              </View>
            </View>
          </View>

          <Pressable
            style={styles.btnIrDescarga}
            onPress={() => router.push('/descargar' as any)}
          >
            <Text style={styles.btnIrDescargaTexto}>Abrir Página de Descarga Aquí</Text>
          </Pressable>
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
    padding: 16,
    alignItems: 'center',
    maxWidth: 650,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1B5E20',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitulo: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#C8E6C9',
    marginBottom: 12,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  urlTexto: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '700',
    marginBottom: 20,
  },
  beneficios: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  beneficioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 12,
  },
  beneficioIcono: {
    fontSize: 24,
  },
  beneficioTextos: {
    flex: 1,
  },
  beneficioTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  beneficioDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  btnIrDescarga: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  btnIrDescargaTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

