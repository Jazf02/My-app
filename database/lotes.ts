// database/lotes.ts — Capa de persistencia SQLite para Lotes agrícolas
import { Platform } from 'react-native';
import { getDB } from './local';
import type { Lote, EstadoLote } from '@/types/domain';
import {
  webCrearLote,
  webObtenerLotes,
  webObtenerLotePorId,
  webActualizarLote,
  webCerrarLote,
} from './webStorage';

function generarUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface CrearLoteDTO {
  nombre: string;
  cultivo: string;
  variedad?: string;
  fecha_siembra?: string;
}

/**
 * Crea un nuevo lote agrícola en la BD local.
 */
export async function crearLote(input: CrearLoteDTO): Promise<Lote> {
  if (Platform.OS === 'web') return webCrearLote(input);
  const db = await getDB();
  const id = generarUUID();
  const nombre = input.nombre.trim();
  const cultivo = input.cultivo.trim();
  const variedad = input.variedad ? input.variedad.trim() : null;
  const fechaSiembra = input.fecha_siembra || null;

  await db.runAsync(
    `INSERT INTO lotes (id, nombre, cultivo, variedad, fecha_siembra, estado, synced)
     VALUES (?, ?, ?, ?, ?, 'activo', 0);`,
    [id, nombre, cultivo, variedad, fechaSiembra]
  );

  const row = await db.getFirstAsync<Lote>(`SELECT * FROM lotes WHERE id = ?;`, [id]);
  if (!row) {
    throw new Error('Error al recuperar el lote creado.');
  }
  return row;
}

/**
 * Obtiene los lotes registrados.
 */
export async function obtenerLotes(soloActivos: boolean = true): Promise<Lote[]> {
  if (Platform.OS === 'web') return webObtenerLotes(soloActivos);
  const db = await getDB();
  let query = `SELECT * FROM lotes`;
  if (soloActivos) {
    query += ` WHERE estado = 'activo'`;
  }
  query += ` ORDER BY nombre ASC;`;
  return await db.getAllAsync<Lote>(query);
}

/**
 * Obtiene un lote por su ID.
 */
export async function obtenerLotePorId(id: string): Promise<Lote | null> {
  if (Platform.OS === 'web') return webObtenerLotePorId(id);
  const db = await getDB();
  const row = await db.getFirstAsync<Lote>(`SELECT * FROM lotes WHERE id = ?;`, [id]);
  return row || null;
}

/**
 * Actualiza la información de un lote.
 */
export async function actualizarLote(id: string, input: Partial<CrearLoteDTO>): Promise<Lote> {
  if (Platform.OS === 'web') return webActualizarLote(id, input);
  const db = await getDB();
  const actual = await obtenerLotePorId(id);
  if (!actual) {
    throw new Error(`Lote con id ${id} no encontrado.`);
  }

  const nombre = input.nombre !== undefined ? input.nombre.trim() : actual.nombre;
  const cultivo = input.cultivo !== undefined ? input.cultivo.trim() : actual.cultivo;
  const variedad = input.variedad !== undefined ? input.variedad : actual.variedad;
  const fechaSiembra = input.fecha_siembra !== undefined ? input.fecha_siembra : actual.fecha_siembra;

  await db.runAsync(
    `UPDATE lotes
     SET nombre = ?, cultivo = ?, variedad = ?, fecha_siembra = ?, synced = 0
     WHERE id = ?;`,
    [nombre, cultivo, variedad, fechaSiembra, id]
  );

  const actualizado = await obtenerLotePorId(id);
  return actualizado!;
}

/**
 * Cambia el estado del lote a 'cerrado'.
 */
export async function cerrarLote(id: string): Promise<void> {
  if (Platform.OS === 'web') return webCerrarLote(id);
  const db = await getDB();
  await db.runAsync(
    `UPDATE lotes SET estado = 'cerrado', synced = 0 WHERE id = ?;`,
    [id]
  );
}
