// database/gastos.ts — Capa de persistencia SQLite para Gastos e Insumos operativos
import { Platform } from 'react-native';
import { getDB } from './local';
import { hoyISO } from '@/lib/fechas';
import type { Gasto, CategoriaGasto } from '@/types/domain';
import {
  webRegistrarGasto,
  webObtenerGastos,
  webObtenerTotalGastos,
  webEliminarGasto,
} from './webStorage';

function generarUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface CrearGastoDTO {
  fecha?: string;
  categoria: CategoriaGasto;
  descripcion?: string;
  monto: number;
  lote_id?: string;
}

/**
 * Registra un nuevo gasto u orden de insumos en SQLite.
 */
export async function registrarGasto(input: CrearGastoDTO): Promise<Gasto> {
  if (Platform.OS === 'web') return webRegistrarGasto(input);
  const db = await getDB();
  const id = generarUUID();
  const fecha = input.fecha || hoyISO();
  const categoria = input.categoria;
  const descripcion = input.descripcion ? input.descripcion.trim() : null;
  const monto = Math.max(0, input.monto || 0);
  const loteId = input.lote_id || null;

  await db.runAsync(
    `INSERT INTO gastos (id, fecha, categoria, descripcion, monto, lote_id, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0);`,
    [id, fecha, categoria, descripcion, monto, loteId]
  );

  const row = await db.getFirstAsync<Gasto>(`SELECT * FROM gastos WHERE id = ?;`, [id]);
  if (!row) {
    throw new Error('Error al recuperar el gasto registrado.');
  }
  return row;
}

/**
 * Obtiene los gastos registrados con filtros opcionales.
 */
export async function obtenerGastos(filtro?: {
  lote_id?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}): Promise<Gasto[]> {
  if (Platform.OS === 'web') return webObtenerGastos(filtro);
  const db = await getDB();
  let query = `SELECT * FROM gastos WHERE 1=1`;
  const params: any[] = [];

  if (filtro?.lote_id) {
    query += ` AND lote_id = ?`;
    params.push(filtro.lote_id);
  }
  if (filtro?.fecha_inicio) {
    query += ` AND fecha >= ?`;
    params.push(filtro.fecha_inicio);
  }
  if (filtro?.fecha_fin) {
    query += ` AND fecha <= ?`;
    params.push(filtro.fecha_fin);
  }

  query += ` ORDER BY fecha DESC;`;
  return await db.getAllAsync<Gasto>(query, params);
}

/**
 * Obtiene el total suma acumulado de gastos (opcionalmente filtrado por lote).
 */
export async function obtenerTotalGastos(loteId?: string): Promise<number> {
  if (Platform.OS === 'web') return webObtenerTotalGastos(loteId);
  const db = await getDB();
  let query = `SELECT SUM(monto) as total FROM gastos`;
  const params: any[] = [];

  if (loteId) {
    query += ` WHERE lote_id = ?`;
    params.push(loteId);
  }

  const res = await db.getFirstAsync<{ total: number | null }>(query, params);
  return res?.total || 0;
}

/**
 * Elimina un gasto por su ID.
 */
export async function eliminarGasto(id: string): Promise<void> {
  if (Platform.OS === 'web') return webEliminarGasto(id);
  const db = await getDB();
  await db.runAsync(`DELETE FROM gastos WHERE id = ?;`, [id]);
}
