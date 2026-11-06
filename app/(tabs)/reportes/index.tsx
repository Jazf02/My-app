// ═══════════════════════════════════════════════════════════
// app/(tabs)/reportes/index.tsx — Balance y Reportes Semanales
// MEJORA 4: Historial de Periodos Cerrados (Semana, Mes, Año)
// MEJORA 8: Comparativa semanal vs semana anterior
// MEJORA 10: Fix CHECK constraint y flujo abierta -> cerrada -> pagada
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BannerEstado } from '@/components/ui/BannerEstado';
import {
  obtenerOCrearSemanaActual,
  obtenerResumenTrabajadorSemana,
  cerrarSemana,
  marcarSemanaComoPagada,
  reabrirSemana,
  guardarPeriodoCerrado,
  obtenerPeriodosCerrados,
  obtenerMetricasPeriodo,
  type PeriodoCerrado,
} from '@/database/asistencia';
import { obtenerTrabajadores } from '@/database/trabajadores';
import { obtenerLotes } from '@/database/lotes';
import { obtenerCosechasPorLote } from '@/database/cosechas';
import {
  formatearFechaCorta,
  formatearMoneda,
  lunesDeSemana,
  domingoDeSemana,
} from '@/lib/fechas';
import type { Trabajador, Semana } from '@/types/domain';
import type { ResultadoPagoSemanal } from '@/lib/calculos';

interface FilaResumenTrabajador {
  trabajador: Trabajador;
  resumen: ResultadoPagoSemanal;
}

export default function ReportesScreen(): React.JSX.Element {
  const router = useRouter();

  const [semana, setSemana] = useState<Semana | null>(null);
  const [desgloseTrabajadores, setDesgloseTrabajadores] = useState<FilaResumenTrabajador[]>([]);
  const [totalCajasCortadas, setTotalCajasCortadas] = useState(0);
  const [totalCajasEmpacadas, setTotalCajasEmpacadas] = useState(0);
  const [totalDescarte, setTotalDescarte] = useState(0);
  const [periodosCerrados, setPeriodosCerrados] = useState<PeriodoCerrado[]>([]);
  const [cargando, setCargando] = useState(true);

  // Datos de la semana anterior para comparativa (MEJORA 8)
  const [datosSemanaAnterior, setDatosSemanaAnterior] = useState<{
    cajas: number;
    nomina: number;
  } | null>(null);

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const sem = await obtenerOCrearSemanaActual();
      setSemana(sem);

      const trabajadores = await obtenerTrabajadores(true);
      const desglose: FilaResumenTrabajador[] = [];

      for (const t of trabajadores) {
        const res = await obtenerResumenTrabajadorSemana(sem.id, t);
        desglose.push({ trabajador: t, resumen: res });
      }
      setDesgloseTrabajadores(desglose);

      // Cargar producción de cosechas
      const lotes = await obtenerLotes(false);
      let cortadas = 0;
      let empacadas = 0;
      let descarte = 0;
      for (const l of lotes) {
        const cortes = await obtenerCosechasPorLote(l.id);
        cortes.forEach((c) => {
          cortadas += c.cajas_cortadas || 0;
          empacadas += c.cajas_empacadas || 0;
          descarte += c.cajas_descarte || 0;
        });
      }
      setTotalCajasCortadas(cortadas);
      setTotalCajasEmpacadas(empacadas);
      setTotalDescarte(descarte);

      // Cargar historial de periodos cerrados (MEJORA 4)
      const periodos = await obtenerPeriodosCerrados();
      setPeriodosCerrados(periodos);

      // Cargar datos semana anterior (MEJORA 8)
      const dIni = new Date(sem.fecha_inicio + 'T00:00:00');
      dIni.setDate(dIni.getDate() - 7);
      const antIni = lunesDeSemana(dIni);
      const antFin = domingoDeSemana(dIni);

      // Buscar si está en periodos_cerrados
      const periodoAnt = periodos.find(
        (p) => p.tipo === 'semana' && p.fecha_inicio === antIni
      );
      if (periodoAnt) {
        setDatosSemanaAnterior({
          cajas: periodoAnt.cajas_cortadas,
          nomina: periodoAnt.nomina_bruta,
        });
      } else {
        // Consultar métricas de esa semana previa directamente
        const metricasPrevias = await obtenerMetricasPeriodo(antIni, antFin);
        if (metricasPrevias.cajasCortadas > 0 || metricasPrevias.nominaTotal > 0) {
          setDatosSemanaAnterior({
            cajas: metricasPrevias.cajasCortadas,
            nomina: metricasPrevias.nominaTotal,
          });
        } else {
          setDatosSemanaAnterior(null);
        }
      }
    } catch (err) {
      console.error('[Reportes] Error al cargar:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [cargarDatos])
  );

  const totalNominaGanada = desgloseTrabajadores.reduce(
    (acc, item) => acc + item.resumen.totalGanado,
    0
  );
  const totalNominaAdelantos = desgloseTrabajadores.reduce(
    (acc, item) => acc + item.resumen.totalAdelantos,
    0
  );
  const totalNominaAPagar = desgloseTrabajadores.reduce(
    (acc, item) => acc + item.resumen.totalAPagar,
    0
  );

  // Semanas cerradas del mes actual (para botón "Cerrar Mes")
  const mesActualPrefijo = semana ? semana.fecha_inicio.substring(0, 7) : '';
  const semanasCerradasDelMes = useMemo(() => {
    if (!mesActualPrefijo) return [];
    return periodosCerrados.filter(
      (p) => p.tipo === 'semana' && p.fecha_inicio.startsWith(mesActualPrefijo)
    );
  }, [periodosCerrados, mesActualPrefijo]);

  // Meses cerrados del año actual (para botón "Cerrar Año")
  const anoActualPrefijo = semana ? semana.fecha_inicio.substring(0, 4) : '';
  const mesesCerradosDelAno = useMemo(() => {
    if (!anoActualPrefijo) return [];
    return periodosCerrados.filter(
      (p) => p.tipo === 'mes' && p.fecha_inicio.startsWith(anoActualPrefijo)
    );
  }, [periodosCerrados, anoActualPrefijo]);

  const handleCerrarSemana = () => {
    if (!semana || semana.estado !== 'abierta') return;
    Alert.alert(
      'Cerrar semana de pago',
      '¿Deseas cerrar esta semana? Los datos quedarán congelados. Podrás reabrirla si necesitas corregir.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Semana',
          style: 'destructive',
          onPress: async () => {
            try {
              await guardarPeriodoCerrado({
                tipo: 'semana',
                fechaInicio: semana.fecha_inicio,
                fechaFin: semana.fecha_fin,
                cajasCortadas: totalCajasCortadas,
                cajasEmpacadas: totalCajasEmpacadas,
                descarte: totalDescarte,
                nominaBruta: totalNominaGanada,
                adelantos: totalNominaAdelantos,
                neto: totalNominaAPagar,
              });
              await cerrarSemana(semana.id);
              await cargarDatos();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Error al cerrar semana.');
            }
          },
        },
      ]
    );
  };

  const handleCerrarMes = () => {
    if (semanasCerradasDelMes.length === 0) return;
    const d = new Date(semana!.fecha_inicio + 'T00:00:00');
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const ultDia = new Date(y, d.getMonth() + 1, 0).getDate();
    const nombreMes = d.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' });

    Alert.alert(
      'Cerrar Mes',
      `¿Deseas cerrar el mes de ${nombreMes}? Se agruparán las ${semanasCerradasDelMes.length} semanas cerradas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Mes',
          onPress: async () => {
            try {
              const cajasCortadas = semanasCerradasDelMes.reduce((a, b) => a + b.cajas_cortadas, 0);
              const cajasEmpacadas = semanasCerradasDelMes.reduce((a, b) => a + b.cajas_empacadas, 0);
              const descarte = semanasCerradasDelMes.reduce((a, b) => a + b.descarte, 0);
              const nominaBruta = semanasCerradasDelMes.reduce((a, b) => a + b.nomina_bruta, 0);
              const adelantos = semanasCerradasDelMes.reduce((a, b) => a + b.adelantos, 0);
              const neto = semanasCerradasDelMes.reduce((a, b) => a + b.neto, 0);

              await guardarPeriodoCerrado({
                tipo: 'mes',
                fechaInicio: `${y}-${m}-01`,
                fechaFin: `${y}-${m}-${String(ultDia).padStart(2, '0')}`,
                cajasCortadas,
                cajasEmpacadas,
                descarte,
                nominaBruta,
                adelantos,
                neto,
              });
              await cargarDatos();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Error al cerrar mes.');
            }
          },
        },
      ]
    );
  };

  const handleCerrarAno = () => {
    if (mesesCerradosDelAno.length === 0) return;
    const y = semana!.fecha_inicio.substring(0, 4);

    Alert.alert(
      'Cerrar Año',
      `¿Deseas cerrar el año ${y}? Se agruparán los ${mesesCerradosDelAno.length} meses cerrados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Año',
          onPress: async () => {
            try {
              const cajasCortadas = mesesCerradosDelAno.reduce((a, b) => a + b.cajas_cortadas, 0);
              const cajasEmpacadas = mesesCerradosDelAno.reduce((a, b) => a + b.cajas_empacadas, 0);
              const descarte = mesesCerradosDelAno.reduce((a, b) => a + b.descarte, 0);
              const nominaBruta = mesesCerradosDelAno.reduce((a, b) => a + b.nomina_bruta, 0);
              const adelantos = mesesCerradosDelAno.reduce((a, b) => a + b.adelantos, 0);
              const neto = mesesCerradosDelAno.reduce((a, b) => a + b.neto, 0);

              await guardarPeriodoCerrado({
                tipo: 'año',
                fechaInicio: `${y}-01-01`,
                fechaFin: `${y}-12-31`,
                cajasCortadas,
                cajasEmpacadas,
                descarte,
                nominaBruta,
                adelantos,
                neto,
              });
              await cargarDatos();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Error al cerrar año.');
            }
          },
        },
      ]
    );
  };

  const handleMarcarPagada = () => {
    if (!semana || semana.estado !== 'cerrada') return;
    Alert.alert(
      'Marcar como Pagada',
      '¿Confirmas que esta semana ya fue pagada a los trabajadores?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar Pagada',
          onPress: async () => {
            try {
              await marcarSemanaComoPagada(semana.id);
              await cargarDatos();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Error.');
            }
          },
        },
      ]
    );
  };

  const handleReabrir = () => {
    if (!semana || semana.estado === 'abierta') return;
    Alert.alert(
      'Reabrir Semana',
      'Esta acción permite editar los registros nuevamente. ¿Deseas reabrir la semana?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reabrir',
          onPress: async () => {
            try {
              await reabrirSemana(semana.id);
              await cargarDatos();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Error.');
            }
          },
        },
      ]
    );
  };

  // Comparativa Semanal (MEJORA 8)
  const comparativa = useMemo(() => {
    if (!datosSemanaAnterior) return null;
    const { cajas: antCajas, nomina: antNomina } = datosSemanaAnterior;

    const diffCajas = antCajas > 0 ? ((totalCajasCortadas - antCajas) / antCajas) * 100 : null;
    const diffNomina = antNomina > 0 ? ((totalNominaGanada - antNomina) / antNomina) * 100 : null;

    return {
      antCajas,
      antNomina,
      diffCajas,
      diffNomina,
    };
  }, [datosSemanaAnterior, totalCajasCortadas, totalNominaGanada]);

  // Formato para items del historial (MEJORA 4)
  const formatearHistorialItem = (p: PeriodoCerrado) => {
    let titulo = '';
    if (p.tipo === 'semana') {
      const dIni = new Date(p.fecha_inicio + 'T00:00:00');
      const dFin = new Date(p.fecha_fin + 'T00:00:00');
      const mesStr = dIni.toLocaleDateString('es-HN', { month: 'short' });
      titulo = `Semana ${dIni.getDate()}-${dFin.getDate()} ${mesStr}`;
    } else if (p.tipo === 'mes') {
      const d = new Date(p.fecha_inicio + 'T00:00:00');
      const mesStr = d.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' });
      titulo = mesStr.charAt(0).toUpperCase() + mesStr.slice(1);
    } else {
      titulo = `Año ${p.fecha_inicio.substring(0, 4)}`;
    }

    return {
      titulo,
      cajasStr: `${p.cajas_cortadas} cajas`,
      netoStr: formatearMoneda(p.neto),
      cerradoStr: `Cerrado ${formatearFechaCorta(p.fecha_cierre.substring(0, 10))}`,
    };
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado estado="offline" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.titulo}>Reportes y Planilla</Text>
          {semana && (
            <Text style={styles.subtitulo}>
              Semana: {formatearFechaCorta(semana.fecha_inicio)} – {formatearFechaCorta(semana.fecha_fin)}
            </Text>
          )}
        </View>

        <Pressable
          style={styles.btnExportar}
          onPress={() => router.push('/(tabs)/reportes/exportar' as any)}
        >
          <Text style={styles.btnExportarTexto}>📤 Exportar</Text>
        </Pressable>
      </View>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      ) : (
        <FlatList
          data={desgloseTrabajadores}
          keyExtractor={(item) => item.trabajador.id}
          contentContainerStyle={styles.contenido}
          ListHeaderComponent={
            <View style={styles.seccionHeader}>
              {/* Tarjeta Nómina General */}
              <View style={styles.tarjetaResumen}>
                <Text style={styles.resumenTitulo}>Resumen de Nómina Semanal</Text>
                <View style={styles.gridResumen}>
                  <View style={styles.itemResumen}>
                    <Text style={styles.itemResumenNum}>{formatearMoneda(totalNominaGanada)}</Text>
                    <Text style={styles.itemResumenLabel}>Ganado Bruto</Text>
                  </View>
                  <View style={styles.itemResumen}>
                    <Text style={[styles.itemResumenNum, styles.rojo]}>
                      {formatearMoneda(totalNominaAdelantos)}
                    </Text>
                    <Text style={styles.itemResumenLabel}>Adelantos</Text>
                  </View>
                </View>

                <View style={styles.bannerNeto}>
                  <Text style={styles.netoTitulo}>Total Neto a Pagar</Text>
                  <Text style={styles.netoMonto}>{formatearMoneda(totalNominaAPagar)}</Text>
                </View>
              </View>

              {/* Tarjeta Producción */}
              <View style={styles.tarjetaProduccion}>
                <Text style={styles.produccionTitulo}>Producción de Cosecha</Text>
                <View style={styles.filaProduccion}>
                  <View style={styles.itemProduccion}>
                    <Text style={styles.itemProduccionNum}>{totalCajasCortadas}</Text>
                    <Text style={styles.itemProduccionLabel}>Cajas Cortadas</Text>
                  </View>
                  <View style={styles.itemProduccion}>
                    <Text style={[styles.itemProduccionNum, styles.verde]}>
                      {totalCajasEmpacadas}
                    </Text>
                    <Text style={styles.itemProduccionLabel}>Cajas Empacadas</Text>
                  </View>
                </View>
              </View>

              {/* Comparativa Semanal (MEJORA 8) */}
              {comparativa && (
                <View style={styles.tarjetaComparativa}>
                  <Text style={styles.comparativaTitulo}>
                    Semana anterior: {comparativa.antCajas} cajas | {formatearMoneda(comparativa.antNomina)}
                  </Text>
                  <View style={styles.filaComparativaItem}>
                    <Text style={styles.comparativaTexto}>
                      Producción: {totalCajasCortadas} cajas{' '}
                      {comparativa.diffCajas !== null ? (
                        <Text
                          style={
                            comparativa.diffCajas >= 0
                              ? styles.compVerde
                              : styles.compRojo
                          }
                        >
                          {comparativa.diffCajas >= 0 ? '▲' : '▼'}{' '}
                          {Math.abs(Math.round(comparativa.diffCajas))}% vs. semana anterior
                        </Text>
                      ) : (
                        ''
                      )}
                    </Text>
                  </View>
                  <View style={styles.filaComparativaItem}>
                    <Text style={styles.comparativaTexto}>
                      Nómina: {formatearMoneda(totalNominaGanada)}{' '}
                      {comparativa.diffNomina !== null ? (
                        <Text
                          style={
                            comparativa.diffNomina >= 0
                              ? styles.compVerde
                              : styles.compRojo
                          }
                        >
                          {comparativa.diffNomina >= 0 ? '▲' : '▼'}{' '}
                          {Math.abs(Math.round(comparativa.diffNomina))}% vs. semana anterior
                        </Text>
                      ) : (
                        ''
                      )}
                    </Text>
                  </View>
                </View>
              )}

              {/* Botones de Cierre de Periodos (MEJORA 4 y 10) */}
              <View style={styles.filaAccionesPeriodo}>
                {semana?.estado === 'abierta' && (
                  <Pressable style={styles.btnAccionCierre} onPress={handleCerrarSemana}>
                    <Text style={styles.btnCerrarTexto}>🔒 Cerrar Semana</Text>
                  </Pressable>
                )}
                {semana?.estado === 'cerrada' && (
                  <View style={styles.filaBotonesCerrada}>
                    <Pressable style={[styles.btnAccionCierre, styles.btnPagadaBg]} onPress={handleMarcarPagada}>
                      <Text style={styles.btnPagadaTexto}>✅ Marcar como Pagada</Text>
                    </Pressable>
                    <Pressable style={[styles.btnAccionCierre, styles.btnReabrirBg]} onPress={handleReabrir}>
                      <Text style={styles.btnReabrirTexto}>🔓 Reabrir</Text>
                    </Pressable>
                  </View>
                )}
                {semana?.estado === 'pagada' && (
                  <Pressable style={[styles.btnAccionCierre, styles.btnReabrirBg]} onPress={handleReabrir}>
                    <Text style={styles.btnReabrirTexto}>🔓 Reabrir Semana</Text>
                  </Pressable>
                )}

                {/* Botón Cerrar Mes (solo si hay al menos 1 semana cerrada del mes) */}
                {semanasCerradasDelMes.length >= 1 && (
                  <Pressable style={[styles.btnAccionCierre, styles.btnMesBg]} onPress={handleCerrarMes}>
                    <Text style={styles.btnMesTexto}>
                      📅 Cerrar Mes ({semanasCerradasDelMes.length} sem.)
                    </Text>
                  </Pressable>
                )}

                {/* Botón Cerrar Año (solo si hay al menos 1 mes cerrado del año) */}
                {mesesCerradosDelAno.length >= 1 && (
                  <Pressable style={[styles.btnAccionCierre, styles.btnAnoBg]} onPress={handleCerrarAno}>
                    <Text style={styles.btnAnoTexto}>
                      🏛️ Cerrar Año ({mesesCerradosDelAno.length} meses)
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Estado de semana */}
              {semana && semana.estado !== 'abierta' && (
                <View
                  style={[
                    styles.bannerEstadoSemana,
                    semana.estado === 'cerrada'
                      ? styles.bannerCerrada
                      : styles.bannerPagada,
                  ]}
                >
                  <Text style={styles.bannerEstadoTexto}>
                    {semana.estado === 'cerrada'
                      ? '🔒 Semana cerrada — Datos congelados. Para corregir, reabrir.'
                      : '✅ Semana pagada'}
                  </Text>
                </View>
              )}

              {/* Historial de Periodos Cerrados (MEJORA 4) */}
              {periodosCerrados.length > 0 && (
                <View style={styles.bloqueHistorial}>
                  <Text style={styles.seccionTitulo}>Historial de Periodos Cerrados</Text>
                  {periodosCerrados.map((p) => {
                    const info = formatearHistorialItem(p);
                    return (
                      <View key={p.id} style={styles.tarjetaHistorial}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historialTitulo}>{info.titulo}</Text>
                          <Text style={styles.historialSubtitulo}>
                            {info.cajasStr} • Neto: {info.netoStr}
                          </Text>
                        </View>
                        <Text style={styles.historialFecha}>{info.cerradoStr}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={styles.seccionTitulo}>Detalle por Trabajador</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.vacioContainer}>
              <Text style={styles.vacioEmoji}>📊</Text>
              <Text style={styles.vacioTitulo}>Sin registros para esta semana</Text>
              <Text style={styles.vacioTexto}>
                Pasa lista en "Asistencia" para generar la nómina de la semana automáticamente.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.tarjetaTrabajador}>
              <View style={styles.infoTrabajador}>
                <Text style={styles.nombreTrabajador}>{item.trabajador.nombre}</Text>
                <Text style={styles.diasTrabajador}>
                  {item.resumen.diasPresentes} días trabajados • Adelantos:{' '}
                  {formatearMoneda(item.resumen.totalAdelantos)}
                </Text>
              </View>
              <View style={styles.montoTrabajador}>
                <Text style={styles.netoTrabajador}>
                  {formatearMoneda(item.resumen.totalAPagar)}
                </Text>
                <Text style={styles.etiquetaNeto}>Neto</Text>
              </View>
            </View>
          )}
        />
      )}
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
  subtitulo: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  btnExportar: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnExportarTexto: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
  },
  contenido: {
    padding: 16,
    gap: 10,
  },
  seccionHeader: {
    gap: 14,
    marginBottom: 6,
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
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  gridResumen: {
    flexDirection: 'row',
    backgroundColor: '#F9FAF9',
    borderRadius: 12,
    padding: 12,
  },
  itemResumen: {
    flex: 1,
    alignItems: 'center',
  },
  itemResumenNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  itemResumenLabel: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  rojo: {
    color: '#DC2626',
  },
  verde: {
    color: '#166534',
  },
  bannerNeto: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  netoMonto: {
    fontSize: 22,
    fontWeight: '800',
    color: '#166534',
  },
  tarjetaProduccion: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    gap: 10,
  },
  produccionTitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  filaProduccion: {
    flexDirection: 'row',
    backgroundColor: '#F9FAF9',
    borderRadius: 12,
    padding: 12,
  },
  itemProduccion: {
    flex: 1,
    alignItems: 'center',
  },
  itemProduccionNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  itemProduccionLabel: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  tarjetaComparativa: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  comparativaTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 2,
  },
  filaComparativaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparativaTexto: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  compVerde: {
    color: '#15803D',
    fontWeight: '700',
  },
  compRojo: {
    color: '#DC2626',
    fontWeight: '700',
  },
  filaAccionesPeriodo: {
    gap: 8,
    marginTop: 4,
  },
  filaBotonesCerrada: {
    flexDirection: 'row',
    gap: 8,
  },
  btnAccionCierre: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  btnCerrarTexto: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  btnPagadaBg: {
    flex: 1,
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  btnPagadaTexto: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
  },
  btnReabrirBg: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  btnReabrirTexto: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '700',
  },
  btnMesBg: {
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
  },
  btnMesTexto: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  btnAnoBg: {
    backgroundColor: '#F3E8FF',
    borderColor: '#D8B4FE',
  },
  btnAnoTexto: {
    color: '#7E22CE',
    fontSize: 13,
    fontWeight: '700',
  },
  seccionTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 4,
  },
  tarjetaTrabajador: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EBE8',
  },
  infoTrabajador: {
    flex: 1,
  },
  nombreTrabajador: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  diasTrabajador: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  montoTrabajador: {
    alignItems: 'flex-end',
  },
  netoTrabajador: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
  },
  etiquetaNeto: {
    fontSize: 11,
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
  bannerEstadoSemana: {
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  bannerCerrada: {
    backgroundColor: '#FEF3C7',
  },
  bannerPagada: {
    backgroundColor: '#D1FAE5',
  },
  bannerEstadoTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  bloqueHistorial: {
    gap: 8,
    marginTop: 6,
  },
  tarjetaHistorial: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EBE8',
  },
  historialTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  historialSubtitulo: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  historialFecha: {
    fontSize: 11,
    color: '#9CA3AF',
  },
});
