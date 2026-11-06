// __tests__/validaciones.test.ts — Unit tests para validaciones de negocio
import {
  validarNombreTrabajador,
  validarTarifaDiaria,
  validacionMonto,
  validacionAdelanto,
  validacionTarifa,
} from '../lib/validaciones';

describe('lib/validaciones.ts — Validaciones de negocio', () => {
  test('Nombre vacío o menor a 2 caracteres → inválido', () => {
    expect(validarNombreTrabajador('').valido).toBe(false);
    expect(validarNombreTrabajador('   ').valido).toBe(false);
    expect(validarNombreTrabajador('J').valido).toBe(false);
    expect(validarNombreTrabajador('Juan').valido).toBe(true);
  });

  test('Tarifa diaria negativa → inválida', () => {
    expect(validarTarifaDiaria(-50).valido).toBe(false);
    expect(validarTarifaDiaria(0).valido).toBe(true);
    expect(validarTarifaDiaria(250).valido).toBe(true);
  });

  test('Monto negativo → invalido', () => {
    const res = validacionMonto(-100);
    expect(res.valido).toBe(false);
    expect(res.error).toBe('El monto no puede ser negativo');
  });

  test('Monto 0 o positivo → valido', () => {
    expect(validacionMonto(0).valido).toBe(true);
    expect(validacionMonto(500).valido).toBe(true);
  });

  test('Adelanto menor o igual a 0 → error', () => {
    const res = validacionAdelanto(0, 1000);
    expect(res.valido).toBe(false);
    expect(res.error).toBe('El monto del adelanto debe ser mayor a 0');
  });

  test('Adelanto mayor a lo ganado → alerta (warning) sin bloquear', () => {
    const res = validacionAdelanto(500, 200);
    expect(res.valido).toBe(true);
    expect(res.warning).toBe('El adelanto excede lo ganado en la semana');
  });

  test('Adelanto menor o igual a lo ganado → válido sin warning', () => {
    const res = validacionAdelanto(300, 500);
    expect(res.valido).toBe(true);
    expect(res.warning).toBeNull();
  });

  test('Tarifa valida', () => {
    expect(validacionTarifa(250).valido).toBe(true);
    expect(validacionTarifa(-10).valido).toBe(false);
  });
});
