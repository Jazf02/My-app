// __tests__/backup.test.ts — Unit tests para respaldo en la nube (Cloud Backup)
import { exportarBackup } from '../sync/backup';
import { _resetDBForTesting } from '../database/local';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-123' } } },
      }),
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
        remove: jest.fn().mockResolvedValue({ error: null }),
      }),
    },
  },
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  readAsStringAsync: jest.fn().mockResolvedValue('dGVzdC1kYXRh'), // base64 'test-data'
}));

describe('sync/backup.ts — Módulo de Respaldo', () => {
  beforeEach(async () => {
    await _resetDBForTesting();
  });

  test('El servicio de backup exportarBackup está definido', () => {
    expect(exportarBackup).toBeDefined();
  });

  test('exportarBackup maneja la ausencia de sesión de forma graciosa', async () => {
    const { supabase } = require('../lib/supabase');
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });

    const resultado = await exportarBackup();

    expect(resultado.exito).toBe(false);
    expect(resultado.mensaje).toContain('No hay usuario autenticado');
  });
});
