import { getDB } from './local';
import { hoyISO, lunesDeSemana, domingoDeSemana } from '@/lib/fechas';
import type { Cosecha, ResumenCosecha } from '@/types/domain';

function generarUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface CrearCosechaDTO {
  lote_id: string;
  fecha?: string;
  cajas_cortadas: number;
  cajas_descarte?: number;
  cajas_empacadas?: number;
}

/**
 * Registra una recolección de cosecha para un lote.
 */
export async function registrarCosecha(input: CrearCosechaDTO): Promise<Cosecha> {
  const db = await getDB();
  const id = generarUUID();
  const fecha = input.fecha || hoyISO();
  const cortadas = Math.max(0, input.cajas_cortadas || 0);
  const descarte = Math.max(0, input.cajas_descarte || 0);
  // Si no se especifican cajas empacadas, se asume cortadas - descarte
  const empacadas = typeof input.cajas_empacadas === 'number'
    ? Math.max(0, input.cajas_empacadas)
    : Math.max(0, cortadas - descarte);

  await db.runAsync(
    `INSERT INTO cosechas (id, lote_id, fecha, cajas_cortadas, cajas_descarte, cajas_empacadas, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0);`,
    [id, input.lote_id, fecha, cortadas, descarte, empacadas]
  );

  const row = await db.getFirstAsync<Cosecha>(`SELECT * FROM cosechas WHERE id = ?;`, [id]);
  if (!row) {
    throw new Error('Error al recuperar el registro de cosecha.');
  }
  return row;
}

/**
 * Obtiene todas las cosechas asociadas a un lote específico.
 */
export async function obtenerCosechasPorLote(loteId: string): Promise<Cosecha[]> {
  const db = await getDB();
  return await db.getAllAsync<Cosecha>(
    `SELECT * FROM cosechas WHERE lote_id = ? ORDER BY fecha DESC;`,
    [loteId]
  );
}

/**
 * Obtiene el resumen total acumulado de producción para un lote.
 */
export async function obtenerResumenCosechaLote(loteId: string): Promise<ResumenCosecha> {
  const db = await getDB();
  const result = await db.getFirstAsync<{
    totalCortadas: number | null;
    totalDescarte: number | null;
    totalEmpacadas: number | null;
  }>(
    `SELECT 
       SUM(cajas_cortadas) as totalCortadas,
       SUM(cajas_descarte) as totalDescarte,
       SUM(cajas_empacadas) as totalEmpacadas
     FROM cosechas
     WHERE lote_id = ?;`,
    [loteId]
  );

  return {
    totalCortadas: result?.totalCortadas || 0,
    totalDescarte: result?.totalDescarte || 0,
    totalEmpacadas: result?.totalEmpacadas || 0,
  };
}

/**
 * Elimina un registro de cosecha.
 */
export async function eliminarCosecha(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM cosechas WHERE id = ?;`, [id]);
}

/**
 * Obtiene el resumen de cosechas en un rango de fechas (YYYY-MM-DD).
 */
export async function obtenerResumenCosechasRango(
  fechaInicio: string,
  fechaFin: string
): Promise<ResumenCosecha> {
  const db = await getDB();
  const result = await db.getFirstAsync<{
    totalCortadas: number | null;
    totalDescarte: number | null;
    totalEmpacadas: number | null;
  }>(
    `SELECT 
       SUM(cajas_cortadas) as totalCortadas,
       SUM(cajas_descarte) as totalDescarte,
       SUM(cajas_empacadas) as totalEmpacadas
     FROM cosechas
     WHERE fecha >= ? AND fecha <= ?;`,
    [fechaInicio, fechaFin]
  );

  return {
    totalCortadas: result?.totalCortadas || 0,
    totalDescarte: result?.totalDescarte || 0,
    totalEmpacadas: result?.totalEmpacadas || 0,
  };
}

/**
 * Obtiene acumulados de cortes para Cosecha (Esta semana, Este mes, Este año).
 */
export async function obtenerAcumuladosCosecha(): Promise<{
  estaSemana: number;
  esteMes: number;
  esteAno: number;
}> {
  const db = await getDB();
  const hoy = new Date();
  const inicioSemana = lunesDeSemana(hoy);
  const finSemana = domingoDeSemana(hoy);

  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const inicioMes = `${y}-${m}-01`;
  const finMes = `${y}-${m}-31`;

  const inicioAno = `${y}-01-01`;
  const finAno = `${y}-12-31`;

  const [resSemana, resMes, resAno] = await Promise.all([
    db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(cajas_cortadas) as total FROM cosechas WHERE fecha >= ? AND fecha <= ?;`,
      [inicioSemana, finSemana]
    ),
    db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(cajas_cortadas) as total FROM cosechas WHERE fecha >= ? AND fecha <= ?;`,
      [inicioMes, finMes]
    ),
    db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(cajas_cortadas) as total FROM cosechas WHERE fecha >= ? AND fecha <= ?;`,
      [inicioAno, finAno]
    ),
  ]);

  return {
    estaSemana: resSemana?.total || 0,
    esteMes: resMes?.total || 0,
    esteAno: resAno?.total || 0,
  };
}
