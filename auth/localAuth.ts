// ═══════════════════════════════════════════════════════════
// auth/localAuth.ts — Autenticación local con PIN (SQLite + AsyncStorage)
// Sin Supabase. Sin internet. 100% offline-first.
// ═══════════════════════════════════════════════════════════

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB } from '@/database/local';

const TABLA_CONFIG = 'configuracion_app';
const KEY_PIN = 'agrogamez_pin_acceso';

/** Crea la tabla de configuración si no existe. */
async function initConfigTable(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const db = await getDB();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${TABLA_CONFIG} (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      );
    `);
  } catch (err) {
    console.warn('[LocalAuth] initConfigTable error:', err);
  }
}

/** Guarda un valor en la tabla de configuración y en AsyncStorage. */
async function setConfig(clave: string, valor: string): Promise<void> {
  await AsyncStorage.setItem(clave, valor);
  if (Platform.OS === 'web') return;
  try {
    await initConfigTable();
    const db = await getDB();
    await db.runAsync(
      `INSERT INTO ${TABLA_CONFIG}(clave, valor) VALUES(?, ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor;`,
      [clave, valor]
    );
  } catch (err) {
    console.warn('[LocalAuth] Error guardando config en SQLite:', err);
  }
}

/** Lee un valor de AsyncStorage con respaldo en SQLite. */
async function getConfig(clave: string): Promise<string | null> {
  const cached = await AsyncStorage.getItem(clave);
  if (cached !== null) {
    return cached;
  }
  if (Platform.OS === 'web') return null;
  try {
    await initConfigTable();
    const db = await getDB();
    const row = await db.getFirstAsync<{ valor: string }>(
      `SELECT valor FROM ${TABLA_CONFIG} WHERE clave = ?;`,
      [clave]
    );
    if (row?.valor) {
      await AsyncStorage.setItem(clave, row.valor);
      return row.valor;
    }
  } catch (err) {
    console.warn('[LocalAuth] Error leyendo config en SQLite:', err);
  }
  return null;
}

// ─── API pública ─────────────────────────────────────────────

/**
 * Comprueba si ya existe un PIN configurado.
 */
export async function tienePin(): Promise<boolean> {
  const pin = await getConfig(KEY_PIN);
  return pin !== null && pin.length >= 4;
}

/**
 * Guarda el PIN de acceso.
 */
export async function guardarPin(pin: string): Promise<void> {
  if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    throw new Error('El PIN debe ser de 4 a 6 dígitos numéricos.');
  }
  await setConfig(KEY_PIN, pin);
}

/**
 * Verifica si el PIN ingresado coincide con el guardado.
 */
export async function verificarPin(pin: string): Promise<boolean> {
  const guardado = await getConfig(KEY_PIN);
  return guardado !== null && guardado === pin;
}

/**
 * Borra el PIN para reiniciar (útil para pruebas o reseteo).
 */
export async function borrarPin(): Promise<void> {
  await AsyncStorage.removeItem(KEY_PIN);
  if (Platform.OS === 'web') return;
  try {
    const db = await getDB();
    await db.runAsync(`DELETE FROM ${TABLA_CONFIG} WHERE clave = ?;`, [KEY_PIN]);
  } catch (err) {
    console.warn('[LocalAuth] Error al borrar PIN:', err);
  }
}

/**
 * Marca la sesión como activa en memoria (no persiste entre reinicios de app).
 */
let _sessionActive = false;

export function getSessionActive(): boolean {
  return _sessionActive;
}

export function setSessionActive(value: boolean): void {
  _sessionActive = value;
}
