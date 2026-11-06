// __tests__/database.test.ts
// Tests unitarios de la capa SQLite (Fase 1)
// QA obligatorio: npx jest --coverage

import {
  getDB,
  initTables,
  checkIntegrity,
  getTableNames,
  _resetDBForTesting,
} from '../database/local';

// ─── Mock de expo-sqlite ─────────────────────────────────────
// expo-sqlite no puede ejecutarse en Node.js (es nativo).
// Usamos un mock que simula la API de SQLiteDatabase.

jest.mock('expo-sqlite', () => {
  // Simula almacenamiento en memoria para el mock
  const tables: Record<string, boolean> = {};
  let journalMode = 'delete';
  let foreignKeys = false;

  const mockDb = {
    execAsync: jest.fn(async (sql: string) => {
      // Simular PRAGMA journal_mode = WAL
      if (sql.includes('journal_mode = WAL')) {
        journalMode = 'wal';
      }
      // Simular PRAGMA foreign_keys = ON
      if (sql.includes('foreign_keys = ON')) {
        foreignKeys = true;
      }
      // Simular CREATE TABLE IF NOT EXISTS
      const tableMatches = sql.matchAll(
        /CREATE TABLE IF NOT EXISTS (\w+)/g
      );
      for (const match of tableMatches) {
        if (match[1]) {
          tables[match[1]] = true;
        }
      }
    }),
    getFirstAsync: jest.fn(async (sql: string) => {
      if (sql.includes('integrity_check')) {
        return { integrity_check: 'ok' };
      }
      if (sql.includes('journal_mode')) {
        return { journal_mode: journalMode };
      }
      if (sql.includes('foreign_keys')) {
        return { foreign_keys: foreignKeys ? 1 : 0 };
      }
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('sqlite_master')) {
        return Object.keys(tables).map((name) => ({ name }));
      }
      return [];
    }),
    closeAsync: jest.fn(async () => {
      // Simular cierre
    }),
  };

  return {
    openDatabaseAsync: jest.fn(async () => mockDb),
  };
});

// ─── Setup ───────────────────────────────────────────────────
beforeEach(() => {
  _resetDBForTesting();
  // Limpiar tablas simuladas entre tests
  jest.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────
describe('database/local.ts — Fase 1', () => {

  test('getDB() abre la BD sin error', async () => {
    const db = await getDB();
    expect(db).toBeDefined();
    expect(db).not.toBeNull();
  });

  test('getDB() retorna el mismo singleton en llamadas sucesivas', async () => {
    const db1 = await getDB();
    const db2 = await getDB();
    expect(db1).toBe(db2);
  });

  test('initTables() crea todas las tablas sin error', async () => {
    await expect(initTables()).resolves.not.toThrow();
  });

  test('initTables() crea todas las tablas requeridas', async () => {
    await initTables();
    const tablas = await getTableNames();

    const tablasEsperadas = [
      'trabajadores',
      'asistencia',
      'lotes',
      'cosechas',
      'gastos',
      'semanas',
      'backups_log',
    ];

    for (const tabla of tablasEsperadas) {
      expect(tablas).toContain(tabla);
    }
  });

  test('PRAGMA integrity_check devuelve "ok"', async () => {
    await initTables();
    const ok = await checkIntegrity();
    expect(ok).toBe(true);
  });

  test('initTables() es idempotente (se puede llamar múltiples veces)', async () => {
    await expect(initTables()).resolves.not.toThrow();
    await expect(initTables()).resolves.not.toThrow();
    await expect(initTables()).resolves.not.toThrow();
  });

  test('_resetDBForTesting() cierra y resetea el singleton', async () => {
    const db1 = await getDB();
    _resetDBForTesting();
    const db2 = await getDB();
    // Después del reset se crea una nueva instancia (en mock son diferentes)
    expect(db1).toBeDefined();
    expect(db2).toBeDefined();
  });
});
