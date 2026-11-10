// ═══════════════════════════════════════════════════════════
// app/(tabs)/trabajadores/index.tsx — Lista y Gestión de Trabajadores
// 100% Offline-First con persistencia directa en SQLite
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BannerEstado } from '@/components/ui/BannerEstado';
import {
  obtenerTrabajadores,
  crearTrabajador,
  actualizarTrabajador,
  desactivarTrabajador,
  activarTrabajador,
  eliminarTrabajador,
} from '@/database/trabajadores';
import { suscribirSyncCompletado, ejecutarSincronizacion } from '@/sync/syncEngine';
import { formatearMoneda } from '@/lib/fechas';
import type { Trabajador } from '@/types/domain';

export default function TrabajadoresScreen(): React.JSX.Element {
  const router = useRouter();
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [soloActivos, setSoloActivos] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Modal para Crear / Editar
  const [modalVisible, setModalVisible] = useState(false);
  const [trabajadorEditando, setTrabajadorEditando] = useState<Trabajador | null>(null);
  const [nombreInput, setNombreInput] = useState('');
  const [tarifaInput, setTarifaInput] = useState('250');
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const lista = await obtenerTrabajadores(soloActivos);
      setTrabajadores(lista);
    } catch (err) {
      console.error('[Trabajadores] Error al cargar:', err);
    } finally {
      setCargando(false);
    }
  }, [soloActivos]);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
      ejecutarSincronizacion().catch(() => {});
    }, [cargarDatos])
  );

  useEffect(() => {
    const unsub = suscribirSyncCompletado(() => {
      cargarDatos();
    });
    return unsub;
  }, [cargarDatos]);

  const abrirModalCrear = () => {
    setTrabajadorEditando(null);
    setNombreInput('');
    setTarifaInput('250');
    setErrorForm(null);
    setModalVisible(true);
  };

  const abrirModalEditar = (t: Trabajador) => {
    setTrabajadorEditando(t);
    setNombreInput(t.nombre);
    setTarifaInput(String(t.tarifa_diaria_default || 250));
    setErrorForm(null);
    setModalVisible(true);
  };

  const handleGuardar = async () => {
    if (!nombreInput.trim()) {
      setErrorForm('El nombre es obligatorio.');
      return;
    }
    const tarifa = parseFloat(tarifaInput.replace(',', '.'));
    if (isNaN(tarifa) || tarifa <= 0) {
      setErrorForm('Ingresa una tarifa diaria válida (mayor a 0).');
      return;
    }

    try {
      setGuardando(true);
      setErrorForm(null);

      if (trabajadorEditando) {
        await actualizarTrabajador(trabajadorEditando.id, {
          nombre: nombreInput.trim(),
          tarifa_diaria_default: tarifa,
        });
      } else {
        await crearTrabajador({
          nombre: nombreInput.trim(),
          tarifa_diaria_default: tarifa,
        });
      }

      setModalVisible(false);
      await cargarDatos();
      ejecutarSincronizacion().catch(() => {});
    } catch (err: unknown) {
      setErrorForm(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleActivo = async (t: Trabajador) => {
    try {
      if (t.activo === 1) {
        Alert.alert(
          'Desactivar trabajador',
          `¿Deseas marcar a "${t.nombre}" como inactivo? No aparecerá en la asistencia diaria pero sus registros históricos se conservarán.`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Desactivar',
              style: 'destructive',
              onPress: async () => {
                await desactivarTrabajador(t.id);
                await cargarDatos();
                ejecutarSincronizacion().catch(() => {});
              },
            },
          ]
        );
      } else {
        await activarTrabajador(t.id);
        await cargarDatos();
        ejecutarSincronizacion().catch(() => {});
      }
    } catch (err) {
      console.error('[Trabajadores] Error al cambiar estado:', err);
    }
  };

  const handleEliminarTrabajador = (t: Trabajador) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirma = window.confirm(
        `¿Eliminar definitivamente a "${t.nombre}"?\n\nEsta acción borrará al trabajador y todos sus registros de asistencia de forma permanente.`
      );
      if (confirma) {
        eliminarTrabajador(t.id)
          .then(async () => {
            if (modalVisible) setModalVisible(false);
            await cargarDatos();
            ejecutarSincronizacion().catch(() => {});
          })
          .catch((err) => {
            Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo eliminar el trabajador.');
          });
      }
      return;
    }

    Alert.alert(
      'Eliminar Trabajador',
      `¿Deseas eliminar definitivamente a "${t.nombre}"?\n\nEsta acción no se puede deshacer y borrará sus registros de asistencia.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarTrabajador(t.id);
              if (modalVisible) setModalVisible(false);
              await cargarDatos();
              ejecutarSincronizacion().catch(() => {});
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo eliminar el trabajador.');
            }
          },
        },
      ]
    );
  };

  const filtrados = trabajadores.filter((t) =>
    t.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado />

      {/* Encabezado */}
      <View style={styles.header}>
        <View>
          <Text style={styles.titulo}>Trabajadores</Text>
          <Text style={styles.subtitulo}>
            {trabajadores.length} {trabajadores.length === 1 ? 'registrado' : 'registrados'}
          </Text>
        </View>

        <Pressable
          id="trabajadores-btn-agregar"
          style={({ pressed }) => [styles.btnAgregar, pressed && styles.btnPresionado]}
          onPress={abrirModalCrear}
          accessibilityRole="button"
          accessibilityLabel="Agregar nuevo trabajador"
        >
          <Text style={styles.btnAgregarTexto}>+ Nuevo</Text>
        </Pressable>
      </View>

      {/* Barra de Búsqueda y Filtros */}
      <View style={styles.filtrosContainer}>
        <TextInput
          id="trabajadores-input-buscar"
          style={styles.inputBuscar}
          placeholder="Buscar por nombre..."
          placeholderTextColor="#9E9E9E"
          value={busqueda}
          onChangeText={setBusqueda}
          clearButtonMode="while-editing"
        />

        <View style={styles.pillContainer}>
          <Pressable
            style={[styles.pill, soloActivos && styles.pillActiva]}
            onPress={() => setSoloActivos(true)}
          >
            <Text style={[styles.pillTexto, soloActivos && styles.pillTextoActiva]}>
              Solo Activos
            </Text>
          </Pressable>
          <Pressable
            style={[styles.pill, !soloActivos && styles.pillActiva]}
            onPress={() => setSoloActivos(false)}
          >
            <Text style={[styles.pillTexto, !soloActivos && styles.pillTextoActiva]}>
              Todos
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Lista de Trabajadores */}
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      ) : filtrados.length === 0 ? (
        <View style={styles.vacioContainer}>
          <Text style={styles.vacioEmoji}>🧑‍🌾</Text>
          <Text style={styles.vacioTitulo}>
            {busqueda ? 'No se encontraron resultados' : 'No hay trabajadores'}
          </Text>
          <Text style={styles.vacioTexto}>
            {busqueda
              ? 'Intenta con otro término de búsqueda.'
              : 'Presiona el botón "+ Nuevo" arriba para registrar a tu primer trabajador.'}
          </Text>
          {!busqueda && (
            <Pressable style={styles.btnCrearPrimero} onPress={abrirModalCrear}>
              <Text style={styles.btnCrearPrimeroTexto}>+ Agregar Trabajador</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.tarjeta, pressed && styles.tarjetaPresionada]}
              onPress={() => router.push(`/(tabs)/trabajadores/${item.id}` as any)}
            >
              <View style={styles.tarjetaContenido}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarEmoji}>🧑‍🌾</Text>
                </View>

                <View style={styles.infoTrabajador}>
                  <Text style={styles.nombreTrabajador} numberOfLines={1}>
                    {item.nombre}
                  </Text>
                  <View style={styles.filaTarifa}>
                    <Text style={styles.tarifaMonto}>
                      {formatearMoneda(item.tarifa_diaria_default || 250)}
                    </Text>
                    <Text style={styles.tarifaEtiqueta}>/ día</Text>
                    {item.activo === 0 && (
                      <View style={styles.badgeInactivo}>
                        <Text style={styles.badgeInactivoTexto}>Inactivo</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.hintAdelantos}>
                    💵 Toca para dar adelantos o ver historial →
                  </Text>
                </View>

                {/* Acciones Rápidas */}
                <View style={styles.accionesRapidas}>
                  <Pressable
                    style={[styles.btnAccion, styles.btnAccionAdelanto]}
                    onPress={() => router.push(`/(tabs)/trabajadores/${item.id}` as any)}
                    hitSlop={8}
                    accessibilityLabel="Dar adelanto a trabajador"
                  >
                    <Text style={styles.btnAccionIcono}>💵</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btnAccion}
                    onPress={() => abrirModalEditar(item)}
                    hitSlop={8}
                    accessibilityLabel="Editar trabajador"
                  >
                    <Text style={styles.btnAccionIcono}>✏️</Text>
                  </Pressable>
                  <Pressable
                    style={styles.btnAccion}
                    onPress={() => handleToggleActivo(item)}
                    hitSlop={8}
                    accessibilityLabel={item.activo === 1 ? 'Desactivar' : 'Activar'}
                  >
                    <Text style={styles.btnAccionIcono}>
                      {item.activo === 1 ? '🟢' : '⚪'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnAccion, styles.btnAccionEliminar]}
                    onPress={() => handleEliminarTrabajador(item)}
                    hitSlop={8}
                    accessibilityLabel="Eliminar trabajador"
                  >
                    <Text style={styles.btnAccionIcono}>🗑️</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Modal para Crear / Editar */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>
              {trabajadorEditando ? 'Editar Trabajador' : 'Nuevo Trabajador'}
            </Text>

            <View style={styles.campo}>
              <Text style={styles.label}>Nombre completo</Text>
              <TextInput
                style={styles.inputModal}
                placeholder="Ej. Juan Pérez"
                placeholderTextColor="#9E9E9E"
                value={nombreInput}
                onChangeText={setNombreInput}
                autoFocus
              />
            </View>

            <View style={styles.campo}>
              <Text style={styles.label}>Tarifa diaria base</Text>
              <TextInput
                style={styles.inputModal}
                placeholder="250"
                placeholderTextColor="#9E9E9E"
                value={tarifaInput}
                onChangeText={setTarifaInput}
                keyboardType="numeric"
              />
              <Text style={styles.ayudaInput}>
                Monto base por día trabajado (en Lempiras).
              </Text>
            </View>

            {errorForm && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTexto}>{errorForm}</Text>
              </View>
            )}

            {trabajadorEditando && (
              <Pressable
                style={styles.btnEliminarModal}
                onPress={() => handleEliminarTrabajador(trabajadorEditando)}
                disabled={guardando}
              >
                <Text style={styles.btnEliminarModalTexto}>🗑️ Eliminar trabajador definitivamente</Text>
              </Pressable>
            )}

            <View style={styles.modalBotones}>
              <Pressable
                style={[styles.btnModal, styles.btnCancelar]}
                onPress={() => setModalVisible(false)}
                disabled={guardando}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[styles.btnModal, styles.btnGuardar]}
                onPress={handleGuardar}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnGuardarTexto}>
                    {trabajadorEditando ? 'Guardar Cambios' : 'Registrar'}
                  </Text>
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
    fontSize: 26,
    fontWeight: '700',
    color: '#1B381E',
    letterSpacing: -0.5,
  },
  subtitulo: {
    fontSize: 14,
    color: '#667085',
    marginTop: 2,
  },
  btnAgregar: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnPresionado: {
    opacity: 0.85,
  },
  btnAgregarTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  filtrosContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EBE8',
  },
  inputBuscar: {
    backgroundColor: '#F2F4F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A1A',
  },
  pillContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E8ECE8',
  },
  pillActiva: {
    backgroundColor: '#2E7D32',
  },
  pillTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  pillTextoActiva: {
    color: '#FFFFFF',
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lista: {
    padding: 16,
    gap: 12,
  },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tarjetaPresionada: {
    backgroundColor: '#F9FAF9',
  },
  tarjetaContenido: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  infoTrabajador: {
    flex: 1,
  },
  nombreTrabajador: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  filaTarifa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tarifaMonto: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  tarifaEtiqueta: {
    fontSize: 13,
    color: '#71717A',
  },
  badgeInactivo: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  badgeInactivoTexto: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  accionesRapidas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 10,
  },
  btnAccion: {
    padding: 6,
    borderRadius: 8,
  },
  btnAccionAdelanto: {
    backgroundColor: '#FEF3C7',
  },
  btnAccionEliminar: {
    backgroundColor: '#FEF2F2',
  },
  hintAdelantos: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
    marginTop: 3,
  },
  btnEliminarModal: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  btnEliminarModalTexto: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  btnAccionIcono: {
    fontSize: 18,
  },
  vacioContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  vacioEmoji: {
    fontSize: 56,
  },
  vacioTitulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  vacioTexto: {
    fontSize: 15,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 22,
  },
  btnCrearPrimero: {
    marginTop: 12,
    backgroundColor: '#2E7D32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnCrearPrimeroTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitulo: {
    fontSize: 22,
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
  ayudaInput: {
    fontSize: 12,
    color: '#9CA3AF',
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
    marginTop: 8,
  },
  btnModal: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelar: {
    backgroundColor: '#F3F4F6',
  },
  btnCancelarTexto: {
    color: '#4B5563',
    fontSize: 15,
    fontWeight: '600',
  },
  btnGuardar: {
    backgroundColor: '#2E7D32',
  },
  btnGuardarTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
