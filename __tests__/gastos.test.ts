// __tests__/gastos.test.ts — Unit tests para registro de gastos e insumos
import { registrarGasto, obtenerGastos, obtenerTotalGastos } from '../database/gastos';
import { _resetDBForTesting } from '../database/local';

describe('database/gastos.ts — Registro de gastos e insumos', () => {
  beforeEach(async () => {
    await _resetDBForTesting();
  });

  test('Exportaciones de módulo de gastos existen', () => {
    expect(registrarGasto).toBeDefined();
    expect(obtenerGastos).toBeDefined();
    expect(obtenerTotalGastos).toBeDefined();
  });
});
