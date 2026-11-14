// database/asistencia.ts — Capa de persistencia SQLite para Semanas, Asistencia y Adelantos
import { Platform } from 'react-native';
import { getDB } from './local';
import { lunesDeSemana, domingoDeSemana, hoyISO } from '@/lib/fechas';
import { calcularPagoSemanal, type ResultadoPagoSemanal } from '@/lib/calculos';
import type { Semana, DiaTrabajado, Adelanto, CrearAdelantoDTO, Trabajador } from '@/types/domain';
import {
  webObtenerOCrearSemanaParaFecha,
  webObtenerSemanaPorId,
  webObtenerSemanas,
  webCerrarSemana,
  webMarcarSemanaComoPagada,
  webReabrirSemana,
  webGuardarPeriodoCerrado,
  webObtenerPeriodosCerrados,
  webMarcarAsistencia,
  webObtenerAsistenciaSemanal,
  webRegistrarAdelanto,
  webObtenerAdelantosSemana,
  webEliminarAdelanto,
  webObtenerResumenTrabajadorSemana,
  webRevertirAdelanto,
  webObtenerMetricasPeriodo,
  webObtenerDatosExportacionPeriodo,
  type ParametrosFiltroExport,
  type ResultadoExportacionPeriodo,
} from './webStorage';

function generarUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Obtiene o crea la semana de pago que corresponde a la fecha dada (YYYY-MM-DD).
 */
export async function obtenerOCrearSemanaParaFecha(fechaISO: string): Promise<Semana> {
  if (Platform.OS === 'web') return webObtenerOCrearSemanaParaFecha(fechaISO);
  const db = await getDB();
  const fechaObj = new Date(fechaISO + 'T00:00:00');
  const fechaInicio = lunesDeSemana(fechaObj);
  const fechaFin = domingoDeSemana(fechaObj);

  const existente = await db.getFirstAsync<Semana>(
    `SELECT * FROM semanas WHERE fecha_inicio = ?;`,
    [fechaInicio]
  );

  if (existente) {
    return existente;
  }

  const id = generarUUID();
  await db.runAsync(
    `INSERT INTO semanas (id, fecha_inicio, fecha_fin, estado, synced)
     VALUES (?, ?, ?, 'abierta', 0);`,
    [id, fechaInicio, fechaFin]
  );

  const nueva = await db.getFirstAsync<Semana>(
    `SELECT * FROM semanas WHERE id = ?;`,
    [id]
  );

  return nueva!;
}

/**
 * Obtiene la semana de pago activa para la fecha actual.
 * Si no existe en SQLite, la crea automáticamente con rango Lunes a Domingo.
 */
export async function obtenerOCrearSemanaActual(): Promise<Semana> {
  return obtenerOCrearSemanaParaFecha(hoyISO());
}

/**
 * Obtiene una semana por su ID.
 */
export async function obtenerSemanaPorId(id: string): Promise<Semana | null> {
  if (Platform.OS === 'web') return webObtenerSemanaPorId(id);
  const db = await getDB();
  const row = await db.getFirstAsync<Semana>(
    `SELECT * FROM semanas WHERE id = ?;`,
    [id]
  );
  return row || null;
}

/**
 * Lista todas las semanas registradas ordenadas descendentemente por fecha.
 */
export async function obtenerSemanas(limite: number = 20): Promise<Semana[]> {
  if (Platform.OS === 'web') return webObtenerSemanas(limite);
  const db = await getDB();
  return await db.getAllAsync<Semana>(
    `SELECT * FROM semanas ORDER BY fecha_inicio DESC LIMIT ?;`,
    [limite]
  );
}

/**
 * Cierra una semana de pago (abierta → cerrada).
 * MEJORA 10: solo funciona si la semana está 'abierta'.
 */
export async function cerrarSemana(id: string): Promise<void> {
  if (Platform.OS === 'web') return webCerrarSemana(id);
  const db = await getDB();
  const semana = await db.getFirstAsync<{ estado: string }>(
    `SELECT estado FROM semanas WHERE id = ?;`,
    [id]
  );
  if (!semana || semana.estado !== 'abierta') {
    throw new Error('Solo se pueden cerrar semanas con estado \'abierta\'.');
  }
  await db.runAsync(
    `UPDATE semanas SET estado = 'cerrada', cerrada_en = datetime('now'), synced = 0 WHERE id = ?;`,
    [id]
  );
}

/**
 * Marca una semana cerrada como pagada (cerrada → pagada).
 */
export async function marcarSemanaComoPagada(id: string): Promise<void> {
  if (Platform.OS === 'web') return webMarcarSemanaComoPagada(id);
  const db = await getDB();
  const semana = await db.getFirstAsync<{ estado: string }>(
    `SELECT estado FROM semanas WHERE id = ?;`,
    [id]
  );
  if (!semana || semana.estado !== 'cerrada') {
    throw new Error('Solo se pueden marcar como pagadas las semanas con estado \'cerrada\'.');
  }
  await db.runAsync(
    `UPDATE semanas SET estado = 'pagada', pagada_en = datetime('now'), synced = 0 WHERE id = ?;`,
    [id]
  );
}

/**
 * Reabre una semana cerrada o pagada (vuelve a 'abierta').
 */
export async function reabrirSemana(id: string, motivo?: string): Promise<void> {
  if (Platform.OS === 'web') return webReabrirSemana(id);
  const db = await getDB();
  await db.runAsync(
    `UPDATE semanas SET estado = 'abierta', reabierta_en = datetime('now'), reabierta_motivo = ?, synced = 0 WHERE id = ?;`,
    [motivo || 'Correción manual', id]
  );
}

/**
 * Guarda un periodo cerrado en el historial.
 */
export async function guardarPeriodoCerrado(input: {
  tipo: 'semana' | 'mes' | 'año';
  fechaInicio: string;
  fechaFin: string;
  cajasCortadas: number;
  cajasEmpacadas: number;
  descarte: number;
  nominaBruta: number;
  adelantos: number;
  neto: number;
}): Promise<void> {
  if (Platform.OS === 'web') return webGuardarPeriodoCerrado(input);
  const db = await getDB();
  const id = generarUUID();
  await db.runAsync(
    `INSERT INTO periodos_cerrados
     (id, tipo, fecha_inicio, fecha_fin, cajas_cortadas, cajas_empacadas, descarte,
      nomina_bruta, adelantos, neto, fecha_cierre)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
    [id, input.tipo, input.fechaInicio, input.fechaFin,
     input.cajasCortadas, input.cajasEmpacadas, input.descarte,
     input.nominaBruta, input.adelantos, input.neto]
  );
}

export interface PeriodoCerrado {
  id: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  cajas_cortadas: number;
  cajas_empacadas: number;
  descarte: number;
  nomina_bruta: number;
  adelantos: number;
  neto: number;
  fecha_cierre: string;
}

/**
 * Obtiene todos los periodos cerrados ordenados por fecha descendente.
 */
export async function obtenerPeriodosCerrados(): Promise<PeriodoCerrado[]> {
  if (Platform.OS === 'web') return webObtenerPeriodosCerrados();
  const db = await getDB();
  return await db.getAllAsync<PeriodoCerrado>(
    `SELECT * FROM periodos_cerrados ORDER BY fecha_inicio DESC;`
  );
}

/**
 * Registra o actualiza la asistencia de un trabajador para un día específico (Upsert).
 */
export async function marcarAsistencia(input: {
  semanaId: string;
  trabajadorId: string;
  fecha: string;
  presente: boolean;
  tarifaDiariaOverride?: number | null;
}): Promise<void> {
  if (Platform.OS === 'web') return webMarcarAsistencia(input);
  const db = await getDB();
  const id = generarUUID();
  const presenteInt = input.presente ? 1 : 0;
  const tarifaVal = typeof input.tarifaDiariaOverride === 'number' ? input.tarifaDiariaOverride : null;

  await db.runAsync(
    `INSERT INTO dias_trabajados (id, semana_id, trabajador_id, fecha, presente, tarifa_diaria, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(semana_id, trabajador_id, fecha) DO UPDATE SET
       presente = excluded.presente,
       tarifa_diaria = excluded.tarifa_diaria,
       synced = 0;`,
    [id, input.semanaId, input.trabajadorId, input.fecha, presenteInt, tarifaVal]
  );
}

/**
 * Obtiene el registro de asistencia diaria para una semana y opcionalmente un trabajador.
 */
export async function obtenerAsistenciaSemanal(
  semanaId: string,
  trabajadorId?: string
): Promise<DiaTrabajado[]> {
  if (Platform.OS === 'web') return webObtenerAsistenciaSemanal(semanaId, trabajadorId);
  const db = await getDB();
  if (trabajadorId) {
    return await db.getAllAsync<DiaTrabajado>(
      `SELECT * FROM dias_trabajados WHERE semana_id = ? AND trabajador_id = ? ORDER BY fecha ASC;`,
      [semanaId, trabajadorId]
    );
  }
  return await db.getAllAsync<DiaTrabajado>(
    `SELECT * FROM dias_trabajados WHERE semana_id = ? ORDER BY fecha ASC;`,
    [semanaId]
  );
}

/**
 * Registra un adelanto de dinero otorgado a un trabajador.
 */
export async function registrarAdelanto(input: CrearAdelantoDTO): Promise<Adelanto> {
  if (Platform.OS === 'web') return webRegistrarAdelanto(input);
  const db = await getDB();
  const fecha = input.fecha || hoyISO();

  // Verificar si ya existe un adelanto activo en esta misma fecha
  const existente = await db.getFirstAsync<Adelanto>(
    `SELECT * FROM adelantos WHERE semana_id = ? AND trabajador_id = ? AND fecha = ? AND revertido = 0;`,
    [input.semana_id, input.trabajador_id, fecha]
  );

  if (existente) {
    await db.runAsync(
      `UPDATE adelantos SET monto = ?, concepto = ?, synced = 0 WHERE id = ?;`,
      [input.monto, input.concepto || existente.concepto, existente.id]
    );
    return (await db.getFirstAsync<Adelanto>(`SELECT * FROM adelantos WHERE id = ?;`, [existente.id]))!;
  }

  const id = generarUUID();
  await db.runAsync(
    `INSERT INTO adelantos (id, semana_id, trabajador_id, monto, concepto, fecha, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0);`,
    [id, input.semana_id, input.trabajador_id, input.monto, input.concepto || '', fecha]
  );

  const row = await db.getFirstAsync<Adelanto>(
    `SELECT * FROM adelantos WHERE id = ?;`,
    [id]
  );

  return row!;
}

/**
 * Obtiene la lista de adelantos de una semana.
 */
export async function obtenerAdelantosSemana(
  semanaId: string,
  trabajadorId?: string
): Promise<Adelanto[]> {
  if (Platform.OS === 'web') return webObtenerAdelantosSemana(semanaId, trabajadorId);
  const db = await getDB();
  if (trabajadorId) {
    return await db.getAllAsync<Adelanto>(
      `SELECT * FROM adelantos WHERE semana_id = ? AND trabajador_id = ? ORDER BY fecha DESC;`,
      [semanaId, trabajadorId]
    );
  }
  return await db.getAllAsync<Adelanto>(
    `SELECT * FROM adelantos WHERE semana_id = ? ORDER BY fecha DESC;`,
    [semanaId]
  );
}

/**
 * Elimina un adelanto por su ID.
 */
export async function eliminarAdelanto(id: string): Promise<void> {
  if (Platform.OS === 'web') return webEliminarAdelanto(id);
  const db = await getDB();
  await db.runAsync(`DELETE FROM adelantos WHERE id = ?;`, [id]);
}

/**
 * Obtiene el resumen consolidado de cálculo para un trabajador en una semana.
 */
export async function obtenerResumenTrabajadorSemana(
  semanaId: string,
  trabajador: Trabajador
): Promise<ResultadoPagoSemanal> {
  const dias = await obtenerAsistenciaSemanal(semanaId, trabajador.id);
  const adelantos = await obtenerAdelantosSemana(semanaId, trabajador.id);

  return calcularPagoSemanal(dias, trabajador.tarifa_diaria_default, adelantos);
}

export async function revertirAdelanto(id: string): Promise<void> {
  if (Platform.OS === 'web') return webRevertirAdelanto(id);
  const db = await getDB();
  await db.runAsync(`UPDATE adelantos SET revertido = 1, synced = 0 WHERE id = ?;`, [id]);
}

export interface ResumenTrabajadorPeriodo {
  trabajador_id: string;
  nombre: string;
  dias_trabajados: number;
  total_ganado: number;
}

export interface MetricasPeriodo {
  nominaTotal: number;
  trabajadoresPresentes: number;
  cajasCortadas: number;
  cajasEmpacadas: number;
  cajasDescarte: number;
  porcentajeAprovechable: number;
  porTrabajador: ResumenTrabajadorPeriodo[];
}

/**
 * Obtiene métricas consolidadas (nómina, asistencia, cosecha, desglose) para un rango de fechas.
 */
export async function obtenerMetricasPeriodo(
  fechaInicio: string,
  fechaFin: string
): Promise<MetricasPeriodo> {
  if (Platform.OS === 'web') return webObtenerMetricasPeriodo(fechaInicio, fechaFin);
  const db = await getDB();

  // Asistencia agrupada por trabajador
  const filasTrabajadores = await db.getAllAsync<{
    trabajador_id: string;
    nombre: string;
    dias_trabajados: number;
    total_ganado: number;
  }>(
    `SELECT 
       d.trabajador_id,
       t.nombre,
       COUNT(CASE WHEN d.presente = 1 THEN 1 END) as dias_trabajados,
       SUM(CASE WHEN d.presente = 1 THEN COALESCE(d.tarifa_diaria, t.tarifa_diaria_default, 250) ELSE 0 END) as total_ganado
     FROM dias_trabajados d
     JOIN trabajadores t ON t.id = d.trabajador_id
     WHERE d.fecha >= ? AND d.fecha <= ?
     GROUP BY d.trabajador_id, t.nombre
     HAVING dias_trabajados > 0
     ORDER BY t.nombre ASC;`,
    [fechaInicio, fechaFin]
  );

  const nominaTotal = filasTrabajadores.reduce((acc, r) => acc + (r.total_ganado || 0), 0);

  // Trabajadores presentes únicos en el rango
  const resPres = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COUNT(DISTINCT trabajador_id) as total 
     FROM dias_trabajados 
     WHERE fecha >= ? AND fecha <= ? AND presente = 1;`,
    [fechaInicio, fechaFin]
  );
  const trabajadoresPresentes = resPres?.total || 0;

  // Cosechas en el periodo
  const resCosecha = await db.getFirstAsync<{
    cortadas: number | null;
    empacadas: number | null;
    descarte: number | null;
  }>(
    `SELECT 
       SUM(cajas_cortadas) as cortadas,
       SUM(cajas_empacadas) as empacadas,
       SUM(cajas_descarte) as descarte
     FROM cosechas
     WHERE fecha >= ? AND fecha <= ?;`,
    [fechaInicio, fechaFin]
  );

  const cajasCortadas = resCosecha?.cortadas || 0;
  const cajasEmpacadas = resCosecha?.empacadas || 0;
  const cajasDescarte = resCosecha?.descarte || 0;
  const porcentajeAprovechable =
    cajasCortadas > 0 ? (cajasEmpacadas / cajasCortadas) * 100 : 0;

  return {
    nominaTotal,
    trabajadoresPresentes,
    cajasCortadas,
    cajasEmpacadas,
    cajasDescarte,
    porcentajeAprovechable,
    porTrabajador: filasTrabajadores,
  };
}

export { ParametrosFiltroExport, ResultadoExportacionPeriodo };

export async function obtenerDatosExportacionPeriodo(
  params: ParametrosFiltroExport
): Promise<ResultadoExportacionPeriodo> {
  if (Platform.OS === 'web') return webObtenerDatosExportacionPeriodo(params);
  const db = await getDB();

  let fechaInicio = params.fechaInicio || '';
  let fechaFin = params.fechaFin || '';

  if (params.tipo === 'todo') {
    const minMax = await db.getFirstAsync<{ minF: string; maxF: string }>(
      `SELECT MIN(fecha) as minF, MAX(fecha) as maxF FROM dias_trabajados;`
    );
    fechaInicio = minMax?.minF || hoyISO();
    fechaFin = minMax?.maxF || hoyISO();
  }

  const esTodo = params.tipo === 'todo';
  const dias = await db.getAllAsync<DiaTrabajado>(
    esTodo
      ? `SELECT * FROM dias_trabajados ORDER BY fecha ASC;`
      : `SELECT * FROM dias_trabajados WHERE fecha >= ? AND fecha <= ? ORDER BY fecha ASC;`,
    esTodo ? [] : [fechaInicio, fechaFin]
  );

  const adelantos = await db.getAllAsync<Adelanto>(
    esTodo
      ? `SELECT * FROM adelantos WHERE revertido = 0 ORDER BY fecha ASC;`
      : `SELECT * FROM adelantos WHERE fecha >= ? AND fecha <= ? AND revertido = 0 ORDER BY fecha ASC;`,
    esTodo ? [] : [fechaInicio, fechaFin]
  );

  const todosTrabajadores = await db.getAllAsync<Trabajador>(
    `SELECT * FROM trabajadores ORDER BY nombre ASC;`
  );

  const idsConActividad = new Set<string>();
  dias.forEach((d) => idsConActividad.add(d.trabajador_id));
  adelantos.forEach((a) => idsConActividad.add(a.trabajador_id));

  const trabajadoresRelevantes = todosTrabajadores.filter(
    (t) => idsConActividad.has(t.id) || (idsConActividad.size === 0 && t.activo === 1)
  );

  let granTotalGanado = 0;
  let granTotalAdelantos = 0;

  const resumenes = trabajadoresRelevantes.map((t) => {
    const diasT = dias.filter((d) => d.trabajador_id === t.id);
    const adelantosT = adelantos.filter((a) => a.trabajador_id === t.id);

    const diasPresentes = diasT.filter((d) => d.presente === 1).length;
    const diasAusentes = diasT.filter((d) => d.presente === 0).length;

    const totalGanado = diasT.reduce((acc, d) => {
      if (d.presente !== 1) return acc;
      const tarifa = d.tarifa_diaria ?? t.tarifa_diaria_default ?? 250;
      return acc + tarifa;
    }, 0);

    const totalAdelantos = adelantosT.reduce((acc, a) => acc + (a.monto || 0), 0);
    const totalAPagar = totalGanado - totalAdelantos;

    granTotalGanado += totalGanado;
    granTotalAdelantos += totalAdelantos;

    return {
      trabajador: t,
      calculo: {
        diasPresentes,
        diasAusentes,
        totalGanado,
        totalAdelantos,
        totalAPagar,
      },
    };
  });

  const resCosecha = await db.getFirstAsync<{
    cortadas: number | null;
    empacadas: number | null;
    descarte: number | null;
  }>(
    esTodo
      ? `SELECT SUM(cajas_cortadas) as cortadas, SUM(cajas_empacadas) as empacadas, SUM(cajas_descarte) as descarte FROM cosechas;`
      : `SELECT SUM(cajas_cortadas) as cortadas, SUM(cajas_empacadas) as empacadas, SUM(cajas_descarte) as descarte FROM cosechas WHERE fecha >= ? AND fecha <= ?;`,
    esTodo ? [] : [fechaInicio, fechaFin]
  );

  return {
    periodoEtiqueta: params.periodoEtiqueta || `${fechaInicio} al ${fechaFin}`,
    fechaInicio,
    fechaFin,
    trabajadores: trabajadoresRelevantes,
    diasTrabajados: dias,
    adelantos,
    resumenes,
    cosecha: {
      cortadas: resCosecha?.cortadas || 0,
      empacadas: resCosecha?.empacadas || 0,
      descarte: resCosecha?.descarte || 0,
    },
    totales: {
      nominaBruta: granTotalGanado,
      totalAdelantos: granTotalAdelantos,
      totalNeto: granTotalGanado - granTotalAdelantos,
    },
  };
}
