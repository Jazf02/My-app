// ═══════════════════════════════════════════════════════════
// app/(tabs)/hoy.tsx — Libreta Digital de Asistencia Diaria
// MEJORA 1: Calendario horizontal deslizante
// MEJORA 3: Separación de responsabilidades
// MEJORA 5: Domingo automático + Filtro dominicales
// MEJORA 6: Buscador de trabajadores en Asistencia
// MEJORA 7: Tarifa dominical predeterminada desde AsyncStorage
// ═══════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useMemo, useState } from 'react';
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
import { obtenerTrabajadores } from '@/database/trabajadores';
import {
  obtenerOCrearSemanaParaFecha,
  obtenerAsistenciaSemanal,
  marcarAsistencia,
} from '@/database/asistencia';
import {
  hoyISO,
  fechaToISO,
  formatearFechaCorta,
  formatearMoneda,
  lunesDeSemana,
} from '@/lib/fechas';
import type { Trabajador, Semana, DiaTrabajado } from '@/types/domain';

export default function HoyScreen(): React.JSX.Element {
  const router = useRouter();

  // Fecha seleccionada (por defecto hoy)
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(hoyISO());
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [semana, setSemana] = useState<Semana | null>(null);
  const [asistencias, setAsistencias] = useState<DiaTrabajado[]>([]);
  const [cargando, setCargando] = useState(true);

  // Undo Toast state
  const [toastUndo, setToastUndo] = useState<{
    mensaje: string;
    accion: () => Promise<void>;
  } | null>(null);
  const [toastTimeout, setToastTimeout] = useState<any>(null);

  // Tarifa override modal state
  const [modalTarifaVisible, setModalTarifaVisible] = useState(false);
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState<Trabajador | null>(null);
  const [tarifaOverrideInput, setTarifaOverrideInput] = useState('');

  // Buscador de trabajadores en Asistencia
  const [busqueda, setBusqueda] = useState<string>('');

  const mostrarUndo = (mensaje: string, accionRevertir: () => Promise<void>) => {
    if (toastTimeout) clearTimeout(toastTimeout);
    setToastUndo({ mensaje, accion: accionRevertir });
    const timer = setTimeout(() => {
      setToastUndo(null);
    }, 5000);
    setToastTimeout(timer);
  };

  const ejecutarUndo = async () => {
    if (toastUndo) {
      if (toastTimeout) clearTimeout(toastTimeout);
      const acc = toastUndo.accion;
      setToastUndo(null);
      await acc();
    }
  };

  // Cargar datos para la fecha seleccionada
  const cargarDatos = useCallback(async (fecha: string) => {
    try {
      setCargando(true);
      const [todosTrabajadores, semanaObj] = await Promise.all([
        obtenerTrabajadores(true),
        obtenerOCrearSemanaParaFecha(fecha),
      ]);

      setTrabajadores(todosTrabajadores);
      setSemana(semanaObj);

      const listaAsistencias = await obtenerAsistenciaSemanal(semanaObj.id);
      setAsistencias(listaAsistencias);
    } catch (err) {
      console.error('[Hoy] Error al cargar datos:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarDatos(fechaSeleccionada);
    }, [cargarDatos, fechaSeleccionada])
  );

  // Cálculo de si el día seleccionado es Domingo (MEJORA 5)
  const esDomingo = useMemo(() => {
    const d = new Date(fechaSeleccionada + 'T00:00:00');
    return d.getDay() === 0;
  }, [fechaSeleccionada]);

  // Lista de trabajadores según filtro dominical (MEJORA 5)
  const trabajadoresVisibles = useMemo(() => {
    if (esDomingo) {
      return trabajadores.filter((t) => Boolean(t.dominical));
    }
    return trabajadores;
  }, [trabajadores, esDomingo]);

  // Lista de trabajadores filtrada por búsqueda (solo visual, no altera totales)
  const trabajadoresFiltrados = useMemo(() => {
    if (!busqueda.trim()) return trabajadoresVisibles;
    const q = busqueda.toLowerCase().trim();
    return trabajadoresVisibles.filter((t) =>
      t.nombre.toLowerCase().includes(q)
    );
  }, [trabajadoresVisibles, busqueda]);

  // Navegación de semanas (◄ ► cambia semana/mes)
  const cambiarSemana = (diasOffset: number) => {
    const d = new Date(fechaSeleccionada + 'T00:00:00');
    d.setDate(d.getDate() + diasOffset);
    const nuevaFecha = fechaToISO(d);
    setFechaSeleccionada(nuevaFecha);
  };

  const irAHoy = () => {
    setFechaSeleccionada(hoyISO());
  };

  // Asistencia del trabajador en la fecha seleccionada
  const getRegistroDia = (trabajadorId: string): DiaTrabajado | undefined => {
    return asistencias.find(
      (a) => a.trabajador_id === trabajadorId && a.fecha === fechaSeleccionada
    );
  };

  // Obtener tarifa aplicada para el día (si hay override se respeta; en domingo el monto es manual)
  const getTarifaAplicada = (trabajador: Trabajador, registro?: DiaTrabajado): number => {
    if (typeof registro?.tarifa_diaria === 'number' && registro.tarifa_diaria > 0) {
      return registro.tarifa_diaria;
    }
    return trabajador.tarifa_diaria_default || 250;
  };

  const verificarSemanaAbierta = (): boolean => {
    if (semana && (semana.estado === 'cerrada' || semana.estado === 'pagada')) {
      Alert.alert(
        'Semana Cerrada',
        'Esta semana está cerrada. Para corregir, reabrir desde la pestaña Reportes.'
      );
      return false;
    }
    return true;
  };

  const handleToggleAsistencia = async (trabajador: Trabajador) => {
    if (!semana) return;
    if (!verificarSemanaAbierta()) return;

    const registro = getRegistroDia(trabajador.id);
    const estadoActual = Boolean(registro && registro.presente === 1);
    const nuevoEstado = !estadoActual;

    // Regla de Negocio: En domingo, si se va a marcar Presente, se pide el monto manual
    if (esDomingo && nuevoEstado) {
      abrirModalTarifa(trabajador);
      return;
    }

    try {
      await marcarAsistencia({
        semanaId: semana.id,
        trabajadorId: trabajador.id,
        fecha: fechaSeleccionada,
        presente: nuevoEstado,
        tarifaDiariaOverride: registro?.tarifa_diaria ?? null,
      });

      const actualizadas = await obtenerAsistenciaSemanal(semana.id);
      setAsistencias(actualizadas);

      mostrarUndo(
        `${trabajador.nombre} marcado como ${nuevoEstado ? 'Presente' : 'Ausente'}`,
        async () => {
          await marcarAsistencia({
            semanaId: semana.id,
            trabajadorId: trabajador.id,
            fecha: fechaSeleccionada,
            presente: estadoActual,
            tarifaDiariaOverride: registro?.tarifa_diaria ?? null,
          });
          const revertidas = await obtenerAsistenciaSemanal(semana.id);
          setAsistencias(revertidas);
        }
      );
    } catch (err) {
      console.error('[Hoy] Error al marcar asistencia:', err);
    }
  };

  const handleMarcarTodos = async (presente: boolean) => {
    if (!semana || trabajadoresVisibles.length === 0) return;
    if (!verificarSemanaAbierta()) return;

    try {
      const backupAsistencias = [...asistencias];
      for (const t of trabajadoresVisibles) {
        const reg = getRegistroDia(t.id);
        const tarifaPorDefecto = getTarifaAplicada(t, reg);
        await marcarAsistencia({
          semanaId: semana.id,
          trabajadorId: t.id,
          fecha: fechaSeleccionada,
          presente,
          tarifaDiariaOverride: reg?.tarifa_diaria ?? (esDomingo ? tarifaPorDefecto : null),
        });
      }
      const actualizadas = await obtenerAsistenciaSemanal(semana.id);
      setAsistencias(actualizadas);

      mostrarUndo(
        presente ? 'Todos marcados presentes' : 'Asistencia limpiada',
        async () => {
          for (const a of backupAsistencias.filter((x) => x.fecha === fechaSeleccionada)) {
            await marcarAsistencia({
              semanaId: semana.id,
              trabajadorId: a.trabajador_id,
              fecha: a.fecha,
              presente: a.presente === 1,
              tarifaDiariaOverride: a.tarifa_diaria,
            });
          }
          const revertidas = await obtenerAsistenciaSemanal(semana.id);
          setAsistencias(revertidas);
        }
      );
    } catch (err) {
      console.error('[Hoy] Error al marcar todos:', err);
    }
  };

  const abrirModalTarifa = (trabajador: Trabajador) => {
    if (!verificarSemanaAbierta()) return;
    const reg = getRegistroDia(trabajador.id);
    // Si ya tiene un monto guardado, sugerirlo; si es domingo nuevo, dejar vacío para ingreso manual
    let tarifaInicial = '';
    if (typeof reg?.tarifa_diaria === 'number' && reg.tarifa_diaria > 0) {
      tarifaInicial = String(reg.tarifa_diaria);
    } else if (!esDomingo) {
      tarifaInicial = String(trabajador.tarifa_diaria_default || 250);
    }
    setTrabajadorSeleccionado(trabajador);
    setTarifaOverrideInput(tarifaInicial);
    setModalTarifaVisible(true);
  };

  const guardarTarifaOverride = async () => {
    if (!trabajadorSeleccionado || !semana) return;
    if (!verificarSemanaAbierta()) return;

    const tarifa = parseFloat(tarifaOverrideInput.replace(',', '.'));
    if (isNaN(tarifa) || tarifa <= 0) {
      Alert.alert('Monto requerido', 'Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    try {
      const reg = getRegistroDia(trabajadorSeleccionado.id);
      // Al guardar tarifa en domingo, si no estaba marcado presente, marcarlo como presente
      const marcarPresente = reg ? Boolean(reg.presente) : true;

      await marcarAsistencia({
        semanaId: semana.id,
        trabajadorId: trabajadorSeleccionado.id,
        fecha: fechaSeleccionada,
        presente: marcarPresente,
        tarifaDiariaOverride: tarifa,
      });

      setModalTarifaVisible(false);
      const actualizadas = await obtenerAsistenciaSemanal(semana.id);
      setAsistencias(actualizadas);
    } catch (err) {
      console.error('[Hoy] Error al guardar tarifa:', err);
    }
  };

  // Cinta de 7 días de la semana actual (MEJORA 1)
  const diasSemana = useMemo(() => {
    const d = new Date(fechaSeleccionada + 'T00:00:00');
    const lunesISO = lunesDeSemana(d);
    const lunesDate = new Date(lunesISO + 'T00:00:00');
    const nombresDiasAbrev = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    return Array.from({ length: 7 }, (_, i) => {
      const diaObj = new Date(lunesDate.getTime());
      diaObj.setDate(lunesDate.getDate() + i);
      const iso = fechaToISO(diaObj);
      const numDia = diaObj.getDate();
      const abrev = nombresDiasAbrev[i];

      // Conteo de trabajadores marcados presentes en esa fecha
      const marcados = asistencias.filter(
        (a) => a.fecha === iso && a.presente === 1
      ).length;
      const tieneRegistros = marcados > 0;

      return {
        iso,
        numDia,
        abrev,
        marcados,
        tieneRegistros,
        esSeleccionado: iso === fechaSeleccionada,
        esHoy: iso === hoyISO(),
      };
    });
  }, [fechaSeleccionada, asistencias]);

  // Título del periodo/mes mostrado
  const tituloMesPeriodo = useMemo(() => {
    const d = new Date(fechaSeleccionada + 'T00:00:00');
    return d.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' });
  }, [fechaSeleccionada]);

  // Totales del día seleccionado
  const totalPresentes = trabajadoresVisibles.filter((t) => {
    const reg = getRegistroDia(t.id);
    return Boolean(reg && reg.presente === 1);
  }).length;

  const totalNominaDia = trabajadoresVisibles.reduce((acc, t) => {
    const reg = getRegistroDia(t.id);
    if (reg && reg.presente === 1) {
      const tarifa = getTarifaAplicada(t, reg);
      return acc + tarifa;
    }
    return acc;
  }, 0);

  const esHoy = fechaSeleccionada === hoyISO();

  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado estado="offline" />

      {/* Cabecera de Calendario con Navegación de Mes/Semana (MEJORA 1) */}
      <View style={styles.headerCalendario}>
        <View style={styles.barraMes}>
          <Pressable
            style={styles.btnFlecha}
            onPress={() => cambiarSemana(-7)}
            hitSlop={8}
            accessibilityLabel="Semana anterior"
          >
            <Text style={styles.btnFlechaTexto}>◄</Text>
          </Pressable>

          <View style={styles.centroMes}>
            <Text style={styles.textoMes}>{tituloMesPeriodo}</Text>
            {!esHoy && (
              <Pressable style={styles.badgeIrHoy} onPress={irAHoy}>
                <Text style={styles.badgeIrHoyTexto}>Volver a Hoy</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={styles.btnFlecha}
            onPress={() => cambiarSemana(7)}
            hitSlop={8}
            accessibilityLabel="Semana siguiente"
          >
            <Text style={styles.btnFlechaTexto}>►</Text>
          </Pressable>
        </View>

        {/* Cinta Horizontal Deslizante de 7 Días */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cintaDias}
        >
          {diasSemana.map((dia) => (
            <Pressable
              key={dia.iso}
              style={[
                styles.tarjetaDia,
                dia.esSeleccionado && styles.tarjetaDiaSeleccionada,
                dia.esHoy && !dia.esSeleccionado && styles.tarjetaDiaHoy,
              ]}
              onPress={() => setFechaSeleccionada(dia.iso)}
            >
              <Text
                style={[
                  styles.diaAbrev,
                  dia.esSeleccionado && styles.diaAbrevSeleccionado,
                ]}
              >
                {dia.abrev}
              </Text>
              <Text
                style={[
                  styles.diaNumero,
                  dia.esSeleccionado && styles.diaNumeroSeleccionado,
                ]}
              >
                {dia.numDia}
              </Text>
              <Text
                style={[
                  styles.diaIndicador,
                  dia.esSeleccionado && styles.diaIndicadorSeleccionado,
                ]}
              >
                {dia.tieneRegistros ? '●' : '○'}
              </Text>
              <Text
                style={[
                  styles.diaConteo,
                  dia.esSeleccionado && styles.diaConteoSeleccionado,
                ]}
              >
                {dia.marcados}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Fecha Seleccionada y Acciones Rápidas */}
        <View style={styles.filaSubheader}>
          <View style={styles.infoDiaSeleccionado}>
            <Text style={styles.textoFechaActiva}>
              {formatearFechaCorta(fechaSeleccionada)}
            </Text>
            {esDomingo && (
              <View style={styles.badgeDomingoHeader}>
                <Text style={styles.badgeDomingoHeaderTexto}>☀️ DOMINGO — Pago Especial</Text>
              </View>
            )}
          </View>

          {trabajadoresVisibles.length > 0 && (
            <View style={styles.filaAcciones}>
              <Pressable
                style={[styles.btnAccionRapida, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1 }]}
                onPress={() => router.push('/(tabs)/instalar' as any)}
              >
                <Text style={{ color: '#15803D', fontSize: 11, fontWeight: '700' }}>📲 Instalar QR</Text>
              </Pressable>
              <Pressable
                style={styles.btnAccionRapida}
                onPress={() => handleMarcarTodos(true)}
              >
                <Text style={styles.btnAccionRapidaTexto}>✓ Todos</Text>
              </Pressable>
              <Pressable
                style={[styles.btnAccionRapida, styles.btnAccionRapidaGris]}
                onPress={() => handleMarcarTodos(false)}
              >
                <Text style={styles.btnAccionRapidaGrisTexto}>✕ Limpiar</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Barra de Búsqueda de Trabajadores */}
      {trabajadoresVisibles.length > 0 && (
        <View style={styles.barraBusqueda}>
          <TextInput
            style={styles.inputBusqueda}
            placeholder="Buscar trabajador por nombre..."
            placeholderTextColor="#9CA3AF"
            value={busqueda}
            onChangeText={setBusqueda}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {busqueda.length > 0 && (
            <Pressable
              style={styles.btnLimpiarBusqueda}
              onPress={() => setBusqueda('')}
              hitSlop={8}
            >
              <Text style={styles.btnLimpiarTexto}>✕</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Lista de Trabajadores */}
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      ) : trabajadoresVisibles.length === 0 ? (
        <View style={styles.vacioContainer}>
          <Text style={styles.vacioEmoji}>{esDomingo ? '☀️' : '📋'}</Text>
          <Text style={styles.vacioTitulo}>
            {esDomingo ? 'Sin trabajadores dominicales' : 'Sin trabajadores activos'}
          </Text>
          <Text style={styles.vacioTexto}>
            {esDomingo
              ? 'Los domingos solo se muestran trabajadores con el toggle "Dominical" activo en su detalle.'
              : 'Para pasar lista, primero registra tus trabajadores en la pestaña "Trabajadores".'}
          </Text>
          <Pressable
            style={styles.btnIrTrabajadores}
            onPress={() => router.push('/(tabs)/trabajadores' as any)}
          >
            <Text style={styles.btnIrTrabajadoresTexto}>Ir a Trabajadores</Text>
          </Pressable>
        </View>
      ) : trabajadoresFiltrados.length === 0 ? (
        <View style={styles.vacioContainer}>
          <Text style={styles.vacioEmoji}>🔍</Text>
          <Text style={styles.vacioTitulo}>Sin resultados</Text>
          <Text style={styles.vacioTexto}>
            No hay trabajadores que coincidan con "{busqueda}".
          </Text>
          <Pressable
            style={styles.btnIrTrabajadores}
            onPress={() => setBusqueda('')}
          >
            <Text style={styles.btnIrTrabajadoresTexto}>Limpiar Búsqueda</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={trabajadoresFiltrados}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => {
            const reg = getRegistroDia(item.id);
            const presente = Boolean(reg && reg.presente === 1);
            const tarifaAplicada = getTarifaAplicada(item, reg);

            return (
              <View
                style={[
                  styles.tarjetaAsistencia,
                  presente && styles.tarjetaPresente,
                ]}
              >
                <View style={styles.infoTrabajador}>
                  <Text style={styles.nombreTrabajador} numberOfLines={1}>
                    {item.nombre}
                  </Text>
                  <Pressable
                    style={styles.filaTarifa}
                    onPress={() => abrirModalTarifa(item)}
                    hitSlop={6}
                  >
                    <Text style={styles.tarifaTexto}>
                      {formatearMoneda(tarifaAplicada)}
                    </Text>
                    <Text style={styles.tarifaLapiz}>✏️</Text>
                  </Pressable>
                </View>

                {/* Botón táctil grande de Presente/Ausente */}
                <Pressable
                  style={[
                    styles.btnToggleAsistencia,
                    presente && styles.btnTogglePresente,
                  ]}
                  onPress={() => handleToggleAsistencia(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Marcar asistencia para ${item.nombre}`}
                >
                  <Text
                    style={[
                      styles.btnToggleTexto,
                      presente && styles.btnToggleTextoPresente,
                    ]}
                  >
                    {presente ? '✓ Presente' : '✕ Ausente'}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {/* Toast Undo Flotante (5 segundos) */}
      {toastUndo && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastTexto} numberOfLines={1}>
            {toastUndo.mensaje}
          </Text>
          <Pressable style={styles.btnDeshacer} onPress={ejecutarUndo}>
            <Text style={styles.btnDeshacerTexto}>Deshacer</Text>
          </Pressable>
        </View>
      )}

      {/* Barra de Resumen Inferior con Badge Dominical (MEJORA 5) */}
      {trabajadoresVisibles.length > 0 && (
        <View style={styles.barraResumen}>
          <View style={styles.itemBarra}>
            <Text style={styles.barraEtiqueta}>Asistencia</Text>
            <Text style={styles.barraValor}>
              {totalPresentes} de {trabajadoresVisibles.length}
            </Text>
          </View>

          {esDomingo && (
            <View style={styles.badgeDomingoBarra}>
              <Text style={styles.badgeDomingoBarraTexto}>DOMINGO</Text>
            </View>
          )}

          <View style={styles.barraSeparador} />

          <View style={styles.itemBarra}>
            <Text style={styles.barraEtiqueta}>Nómina estimada día</Text>
            <Text style={[styles.barraValor, styles.barraValorVerde]}>
              {formatearMoneda(totalNominaDia)}
            </Text>
          </View>
        </View>
      )}

      {/* Modal para Ajustar Tarifa del Día */}
      <Modal
        visible={modalTarifaVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalTarifaVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContenido}>
            <Text style={styles.modalTitulo}>
              {esDomingo ? '☀️ Pago Especial del Domingo' : 'Tarifa del Día'}
            </Text>
            <Text style={styles.modalSubtitulo}>
              Para {trabajadorSeleccionado?.nombre} el{' '}
              {formatearFechaCorta(fechaSeleccionada)}
              {esDomingo ? ' — Ingresa el monto a pagar por asistir este domingo' : ''}
            </Text>

            <TextInput
              style={styles.inputModal}
              value={tarifaOverrideInput}
              onChangeText={setTarifaOverrideInput}
              keyboardType="numeric"
              placeholder={esDomingo ? 'Ej. 400' : '250'}
              autoFocus
            />

            {esDomingo && (
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: -6, marginBottom: 4 }}>
                ℹ️ Este pago es independiente del salario normal (L. {trabajadorSeleccionado?.tarifa_diaria_default || 250}/día) y no lo modificará.
              </Text>
            )}

            <View style={styles.modalBotones}>
              <Pressable
                style={[styles.btnModal, styles.btnCancelar]}
                onPress={() => setModalTarifaVisible(false)}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btnModal, styles.btnGuardar]}
                onPress={guardarTarifaOverride}
              >
                <Text style={styles.btnGuardarTexto}>Guardar</Text>
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
  headerCalendario: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EBE8',
    paddingTop: 10,
    paddingBottom: 8,
  },
  barraMes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  btnFlecha: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnFlechaTexto: {
    color: '#166534',
    fontSize: 16,
    fontWeight: '700',
  },
  centroMes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textoMes: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'capitalize',
  },
  badgeIrHoy: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeIrHoyTexto: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
  },
  cintaDias: {
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 6,
  },
  tarjetaDia: {
    width: 48,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  tarjetaDiaSeleccionada: {
    backgroundColor: '#2E7D32',
    borderColor: '#1B5E20',
  },
  tarjetaDiaHoy: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  diaAbrev: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  diaAbrevSeleccionado: {
    color: '#FFFFFF',
  },
  diaNumero: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginVertical: 2,
  },
  diaNumeroSeleccionado: {
    color: '#FFFFFF',
  },
  diaIndicador: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  diaIndicadorSeleccionado: {
    color: '#86EFAC',
  },
  diaConteo: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 2,
  },
  diaConteoSeleccionado: {
    color: '#FFFFFF',
  },
  filaSubheader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 4,
  },
  infoDiaSeleccionado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textoFechaActiva: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'capitalize',
  },
  badgeDomingoHeader: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeDomingoHeaderTexto: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
  },
  filaAcciones: {
    flexDirection: 'row',
    gap: 6,
  },
  btnAccionRapida: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnAccionRapidaTexto: {
    color: '#1B5E20',
    fontSize: 11,
    fontWeight: '700',
  },
  btnAccionRapidaGris: {
    backgroundColor: '#F3F4F6',
  },
  btnAccionRapidaGrisTexto: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '600',
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barraBusqueda: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputBusqueda: {
    flex: 1,
    backgroundColor: '#F2F4F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: '#1A1A1A',
  },
  btnLimpiarBusqueda: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnLimpiarTexto: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '700',
  },
  lista: {
    padding: 16,
    gap: 10,
    paddingBottom: 90,
  },
  tarjetaAsistencia: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  tarjetaPresente: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  infoTrabajador: {
    flex: 1,
    gap: 2,
  },
  nombreTrabajador: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  filaTarifa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tarifaTexto: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  tarifaLapiz: {
    fontSize: 11,
  },
  btnToggleAsistencia: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  btnTogglePresente: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  btnToggleTexto: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  btnToggleTextoPresente: {
    color: '#FFFFFF',
  },
  barraResumen: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  itemBarra: {
    flex: 1,
    alignItems: 'center',
  },
  barraSeparador: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  barraEtiqueta: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  barraValor: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 2,
  },
  barraValorVerde: {
    color: '#1B5E20',
  },
  badgeDomingoBarra: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginHorizontal: 8,
  },
  badgeDomingoBarraTexto: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 76,
    left: 16,
    right: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  toastTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  btnDeshacer: {
    backgroundColor: '#374151',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  btnDeshacerTexto: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
  vacioContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
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
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  btnIrTrabajadores: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  btnIrTrabajadoresTexto: {
    color: '#FFFFFF',
    fontSize: 15,
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
    gap: 14,
  },
  modalTitulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalSubtitulo: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: -8,
  },
  inputModal: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: '#1A1A1A',
    backgroundColor: '#F9FAFB',
  },
  modalBotones: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
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
