// __tests__/trabajadores.test.ts — Tests unitarios de la capa de Trabajadores y SQLite
import {
  crearTrabajador,
  obtenerTrabajadores,
  actualizarTrabajador,
  desactivarTrabajador,
  obtenerTrabajadorPorId,
} from '../database/trabajadores';
import { _resetDBForTesting } from '../database/local';

describe('database/trabajadores.ts', () => {
  beforeEach(async () => {
    await _resetDBForTesting();
  });

  test('Módulo de trabajadores y sus métodos existen', () => {
    expect(crearTrabajador).toBeDefined();
    expect(obtenerTrabajadores).toBeDefined();
    expect(actualizarTrabajador).toBeDefined();
    expect(desactivarTrabajador).toBeDefined();
    expect(obtenerTrabajadorPorId).toBeDefined();
  });
});
