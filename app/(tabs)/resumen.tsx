// ═══════════════════════════════════════════════════════════
// app/(tabs)/resumen.tsx — Dashboard y Resumen General
// MEJORA 2: Pantalla Resumen con métricas HOY, SEMANA, MES, AÑO
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BannerEstado } from '@/components/ui/BannerEstado';
import {
  obtenerMetricasPeriodo,
  type MetricasPeriodo,
} from '@/database/asistencia';
import {
  hoyISO,
  fechaToISO,
  formatearFechaCorta,
  formatearMoneda,
  lunesDeSemana,
  domingoDeSemana,
} from '@/lib/fechas';

type TipoPeriodo = 'dia' | 'semana' | 'mes' | 'ano';

export default function ResumenScreen(): React.JSX.Element {
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('semana');
  const [fechaReferencia, setFechaReferencia] = useState<string>(hoyISO());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [mesCalendario, setMesCalendario] = useState<Date>(() => new Date());
  const [cargando, setCargando] = useState(true);

  // Métricas
  const [metricasPeriodo, setMetricasPeriodo] = useState<MetricasPeriodo | null>(null);
  const [metricasHoy, setMetricasHoy] = useState<MetricasPeriodo | null>(null);
  const [metricasSemana, setMetricasSemana] = useState<MetricasPeriodo | null>(null);
  const [metricasMes, setMetricasMes] = useState<MetricasPeriodo | null>(null);

  // Calcular rango según fechaReferencia y tipoPeriodo
  const { inicioPeriodo, finPeriodo, etiquetaPeriodo } = useMemo(() => {
    const d = new Date(fechaReferencia + 'T00:00:00');
    if (tipoPeriodo === 'dia') {
      return {
        inicioPeriodo: fechaReferencia,
        finPeriodo: fechaReferencia,
        etiquetaPeriodo: formatearFechaCorta(fechaReferencia),
      };
    }
    if (tipoPeriodo === 'semana') {
      const ini = lunesDeSemana(d);
      const fin = domingoDeSemana(d);
      return {
        inicioPeriodo: ini,
        finPeriodo: fin,
        etiquetaPeriodo: `Semana: ${formatearFechaCorta(ini)} - ${formatearFechaCorta(fin)}`,
      };
    }
    if (tipoPeriodo === 'mes') {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const ultimoDia = new Date(y, d.getMonth() + 1, 0).getDate();
      const ini = `${y}-${m}-01`;
      const fin = `${y}-${m}-${String(ultimoDia).padStart(2, '0')}`;
      const nombreMes = d.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' });
      return {
        inicioPeriodo: ini,
        finPeriodo: fin,
        etiquetaPeriodo: nombreMes,
      };
    }
    // 'ano'
    const y = d.getFullYear();
    return {
      inicioPeriodo: `${y}-01-01`,
      finPeriodo: `${y}-12-31`,
      etiquetaPeriodo: `Año ${y}`,
    };
  }, [fechaReferencia, tipoPeriodo]);

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const hoy = hoyISO();
      const fechaHoyDate = new Date(hoy + 'T00:00:00');
      const iniSemanaActual = lunesDeSemana(fechaHoyDate);
      const finSemanaActual = domingoDeSemana(fechaHoyDate);

      const y = fechaHoyDate.getFullYear();
      const m = String(fechaHoyDate.getMonth() + 1).padStart(2, '0');
      const ultDiaMes = new Date(y, fechaHoyDate.getMonth() + 1, 0).getDate();
      const iniMesActual = `${y}-${m}-01`;
      const finMesActual = `${y}-${m}-${String(ultDiaMes).padStart(2, '0')}`;

      // Cargar en paralelo
      const [mHoy, mSemana, mMes, mSel] = await Promise.all([
        obtenerMetricasPeriodo(hoy, hoy),
        obtenerMetricasPeriodo(iniSemanaActual, finSemanaActual),
        obtenerMetricasPeriodo(iniMesActual, finMesActual),
        obtenerMetricasPeriodo(inicioPeriodo, finPeriodo),
      ]);

      setMetricasHoy(mHoy);
      setMetricasSemana(mSemana);
      setMetricasMes(mMes);
      setMetricasPeriodo(mSel);
    } catch (err) {
      console.error('[Resumen] Error al cargar métricas:', err);
    } finally {
      setCargando(false);
    }
  }, [inicioPeriodo, finPeriodo]);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [cargarDatos])
  );

  const cambiarPeriodoOffset = (offset: number) => {
    const d = new Date(fechaReferencia + 'T00:00:00');
    if (tipoPeriodo === 'dia') {
      d.setDate(d.getDate() + offset);
    } else if (tipoPeriodo === 'semana') {
      d.setDate(d.getDate() + offset * 7);
    } else if (tipoPeriodo === 'mes') {
      d.setMonth(d.getMonth() + offset);
    } else {
      d.setFullYear(d.getFullYear() + offset);
    }
    setFechaReferencia(fechaToISO(d));
  };

  const irAHoyPeriodo = () => {
    setFechaReferencia(hoyISO());
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado />

      {/* Header Selector de Periodo */}
      <View style={styles.header}>
        <Text style={styles.titulo}>Resumen y Métricas</Text>
        <View style={styles.selectorPeriodo}>
          <Pressable
            style={[styles.btnPeriodo, tipoPeriodo === 'dia' && styles.btnPeriodoActivo]}
            onPress={() => setTipoPeriodo('dia')}
          >
            <Text style={[styles.btnPeriodoTexto, tipoPeriodo === 'dia' && styles.btnPeriodoTextoActivo]}>
              Día
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btnPeriodo, tipoPeriodo === 'semana' && styles.btnPeriodoActivo]}
            onPress={() => setTipoPeriodo('semana')}
          >
            <Text style={[styles.btnPeriodoTexto, tipoPeriodo === 'semana' && styles.btnPeriodoTextoActivo]}>
              Semana
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btnPeriodo, tipoPeriodo === 'mes' && styles.btnPeriodoActivo]}
            onPress={() => setTipoPeriodo('mes')}
          >
            <Text style={[styles.btnPeriodoTexto, tipoPeriodo === 'mes' && styles.btnPeriodoTextoActivo]}>
              Mes
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btnPeriodo, tipoPeriodo === 'ano' && styles.btnPeriodoActivo]}
            onPress={() => setTipoPeriodo('ano')}
          >
            <Text style={[styles.btnPeriodoTexto, tipoPeriodo === 'ano' && styles.btnPeriodoTextoActivo]}>
              Año
            </Text>
          </Pressable>
        </View>

        {/* Navegador de Fecha/Periodo */}
        <View style={styles.barraNavegacion}>
          <Pressable style={styles.btnNav} onPress={() => cambiarPeriodoOffset(-1)}>
            <Text style={styles.btnNavTexto}>◄</Text>
          </Pressable>
          <Pressable style={styles.centroNav} onPress={irAHoyPeriodo}>
            <Text style={styles.textoPeriodo}>{etiquetaPeriodo}</Text>
          </Pressable>
          <Pressable style={styles.btnCalendarioToggle} onPress={() => setMostrarCalendario(!mostrarCalendario)}>
            <Text style={styles.btnCalendarioIcono}>📅</Text>
          </Pressable>
          <Pressable style={styles.btnNav} onPress={() => cambiarPeriodoOffset(1)}>
            <Text style={styles.btnNavTexto}>►</Text>
          </Pressable>
        </View>

        {/* Calendario Interactivo Desplegable */}
        {mostrarCalendario && (
          <View style={styles.cajaCalendario}>
            <View style={styles.calHeader}>
              <Pressable
                style={styles.calBtnMes}
                onPress={() => {
                  const n = new Date(mesCalendario);
                  n.setMonth(n.getMonth() - 1);
                  setMesCalendario(n);
                }}
              >
                <Text style={styles.calBtnMesTexto}>◄</Text>
              </Pressable>
              <Text style={styles.calMesTitulo}>
                {mesCalendario.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' })}
              </Text>
              <Pressable
                style={styles.calBtnMes}
                onPress={() => {
                  const n = new Date(mesCalendario);
                  n.setMonth(n.getMonth() + 1);
                  setMesCalendario(n);
                }}
              >
                <Text style={styles.calBtnMesTexto}>►</Text>
              </Pressable>
            </View>

            {/* Días de la semana */}
            <View style={styles.calFilaDiasNom}>
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <Text key={i} style={styles.calDiaNomTexto}>{d}</Text>
              ))}
            </View>

            {/* Grid de Días del Mes */}
            <View style={styles.calGridDias}>
              {(() => {
                const y = mesCalendario.getFullYear();
                const m = mesCalendario.getMonth();
                const primerDiaMes = new Date(y, m, 1);
                // Ajustar lunes = 0
                let diaSemanaInicio = primerDiaMes.getDay() - 1;
                if (diaSemanaInicio === -1) diaSemanaInicio = 6;
                const totalDias = new Date(y, m + 1, 0).getDate();

                const celdas = [];
                for (let i = 0; i < diaSemanaInicio; i++) {
                  celdas.push(<View key={`empty-${i}`} style={styles.calCeldaVacia} />);
                }
                for (let dia = 1; dia <= totalDias; dia++) {
                  const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                  const seleccionado = fechaReferencia === iso;
                  const esHoy = iso === hoyISO();
                  celdas.push(
                    <Pressable
                      key={iso}
                      style={[
                        styles.calCeldaDia,
                        seleccionado && styles.calCeldaDiaSel,
                        esHoy && !seleccionado && styles.calCeldaDiaHoy,
                      ]}
                      onPress={() => {
                        setFechaReferencia(iso);
                        setMostrarCalendario(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.calNumDia,
                          seleccionado && styles.calNumDiaSel,
                          esHoy && !seleccionado && styles.calNumDiaHoy,
                        ]}
                      >
                        {dia}
                      </Text>
                    </Pressable>
                  );
                }
                return celdas;
              })()}
            </View>
          </View>
        )}
      </View>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.contenido}>
          {/* Tarjetas Grandes: HOY, SEMANA, MES */}
          <View style={styles.contenedorTarjetas}>
            {/* Tarjeta HOY */}
            {(tipoPeriodo === 'semana' || tipoPeriodo === 'dia') && (
              <View style={[styles.tarjetaGrande, tipoPeriodo === 'dia' && styles.tarjetaExpandida]}>
                <View style={styles.tarjetaHeader}>
                  <Text style={styles.tarjetaTitulo}>HOY</Text>
                  <Text style={styles.tarjetaSub}>{metricasHoy?.trabajadoresPresentes || 0} pres.</Text>
                </View>
                <Text style={styles.tarjetaNomina}>
                  {formatearMoneda(metricasHoy?.nominaTotal || 0)}
                </Text>
                <Text style={styles.tarjetaCajas}>
                  {metricasHoy?.cajasCortadas || 0} cajas cortadas
                </Text>
              </View>
            )}

            {/* Tarjeta SEMANA */}
            {(tipoPeriodo === 'semana' || tipoPeriodo === 'dia') && (
              <View style={[styles.tarjetaGrande, styles.tarjetaSemana, tipoPeriodo === 'semana' && styles.tarjetaExpandida]}>
                <View style={styles.tarjetaHeader}>
                  <Text style={[styles.tarjetaTitulo, styles.tarjetaTituloSemana]}>SEMANA</Text>
                  <Text style={styles.tarjetaSub}>{metricasSemana?.trabajadoresPresentes || 0} pres.</Text>
                </View>
                <Text style={[styles.tarjetaNomina, styles.tarjetaNominaSemana]}>
                  {formatearMoneda(metricasSemana?.nominaTotal || 0)}
                </Text>
                <Text style={styles.tarjetaCajas}>
                  {metricasSemana?.cajasCortadas || 0} cajas cortadas
                </Text>
              </View>
            )}

            {/* Tarjeta MES */}
            {(tipoPeriodo === 'mes' || tipoPeriodo === 'semana') && (
              <View style={[styles.tarjetaGrande, styles.tarjetaMes, tipoPeriodo === 'mes' && styles.tarjetaExpandida]}>
                <View style={styles.tarjetaHeader}>
                  <Text style={[styles.tarjetaTitulo, styles.tarjetaTituloMes]}>MES</Text>
                  <Text style={styles.tarjetaSub}>{metricasMes?.trabajadoresPresentes || 0} pres.</Text>
                </View>
                <Text style={[styles.tarjetaNomina, styles.tarjetaNominaMes]}>
                  {formatearMoneda(metricasMes?.nominaTotal || 0)}
                </Text>
                <Text style={styles.tarjetaCajas}>
                  {metricasMes?.cajasCortadas || 0} cajas cortadas
                </Text>
              </View>
            )}

            {/* Tarjeta AÑO */}
            {tipoPeriodo === 'ano' && (
              <View style={[styles.tarjetaGrande, styles.tarjetaExpandida]}>
                <View style={styles.tarjetaHeader}>
                  <Text style={styles.tarjetaTitulo}>AÑO</Text>
                  <Text style={styles.tarjetaSub}>{metricasPeriodo?.trabajadoresPresentes || 0} pres.</Text>
                </View>
                <Text style={styles.tarjetaNomina}>
                  {formatearMoneda(metricasPeriodo?.nominaTotal || 0)}
                </Text>
                <Text style={styles.tarjetaCajas}>
                  {metricasPeriodo?.cajasCortadas || 0} cajas cortadas
                </Text>
              </View>
            )}
          </View>

          {/* Sección Cosecha */}
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>Cosecha ({etiquetaPeriodo})</Text>
            <View style={styles.gridCosecha}>
              <View style={styles.itemCosecha}>
                <Text style={styles.numCosecha}>{metricasPeriodo?.cajasCortadas || 0}</Text>
                <Text style={styles.labelCosecha}>Cortadas</Text>
              </View>
              <View style={styles.itemCosecha}>
                <Text style={[styles.numCosecha, styles.colorVerde]}>
                  {metricasPeriodo?.cajasEmpacadas || 0}
                </Text>
                <Text style={styles.labelCosecha}>Empacadas</Text>
              </View>
              <View style={styles.itemCosecha}>
                <Text style={[styles.numCosecha, styles.colorRojo]}>
                  {metricasPeriodo?.cajasDescarte || 0}
                </Text>
                <Text style={styles.labelCosecha}>Descarte</Text>
              </View>
              <View style={styles.itemCosecha}>
                <Text style={[styles.numCosecha, styles.colorAzul]}>
                  {(metricasPeriodo?.porcentajeAprovechable || 0).toFixed(1)}%
                </Text>
                <Text style={styles.labelCosecha}>% Aprovechable</Text>
              </View>
            </View>
          </View>

          {/* Sección Por Trabajador */}
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>Por Trabajador ({etiquetaPeriodo})</Text>
            {!metricasPeriodo || metricasPeriodo.porTrabajador.length === 0 ? (
              <View style={styles.sinRegistros}>
                <Text style={styles.sinRegistrosTexto}>
                  No hay asistencias registradas en este periodo.
                </Text>
              </View>
            ) : (
              <View style={styles.tablaTrabajadores}>
                <View style={styles.tablaFilaHeader}>
                  <Text style={[styles.tablaColHeader, styles.colNombre]}>Trabajador</Text>
                  <Text style={[styles.tablaColHeader, styles.colDias]}>Días</Text>
                  <Text style={[styles.tablaColHeader, styles.colTotal]}>Total Ganado</Text>
                </View>
                {metricasPeriodo.porTrabajador.map((item) => (
                  <View key={item.trabajador_id} style={styles.tablaFila}>
                    <Text style={[styles.tablaCelda, styles.colNombre]} numberOfLines={1}>
                      {item.nombre}
                    </Text>
                    <Text style={[styles.tablaCelda, styles.colDias]}>
                      {item.dias_trabajados} {item.dias_trabajados === 1 ? 'día' : 'días'}
                    </Text>
                    <Text style={[styles.tablaCelda, styles.colTotal, styles.textoGanado]}>
                      {formatearMoneda(item.total_ganado)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAF8',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  selectorPeriodo: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
  },
  btnPeriodo: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPeriodoActivo: {
    backgroundColor: '#2E7D32',
  },
  btnPeriodoTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  btnPeriodoTextoActivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  barraNavegacion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  btnNav: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  btnNavTexto: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '700',
  },
  btnCalendarioToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
    marginHorizontal: 4,
  },
  btnCalendarioIcono: {
    fontSize: 15,
  },
  cajaCalendario: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#C8E6C9',
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calBtnMes: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
  },
  calBtnMesTexto: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 14,
  },
  calMesTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'capitalize',
  },
  calFilaDiasNom: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 4,
  },
  calDiaNomTexto: {
    width: 32,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  calGridDias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCeldaVacia: {
    width: `${100 / 7}%`,
    height: 34,
  },
  calCeldaDia: {
    width: `${100 / 7}%`,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 1,
  },
  calCeldaDiaSel: {
    backgroundColor: '#2E7D32',
  },
  calCeldaDiaHoy: {
    borderWidth: 1,
    borderColor: '#2E7D32',
    backgroundColor: '#F0FDF4',
  },
  calNumDia: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  calNumDiaSel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calNumDiaHoy: {
    color: '#15803D',
    fontWeight: '700',
  },
  centroNav: {
    flex: 1,
    alignItems: 'center',
  },
  textoPeriodo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    textTransform: 'capitalize',
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contenido: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  contenedorTarjetas: {
    gap: 10,
  },
  tarjetaGrande: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  tarjetaExpandida: {
    borderColor: '#2E7D32',
    backgroundColor: '#F0FDF4',
  },
  tarjetaSemana: {
    borderColor: '#BBF7D0',
  },
  tarjetaMes: {
    borderColor: '#BFDBFE',
  },
  tarjetaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tarjetaTitulo: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4B5563',
  },
  tarjetaTituloSemana: {
    color: '#166534',
  },
  tarjetaTituloMes: {
    color: '#1E40AF',
  },
  tarjetaSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  tarjetaNomina: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  tarjetaNominaSemana: {
    color: '#15803D',
  },
  tarjetaNominaMes: {
    color: '#1D4ED8',
  },
  tarjetaCajas: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  seccion: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  seccionTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  gridCosecha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemCosecha: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 3,
  },
  numCosecha: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  labelCosecha: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  colorVerde: {
    color: '#166534',
  },
  colorRojo: {
    color: '#DC2626',
  },
  colorAzul: {
    color: '#2563EB',
  },
  sinRegistros: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  sinRegistrosTexto: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  tablaTrabajadores: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  tablaFilaHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tablaColHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  tablaFila: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tablaCelda: {
    fontSize: 13,
    color: '#1A1A1A',
  },
  colNombre: {
    flex: 2,
    fontWeight: '600',
  },
  colDias: {
    flex: 1,
    textAlign: 'center',
    color: '#4B5563',
  },
  colTotal: {
    flex: 1.5,
    textAlign: 'right',
  },
  textoGanado: {
    fontWeight: '700',
    color: '#166534',
  },
});
