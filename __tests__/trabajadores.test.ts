// __tests__/trabajadores.test.ts — Tests unitarios de la capa de Trabajadores y SQLite
import { Platform } from 'react-native';
import {
  crearTrabajador,
  obtenerTrabajadores,
  actualizarTrabajador,
  desactivarTrabajador,
  obtenerTrabajadorPorId,
  eliminarTrabajador,
} from '../database/trabajadores';

describe('database/trabajadores.ts', () => {
  const originalOS = Platform.OS;

  beforeAll(() => {
    // @ts-ignore
    Platform.OS = 'web';
  });

  afterAll(() => {
    // @ts-ignore
    Platform.OS = originalOS;
  });

  test('Módulo de trabajadores y sus métodos existen', () => {
    expect(crearTrabajador).toBeDefined();
    expect(obtenerTrabajadores).toBeDefined();
    expect(actualizarTrabajador).toBeDefined();
    expect(desactivarTrabajador).toBeDefined();
    expect(obtenerTrabajadorPorId).toBeDefined();
    expect(eliminarTrabajador).toBeDefined();
  });

  test('crearTrabajador no permite nombres duplicados (case-insensitive)', async () => {
    await crearTrabajador({ nombre: 'Pedro Ramírez', tarifa_diaria_default: 300 });
    await expect(
      crearTrabajador({ nombre: 'pedro ramírez', tarifa_diaria_default: 250 })
    ).rejects.toThrow(/Ya existe un trabajador registrado/i);
  });

  test('eliminarTrabajador borra al trabajador', async () => {
    const t = await crearTrabajador({ nombre: 'Ana Gómez', tarifa_diaria_default: 280 });
    expect(await obtenerTrabajadorPorId(t.id)).not.toBeNull();
    await eliminarTrabajador(t.id);
    expect(await obtenerTrabajadorPorId(t.id)).toBeNull();
  });
});
