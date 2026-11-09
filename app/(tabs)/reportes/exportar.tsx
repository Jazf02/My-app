// ═══════════════════════════════════════════════════════════
// app/(tabs)/reportes/exportar.tsx — Exportación y Archivos
// Soporte completo para Semana, Mes, Año, Todo y Período Personalizado
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import {
  obtenerSemanas,
  obtenerDatosExportacionPeriodo,
  type ResultadoExportacionPeriodo,
} from '@/database/asistencia';
import {
  generarReporteCompletoCSV,
  guardarYCompartirReporteCSV,
  compartirPorWhatsApp,
  compartirReporteNativo,
  copiarAlPortapapeles,
  imprimirReporteHTML,
  generarTextoWhatsAppPeriodo,
  generarHTMLPlanillaPeriodo,
} from '@/lib/exportar';
import {
  hoyISO,
  fechaToISO,
  formatearFechaCorta,
  formatearMoneda,
  lunesDeSemana,
  domingoDeSemana,
} from '@/lib/fechas';
import type { Semana } from '@/types/domain';

type TipoPeriodo = 'semana' | 'mes' | 'ano' | 'rango' | 'todo';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function ExportarScreen(): React.JSX.Element {
  const router = useRouter();

  // Modo de exportación
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('semana');

  // Semanas disponibles en la base de datos
  const [semanas, setSemanas] = useState<Semana[]>([]);
  const [semanaSeleccionadaId, setSemanaSeleccionadaId] = useState<string>('');

  // Selector de Mes y Año
  const fechaHoy = useMemo(() => new Date(), []);
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(() => fechaHoy.getMonth());
  const [anoSeleccionado, setAnoSeleccionado] = useState<number>(() => fechaHoy.getFullYear());

  // Rango personalizado
  const [fechaInicioInput, setFechaInicioInput] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return fechaToISO(d);
  });
  const [fechaFinInput, setFechaFinInput] = useState<string>(() => hoyISO());

  // Datos consolidados del filtro activo
  const [datosExport, setDatosExport] = useState<ResultadoExportacionPeriodo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [archivoGenerado, setArchivoGenerado] = useState<string | null>(null);
  const [copiadoExito, setCopiadoExito] = useState(false);

  // 1. Cargar lista de semanas registradas
  useEffect(() => {
    obtenerSemanas(52)
      .then((lista) => {
        setSemanas(lista);
        if (lista.length > 0 && !semanaSeleccionadaId) {
          setSemanaSeleccionadaId(lista[0].id);
        }
      })
      .catch((err) => console.error('[Exportar] Error al cargar semanas:', err));
  }, []);

  // 2. Calcular fechas y etiqueta según el tipo de período
  const { fechaInicioCalculada, fechaFinCalculada, periodoEtiqueta } = useMemo(() => {
    if (tipoPeriodo === 'semana') {
      const sem = semanas.find((s) => s.id === semanaSeleccionadaId) || semanas[0];
      if (sem) {
        return {
          fechaInicioCalculada: sem.fecha_inicio,
          fechaFinCalculada: sem.fecha_fin,
          periodoEtiqueta: `Semana: ${formatearFechaCorta(sem.fecha_inicio)} – ${formatearFechaCorta(sem.fecha_fin)}`,
        };
      }
      const lunes = lunesDeSemana(fechaHoy);
      const domingo = domingoDeSemana(fechaHoy);
      return {
        fechaInicioCalculada: lunes,
        fechaFinCalculada: domingo,
        periodoEtiqueta: `Semana: ${formatearFechaCorta(lunes)} – ${formatearFechaCorta(domingo)}`,
      };
    }

    if (tipoPeriodo === 'mes') {
      const y = anoSeleccionado;
      const m = String(mesSeleccionado + 1).padStart(2, '0');
      const ultimoDia = new Date(y, mesSeleccionado + 1, 0).getDate();
      const ini = `${y}-${m}-01`;
      const fin = `${y}-${m}-${String(ultimoDia).padStart(2, '0')}`;
      return {
        fechaInicioCalculada: ini,
        fechaFinCalculada: fin,
        periodoEtiqueta: `Mes de ${MESES[mesSeleccionado]} ${y}`,
      };
    }

    if (tipoPeriodo === 'ano') {
      return {
        fechaInicioCalculada: `${anoSeleccionado}-01-01`,
        fechaFinCalculada: `${anoSeleccionado}-12-31`,
        periodoEtiqueta: `Año ${anoSeleccionado}`,
      };
    }

    if (tipoPeriodo === 'rango') {
      const ini = fechaInicioInput.trim() || hoyISO();
      const fin = fechaFinInput.trim() || hoyISO();
      return {
        fechaInicioCalculada: ini,
        fechaFinCalculada: fin,
        periodoEtiqueta: `Período: ${ini} al ${fin}`,
      };
    }

    // 'todo'
    return {
      fechaInicioCalculada: '',
      fechaFinCalculada: '',
      periodoEtiqueta: 'Historial Completo',
    };
  }, [
    tipoPeriodo,
    semanas,
    semanaSeleccionadaId,
    mesSeleccionado,
    anoSeleccionado,
    fechaInicioInput,
    fechaFinInput,
    fechaHoy,
  ]);

  // 3. Cargar datos del período seleccionado
  const cargarDatosPeriodo = useCallback(async () => {
    try {
      setCargando(true);
      const datos = await obtenerDatosExportacionPeriodo({
        tipo: tipoPeriodo === 'rango' ? 'personalizado' : tipoPeriodo,
        fechaInicio: fechaInicioCalculada,
        fechaFin: fechaFinCalculada,
        periodoEtiqueta,
      });
      setDatosExport(datos);
      setArchivoGenerado(null);
    } catch (err) {
      console.error('[Exportar] Error al cargar datos del período:', err);
      Alert.alert('Error', 'No se pudieron calcular los datos para este período.');
    } finally {
      setCargando(false);
    }
  }, [tipoPeriodo, fechaInicioCalculada, fechaFinCalculada, periodoEtiqueta]);

  useFocusEffect(
    useCallback(() => {
      cargarDatosPeriodo();
    }, [cargarDatosPeriodo])
  );

  // Textos formateados
  const textoWhatsApp = useMemo(() => {
    if (!datosExport) return '';
    return generarTextoWhatsAppPeriodo({
      periodoEtiqueta: datosExport.periodoEtiqueta,
      fechaInicio: datosExport.fechaInicio,
      fechaFin: datosExport.fechaFin,
      resumenes: datosExport.resumenes,
      cosecha: datosExport.cosecha,
    });
  }, [datosExport]);

  const textoCSV = useMemo(() => {
    if (!datosExport) return '';
    return generarReporteCompletoCSV({
      periodoEtiqueta: datosExport.periodoEtiqueta,
      fechaInicio: datosExport.fechaInicio,
      fechaFin: datosExport.fechaFin,
      trabajadores: datosExport.trabajadores,
      diasTrabajados: datosExport.diasTrabajados,
      adelantos: datosExport.adelantos,
      resumenes: datosExport.resumenes,
      cosecha: datosExport.cosecha,
      totales: datosExport.totales,
    });
  }, [datosExport]);

  // Acciones
  const handleDescargarCSV = async () => {
    if (!datosExport) return;
    try {
      setExportando(true);
      const nombreLimpio = `AgroGamez_${datosExport.periodoEtiqueta.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
      const ruta = await guardarYCompartirReporteCSV({
        periodoEtiqueta: datosExport.periodoEtiqueta,
        fechaInicio: datosExport.fechaInicio,
        fechaFin: datosExport.fechaFin,
        nombreArchivo: nombreLimpio,
        trabajadores: datosExport.trabajadores,
        diasTrabajados: datosExport.diasTrabajados,
        adelantos: datosExport.adelantos,
        resumenes: datosExport.resumenes,
        cosecha: datosExport.cosecha,
        totales: datosExport.totales,
      });

      setArchivoGenerado(ruta);
      Alert.alert(
        'Exportación Exitosa',
        `Se ha generado el archivo CSV con las 6 secciones completas para:\n${datosExport.periodoEtiqueta}`
      );
    } catch (err) {
      Alert.alert('Error', 'No se pudo generar el archivo de exportación.');
    } finally {
      setExportando(false);
    }
  };

  const handleCompartirGeneral = async () => {
    if (!datosExport || !textoWhatsApp) return;
    try {
      const nombreLimpio = `AgroGamez_${datosExport.periodoEtiqueta.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
      const res = await compartirReporteNativo({
        titulo: `Planilla AgroGámez — ${datosExport.periodoEtiqueta}`,
        texto: textoWhatsApp,
        contenidoCSV: textoCSV,
        nombreArchivo: nombreLimpio,
      });

      if (!res.compartido) {
        await compartirPorWhatsApp(textoWhatsApp);
      }
    } catch (err) {
      console.error('[Exportar] Error en compartir general:', err);
    }
  };

  const handleEnviarWhatsApp = async () => {
    if (!textoWhatsApp) return;
    try {
      const exito = await compartirPorWhatsApp(textoWhatsApp);
      if (!exito) {
        Alert.alert(
          'WhatsApp',
          'Si no se abre automáticamente, usa el botón "Copiar Resumen" para pegarlo directamente en WhatsApp.'
        );
      }
    } catch (err) {
      console.error('[Exportar] Error:', err);
    }
  };

  const handleCopiarPortapapeles = async () => {
    if (!textoWhatsApp) return;
    const copiado = await copiarAlPortapapeles(textoWhatsApp);
    if (copiado) {
      setCopiadoExito(true);
      setTimeout(() => setCopiadoExito(false), 3000);
    } else {
      Alert.alert('Portapapeles', 'No se pudo copiar automáticamente.');
    }
  };

  const handleImprimirPDF = () => {
    if (!datosExport) return;
    const html = generarHTMLPlanillaPeriodo({
      periodoEtiqueta: datosExport.periodoEtiqueta,
      fechaInicio: datosExport.fechaInicio,
      fechaFin: datosExport.fechaFin,
      resumenes: datosExport.resumenes,
      cosecha: datosExport.cosecha,
    });
    const exito = imprimirReporteHTML(html);
    if (!exito) {
      Alert.alert('Impresión', 'La función de impresión no está disponible en este visor.');
    }
  };

  // Atajos para fechas en rango personalizado
  const aplicarAtajoRango = (dias: number) => {
    const fin = new Date();
    const ini = new Date();
    ini.setDate(ini.getDate() - dias);
    setFechaInicioInput(fechaToISO(ini));
    setFechaFinInput(fechaToISO(fin));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.btnVolver} onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.btnVolverTexto}>← Volver</Text>
        </Pressable>
        <Text style={styles.headerTitulo}>Exportar y Descargar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.contenido}>
        {/* Selector de Modo de Exportación */}
        <View style={styles.tarjetaModos}>
          <Text style={styles.tituloSeccion}>1. Selecciona el Tipo de Período a Exportar</Text>
          <View style={styles.filaPills}>
            {(
              [
                { id: 'semana', label: '📅 Semana' },
                { id: 'mes', label: '🗓️ Mes' },
                { id: 'ano', label: '📆 Año' },
                { id: 'rango', label: '🕒 Rango' },
                { id: 'todo', label: '🌐 Todo' },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.id}
                style={[styles.pill, tipoPeriodo === item.id && styles.pillActiva]}
                onPress={() => setTipoPeriodo(item.id)}
              >
                <Text
                  style={[
                    styles.pillTexto,
                    tipoPeriodo === item.id && styles.pillTextoActivo,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Controles Específicos según el Modo */}
          {tipoPeriodo === 'semana' && (
            <View style={styles.cajaSelector}>
              <Text style={styles.labelControl}>Semana a exportar:</Text>
              {semanas.length === 0 ? (
                <Text style={styles.textoVacio}>No hay semanas registradas aún.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollHorizontal}>
                  <View style={styles.filaOpcionesSemanas}>
                    {semanas.map((s) => (
                      <Pressable
                        key={s.id}
                        style={[
                          styles.chipSemana,
                          semanaSeleccionadaId === s.id && styles.chipSemanaActivo,
                        ]}
                        onPress={() => setSemanaSeleccionadaId(s.id)}
                      >
                        <Text
                          style={[
                            styles.chipSemanaTexto,
                            semanaSeleccionadaId === s.id && styles.chipSemanaTextoActivo,
                          ]}
                        >
                          {formatearFechaCorta(s.fecha_inicio)} – {formatearFechaCorta(s.fecha_fin)}
                        </Text>
                        <Text style={styles.chipSemanaSub}>{s.estado.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          )}

          {tipoPeriodo === 'mes' && (
            <View style={styles.cajaSelector}>
              <View style={styles.filaAnoHeader}>
                <Text style={styles.labelControl}>Mes y Año a exportar:</Text>
                <View style={styles.selectorAno}>
                  <Pressable
                    style={styles.btnFlechaAno}
                    onPress={() => setAnoSeleccionado((a) => a - 1)}
                  >
                    <Text style={styles.btnFlechaAnoTexto}>◀</Text>
                  </Pressable>
                  <Text style={styles.textoAnoActual}>{anoSeleccionado}</Text>
                  <Pressable
                    style={styles.btnFlechaAno}
                    onPress={() => setAnoSeleccionado((a) => a + 1)}
                  >
                    <Text style={styles.btnFlechaAnoTexto}>▶</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.gridMeses}>
                {MESES.map((nombre, idx) => (
                  <Pressable
                    key={nombre}
                    style={[styles.btnMes, mesSeleccionado === idx && styles.btnMesActivo]}
                    onPress={() => setMesSeleccionado(idx)}
                  >
                    <Text
                      style={[styles.btnMesTexto, mesSeleccionado === idx && styles.btnMesTextoActivo]}
                    >
                      {nombre.substring(0, 3)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {tipoPeriodo === 'ano' && (
            <View style={styles.cajaSelector}>
              <Text style={styles.labelControl}>Año a exportar:</Text>
              <View style={styles.selectorAnoCentrado}>
                <Pressable
                  style={styles.btnFlechaAnoGrande}
                  onPress={() => setAnoSeleccionado((a) => a - 1)}
                >
                  <Text style={styles.btnFlechaAnoGrandeTexto}>◀</Text>
                </Pressable>
                <Text style={styles.textoAnoGrande}>{anoSeleccionado}</Text>
                <Pressable
                  style={styles.btnFlechaAnoGrande}
                  onPress={() => setAnoSeleccionado((a) => a + 1)}
                >
                  <Text style={styles.btnFlechaAnoGrandeTexto}>▶</Text>
                </Pressable>
              </View>
            </View>
          )}

          {tipoPeriodo === 'rango' && (
            <View style={styles.cajaSelector}>
              <Text style={styles.labelControl}>Rango de fechas personalizado (YYYY-MM-DD):</Text>
              <View style={styles.filaInputsFechas}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.labelInput}>Desde:</Text>
                  <TextInput
                    style={styles.inputFecha}
                    value={fechaInicioInput}
                    onChangeText={setFechaInicioInput}
                    placeholder="2026-10-01"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.labelInput}>Hasta:</Text>
                  <TextInput
                    style={styles.inputFecha}
                    value={fechaFinInput}
                    onChangeText={setFechaFinInput}
                    placeholder="2026-10-31"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              {/* Atajos de rango */}
              <View style={styles.filaAtajos}>
                <Pressable style={styles.btnAtajo} onPress={() => aplicarAtajoRango(7)}>
                  <Text style={styles.btnAtajoTexto}>Últimos 7 días</Text>
                </Pressable>
                <Pressable style={styles.btnAtajo} onPress={() => aplicarAtajoRango(15)}>
                  <Text style={styles.btnAtajoTexto}>Últimos 15 días</Text>
                </Pressable>
                <Pressable style={styles.btnAtajo} onPress={() => aplicarAtajoRango(30)}>
                  <Text style={styles.btnAtajoTexto}>Últimos 30 días</Text>
                </Pressable>
              </View>
            </View>
          )}

          {tipoPeriodo === 'todo' && (
            <View style={styles.cajaSelector}>
              <Text style={styles.badgeTodo}>
                🌐 Se exportarán todos los registros históricos existentes en la base de datos sin límite de fecha.
              </Text>
            </View>
          )}
        </View>

        {/* Resumen de Datos del Período Seleccionado */}
        <View style={styles.tarjetaResumenPeriodo}>
          <Text style={styles.resumenPeriodoTitulo}>2. Resumen del Filtro Seleccionado</Text>
          <Text style={styles.resumenPeriodoEtiqueta}>{periodoEtiqueta}</Text>

          {cargando ? (
            <View style={styles.centro}>
              <ActivityIndicator size="small" color="#2E7D32" />
              <Text style={styles.textoCargando}>Calculando registros del período...</Text>
            </View>
          ) : (
            <>
              <View style={styles.gridMetricasPeriodo}>
                <View style={styles.itemMetrica}>
                  <Text style={styles.itemMetricaValor}>
                    {datosExport?.trabajadores.length || 0}
                  </Text>
                  <Text style={styles.itemMetricaLabel}>Trabajadores</Text>
                </View>
                <View style={styles.itemMetrica}>
                  <Text style={styles.itemMetricaValor}>
                    {datosExport?.diasTrabajados.length || 0}
                  </Text>
                  <Text style={styles.itemMetricaLabel}>Jornadas</Text>
                </View>
                <View style={styles.itemMetrica}>
                  <Text style={styles.itemMetricaValor}>
                    {datosExport?.adelantos.length || 0}
                  </Text>
                  <Text style={styles.itemMetricaLabel}>Adelantos</Text>
                </View>
                <View style={styles.itemMetrica}>
                  <Text style={[styles.itemMetricaValor, { color: '#166534' }]}>
                    {datosExport?.cosecha.empacadas || 0}
                  </Text>
                  <Text style={styles.itemMetricaLabel}>Cajas Empacadas</Text>
                </View>
              </View>

              <View style={styles.bannerNetoPeriodo}>
                <Text style={styles.bannerNetoTitulo}>Nómina Neta a Pagar en este Período:</Text>
                <Text style={styles.bannerNetoMonto}>
                  {formatearMoneda(datosExport?.totales.totalNeto || 0)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* 3. Acciones Reales de Exportación */}
        <View style={styles.tarjetaAcciones}>
          <Text style={styles.tituloSeccion}>3. Ejecutar Exportación o Compartir</Text>

          {/* Botón Principal: Descargar CSV */}
          <Pressable
            style={[styles.btnDescargarCSV, exportando && styles.btnDisabled]}
            onPress={handleDescargarCSV}
            disabled={exportando || cargando}
          >
            {exportando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnDescargarCSVTexto}>
                📥 Descargar Archivo Excel (CSV Completo)
              </Text>
            )}
          </Pressable>

          {/* Botón Menú Compartir Nativo (WhatsApp, AirDrop, Correo, etc.) */}
          <Pressable
            style={styles.btnCompartirNativo}
            onPress={handleCompartirGeneral}
            disabled={cargando}
          >
            <Text style={styles.btnCompartirNativoTexto}>
              📲 Compartir Reporte (Menú Oficial del Sistema)
            </Text>
          </Pressable>

          {/* Botón WhatsApp */}
          <Pressable
            style={styles.btnWhatsApp}
            onPress={handleEnviarWhatsApp}
            disabled={cargando}
          >
            <Text style={styles.btnWhatsAppTexto}>
              💬 Enviar por WhatsApp
            </Text>
          </Pressable>

          {/* Fila de Acciones Secundarias */}
          <View style={styles.filaBotonesSecundarios}>
            <Pressable
              style={[styles.btnSecundario, { flex: 1 }]}
              onPress={handleCopiarPortapapeles}
            >
              <Text style={styles.btnSecundarioTexto}>📋 Copiar Resumen</Text>
            </Pressable>

            <Pressable
              style={[styles.btnSecundario, { flex: 1 }]}
              onPress={handleImprimirPDF}
            >
              <Text style={styles.btnSecundarioTexto}>🖨️ Imprimir / PDF</Text>
            </Pressable>
          </View>

          {copiadoExito && (
            <View style={styles.bannerExito}>
              <Text style={styles.bannerExitoTexto}>
                ✓ ¡Texto copiado al portapapeles! Listo para pegar donde desees.
              </Text>
            </View>
          )}

          {archivoGenerado && (
            <View style={styles.bannerExito}>
              <Text style={styles.bannerExitoTexto}>
                ✓ Archivo Excel (CSV) generado con las 6 secciones para {periodoEtiqueta}.
              </Text>
            </View>
          )}
        </View>

        {/* Vista Previa del Archivo de Exportación */}
        <View style={styles.cajaPrevia}>
          <View style={styles.previaHeader}>
            <Text style={styles.previaTitulo}>
              Vista previa del contenido a exportar:
            </Text>
            <Text style={styles.previaSemana}>{periodoEtiqueta}</Text>
          </View>
          <Text style={styles.mensajeTexto}>{textoCSV || 'Cargando vista previa...'}</Text>
        </View>
      </ScrollView>
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
  },
  contenido: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  tarjetaModos: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    gap: 12,
  },
  tituloSeccion: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  filaPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillActiva: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  pillTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  pillTextoActivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cajaSelector: {
    backgroundColor: '#F9FAF9',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    gap: 10,
    marginTop: 4,
  },
  labelControl: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  scrollHorizontal: {
    marginHorizontal: -4,
  },
  filaOpcionesSemanas: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  chipSemana: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minWidth: 140,
  },
  chipSemanaActivo: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  chipSemanaTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  chipSemanaTextoActivo: {
    color: '#166534',
  },
  chipSemanaSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  textoVacio: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  filaAnoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorAno: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnFlechaAno: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  btnFlechaAnoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  textoAnoActual: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  gridMeses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  btnMes: {
    width: '23%',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  btnMesActivo: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  btnMesTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  btnMesTextoActivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectorAnoCentrado: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 10,
  },
  btnFlechaAnoGrande: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  btnFlechaAnoGrandeTexto: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  textoAnoGrande: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  filaInputsFechas: {
    flexDirection: 'row',
    gap: 10,
  },
  labelInput: {
    fontSize: 11,
    color: '#4B5563',
    marginBottom: 4,
    fontWeight: '600',
  },
  inputFecha: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  filaAtajos: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  btnAtajo: {
    backgroundColor: '#E0E7FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  btnAtajoTexto: {
    color: '#3730A3',
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTodo: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
    fontWeight: '600',
  },
  tarjetaResumenPeriodo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    gap: 10,
  },
  resumenPeriodoTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  resumenPeriodoEtiqueta: {
    fontSize: 17,
    fontWeight: '800',
    color: '#166534',
  },
  gridMetricasPeriodo: {
    flexDirection: 'row',
    backgroundColor: '#F9FAF9',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  itemMetrica: {
    flex: 1,
    alignItems: 'center',
  },
  itemMetricaValor: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
  },
  itemMetricaLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  bannerNetoPeriodo: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerNetoTitulo: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
    flex: 1,
  },
  bannerNetoMonto: {
    fontSize: 18,
    fontWeight: '800',
    color: '#166534',
  },
  centro: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  textoCargando: {
    fontSize: 12,
    color: '#6B7280',
  },
  tarjetaAcciones: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    gap: 10,
  },
  btnDescargarCSV: {
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#1E40AF',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  btnDescargarCSVTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnCompartirNativo: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnCompartirNativoTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnWhatsApp: {
    backgroundColor: '#166534',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnWhatsAppTexto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  filaBotonesSecundarios: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSecundario: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecundarioTexto: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
  },
  bannerExito: {
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginTop: 4,
  },
  bannerExitoTexto: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  cajaPrevia: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    gap: 10,
  },
  previaHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  previaTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  previaSemana: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
    marginTop: 2,
  },
  mensajeTexto: {
    fontSize: 11,
    color: '#374151',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
