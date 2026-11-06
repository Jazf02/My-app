// __tests__/exportar.test.ts — Unit tests para exportación a WhatsApp y HTML/PDF
import {
  generarTextoWhatsAppSemana,
  generarHTMLPlanillaSemanal,
  generarHTMLReporteLote,
} from '../lib/exportar';
import type { Semana, Trabajador, Lote, Cosecha, Gasto } from '../types/domain';
import type { ResultadoPagoSemanal } from '../lib/calculos';
import type { ResumenRendimientoLote } from '../lib/rendimiento';

describe('lib/exportar.ts — Módulo de Exportación', () => {
  const mockSemana: Semana = {
    id: 'sem-1',
    fecha_inicio: '2026-10-05',
    fecha_fin: '2026-10-11',
    estado: 'abierta',
    synced: 0,
  };

  const mockTrabajador: Trabajador = {
    id: 'trab-1',
    nombre: 'Juan Pérez',
    tarifa_diaria_default: 250,
    activo: 1,
    synced: 0,
  };

  const mockCalculo: ResultadoPagoSemanal = {
    diasPresentes: 5,
    diasAusentes: 2,
    totalGanado: 1250,
    totalAdelantos: 200,
    totalAPagar: 1050,
  };

  test('Texto WhatsApp contiene la marca AgroGámez, el trabajador y los montos en Lempiras', () => {
    const texto = generarTextoWhatsAppSemana(mockSemana, [
      { trabajador: mockTrabajador, calculo: mockCalculo },
    ]);

    expect(texto).toContain('AGROGÁMEZ');
    expect(texto).toContain('Juan Pérez');
    expect(texto).toContain('L. 1,250.00'); // total ganado
    expect(texto).toContain('L. 200.00');   // adelantos
    expect(texto).toContain('L. 1,050.00'); // total a pagar
  });

  test('generarHTMLPlanillaSemanal produce un documento HTML válido con los totales', () => {
    const html = generarHTMLPlanillaSemanal(mockSemana, [
      { trabajador: mockTrabajador, calculo: mockCalculo },
    ]);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('AGROGÁMEZ');
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('L. 1,050.00');
  });

  test('generarHTMLReporteLote genera HTML con métricas agronómicas', () => {
    const mockLote: Lote = {
      id: 'lote-1',
      nombre: 'Lote Norte 1',
      cultivo: 'Melón',
      variedad: 'Cantalupe',
      fecha_siembra: '2026-09-01',
      estado: 'activo',
      creado_en: '2026-09-01',
    };

    const mockRendimiento: ResumenRendimientoLote = {
      totalCortadas: 100,
      totalDescarte: 10,
      totalEmpacadas: 90,
      totalGastos: 5000,
      ingresoEstimado: 18000,
      margenEstimado: 13000,
      porcentajeEficienciaEmpaque: 90,
    };

    const mockCosechas: Cosecha[] = [
      { id: 'c-1', lote_id: 'lote-1', fecha: '2026-10-08', cajas_cortadas: 100, cajas_descarte: 10, cajas_empacadas: 90 },
    ];

    const mockGastos: Gasto[] = [
      { id: 'g-1', fecha: '2026-10-02', categoria: 'Insumos', descripcion: 'Fertilizante', monto: 5000 },
    ];

    const html = generarHTMLReporteLote(mockLote, mockRendimiento, mockCosechas, mockGastos);

    expect(html).toContain('Lote Norte 1');
    expect(html).toContain('Melón');
    expect(html).toContain('90 cajas');
    expect(html).toContain('Fertilizante');
  });
});
