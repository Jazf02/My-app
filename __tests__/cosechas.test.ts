// __tests__/cosechas.test.ts — Unit tests para recolección de cosecha y agregados
import { registrarCosecha, obtenerCosechasPorLote, obtenerResumenCosechaLote } from '../database/cosechas';
import { _resetDBForTesting } from '../database/local';

describe('database/cosechas.ts — Registro de cosecha', () => {
  beforeEach(async () => {
    await _resetDBForTesting();
  });

  test('Exportaciones de módulo de cosecha existen', () => {
    expect(registrarCosecha).toBeDefined();
    expect(obtenerCosechasPorLote).toBeDefined();
    expect(obtenerResumenCosechaLote).toBeDefined();
  });
});
