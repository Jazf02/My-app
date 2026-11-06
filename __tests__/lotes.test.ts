// __tests__/lotes.test.ts — Unit tests para gestión de lotes
import { crearLote, obtenerLotes, cerrarLote } from '../database/lotes';
import { _resetDBForTesting } from '../database/local';

describe('database/lotes.ts — Gestión de Lotes Agrícolas', () => {
  beforeEach(async () => {
    await _resetDBForTesting();
  });

  test('Exportaciones de módulo de lotes existen', () => {
    expect(crearLote).toBeDefined();
    expect(obtenerLotes).toBeDefined();
    expect(cerrarLote).toBeDefined();
  });
});
