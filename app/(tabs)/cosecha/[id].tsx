// ═══════════════════════════════════════════════════════════
// app/(tabs)/cosecha/[id].tsx — Detalle de Lote y Rendimiento
// Muestra historial de cortes, resumen de cajas y estado del lote
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BannerEstado } from '@/components/ui/BannerEstado';
import { obtenerLotePorId, cerrarLote } from '@/database/lotes';
import {
  obtenerCosechasPorLote,
  obtenerResumenCosechaLote,
  registrarCosecha,
  eliminarCosecha,
} from '@/database/cosechas';
import { formatearFechaCorta, hoyISO } from '@/lib/fechas';
import type { Lote, Cosecha, ResumenCosecha } from '@/types/domain';

export default function LoteDetalleScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [lote, setLote] = useState<Lote | null>(null);
  const [cosechas, setCosechas] = useState<Cosecha[]>([]);
  const [resumen, setResumen] = useState<ResumenCosecha | null>(null);
  const [cargando, setCargando] = useState(true);

  // Modal Registrar Cosecha
  const [modalCosechaVisible, setModalCosechaVisible] = useState(false);
  const [cortadasInput, setCortadasInput] = useState('');
  const [descarteInput, setDescarteInput] = useState('0');
  const [guardandoCosecha, setGuardandoCosecha] = useState(false);
  const [errorCosecha, setErrorCosecha] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!id) return;
    try {
      setCargando(true);
      const l = await obtenerLotePorId(id);
      if (!l) {
        Alert.alert('Error', 'Lote no encontrado.');
        router.back();
        return;
      }
      setLote(l);

      const lista = await obtenerCosechasPorLote(id);
      setCosechas(lista);

      const res = await obtenerResumenCosechaLote(id);
      setResumen(res);
    } catch (err) {
      console.error('[DetalleLote] Error al cargar:', err);
    } finally {
      setCargando(false);
    }
  }, [id, router]);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [cargarDatos])
  );

  const handleRegistrarCosecha = async () => {
    if (!id) return;
    const cortadas = parseInt(cortadasInput, 10);
    const descarte = parseInt(descarteInput, 10) || 0;

    if (isNaN(cortadas) || cortadas <= 0) {
      setErrorCosecha('Ingresa una cantidad válida de cajas cortadas.');
      return;
    }
    if (descarte > cortadas) {
      setErrorCosecha('Las cajas de descarte no pueden superar las cajas cortadas.');
      return;
    }

    try {
      setGuardandoCosecha(true);
      setErrorCosecha(null);

      await registrarCosecha({
        lote_id: id,
        cajas_cortadas: cortadas,
        cajas_descarte: descarte,
        cajas_empacadas: Math.max(0, cortadas - descarte),
        fecha: hoyISO(),
      });

      setModalCosechaVisible(false);
      setCortadasInput('');
      setDescarteInput('0');
      await cargarDatos();
    } catch (err: unknown) {
      setErrorCosecha(err instanceof Error ? err.message : 'Error al registrar corte.');
    } finally {
      setGuardandoCosecha(false);
    }
  };

  const handleEliminarCorte = (corteId: string) => {
    Alert.alert(
      'Eliminar corte',
      '¿Deseas eliminar este registro de cosecha?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await eliminarCosecha(corteId);
            await cargarDatos();
          },
        },
      ]
    );
  };

  const handleCerrarLote = () => {
    if (!lote) return;
    Alert.alert(
      'Cerrar lote',
      `¿Deseas dar por finalizado el ciclo de cosecha de "${lote.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Lote',
          style: 'destructive',
          onPress: async () => {
            await cerrarLote(lote.id);
            await cargarDatos();
          },
        },
      ]
    );
  };

  if (cargando || !lote) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      </SafeAreaView>
    );
  }

  const porcentajeRendimiento = resumen && resumen.totalCortadas > 0
    ? Math.round((resumen.totalEmpacadas / resumen.totalCortadas) * 100)
    : 100;

  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado estado="offline" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.btnVolver} onPress={() => router.back()}>
          <Text style={styles.btnVolverTexto}>← Volver</Text>
        </Pressable>
        <Text style={styles.headerTitulo} numberOfLines={1}>
          {lote.nombre}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.contenido}>
        {/* Información del Lote */}
        <View style={styles.tarjetaLote}>
          <View style={styles.filaLote}>
            <View>
              <Text style={styles.nombreLote}>{lote.nombre}</Text>
              <Text style={styles.cultivoLote}>
                Cultivo: <Text style={styles.bold}>{lote.cultivo}</Text>
                {lote.variedad ? ` • Variedad: ${lote.variedad}` : ''}
              </Text>
            </View>
            <View style={[styles.badgeEstado, lote.estado === 'cerrado' && styles.badgeCerrado]}>
              <Text style={[styles.badgeEstadoTexto, lote.estado === 'cerrado' && styles.badgeCerradoTexto]}>
                {lote.estado === 'cerrado' ? 'Cerrado' : 'Activo'}
              </Text>
            </View>
          </View>
        </View>

        {/* Resumen de Producción */}
        {resumen && (
          <View style={styles.tarjetaResumen}>
            <Text style={styles.resumenTitulo}>Rendimiento de Cosecha</Text>
            <View style={styles.gridResumen}>
              <View style={styles.itemResumen}>
                <Text style={styles.itemResumenNum}>{resumen.totalCortadas}</Text>
                <Text style={styles.itemResumenLabel}>Cortadas</Text>
              </View>
              <View style={styles.itemResumen}>
                <Text style={[styles.itemResumenNum, styles.verde]}>{resumen.totalEmpacadas}</Text>
                <Text style={styles.itemResumenLabel}>Empacadas</Text>
              </View>
              <View style={styles.itemResumen}>
                <Text style={[styles.itemResumenNum, styles.rojo]}>{resumen.totalDescarte}</Text>
                <Text style={styles.itemResumenLabel}>Descarte</Text>
              </View>
              <View style={styles.itemResumen}>
                <Text style={styles.itemResumenNum}>{porcentajeRendimiento}%</Text>
                <Text style={styles.itemResumenLabel}>Aprovechable</Text>
              </View>
            </View>
          </View>
        )}

        {/* Acciones del Lote */}
        <View style={styles.filaBotones}>
          <Pressable
            style={styles.btnRegistrarCorte}
            onPress={() => {
              setErrorCosecha(null);
              setCortadasInput('');
              setDescarteInput('0');
              setModalCosechaVisible(true);
            }}
          >
            <Text style={styles.btnRegistrarCorteTexto}>+ Registrar Corte</Text>
          </Pressable>

          {lote.estado === 'activo' && (
            <Pressable style={styles.btnCerrarLote} onPress={handleCerrarLote}>
              <Text style={styles.btnCerrarLoteTexto}>Cerrar Ciclo</Text>
            </Pressable>
          )}
        </View>

        {/* Historial de Cortes */}
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Historial de Cortes ({cosechas.length})</Text>

          {cosechas.length === 0 ? (
            <View style={styles.cajaVacia}>
              <Text style={styles.cajaVaciaTexto}>No hay cortes registrados para este lote.</Text>
            </View>
          ) : (
            <View style={styles.listaCortes}>
              {cosechas.map((c) => (
                <View key={c.id} style={styles.itemCorte}>
                  <View style={styles.infoCorte}>
                    <Text style={styles.fechaCorte}>{formatearFechaCorta(c.fecha)}</Text>
                    <Text style={styles.detalleCorte}>
                      Cortadas: {c.cajas_cortadas} | Descarte: {c.cajas_descarte || 0}
                    </Text>
                  </View>
                  <View style={styles.ladoDerechoCorte}>
                    <Text style={styles.cajasEmpacadas}>{c.cajas_empacadas || 0} empacadas</Text>
                    <Pressable onPress={() => handleEliminarCorte(c.id)} hitSlop={8}>
                      <Text style={styles.btnEliminarEmoji}>🗑️</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal Registrar Cosecha */}
      <Modal
        visible={modalCosechaVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalCosechaVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>Nuevo Corte en {lote.nombre}</Text>

            <View style={styles.campo}>
              <Text style={styles.label}>Cajas Cortadas</Text>
              <TextInput
                style={styles.inputModal}
                placeholder="Ej. 50"
                placeholderTextColor="#9E9E9E"
                keyboardType="numeric"
                value={cortadasInput}
                onChangeText={setCortadasInput}
                autoFocus
              />
            </View>

            <View style={styles.campo}>
              <Text style={styles.label}>Cajas de Descarte / Merma</Text>
              <TextInput
                style={styles.inputModal}
                placeholder="0"
                placeholderTextColor="#9E9E9E"
                keyboardType="numeric"
                value={descarteInput}
                onChangeText={setDescarteInput}
              />
            </View>

            {errorCosecha && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTexto}>{errorCosecha}</Text>
              </View>
            )}

            <View style={styles.modalBotones}>
              <Pressable
                style={[styles.btnModal, styles.btnCancelar]}
                onPress={() => setModalCosechaVisible(false)}
                disabled={guardandoCosecha}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[styles.btnModal, styles.btnGuardar]}
                onPress={handleRegistrarCosecha}
                disabled={guardandoCosecha}
              >
                {guardandoCosecha ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnGuardarTexto}>Guardar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F9F7',
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EBE8',
    gap: 12,
  },
  btnVolver: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
  },
  btnVolverTexto: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B381E',
    flex: 1,
  },
  contenido: {
    padding: 16,
    gap: 16,
  },
  tarjetaLote: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EBE8',
  },
  filaLote: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nombreLote: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  cultivoLote: {
    fontSize: 14,
    color: '#71717A',
    marginTop: 4,
  },
  bold: {
    fontWeight: '700',
    color: '#1A1A1A',
  },
  badgeEstado: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
  },
  badgeEstadoTexto: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeCerrado: {
    backgroundColor: '#F3F4F6',
  },
  badgeCerradoTexto: {
    color: '#6B7280',
  },
  tarjetaResumen: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    gap: 12,
  },
  resumenTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  gridResumen: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAF9',
    borderRadius: 12,
    padding: 12,
  },
  itemResumen: {
    alignItems: 'center',
    flex: 1,
  },
  itemResumenNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  itemResumenLabel: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  verde: {
    color: '#166534',
  },
  rojo: {
    color: '#DC2626',
  },
  filaBotones: {
    flexDirection: 'row',
    gap: 10,
  },
  btnRegistrarCorte: {
    flex: 1,
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnRegistrarCorteTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnCerrarLote: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnCerrarLoteTexto: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  seccion: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    gap: 12,
  },
  seccionTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  cajaVacia: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cajaVaciaTexto: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  listaCortes: {
    gap: 8,
  },
  itemCorte: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAF9',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoCorte: {
    flex: 1,
  },
  fechaCorte: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  detalleCorte: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  ladoDerechoCorte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cajasEmpacadas: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  btnEliminarEmoji: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContenido: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 14,
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  campo: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  inputModal: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#F9FAFB',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    padding: 10,
    borderRadius: 6,
  },
  errorTexto: {
    color: '#B91C1C',
    fontSize: 13,
  },
  modalBotones: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  btnModal: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnCancelar: {
    backgroundColor: '#F3F4F6',
  },
  btnCancelarTexto: {
    color: '#4B5563',
    fontWeight: '600',
  },
  btnGuardar: {
    backgroundColor: '#2E7D32',
  },
  btnGuardarTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
