// ═══════════════════════════════════════════════════════════
// app/(tabs)/reportes/exportar.tsx — Exportación y Archivos
// MEJORA 9: Exportar con datos completos (6 secciones: Encabezado,
// Asistencia, Adelantos, Resumen Trabajador, Cosecha, Totales)
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BannerEstado } from '@/components/ui/BannerEstado';
import {
  obtenerOCrearSemanaActual,
  obtenerAsistenciaSemanal,
  obtenerAdelantosSemana,
  obtenerResumenTrabajadorSemana,
} from '@/database/asistencia';
import { obtenerTrabajadores } from '@/database/trabajadores';
import { obtenerLotes } from '@/database/lotes';
import { obtenerCosechasPorLote } from '@/database/cosechas';
import {
  generarTextoWhatsAppSemana,
  compartirPorWhatsApp,
  generarReporteCompletoCSV,
  guardarYCompartirReporteCSV,
  type ItemPlanillaExport,
  type ExportarCompletoInput,
} from '@/lib/exportar';
import { formatearFechaCorta } from '@/lib/fechas';
import type { Semana, Trabajador, DiaTrabajado, Adelanto } from '@/types/domain';

export default function ExportarScreen(): React.JSX.Element {
  const router = useRouter();

  const [semana, setSemana] = useState<Semana | null>(null);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [diasTrabajados, setDiasTrabajados] = useState<DiaTrabajado[]>([]);
  const [adelantos, setAdelantos] = useState<Adelanto[]>([]);
  const [itemsPlanilla, setItemsPlanilla] = useState<ItemPlanillaExport[]>([]);
  const [totalesCosecha, setTotalesCosecha] = useState({
    cortadas: 0,
    empacadas: 0,
    descarte: 0,
  });

  const [textoCSV, setTextoCSV] = useState<string>('');
  const [textoWhatsApp, setTextoWhatsApp] = useState<string>('');
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [archivoGenerado, setArchivoGenerado] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const sem = await obtenerOCrearSemanaActual();
      setSemana(sem);

      const [listaTrabajadores, listaDias, listaAdelantos, listaLotes] = await Promise.all([
        obtenerTrabajadores(true),
        obtenerAsistenciaSemanal(sem.id),
        obtenerAdelantosSemana(sem.id),
        obtenerLotes(false),
      ]);

      setTrabajadores(listaTrabajadores);
      setDiasTrabajados(listaDias);
      setAdelantos(listaAdelantos);

      const items: ItemPlanillaExport[] = [];
      for (const t of listaTrabajadores) {
        const calculo = await obtenerResumenTrabajadorSemana(sem.id, t);
        items.push({ trabajador: t, calculo });
      }
      setItemsPlanilla(items);

      // Cosecha
      let cortadas = 0;
      let empacadas = 0;
      let descarte = 0;
      for (const l of listaLotes) {
        const cortes = await obtenerCosechasPorLote(l.id);
        cortes.forEach((c) => {
          cortadas += c.cajas_cortadas || 0;
          empacadas += c.cajas_empacadas || 0;
          descarte += c.cajas_descarte || 0;
        });
      }
      const cos = { cortadas, empacadas, descarte };
      setTotalesCosecha(cos);

      const exportInput: ExportarCompletoInput = {
        semana: sem,
        trabajadores: listaTrabajadores,
        diasTrabajados: listaDias,
        adelantos: listaAdelantos,
        resumenes: items,
        cosecha: cos,
      };

      const csv = generarReporteCompletoCSV(exportInput);
      setTextoCSV(csv);

      const wa = generarTextoWhatsAppSemana(sem, items);
      setTextoWhatsApp(wa);
    } catch (err) {
      console.error('[Exportar] Error al cargar:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [cargarDatos])
  );

  const handleExportarArchivo = async () => {
    if (!semana) return;
    try {
      setExportando(true);
      const exportInput: ExportarCompletoInput = {
        semana,
        trabajadores,
        diasTrabajados,
        adelantos,
        resumenes: itemsPlanilla,
        cosecha: totalesCosecha,
      };

      const ruta = await guardarYCompartirReporteCSV(exportInput);
      setArchivoGenerado(ruta);
      Alert.alert(
        'Exportación Exitosa',
        `Se ha generado el archivo correctamente con las 6 secciones completas.`
      );
    } catch (err) {
      Alert.alert('Error', 'No se pudo generar el archivo de exportación.');
    } finally {
      setExportando(false);
    }
  };

  const handleEnviarWhatsApp = async () => {
    if (!textoWhatsApp) return;
    try {
      const exito = await compartirPorWhatsApp(textoWhatsApp);
      if (!exito) {
        Alert.alert(
          'WhatsApp no disponible',
          'No pudimos abrir WhatsApp directamente en este dispositivo.'
        );
      }
    } catch (err) {
      console.error('[Exportar] Error:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BannerEstado />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.btnVolver} onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.btnVolverTexto}>← Volver</Text>
        </Pressable>
        <Text style={styles.headerTitulo}>Exportar Reporte Completo</Text>
      </View>

      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.tarjetaIntro}>
          <Text style={styles.introEmoji}>📑</Text>
          <Text style={styles.introTitulo}>Exportación Oficial de Planilla</Text>
          <Text style={styles.introTexto}>
            Genera un archivo con 6 secciones completas: Encabezado, Asistencia diaria, Adelantos, Resumen por trabajador, Producción de cosecha y Totales consolidados.
          </Text>
        </View>

        {cargando ? (
          <View style={styles.centro}>
            <ActivityIndicator size="large" color="#2E7D32" />
          </View>
        ) : (
          <>
            {/* Botón Principal: Generar Archivo CSV */}
            <Pressable
              style={[styles.btnExportarArchivo, exportando && styles.btnDisabled]}
              onPress={handleExportarArchivo}
              disabled={exportando}
            >
              {exportando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnExportarArchivoTexto}>
                  📄 Exportar Archivo Completo (CSV)
                </Text>
              )}
            </Pressable>

            {archivoGenerado && (
              <View style={styles.bannerExito}>
                <Text style={styles.bannerExitoTexto}>
                  ✓ Archivo generado listo para abrir en Excel o compartir.
                </Text>
              </View>
            )}

            {/* Botón WhatsApp */}
            <Pressable style={styles.btnWhatsApp} onPress={handleEnviarWhatsApp}>
              <Text style={styles.btnWhatsAppTexto}>
                💬 Compartir Resumen por WhatsApp
              </Text>
            </Pressable>

            {/* Vista Previa del Archivo de Exportación */}
            <View style={styles.cajaPrevia}>
              <View style={styles.previaHeader}>
                <Text style={styles.previaTitulo}>
                  Contenido del archivo (6 secciones completas):
                </Text>
                {semana && (
                  <Text style={styles.previaSemana}>
                    Semana {formatearFechaCorta(semana.fecha_inicio)} – {formatearFechaCorta(semana.fecha_fin)}
                  </Text>
                )}
              </View>
              <Text style={styles.mensajeTexto}>{textoCSV}</Text>
            </View>
          </>
        )}
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
  tarjetaIntro: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EBE8',
    alignItems: 'center',
    gap: 6,
  },
  introEmoji: {
    fontSize: 40,
  },
  introTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  introTexto: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  centro: {
    padding: 30,
    alignItems: 'center',
  },
  btnExportarArchivo: {
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
  btnExportarArchivoTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  bannerExito: {
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  bannerExitoTexto: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
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
    color: '#6B7280',
    marginTop: 2,
  },
  mensajeTexto: {
    fontSize: 11,
    color: '#374151',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
