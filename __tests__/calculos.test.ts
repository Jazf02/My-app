// __tests__/calculos.test.ts — Unit tests para el motor de cálculo de planillas de AgroGámez
import { calcularPagoSemanal, calcularCosecha } from '../lib/calculos';
import type { DiaTrabajado, Adelanto, Cosecha } from '../types/domain';

describe('lib/calculos.ts — Motor de cálculo de planillas', () => {
  const tarifaDefault = 250;

  test('5 días presentes × L.250 → totalGanado = L.1250', () => {
    const dias: Partial<DiaTrabajado>[] = [
      { fecha: '2026-10-05', presente: 1, tarifa_diaria: null },
      { fecha: '2026-10-06', presente: 1, tarifa_diaria: null },
      { fecha: '2026-10-07', presente: 1, tarifa_diaria: null },
      { fecha: '2026-10-08', presente: 1, tarifa_diaria: null },
      { fecha: '2026-10-09', presente: 1, tarifa_diaria: null },
      { fecha: '2026-10-10', presente: 0, tarifa_diaria: null },
      { fecha: '2026-10-11', presente: 0, tarifa_diaria: null },
    ];
    const adelantos: Partial<Adelanto>[] = [];

    const resultado = calcularPagoSemanal(dias, tarifaDefault, adelantos);

    expect(resultado.diasPresentes).toBe(5);
    expect(resultado.diasAusentes).toBe(2);
    expect(resultado.totalGanado).toBe(1250);
    expect(resultado.totalAdelantos).toBe(0);
    expect(resultado.totalAPagar).toBe(1250);
  });

  test('1 día con tarifa manual override L.300 + 4 días L.250 → totalGanado = L.1300', () => {
    const dias: Partial<DiaTrabajado>[] = [
      { fecha: '2026-10-05', presente: 1, tarifa_diaria: 300 }, // override
      { fecha: '2026-10-06', presente: 1, tarifa_diaria: null },
      { fecha: '2026-10-07', presente: 1, tarifa_diaria: null },
      { fecha: '2026-10-08', presente: 1, tarifa_diaria: null },
      { fecha: '2026-10-09', presente: 1, tarifa_diaria: null },
    ];
    const adelantos: Partial<Adelanto>[] = [];

    const resultado = calcularPagoSemanal(dias, tarifaDefault, adelantos);

    expect(resultado.diasPresentes).toBe(5);
    expect(resultado.totalGanado).toBe(1300); // 300 + (4 * 250)
    expect(resultado.totalAPagar).toBe(1300);
  });

  test('Total adelantos se resta correctamente del total ganado', () => {
    const dias: Partial<DiaTrabajado>[] = [
      { fecha: '2026-10-05', presente: 1, tarifa_diaria: null },
      { fecha: '2026-10-06', presente: 1, tarifa_diaria: null },
    ];
    const adelantos: Partial<Adelanto>[] = [
      { monto: 100 },
      { monto: 150 },
    ];

    const resultado = calcularPagoSemanal(dias, tarifaDefault, adelantos);

    expect(resultado.totalGanado).toBe(500); // 2 * 250
    expect(resultado.totalAdelantos).toBe(250); // 100 + 150
    expect(resultado.totalAPagar).toBe(250); // 500 - 250
  });

  test('Si el adelanto supera lo ganado, totalAPagar no es negativo (es 0)', () => {
    const dias: Partial<DiaTrabajado>[] = [
      { fecha: '2026-10-05', presente: 1, tarifa_diaria: null },
    ];
    const adelantos: Partial<Adelanto>[] = [
      { monto: 500 }, // Adelanto de 500 para 250 ganado
    ];

    const resultado = calcularPagoSemanal(dias, tarifaDefault, adelantos);

    expect(resultado.totalGanado).toBe(250);
    expect(resultado.totalAdelantos).toBe(500);
    expect(resultado.totalAPagar).toBe(0); // Clamped to 0
  });

  test('Semana con 0 días trabajados → totalGanado = 0, totalAPagar = 0', () => {
    const dias: Partial<DiaTrabajado>[] = [];
    const adelantos: Partial<Adelanto>[] = [];

    const resultado = calcularPagoSemanal(dias, tarifaDefault, adelantos);

    expect(resultado.diasPresentes).toBe(0);
    expect(resultado.totalGanado).toBe(0);
    expect(resultado.totalAPagar).toBe(0);
  });

  test('calcularCosecha consolida correctamente cajas cortadas, descarte y empacadas', () => {
    const registros: Partial<Cosecha>[] = [
      { cajasCortadas: 10, cajasDescarte: 2, cajasEmpacadas: 8 },
      { cajasCortadas: 15, cajasDescarte: 1, cajasEmpacadas: 14 },
    ];

    const resultado = calcularCosecha(registros as Cosecha[]);

    expect(resultado.totalCortadas).toBe(25);
    expect(resultado.totalDescarte).toBe(3);
    expect(resultado.totalEmpacadas).toBe(22);
  });
});
