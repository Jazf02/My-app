jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
  }),
}));

import {
  tienePin,
  guardarPin,
  verificarPin,
  borrarPin,
  getSessionActive,
  setSessionActive,
} from '@/auth/localAuth';

describe('Local Auth PIN (Offline)', () => {
  beforeEach(async () => {
    await borrarPin();
    setSessionActive(false);
  });

  test('inicialmente no tiene PIN configurado', async () => {
    const hasPin = await tienePin();
    expect(hasPin).toBe(false);
  });

  test('guarda un PIN válido y verifica correctamente', async () => {
    await guardarPin('1234');
    expect(await tienePin()).toBe(true);

    const correcto = await verificarPin('1234');
    const incorrecto = await verificarPin('9999');

    expect(correcto).toBe(true);
    expect(incorrecto).toBe(false);
  });

  test('rechaza PINs no numéricos o fuera del rango 4-6 dígitos', async () => {
    await expect(guardarPin('12')).rejects.toThrow();
    await expect(guardarPin('1234567')).rejects.toThrow();
    await expect(guardarPin('abcd')).rejects.toThrow();
  });

  test('borrarPin elimina el PIN existente', async () => {
    await guardarPin('4567');
    expect(await tienePin()).toBe(true);

    await borrarPin();
    expect(await tienePin()).toBe(false);
  });

  test('controla el estado de sesión activa en memoria', () => {
    expect(getSessionActive()).toBe(false);
    setSessionActive(true);
    expect(getSessionActive()).toBe(true);
    setSessionActive(false);
    expect(getSessionActive()).toBe(false);
  });
});
