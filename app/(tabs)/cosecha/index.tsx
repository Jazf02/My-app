// ═══════════════════════════════════════════════════════════
// app/(tabs)/cosecha/index.tsx — Control de Cosechas y Lotes
// Registro de cortes, cajas empacadas y merma por lote agrícola
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BannerEstado } from '@/components/ui/BannerEstado';
import { obtenerLotes, crearLote } from '@/database/lotes';
import {
  registrarCosecha,
  obtenerCosechasPorLote,
  eliminarCosecha,
  obtenerAcumuladosCosecha,
} from '@/database/cosechas';
import { hoyISO, formatearFechaCorta } from '@/lib/fechas';
import type { Lote, Cosecha } from '@/types/domain';

interface CosechaConLote extends Cosecha {
  nombreLote?: string;
  cultivoLote?: string;
}

export default function CosechaScreen(): React.JSX.Element {
  const router = useRouter();

  const [tabActiva, setTabActiva] = useState<'cosechas' | 'lotes'>('cosechas');
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [todasCosechas, setTodasCosechas] = useState<CosechaConLote[]>([]);
  const [acumulado, setAcumulado] = useState<{
    estaSemana: number;
    esteMes: number;
    esteAno: number;
  }>({ estaSemana: 0, esteMes: 0, esteAno: 0 });
  const [cargando, setCargando] = useState(true);

  // Modal Nuevo Lote
  const [modalLoteVisible, setModalLoteVisible] = useState(false);
  const [nombreLoteInput, setNombreLoteInput] = useState('');
  const [cultivoInput, setCultivoInput] = useState('');
  const [variedadInput, setVariedadInput] = useState('');
  const [guardandoLote, setGuardandoLote] = useState(false);
  const [errorLote, setErrorLote] = useState<string | null>(null);

  // Modal Registrar Cosecha
  const [modalCosechaVisible, setModalCosechaVisible] = useState(false);
  const [loteSeleccionadoId, setLoteSeleccionadoId] = useState<string>('');
  const [cortadasInput, setCortadasInput] = useState('');
  const [descarteInput, setDescarteInput] = useState('0');
  const [guardandoCosecha, setGuardandoCosecha] = useState(false);
  const [errorCosecha, setErrorCosecha] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const [listaLotesActivos, todosLosLotes, resAcumulado] = await Promise.all([
        obtenerLotes(true),
        obtenerLotes(false),
        obtenerAcumuladosCosecha(),
      ]);

      setLotes(listaLotesActivos);
      setAcumulado(resAcumulado);

      // Cargar cosechas de todos los lotes (activos y cerrados cuentan)
      const todas: CosechaConLote[] = [];
      for (const lote of todosLosLotes) {
        const registros = await obtenerCosechasPorLote(lote.id);
        registros.forEach((c) => {
          todas.push({
            ...c,
            nombreLote: lote.nombre,
            cultivoLote: lote.cultivo,
          });
        });
      }
      // Ordenar por fecha descendente
      todas.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setTodasCosechas(todas);
    } catch (err) {
      console.error('[Cosecha] Error al cargar:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [cargarDatos])
  );

  const handleCrearLote = async () => {
    if (!nombreLoteInput.trim()) {
      setErrorLote('El nombre del lote es obligatorio.');
      return;
    }
    if (!cultivoInput.trim()) {
      setErrorLote('El cultivo es obligatorio (ej. Maíz, Tomate, Aguacate).');
      return;
    }

    try {
      setGuardandoLote(true);
      setErrorLote(null);

      await crearLote({
        nombre: nombreLoteInput.trim(),
        cultivo: cultivoInput.trim(),
        variedad: variedadInput.trim() || undefined,
      });

      setModalLoteVisible(false);
      setNombreLoteInput('');
      setCultivoInput('');
      setVariedadInput('');
      await cargarDatos();
    } catch (err: unknown) {
      setErrorLote(err instanceof Error ? err.message : 'Error al crear lote.');
    } finally {
      setGuardandoLote(false);
    }
  };

  const abrirModalCosecha = () => {
    if (lotes.length === 0) {
      Alert.alert('Atención', 'Primero debes registrar al menos un Lote agrícola.');
      setTabActiva('lotes');
      return;
    }
    setLoteSeleccionadoId(lotes[0].id);
    setCortadasInput('');
    setDescarteInput('0');
    setErrorCosecha(null);
    setModalCosechaVisible(true);
  };

  const handleRegistrarCosecha = async () => {
    if (!loteSeleccionadoId) {
      setErrorCosecha('Selecciona un lote.');
      return;
    }
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
        lote_id: loteSeleccionadoId,
        cajas_cortadas: cortadas,
        cajas_descarte: descarte,
        cajas_empacadas: Math.max(0, cortadas - descarte),
        fecha: hoyISO(),
      });

      setModalCosechaVisible(false);
      await cargarDatos();
    } catch (err: unknown) {
      setErrorCosecha(err instanceof Error ? err.message : 'Error al registrar corte.');
    } finally {
      setGuardandoCosecha(false);
    }
  };

  const handleEliminarCosecha = (c: CosechaConLote) => {
    Alert.alert(
      'Eliminar registro',
      `¿Deseas eliminar el registro de cosecha de ${c.cajas_cortadas || 0} cajas en ${c.nombreLote}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await eliminarCosecha(c.id);
            await cargarDatos();
          },
        },
      ]
    );
  };

  // Totales acumulados
  const totalCortadas = todasCosechas.reduce((acc, c) => acc + (c.cajas_cortadas || 0), 0);
  const totalDescarte = todasCosechas.reduce((acc, c) => acc + (c.cajas_descarte || 0), 0);
  const totalEmpacadas = todasCosechas.reduce((acc, c) => acc + (c.cajas_empacadas || 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado estado="offline" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.titulo}>Cosechas y Lotes</Text>
        <Pressable
          style={styles.btnPrincipal}
          onPress={tabActiva === 'cosechas' ? abrirModalCosecha : () => setModalLoteVisible(true)}
        >
          <Text style={styles.btnPrincipalTexto}>
            {tabActiva === 'cosechas' ? '+ Cosecha' : '+ Lote'}
          </Text>
        </Pressable>
      </View>

      {/* Selector de Pestaña Segmentada */}
      <View style={styles.segmentos}>
        <Pressable
          style={[styles.segmento, tabActiva === 'cosechas' && styles.segmentoActivo]}
          onPress={() => setTabActiva('cosechas')}
        >
          <Text style={[styles.segmentoTexto, tabActiva === 'cosechas' && styles.segmentoTextoActivo]}>
            🌽 Cosechas ({todasCosechas.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.segmento, tabActiva === 'lotes' && styles.segmentoActivo]}
          onPress={() => setTabActiva('lotes')}
        >
          <Text style={[styles.segmentoTexto, tabActiva === 'lotes' && styles.segmentoTextoActivo]}>
            🌱 Lotes ({lotes.length})
          </Text>
        </Pressable>
      </View>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      ) : tabActiva === 'cosechas' ? (
        /* VISTA COSECHAS */
        <ScrollView contentContainerStyle={styles.contenido}>
          {/* Tarjeta de Resumen */}
          <View style={styles.tarjetaResumen}>
            <Text style={styles.resumenTitulo}>Producción Total Acumulada</Text>
            <View style={styles.gridResumen}>
              <View style={styles.itemResumen}>
                <Text style={styles.itemResumenNum}>{totalCortadas}</Text>
                <Text style={styles.itemResumenLabel}>Cortadas</Text>
              </View>
              <View style={styles.itemResumen}>
                <Text style={[styles.itemResumenNum, styles.verde]}>{totalEmpacadas}</Text>
                <Text style={styles.itemResumenLabel}>Empacadas</Text>
              </View>
              <View style={styles.itemResumen}>
                <Text style={[styles.itemResumenNum, styles.rojo]}>{totalDescarte}</Text>
                <Text style={styles.itemResumenLabel}>Descarte</Text>
              </View>
            </View>
          </View>

          {/* Bloque Acumulado (MEJORA 7) */}
          <View style={styles.tarjetaAcumulado}>
            <Text style={styles.acumuladoTitulo}>Acumulado</Text>
            <View style={styles.filaAcumulado}>
              <Text style={styles.acumuladoLabel}>Esta semana:</Text>
              <Text style={styles.acumuladoValor}>{acumulado.estaSemana} cajas</Text>
            </View>
            <View style={styles.filaAcumulado}>
              <Text style={styles.acumuladoLabel}>Este mes:</Text>
              <Text style={styles.acumuladoValor}>{acumulado.esteMes} cajas</Text>
            </View>
            <View style={styles.filaAcumulado}>
              <Text style={styles.acumuladoLabel}>Este año:</Text>
              <Text style={styles.acumuladoValor}>{acumulado.esteAno} cajas</Text>
            </View>
          </View>

          {/* Listado de Cortes */}
          {todasCosechas.length === 0 ? (
            <View style={styles.vacioContainer}>
              <Text style={styles.vacioEmoji}>📦</Text>
              <Text style={styles.vacioTitulo}>Sin registros de cosecha</Text>
              <Text style={styles.vacioTexto}>
                Registra la recolección de cajas por lote presionando "+ Cosecha".
              </Text>
            </View>
          ) : (
            <View style={styles.listaCosechas}>
              <Text style={styles.seccionTitulo}>Historial de Cortes</Text>
              {todasCosechas.map((item) => (
                <View key={item.id} style={styles.tarjetaCorte}>
                  <View style={styles.infoCorte}>
                    <Text style={styles.loteCorte}>{item.nombreLote}</Text>
                    <Text style={styles.cultivoCorte}>{item.cultivoLote}</Text>
                    <Text style={styles.fechaCorte}>{formatearFechaCorta(item.fecha)}</Text>
                  </View>

                  <View style={styles.metricasCorte}>
                    <View style={styles.badgeCorte}>
                      <Text style={styles.cajasCortadasNum}>{item.cajas_cortadas} cx</Text>
                      <Text style={styles.cajasEmpacadasNum}>
                        ✓ {item.cajas_empacadas ?? (item.cajas_cortadas || 0) - (item.cajas_descarte || 0)} empacadas
                      </Text>
                      {Boolean(item.cajas_descarte) && (
                        <Text style={styles.cajasDescarteNum}>✕ {item.cajas_descarte} descarte</Text>
                      )}
                    </View>

                    <Pressable
                      onPress={() => handleEliminarCosecha(item)}
                      hitSlop={8}
                    >
                      <Text style={styles.btnEliminarEmoji}>🗑️</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        /* VISTA LOTES */
        <FlatList
          data={lotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listaLotes}
          ListEmptyComponent={
            <View style={styles.vacioContainer}>
              <Text style={styles.vacioEmoji}>🌱</Text>
              <Text style={styles.vacioTitulo}>No hay lotes registrados</Text>
              <Text style={styles.vacioTexto}>
                Crea tu primer lote (ej. Lote 1, Parcela Norte) con su cultivo para comenzar.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.tarjetaLote, pressed && styles.tarjetaLotePresionada]}
              onPress={() => router.push(`/(tabs)/cosecha/${item.id}` as any)}
            >
              <View style={styles.tarjetaLoteIcono}>
                <Text style={styles.tarjetaLoteEmoji}>🌱</Text>
              </View>
              <View style={styles.tarjetaLoteInfo}>
                <Text style={styles.nombreLote}>{item.nombre}</Text>
                <Text style={styles.cultivoLote}>
                  {item.cultivo} {item.variedad ? `(${item.variedad})` : ''}
                </Text>
              </View>
              <Text style={styles.flechaDerecha}>→</Text>
            </Pressable>
          )}
        />
      )}

      {/* Modal Nuevo Lote */}
      <Modal
        visible={modalLoteVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalLoteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>Nuevo Lote Agrícola</Text>

            <View style={styles.campo}>
              <Text style={styles.label}>Nombre del Lote</Text>
              <TextInput
                style={styles.inputModal}
                placeholder="Ej. Lote Norte, Parcela 3"
                placeholderTextColor="#9E9E9E"
                value={nombreLoteInput}
                onChangeText={setNombreLoteInput}
                autoFocus
              />
            </View>

            <View style={styles.campo}>
              <Text style={styles.label}>Cultivo</Text>
              <TextInput
                style={styles.inputModal}
                placeholder="Ej. Maíz, Café, Tomate, Plátano"
                placeholderTextColor="#9E9E9E"
                value={cultivoInput}
                onChangeText={setCultivoInput}
              />
            </View>

            <View style={styles.campo}>
              <Text style={styles.label}>Variedad (opcional)</Text>
              <TextInput
                style={styles.inputModal}
                placeholder="Ej. H-53, Catuaí, Saladette"
                placeholderTextColor="#9E9E9E"
                value={variedadInput}
                onChangeText={setVariedadInput}
              />
            </View>

            {errorLote && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTexto}>{errorLote}</Text>
              </View>
            )}

            <View style={styles.modalBotones}>
              <Pressable
                style={[styles.btnModal, styles.btnCancelar]}
                onPress={() => setModalLoteVisible(false)}
                disabled={guardandoLote}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[styles.btnModal, styles.btnGuardar]}
                onPress={handleCrearLote}
                disabled={guardandoLote}
              >
                {guardandoLote ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnGuardarTexto}>Crear Lote</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Registrar Cosecha */}
      <Modal
        visible={modalCosechaVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalCosechaVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>Registrar Cosecha</Text>

            <View style={styles.campo}>
              <Text style={styles.label}>Seleccionar Lote</Text>
              <View style={styles.selectorLotes}>
                {lotes.map((l) => (
                  <Pressable
                    key={l.id}
                    style={[
                      styles.opcionLote,
                      loteSeleccionadoId === l.id && styles.opcionLoteActivo,
                    ]}
                    onPress={() => setLoteSeleccionadoId(l.id)}
                  >
                    <Text
                      style={[
                        styles.opcionLoteTexto,
                        loteSeleccionadoId === l.id && styles.opcionLoteTextoActivo,
                      ]}
                    >
                      {l.nombre} ({l.cultivo})
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.campo}>
              <Text style={styles.label}>Cajas Cortadas</Text>
              <TextInput
                style={styles.inputModal}
                placeholder="Ej. 100"
                placeholderTextColor="#9E9E9E"
                keyboardType="numeric"
                value={cortadasInput}
                onChangeText={setCortadasInput}
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
                  <Text style={styles.btnGuardarTexto}>Guardar Corte</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EBE8',
  },
  titulo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B381E',
  },
  btnPrincipal: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnPrincipalTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  segmentos: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EBE8',
  },
  segmento: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  segmentoActivo: {
    backgroundColor: '#E8F5E9',
  },
  segmentoTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentoTextoActivo: {
    color: '#1B5E20',
    fontWeight: '700',
  },
  contenido: {
    padding: 16,
    gap: 16,
  },
  tarjetaResumen: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    gap: 12,
  },
  tarjetaAcumulado: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    gap: 8,
  },
  acumuladoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  filaAcumulado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  acumuladoLabel: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  acumuladoValor: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
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
    flex: 1,
    alignItems: 'center',
  },
  itemResumenNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  itemResumenLabel: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  verde: {
    color: '#166534',
  },
  rojo: {
    color: '#DC2626',
  },
  listaCosechas: {
    gap: 10,
  },
  seccionTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  tarjetaCorte: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EBE8',
  },
  infoCorte: {
    flex: 1,
    gap: 2,
  },
  loteCorte: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  cultivoCorte: {
    fontSize: 13,
    color: '#6B7280',
  },
  fechaCorte: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  metricasCorte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeCorte: {
    alignItems: 'flex-end',
    gap: 2,
  },
  cajasCortadasNum: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  cajasEmpacadasNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  cajasDescarteNum: {
    fontSize: 11,
    color: '#DC2626',
  },
  btnEliminarEmoji: {
    fontSize: 16,
  },
  listaLotes: {
    padding: 16,
    gap: 10,
  },
  tarjetaLote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EBE8',
  },
  tarjetaLotePresionada: {
    backgroundColor: '#F9FAF9',
  },
  tarjetaLoteIcono: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tarjetaLoteEmoji: {
    fontSize: 22,
  },
  tarjetaLoteInfo: {
    flex: 1,
  },
  nombreLote: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  cultivoLote: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  flechaDerecha: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  vacioContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  vacioEmoji: {
    fontSize: 56,
  },
  vacioTitulo: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  vacioTexto: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
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
  selectorLotes: {
    gap: 6,
    maxHeight: 140,
  },
  opcionLote: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  opcionLoteActivo: {
    backgroundColor: '#2E7D32',
  },
  opcionLoteTexto: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '600',
  },
  opcionLoteTextoActivo: {
    color: '#FFFFFF',
    fontWeight: '700',
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
