// database/trabajadores.ts — Capa de persistencia SQLite para Trabajadores
import { Platform } from 'react-native';
import { getDB } from './local';
import type { Trabajador, CrearTrabajadorDTO } from '@/types/domain';
import {
  webCrearTrabajador,
  webObtenerTrabajadores,
  webObtenerTrabajadorPorId,
  webActualizarTrabajador,
  webDesactivarTrabajador,
  webActivarTrabajador,
} from './webStorage';

/**
 * Genera un UUID v4 simple para compatibilidad offline.
 */
function generarUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Crea un nuevo trabajador en SQLite.
 */
export async function crearTrabajador(input: CrearTrabajadorDTO): Promise<Trabajador> {
  if (Platform.OS === 'web') return webCrearTrabajador(input);
  const db = await getDB();
  const id = generarUUID();
  const nombre = input.nombre.trim();
  const tarifaDiaria = typeof input.tarifa_diaria_default === 'number' ? input.tarifa_diaria_default : 250;

  await db.runAsync(
    `INSERT INTO trabajadores (id, nombre, tarifa_diaria_default, activo, synced)
     VALUES (?, ?, ?, 1, 0);`,
    [id, nombre, tarifaDiaria]
  );

  const row = await db.getFirstAsync<Trabajador>(
    `SELECT * FROM trabajadores WHERE id = ?;`,
    [id]
  );

  if (!row) {
    throw new Error('Error al recuperar el trabajador recién creado.');
  }

  return row;
}

/**
 * Obtiene la lista de trabajadores registrados.
 * @param soloActivos Si es true (default), solo retorna los trabajadores activos.
 */
export async function obtenerTrabajadores(soloActivos: boolean = true): Promise<Trabajador[]> {
  if (Platform.OS === 'web') return webObtenerTrabajadores(soloActivos);
  const db = await getDB();
  let query = `SELECT * FROM trabajadores`;
  const params: any[] = [];

  if (soloActivos) {
    query += ` WHERE activo = 1`;
  }
  query += ` ORDER BY nombre ASC;`;

  return await db.getAllAsync<Trabajador>(query, params);
}

/**
 * Obtiene un trabajador por su ID.
 */
export async function obtenerTrabajadorPorId(id: string): Promise<Trabajador | null> {
  if (Platform.OS === 'web') return webObtenerTrabajadorPorId(id);
  const db = await getDB();
  const row = await db.getFirstAsync<Trabajador>(
    `SELECT * FROM trabajadores WHERE id = ?;`,
    [id]
  );
  return row || null;
}

/**
 * Actualiza los datos de un trabajador.
 */
export async function actualizarTrabajador(
  id: string,
  input: Partial<CrearTrabajadorDTO> & { dominical?: number }
): Promise<Trabajador> {
  if (Platform.OS === 'web') return webActualizarTrabajador(id, input);
  const db = await getDB();
  const actual = await obtenerTrabajadorPorId(id);
  if (!actual) {
    throw new Error(`Trabajador con id ${id} no encontrado.`);
  }

  const nuevoNombre = input.nombre !== undefined ? input.nombre.trim() : actual.nombre;
  const nuevaTarifa = input.tarifa_diaria_default !== undefined ? input.tarifa_diaria_default : actual.tarifa_diaria_default;
  const nuevoDominical = input.dominical !== undefined ? input.dominical : (actual.dominical ?? 0);

  await db.runAsync(
    `UPDATE trabajadores
     SET nombre = ?, tarifa_diaria_default = ?, dominical = ?, synced = 0
     WHERE id = ?;`,
    [nuevoNombre, nuevaTarifa, nuevoDominical, id]
  );

  const actualizado = await obtenerTrabajadorPorId(id);
  return actualizado!;
}

/**
 * Realiza un borrado lógico (soft-delete) desactivando al trabajador (`activo = 0`).
 */
export async function desactivarTrabajador(id: string): Promise<void> {
  if (Platform.OS === 'web') return webDesactivarTrabajador(id);
  const db = await getDB();
  await db.runAsync(
    `UPDATE trabajadores SET activo = 0, synced = 0 WHERE id = ?;`,
    [id]
  );
}

/**
 * Reactiva un trabajador previamente desactivado.
 */
export async function activarTrabajador(id: string): Promise<void> {
  if (Platform.OS === 'web') return webActivarTrabajador(id);
  const db = await getDB();
  await db.runAsync(
    `UPDATE trabajadores SET activo = 1, synced = 0 WHERE id = ?;`,
    [id]
  );
}
