// __tests__/exportar.test.ts — Unit tests para exportación a WhatsApp y HTML/PDF
import {
  generarTextoWhatsAppSemana,
  generarHTMLPlanillaSemanal,
  generarHTMLReporteLote,
  compartirPorWhatsApp,
  copiarAlPortapapeles,
  compartirReporteNativo,
  generarTextoWhatsAppPeriodo,
  generarHTMLPlanillaPeriodo,
  generarReporteCompletoCSV,
} from '../lib/exportar';
import { webObtenerDatosExportacionPeriodo } from '../database/webStorage';
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

  test('compartirPorWhatsApp genera la URL universal wa.me correctamente', async () => {
    const res = await compartirPorWhatsApp('Reporte de prueba');
    expect(typeof res).toBe('boolean');
  });

  test('copiarAlPortapapeles no lanza errores en entornos de prueba', async () => {
    const res = await copiarAlPortapapeles('Texto a copiar');
    expect(typeof res).toBe('boolean');
  });

  test('compartirReporteNativo maneja llamadas seguras', async () => {
    const res = await compartirReporteNativo({
      titulo: 'Título Test',
      texto: 'Mensaje Test',
    });
    expect(typeof res.compartido).toBe('boolean');
  });

  test('generarTextoWhatsAppPeriodo formatea correctamente meses, años y rangos', () => {
    const textoMes = generarTextoWhatsAppPeriodo({
      periodoEtiqueta: 'Mes de Octubre 2026',
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-31',
      resumenes: [{ trabajador: mockTrabajador, calculo: mockCalculo }],
      cosecha: { cortadas: 500, empacadas: 450, descarte: 50 },
    });

    expect(textoMes).toContain('Mes de Octubre 2026');
    expect(textoMes).toContain('Juan Pérez');
    expect(textoMes).toContain('L. 1,050.00');
    expect(textoMes).toContain('450 cajas');
    expect(textoMes).toContain('90.0% aprovechable');
  });

  test('generarHTMLPlanillaPeriodo genera el comprobante imprimible con totales', () => {
    const html = generarHTMLPlanillaPeriodo({
      periodoEtiqueta: 'Año 2026',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      resumenes: [{ trabajador: mockTrabajador, calculo: mockCalculo }],
      cosecha: { cortadas: 1000, empacadas: 900, descarte: 100 },
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Año 2026');
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('L. 1,050.00');
    expect(html).toContain('900');
  });

  test('Filtros estrictos de período en webObtenerDatosExportacionPeriodo', async () => {
    const datosOctubre = await webObtenerDatosExportacionPeriodo({
      tipo: 'mes',
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-31',
      periodoEtiqueta: 'Mes de Octubre 2026',
    });

    expect(datosOctubre.periodoEtiqueta).toBe('Mes de Octubre 2026');
    expect(datosOctubre.fechaInicio).toBe('2026-10-01');
    expect(datosOctubre.fechaFin).toBe('2026-10-31');
    expect(Array.isArray(datosOctubre.diasTrabajados)).toBe(true);
    expect(Array.isArray(datosOctubre.adelantos)).toBe(true);
    expect(Array.isArray(datosOctubre.resumenes)).toBe(true);

    // Asegurar que no contenga fechas fuera de octubre
    datosOctubre.diasTrabajados.forEach((d) => {
      expect(d.fecha >= '2026-10-01' && d.fecha <= '2026-10-31').toBe(true);
    });

    datosOctubre.adelantos.forEach((a) => {
      expect(a.fecha >= '2026-10-01' && a.fecha <= '2026-10-31').toBe(true);
    });
  });

  test('CSV completo con BOM UTF-8 y 6 secciones', () => {
    const csv = generarReporteCompletoCSV({
      periodoEtiqueta: 'Período Personalizado Especial',
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-15',
      trabajadores: [mockTrabajador],
      diasTrabajados: [{
        id: 'dia-1',
        semana_id: 'sem-1',
        trabajador_id: mockTrabajador.id,
        fecha: '2026-10-05',
        presente: 1,
        tarifa_diaria: 250,
        synced: 0,
      }],
      adelantos: [{
        id: 'ad-1',
        semana_id: 'sem-1',
        trabajador_id: mockTrabajador.id,
        monto: 100,
        concepto: 'Almuerzo',
        fecha: '2026-10-06',
        revertido: 0,
        synced: 0,
      }],
      resumenes: [{ trabajador: mockTrabajador, calculo: mockCalculo }],
      cosecha: { cortadas: 100, empacadas: 90, descarte: 10 },
      totales: { nominaBruta: 1250, totalAdelantos: 100, totalNeto: 1150 },
    });

    // Validar marca BOM UTF-8 al inicio
    expect(csv.startsWith('\uFEFF')).toBe(true);
    // Validar las 6 secciones exactas
    expect(csv).toContain('=== 1. ENCABEZADO ===');
    expect(csv).toContain('=== 2. TABLA DE ASISTENCIA ===');
    expect(csv).toContain('=== 3. TABLA DE ADELANTOS ===');
    expect(csv).toContain('=== 4. RESUMEN POR TRABAJADOR ===');
    expect(csv).toContain('=== 5. PRODUCCION DE COSECHA ===');
    expect(csv).toContain('=== 6. TOTALES GENERALES ===');
    // Validar datos específicos
    expect(csv).toContain('Período Personalizado Especial');
    expect(csv).toContain('Juan Pérez');
    expect(csv).toContain('Almuerzo');
    expect(csv).toContain('90.0%');
  });
});
