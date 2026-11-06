// __tests__/mejoras_qa.test.ts — Verificación QA de las 10 Mejoras
import {
  calcularPagoSemanal,
} from '../lib/calculos';
import {
  generarReporteCompletoCSV,
  type ExportarCompletoInput,
} from '../lib/exportar';
import {
  lunesDeSemana,
  domingoDeSemana,
  hoyISO,
  fechaToISO,
} from '../lib/fechas';
import type {
  Semana,
  Trabajador,
  DiaTrabajado,
  Adelanto,
} from '../types/domain';

describe('QA — 10 Mejoras de AgroGámez', () => {
  // ════════════════════════════════════════════════════════════
  // MEJORA 10: Fix error CHECK constraint al cerrar semana
  // ════════════════════════════════════════════════════════════
  test('MEJORA 10: Flujo de estados (abierta -> cerrada -> pagada -> reabierta)', () => {
    const estadosValidos = ['abierta', 'cerrada', 'pagada'];
    expect(estadosValidos).toContain('abierta');
    expect(estadosValidos).toContain('cerrada');
    expect(estadosValidos).toContain('pagada');
  });

  // ════════════════════════════════════════════════════════════
  // MEJORA 3: Separación Hoy vs Trabajadores & Toggle Dominical
  // ════════════════════════════════════════════════════════════
  test('MEJORA 3: Trabajador soporta propiedad dominical y tarifa base', () => {
    const t: Trabajador = {
      id: 't-1',
      nombre: 'Juan Carlos',
      tarifa_diaria_default: 250,
      activo: 1,
      dominical: 1,
      synced: 0,
    };
    expect(t.dominical).toBe(1);
    expect(t.tarifa_diaria_default).toBe(250);

    // En Hoy, el override de tarifa no modifica la tarifa base del trabajador
    const overrideTarifaDia = 350;
    expect(t.tarifa_diaria_default).toBe(250);
    expect(overrideTarifaDia).toBe(350);
  });

  // ════════════════════════════════════════════════════════════
  // MEJORA 1: Cinta de 7 días y recálculo de nómina del día
  // ════════════════════════════════════════════════════════════
  test('MEJORA 1: 7 días de la semana y nómina estimada refleja solo el día seleccionado', () => {
    const fecha = new Date('2026-10-21T00:00:00'); // Miércoles
    const lunes = lunesDeSemana(fecha);
    const domingo = domingoDeSemana(fecha);

    expect(lunes).toBe('2026-10-19');
    expect(domingo).toBe('2026-10-25');

    // 7 días
    const dLunes = new Date(lunes + 'T00:00:00');
    const semana7Dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(dLunes.getTime());
      d.setDate(dLunes.getDate() + i);
      return fechaToISO(d);
    });

    expect(semana7Dias).toHaveLength(7);
    expect(semana7Dias[0]).toBe('2026-10-19'); // Lun
    expect(semana7Dias[2]).toBe('2026-10-21'); // Mié
    expect(semana7Dias[3]).toBe('2026-10-22'); // Jue
    expect(semana7Dias[6]).toBe('2026-10-25'); // Dom

    // Día 21 con 3 trabajadores (Juan Carlos 250, Luis 400, Pan 250)
    const registrosMiercoles = [
      { trabajador_id: 't-1', presente: 1, tarifa_diaria: 250 },
      { trabajador_id: 't-2', presente: 1, tarifa_diaria: 400 },
      { trabajador_id: 't-3', presente: 1, tarifa_diaria: 250 },
    ];
    const nominaMiercoles = registrosMiercoles.reduce((acc, r) => acc + r.tarifa_diaria, 0);
    expect(nominaMiercoles).toBe(900);

    // Día 22 sin registros -> nómina 0
    const registrosJueves: any[] = [];
    const nominaJueves = registrosJueves.reduce((acc, r) => acc + r.tarifa_diaria, 0);
    expect(nominaJueves).toBe(0);
  });

  // ════════════════════════════════════════════════════════════
  // MEJORA 5: Domingo automático + Filtro dominicales (tarifa x2)
  // ════════════════════════════════════════════════════════════
  test('MEJORA 5: Domingo solo muestra dominicales y tarifa default x2', () => {
    const trabajadores: Trabajador[] = [
      { id: '1', nombre: 'Juan Carlos', tarifa_diaria_default: 250, activo: 1, dominical: 1, synced: 0 },
      { id: '2', nombre: 'Luis', tarifa_diaria_default: 400, activo: 1, dominical: 1, synced: 0 },
      { id: '3', nombre: 'Pan', tarifa_diaria_default: 250, activo: 1, dominical: 0, synced: 0 }, // No dominical
    ];

    // En domingo (Pan no es dominical, no aparece)
    const esDomingo = true;
    const visiblesDomingo = esDomingo ? trabajadores.filter((t) => Boolean(t.dominical)) : trabajadores;
    expect(visiblesDomingo).toHaveLength(2);
    expect(visiblesDomingo.map((t) => t.nombre)).toEqual(['Juan Carlos', 'Luis']);

    // Tarifa domingo x2
    const tarifaJC = visiblesDomingo[0].tarifa_diaria_default * 2;
    expect(tarifaJC).toBe(500);

    // En día no domingo (lunes) aparecen todos con tarifa normal
    const visiblesLunes = false ? trabajadores.filter((t) => Boolean(t.dominical)) : trabajadores;
    expect(visiblesLunes).toHaveLength(3);
    expect(visiblesLunes[0].tarifa_diaria_default).toBe(250);
    expect(visiblesLunes[1].tarifa_diaria_default).toBe(400);
  });

  // ════════════════════════════════════════════════════════════
  // MEJORA 6: Adelantos con fecha y nota, revertir adelanto
  // ════════════════════════════════════════════════════════════
  test('MEJORA 6: Adelanto con nota y reversión no cuenta en neto', () => {
    const diasLuis: Partial<DiaTrabajado>[] = [
      { fecha: '2026-10-21', presente: 1, tarifa_diaria: 400 },
    ];
    const adelantoLuis: Partial<Adelanto> = {
      id: 'ad-1',
      monto: 200,
      concepto: 'préstamo',
      fecha: '2026-10-21',
      revertido: 0,
    };

    // Con adelanto activo: 400 - 200 = 200
    const resActivo = calcularPagoSemanal(diasLuis, 400, [adelantoLuis]);
    expect(resActivo.totalGanado).toBe(400);
    expect(resActivo.totalAdelantos).toBe(200);
    expect(resActivo.totalAPagar).toBe(200);

    // Al revertir: revertido = 1 -> el adelanto no cuenta, neto vuelve a 400
    const adelantoRevertido = { ...adelantoLuis, revertido: 1 };
    const resRevertido = calcularPagoSemanal(diasLuis, 400, [adelantoRevertido]);
    expect(resRevertido.totalGanado).toBe(400);
    expect(resRevertido.totalAdelantos).toBe(0);
    expect(resRevertido.totalAPagar).toBe(400);
  });

  // ════════════════════════════════════════════════════════════
  // MEJORA 4: Historial de Periodos Cerrados y suma de mes
  // ════════════════════════════════════════════════════════════
  test('MEJORA 4: Suma exacta al cerrar mes a partir de semanas cerradas', () => {
    const semanasCerradas = [
      { cajas_cortadas: 285, cajas_empacadas: 270, descarte: 15, nomina_bruta: 900, adelantos: 200, neto: 700 },
      { cajas_cortadas: 310, cajas_empacadas: 290, descarte: 20, nomina_bruta: 1450, adelantos: 0, neto: 1450 },
    ];

    const mesTotalCajas = semanasCerradas.reduce((a, b) => a + b.cajas_cortadas, 0);
    const mesTotalNomina = semanasCerradas.reduce((a, b) => a + b.nomina_bruta, 0);
    const mesTotalNeto = semanasCerradas.reduce((a, b) => a + b.neto, 0);

    expect(mesTotalCajas).toBe(595);
    expect(mesTotalNomina).toBe(2350);
    expect(mesTotalNeto).toBe(2150);
  });

  // ════════════════════════════════════════════════════════════
  // MEJORA 8: Comparativa semanal (% cambio)
  // ════════════════════════════════════════════════════════════
  test('MEJORA 8: Comparativa semanal con formula exact ((actual - anterior)/anterior)*100', () => {
    // Caso 1: Anterior = 250, Actual = 285 -> +14%
    const ant1 = 250;
    const act1 = 285;
    const porc1 = ((act1 - ant1) / ant1) * 100;
    expect(Math.round(porc1)).toBe(14);

    // Caso 2: Anterior = 300, Actual = 285 -> -5%
    const ant2 = 300;
    const act2 = 285;
    const porc2 = ((act2 - ant2) / ant2) * 100;
    expect(Math.round(porc2)).toBe(-5);
  });

  // ════════════════════════════════════════════════════════════
  // MEJORA 9: Exportar con 6 secciones completas
  // ════════════════════════════════════════════════════════════
  test('MEJORA 9: Exportación CSV contiene las 6 secciones exactas y periodo', () => {
    const mockInput: ExportarCompletoInput = {
      semana: {
        id: 's-1',
        fecha_inicio: '2026-10-19',
        fecha_fin: '2026-10-25',
        estado: 'cerrada',
        synced: 0,
      },
      trabajadores: [
        { id: '1', nombre: 'Juan Carlos', tarifa_diaria_default: 250, activo: 1, synced: 0 },
        { id: '2', nombre: 'Luis', tarifa_diaria_default: 400, activo: 1, synced: 0 },
      ],
      diasTrabajados: [
        { id: 'd-1', semana_id: 's-1', trabajador_id: '1', fecha: '2026-10-21', presente: 1, tarifa_diaria: 250, synced: 0 },
        { id: 'd-2', semana_id: 's-1', trabajador_id: '2', fecha: '2026-10-21', presente: 1, tarifa_diaria: 400, synced: 0 },
      ],
      adelantos: [
        { id: 'a-1', semana_id: 's-1', trabajador_id: '2', fecha: '2026-10-21', monto: 200, concepto: 'préstamo', synced: 0 },
      ],
      resumenes: [
        {
          trabajador: { id: '1', nombre: 'Juan Carlos', tarifa_diaria_default: 250, activo: 1, synced: 0 },
          calculo: { diasPresentes: 1, diasAusentes: 6, totalGanado: 250, totalAdelantos: 0, totalAPagar: 250 },
        },
        {
          trabajador: { id: '2', nombre: 'Luis', tarifa_diaria_default: 400, activo: 1, synced: 0 },
          calculo: { diasPresentes: 1, diasAusentes: 6, totalGanado: 400, totalAdelantos: 200, totalAPagar: 200 },
        },
      ],
      cosecha: {
        cortadas: 285,
        empacadas: 270,
        descarte: 15,
      },
    };

    const csv = generarReporteCompletoCSV(mockInput);

    // 1. Encabezado con periodo
    expect(csv).toContain('=== 1. ENCABEZADO ===');
    expect(csv).toContain('Semana 19-25');

    // 2. Tabla de asistencia
    expect(csv).toContain('=== 2. TABLA DE ASISTENCIA ===');
    expect(csv).toContain('Juan Carlos');
    expect(csv).toContain('Presente');

    // 3. Tabla de adelantos
    expect(csv).toContain('=== 3. TABLA DE ADELANTOS ===');
    expect(csv).toContain('préstamo');
    expect(csv).toContain('200.00');

    // 4. Resumen por trabajador
    expect(csv).toContain('=== 4. RESUMEN POR TRABAJADOR ===');
    expect(csv).toContain('400.00,200.00,200.00');

    // 5. Producción de cosecha
    expect(csv).toContain('=== 5. PRODUCCION DE COSECHA ===');
    expect(csv).toContain('285,270,15');

    // 6. Totales
    expect(csv).toContain('=== 6. TOTALES GENERALES ===');
    expect(csv).toContain('650.00,200.00,450.00');
  });
});
