// __tests__/restore.test.ts — Unit tests para restauración de la base de datos local desde Supabase Storage
import { listarBackupsRemotos, restaurarBackup } from '../sync/restore';

const mockDownload = jest.fn().mockResolvedValue({
  data: {
    arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
  },
  error: null,
});

const mockList = jest.fn().mockResolvedValue({
  data: [
    { name: 'agrogamez_2026-10-10.db', created_at: '2026-10-10T12:00:00Z', metadata: { size: 2048 } },
  ],
  error: null,
});

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('../database/local', () => ({
  getDB: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  }),
  initTables: jest.fn().mockResolvedValue(undefined),
  _resetDBForTesting: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-123' } } },
      }),
    },
    storage: {
      from: jest.fn().mockImplementation(() => ({
        list: mockList,
        download: mockDownload,
      })),
    },
  },
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test/',
  cacheDirectory: 'file:///test/cache/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 2048 }),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: 'base64' },
}));

describe('sync/restore.ts — Módulo de Restauración', () => {
  test('listarBackupsRemotos retorna la lista de archivos remotos del usuario', async () => {
    const backups = await listarBackupsRemotos('test-user-123');

    expect(backups).toHaveLength(1);
    expect(backups[0].name).toBe('agrogamez_2026-10-10.db');
  });

  test('restaurarBackup ejecuta la descarga y actualiza la BD local', async () => {
    const resultado = await restaurarBackup('test-user-123/agrogamez_2026-10-10.db');

    expect(resultado.exito).toBe(true);
    expect(resultado.mensaje).toContain('restaurada correctamente');
  });
});
