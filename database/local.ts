// ═══════════════════════════════════════════════════════════
// database/local.ts — Capa de acceso a SQLite (expo-sqlite)
// Offline-first: inicialización, migraciones y singleton de BD
// ═══════════════════════════════════════════════════════════

import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

// Nombre del archivo de base de datos
const DB_NAME = 'agrogamez.db';

// Instancia singleton de la BD
let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Obtiene (o crea) la instancia singleton de la base de datos.
 * Habilita WAL mode y foreign keys en cada apertura.
 */
export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (Platform.OS === 'web') {
    throw new Error('SQLite no está disponible en la plataforma web.');
  }

  if (_db !== null) {
    return _db;
  }

  const db = await SQLite.openDatabaseAsync(DB_NAME, {
    useNewConnection: false,
  });

  // Habilitar WAL mode para mayor rendimiento
  await db.execAsync('PRAGMA journal_mode = WAL;');
  // Habilitar foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  _db = db;
  return _db;
}

/**
 * Migra columnas faltantes en tablas existentes para garantizar
 * compatibilidad sin perder datos previos.
 */
async function migrarEsquema(db: SQLite.SQLiteDatabase): Promise<void> {
  const asegurarColumna = async (tabla: string, columna: string, definicion: string) => {
    try {
      const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tabla});`);
      const existe = info.some((c) => c.name.toLowerCase() === columna.toLowerCase());
      if (!existe) {
        await db.execAsync(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion};`);
      }
    } catch (err) {
      console.warn(`[Migracion] Aviso al asegurar columna ${columna} en ${tabla}:`, err);
    }
  };

  // 1. Trabajadores
  await asegurarColumna('trabajadores', 'tarifa_diaria_default', 'REAL NOT NULL DEFAULT 250');
  await asegurarColumna('trabajadores', 'sueldo_base', 'REAL NOT NULL DEFAULT 250');
  await asegurarColumna('trabajadores', 'activo', 'INTEGER DEFAULT 1');
  await asegurarColumna('trabajadores', 'synced', 'INTEGER DEFAULT 0');
  try {
    await db.execAsync(`
      UPDATE trabajadores
      SET tarifa_diaria_default = sueldo_base
      WHERE tarifa_diaria_default IS NULL OR tarifa_diaria_default = 0;
    `);
  } catch (_) {}

  // 2. Semanas — asegurar columnas y migrar CHECK constraint
  await asegurarColumna('semanas', 'synced', 'INTEGER DEFAULT 0');
  await asegurarColumna('semanas', 'pagada_en', 'TEXT');
  await asegurarColumna('semanas', 'cerrada_en', 'TEXT');
  await asegurarColumna('semanas', 'reabierta_en', 'TEXT');
  await asegurarColumna('semanas', 'reabierta_motivo', 'TEXT');
  // Migrar CHECK constraint de semanas para incluir 'cerrada'
  try {
    const semanasDef = await db.getAllAsync<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='semanas';`
    );
    const defStr = semanasDef[0]?.sql || '';
    if (!defStr.includes("'cerrada'")) {
      // Recrear tabla con el constraint correcto preservando datos
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS semanas_nueva (
          id                TEXT PRIMARY KEY,
          fecha_inicio      TEXT NOT NULL,
          fecha_fin         TEXT NOT NULL,
          estado            TEXT NOT NULL DEFAULT 'abierta'
                              CHECK(estado IN ('abierta','cerrada','pagada')),
          synced            INTEGER DEFAULT 0,
          pagada_en         TEXT,
          cerrada_en        TEXT,
          reabierta_en      TEXT,
          reabierta_motivo  TEXT
        );
        INSERT INTO semanas_nueva SELECT id, fecha_inicio, fecha_fin,
          CASE WHEN estado IN ('abierta','cerrada','pagada') THEN estado ELSE 'abierta' END,
          synced, pagada_en, NULL, reabierta_en, reabierta_motivo
        FROM semanas;
        DROP TABLE semanas;
        ALTER TABLE semanas_nueva RENAME TO semanas;
      `);
    }
  } catch (err) {
    console.warn('[Migracion] Aviso al migrar CHECK de semanas:', err);
  }
  // Tabla de periodos cerrados (historial)
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS periodos_cerrados (
        id              TEXT PRIMARY KEY,
        tipo            TEXT NOT NULL CHECK(tipo IN ('semana','mes','año')),
        fecha_inicio    TEXT NOT NULL,
        fecha_fin       TEXT NOT NULL,
        cajas_cortadas  INTEGER DEFAULT 0,
        cajas_empacadas INTEGER DEFAULT 0,
        descarte        INTEGER DEFAULT 0,
        nomina_bruta    REAL DEFAULT 0,
        adelantos       REAL DEFAULT 0,
        neto            REAL DEFAULT 0,
        fecha_cierre    TEXT NOT NULL,
        creado_en       TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_periodos_fecha ON periodos_cerrados(fecha_inicio);
    `);
  } catch (err) {
    console.warn('[Migracion] Aviso al crear periodos_cerrados:', err);
  }
  // 2b. Trabajadores — columna dominical
  await asegurarColumna('trabajadores', 'dominical', 'INTEGER DEFAULT 0');

  // 3. Cosechas
  await asegurarColumna('cosechas', 'cajas_cortadas', 'INTEGER DEFAULT 0');
  await asegurarColumna('cosechas', 'cajas_descarte', 'INTEGER DEFAULT 0');
  await asegurarColumna('cosechas', 'cajas_empacadas', 'INTEGER DEFAULT 0');
  await asegurarColumna('cosechas', 'synced', 'INTEGER DEFAULT 0');

  // 4. Lotes
  await asegurarColumna('lotes', 'cultivo', 'TEXT NOT NULL DEFAULT ""');
  await asegurarColumna('lotes', 'variedad', 'TEXT');
  await asegurarColumna('lotes', 'fecha_siembra', 'TEXT');
  await asegurarColumna('lotes', 'estado', 'TEXT DEFAULT "activo"');
  await asegurarColumna('lotes', 'synced', 'INTEGER DEFAULT 0');

  // 5. Gastos
  await asegurarColumna('gastos', 'lote_id', 'TEXT');
  await asegurarColumna('gastos', 'synced', 'INTEGER DEFAULT 0');

  // 6. Adelantos — revertido
  await asegurarColumna('adelantos', 'revertido', 'INTEGER DEFAULT 0');
}

/**
 * Inicializa todas las tablas e índices si no existen y corre migraciones.
 * Se llama al arrancar la app. Es idempotente (IF NOT EXISTS).
 */
export async function initTables(): Promise<void> {
  // En web, expo-sqlite usa OPFS+SharedArrayBuffer que no está disponible
  // en el servidor de desarrollo. Los datos en web se gestionan via Supabase.
  if (Platform.OS === 'web') {
    return;
  }

  const db = await getDB();

  await db.execAsync(`
    -- ─── Trabajadores ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS trabajadores (
      id                    TEXT PRIMARY KEY,
      nombre                TEXT NOT NULL,
      tarifa_diaria_default REAL NOT NULL DEFAULT 250,
      sueldo_base           REAL NOT NULL DEFAULT 250,
      activo                INTEGER DEFAULT 1,
      dominical             INTEGER DEFAULT 0,
      synced                INTEGER DEFAULT 0,
      creado_en             TEXT DEFAULT (datetime('now'))
    );

    -- ─── Semanas de Pago ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS semanas (
      id                TEXT PRIMARY KEY,
      fecha_inicio      TEXT NOT NULL,
      fecha_fin         TEXT NOT NULL,
      estado            TEXT NOT NULL DEFAULT 'abierta'
                          CHECK(estado IN ('abierta','cerrada','pagada')),
      synced            INTEGER DEFAULT 0,
      pagada_en         TEXT,
      cerrada_en        TEXT,
      reabierta_en      TEXT,
      reabierta_motivo  TEXT
    );

    -- ─── Periodos Cerrados (Historial) ──────────────────────────
    CREATE TABLE IF NOT EXISTS periodos_cerrados (
      id              TEXT PRIMARY KEY,
      tipo            TEXT NOT NULL,
      fecha_inicio    TEXT NOT NULL,
      fecha_fin       TEXT NOT NULL,
      cajas_cortadas  INTEGER DEFAULT 0,
      cajas_empacadas INTEGER DEFAULT 0,
      descarte        INTEGER DEFAULT 0,
      nomina_bruta    REAL DEFAULT 0,
      adelantos       REAL DEFAULT 0,
      neto            REAL DEFAULT 0,
      fecha_cierre    TEXT NOT NULL,
      creado_en       TEXT DEFAULT (datetime('now'))
    );

    -- ─── Días Trabajados (Asistencia Semanal) ───────────────────
    CREATE TABLE IF NOT EXISTS dias_trabajados (
      id             TEXT PRIMARY KEY,
      semana_id      TEXT NOT NULL,
      trabajador_id  TEXT NOT NULL,
      fecha          TEXT NOT NULL,
      presente       INTEGER NOT NULL DEFAULT 0,
      tarifa_diaria  REAL,
      synced         INTEGER DEFAULT 0,
      FOREIGN KEY(semana_id) REFERENCES semanas(id),
      FOREIGN KEY(trabajador_id) REFERENCES trabajadores(id),
      UNIQUE(semana_id, trabajador_id, fecha)
    );

    -- ─── Adelantos de Dinero ────────────────────────────────────
    CREATE TABLE IF NOT EXISTS adelantos (
      id             TEXT PRIMARY KEY,
      semana_id      TEXT NOT NULL,
      trabajador_id  TEXT NOT NULL,
      monto          REAL NOT NULL,
      concepto       TEXT,
      fecha          TEXT NOT NULL,
      synced         INTEGER DEFAULT 0,
      FOREIGN KEY(semana_id) REFERENCES semanas(id),
      FOREIGN KEY(trabajador_id) REFERENCES trabajadores(id)
    );

    -- ─── Asistencia (Tabla legacy mantenida para compatibilidad) ─
    CREATE TABLE IF NOT EXISTS asistencia (
      id               TEXT PRIMARY KEY,
      trabajador_id    TEXT NOT NULL,
      fecha            TEXT NOT NULL,
      tipo             TEXT NOT NULL CHECK(tipo IN ('presente','inactivo','adelanto')),
      monto            REAL DEFAULT 0,
      tarifa_aplicada  REAL DEFAULT 0,
      nota             TEXT,
      FOREIGN KEY(trabajador_id) REFERENCES trabajadores(id)
    );

    -- ─── Lotes Agrícolas ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS lotes (
      id            TEXT PRIMARY KEY,
      nombre        TEXT NOT NULL,
      cultivo       TEXT NOT NULL,
      variedad      TEXT,
      fecha_siembra TEXT,
      estado        TEXT DEFAULT 'activo',
      synced        INTEGER DEFAULT 0,
      creado_en     TEXT DEFAULT (datetime('now'))
    );

    -- ─── Cosechas ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS cosechas (
      id              TEXT PRIMARY KEY,
      lote_id         TEXT NOT NULL,
      fecha           TEXT NOT NULL,
      cajas_cortadas  INTEGER DEFAULT 0,
      cajas_descarte  INTEGER DEFAULT 0,
      cajas_empacadas INTEGER DEFAULT 0,
      synced          INTEGER DEFAULT 0,
      FOREIGN KEY(lote_id) REFERENCES lotes(id)
    );

    -- ─── Gastos ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS gastos (
      id          TEXT PRIMARY KEY,
      fecha       TEXT NOT NULL,
      categoria   TEXT NOT NULL,
      descripcion TEXT,
      monto       REAL NOT NULL,
      lote_id     TEXT,
      synced      INTEGER DEFAULT 0
    );

    -- ─── Backups Log ───────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS backups_log (
      id             TEXT PRIMARY KEY,
      fecha          TEXT NOT NULL,
      dispositivo_id TEXT,
      tamano         INTEGER,
      exito          INTEGER DEFAULT 0
    );

    -- ─── Configuración de la App ────────────────────────────────
    CREATE TABLE IF NOT EXISTS configuracion_app (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    -- ─── Índices de Rendimiento ─────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_dias_trabajados_semana ON dias_trabajados(semana_id);
    CREATE INDEX IF NOT EXISTS idx_dias_trabajados_fecha ON dias_trabajados(fecha);
    CREATE INDEX IF NOT EXISTS idx_dias_trabajados_trab ON dias_trabajados(trabajador_id);
    CREATE INDEX IF NOT EXISTS idx_adelantos_semana ON adelantos(semana_id);
    CREATE INDEX IF NOT EXISTS idx_adelantos_trab ON adelantos(trabajador_id);
    CREATE INDEX IF NOT EXISTS idx_cosechas_lote ON cosechas(lote_id);
    CREATE INDEX IF NOT EXISTS idx_cosechas_fecha ON cosechas(fecha);
    CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
  `);

  // Ejecutar migración de columnas por si la BD ya existía con esquema viejo
  await migrarEsquema(db);
}

/**
 * Cierra la conexión activa a la BD.
 * Útil antes de un restore.
 */
export async function closeDB(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (_db !== null) {
    await _db.closeAsync();
    _db = null;
  }
}

/**
 * Verifica la integridad de la BD.
 * Devuelve true si PRAGMA integrity_check retorna "ok".
 */
export async function checkIntegrity(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const db = await getDB();
  const result = await db.getFirstAsync<{ integrity_check: string }>(
    'PRAGMA integrity_check;'
  );
  return result?.integrity_check === 'ok';
}

/**
 * Devuelve la lista de tablas existentes en la BD.
 * Útil para tests y diagnóstico.
 */
export async function getTableNames(): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  const db = await getDB();
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
  );
  return rows.map((r) => r.name);
}

/**
 * Resetea la instancia singleton (solo para tests).
 * ⚠️ No usar en producción.
 */
export function _resetDBForTesting(): void {
  _db = null;
}
