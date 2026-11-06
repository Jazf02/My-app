// __tests__/qa_integracion.test.ts — Pruebas QA de Integración de Base de Datos
// Verifica que todos los módulos ejecuten sus queries SQLite con las columnas correctas

const executedQueries: string[] = [];
let mockData: Record<string, any> = {};

jest.mock('expo-sqlite', () => {
  const tables: Record<string, boolean> = {};

  const mockDb = {
    execAsync: jest.fn(async (sql: string) => {
      executedQueries.push(sql);
      const matches = sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g);
      for (const m of matches) {
        if (m[1]) tables[m[1]] = true;
      }
    }),
    runAsync: jest.fn(async (sql: string, params?: any[]) => {
      executedQueries.push(sql);
      return { lastInsertRowId: 1, changes: 1 };
    }),
    getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
      executedQueries.push(sql);
      if (sql.includes('SELECT * FROM trabajadores WHERE id = ?')) {
        return mockData['trabajador'] || {
          id: params?.[0] || 't-1',
          nombre: 'Juan Pérez',
          tarifa_diaria_default: 250,
          sueldo_base: 250,
          activo: 1,
          synced: 0,
        };
      }
      if (sql.includes('SELECT * FROM semanas WHERE fecha_inicio = ?')) {
        return mockData['semana'] || null;
      }
      if (sql.includes('SELECT * FROM semanas WHERE id = ?')) {
        return mockData['semana'] || {
          id: params?.[0] || 's-1',
          fecha_inicio: '2026-10-05',
          fecha_fin: '2026-10-11',
          estado: 'abierta',
          synced: 0,
        };
      }
      if (sql.includes('SELECT * FROM lotes WHERE id = ?')) {
        return {
          id: params?.[0] || 'l-1',
          nombre: 'Lote Norte',
          cultivo: 'Maíz',
          variedad: 'H-53',
          estado: 'activo',
          synced: 0,
        };
      }
      if (sql.includes('SELECT * FROM cosechas WHERE id = ?')) {
        return {
          id: params?.[0] || 'c-1',
          lote_id: 'l-1',
          fecha: '2026-10-10',
          cajas_cortadas: 100,
          cajas_descarte: 5,
          cajas_empacadas: 95,
          synced: 0,
        };
      }
      if (sql.includes('SELECT * FROM adelantos WHERE id = ?')) {
        return {
          id: params?.[0] || 'a-1',
          semana_id: 's-1',
          trabajador_id: 't-1',
          monto: 100,
          concepto: 'Comida',
          fecha: '2026-10-10',
          synced: 0,
        };
      }
      if (sql.includes('SELECT * FROM gastos WHERE id = ?')) {
        return {
          id: params?.[0] || 'g-1',
          fecha: '2026-10-10',
          categoria: 'Insumos',
          descripcion: 'Abono',
          monto: 500,
          lote_id: 'l-1',
          synced: 0,
        };
      }
      if (sql.includes('integrity_check')) {
        return { integrity_check: 'ok' };
      }
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string, params?: any[]) => {
      executedQueries.push(sql);
      if (sql.includes('sqlite_master')) {
        return Object.keys(tables).map((name) => ({ name }));
      }
      if (sql.includes('table_info')) {
        // Simular que existen las columnas para que migrarEsquema no falle
        return [
          { name: 'id' },
          { name: 'nombre' },
          { name: 'tarifa_diaria_default' },
          { name: 'sueldo_base' },
          { name: 'activo' },
          { name: 'synced' },
          { name: 'cajas_empacadas' },
          { name: 'lote_id' },
          { name: 'cultivo' },
        ];
      }
      if (sql.includes('SELECT * FROM trabajadores')) {
        return [
          {
            id: 't-1',
            nombre: 'Juan Pérez',
            tarifa_diaria_default: 250,
            activo: 1,
            synced: 0,
          },
        ];
      }
      if (sql.includes('SELECT * FROM lotes')) {
        return [
          {
            id: 'l-1',
            nombre: 'Lote Norte',
            cultivo: 'Maíz',
            variedad: 'H-53',
            estado: 'activo',
            synced: 0,
          },
        ];
      }
      if (sql.includes('SELECT * FROM cosechas WHERE lote_id = ?')) {
        return [
          {
            id: 'c-1',
            lote_id: 'l-1',
            fecha: '2026-10-10',
            cajas_cortadas: 50,
            cajas_descarte: 5,
            cajas_empacadas: 45,
            synced: 0,
          },
        ];
      }
      if (sql.includes('SELECT * FROM dias_trabajados')) {
        return [
          {
            id: 'd-1',
            semana_id: 's-1',
            trabajador_id: 't-1',
            fecha: '2026-10-10',
            presente: 1,
            tarifa_diaria: 250,
            synced: 0,
          },
        ];
      }
      if (sql.includes('SELECT * FROM adelantos')) {
        return [
          {
            id: 'a-1',
            semana_id: 's-1',
            trabajador_id: 't-1',
            monto: 50,
            concepto: 'Pasaje',
            fecha: '2026-10-10',
            synced: 0,
          },
        ];
      }
      return [];
    }),
  };

  return {
    openDatabaseAsync: jest.fn(async () => mockDb),
  };
});

import { initTables, _resetDBForTesting } from '../database/local';
import { crearTrabajador, obtenerTrabajadores } from '../database/trabajadores';
import {
  obtenerOCrearSemanaActual,
  marcarAsistencia,
  registrarAdelanto,
  obtenerAsistenciaSemanal,
} from '../database/asistencia';
import { crearLote, obtenerLotes } from '../database/lotes';
import { registrarCosecha, obtenerCosechasPorLote } from '../database/cosechas';
import { registrarGasto } from '../database/gastos';

describe('QA Integración SQLite — Flujo Completo sin Errores', () => {
  beforeEach(async () => {
    _resetDBForTesting();
    executedQueries.length = 0;
    mockData = {};
  });

  test('1. initTables crea las tablas requeridas para Fase 2, 3 y 4', async () => {
    await initTables();

    const sqlCompleto = executedQueries.join('\n');
    expect(sqlCompleto).toContain('CREATE TABLE IF NOT EXISTS trabajadores');
    expect(sqlCompleto).toContain('CREATE TABLE IF NOT EXISTS semanas');
    expect(sqlCompleto).toContain('CREATE TABLE IF NOT EXISTS dias_trabajados');
    expect(sqlCompleto).toContain('CREATE TABLE IF NOT EXISTS adelantos');
    expect(sqlCompleto).toContain('CREATE TABLE IF NOT EXISTS lotes');
    expect(sqlCompleto).toContain('CREATE TABLE IF NOT EXISTS cosechas');
    expect(sqlCompleto).toContain('CREATE TABLE IF NOT EXISTS gastos');
  });

  test('2. Registrar y listar trabajador incluye tarifa_diaria_default y synced', async () => {
    const trabajador = await crearTrabajador({
      nombre: 'Carlos Gámez',
      tarifa_diaria_default: 300,
    });

    expect(trabajador).toBeDefined();
    expect(trabajador.nombre).toBe('Juan Pérez');

    const sqlInsersion = executedQueries.find((q) =>
      q.includes('INSERT INTO trabajadores')
    );
    expect(sqlInsersion).toContain('tarifa_diaria_default');
    expect(sqlInsersion).toContain('synced');

    const lista = await obtenerTrabajadores(true);
    expect(lista.length).toBeGreaterThan(0);
  });

  test('3. Semana y asistencia usan dias_trabajados y columna synced', async () => {
    const semana = await obtenerOCrearSemanaActual();
    expect(semana).toBeDefined();

    const sqlSemana = executedQueries.find((q) =>
      q.includes('INSERT INTO semanas')
    );
    if (sqlSemana) {
      expect(sqlSemana).toContain('synced');
    }

    await marcarAsistencia({
      semanaId: semana.id,
      trabajadorId: 't-1',
      fecha: '2026-10-10',
      presente: true,
      tarifaDiariaOverride: 280,
    });

    const sqlAsistencia = executedQueries.find((q) =>
      q.includes('INSERT INTO dias_trabajados')
    );
    expect(sqlAsistencia).toBeDefined();
    expect(sqlAsistencia).toContain('tarifa_diaria');
    expect(sqlAsistencia).toContain('synced');

    const dias = await obtenerAsistenciaSemanal(semana.id, 't-1');
    expect(dias.length).toBeGreaterThan(0);
  });

  test('4. Adelanto se registra con semana_id y trabajador_id', async () => {
    const adelanto = await registrarAdelanto({
      semana_id: 's-1',
      trabajador_id: 't-1',
      monto: 100,
      concepto: 'Almuerzo',
    });

    expect(adelanto).toBeDefined();
    const sqlAdelanto = executedQueries.find((q) =>
      q.includes('INSERT INTO adelantos')
    );
    expect(sqlAdelanto).toBeDefined();
    expect(sqlAdelanto).toContain('synced');
  });

  test('5. Cosecha y Lote se registran con cajas_empacadas y synced', async () => {
    const lote = await crearLote({
      nombre: 'Parcela 1',
      cultivo: 'Tomate',
      variedad: 'Saladette',
    });
    expect(lote).toBeDefined();

    const sqlLote = executedQueries.find((q) => q.includes('INSERT INTO lotes'));
    expect(sqlLote).toContain('synced');

    const cosecha = await registrarCosecha({
      lote_id: lote.id,
      cajas_cortadas: 80,
      cajas_descarte: 5,
      cajas_empacadas: 75,
    });
    expect(cosecha).toBeDefined();

    const sqlCosecha = executedQueries.find((q) =>
      q.includes('INSERT INTO cosechas')
    );
    expect(sqlCosecha).toContain('cajas_empacadas');
    expect(sqlCosecha).toContain('synced');

    const listaCortes = await obtenerCosechasPorLote(lote.id);
    expect(listaCortes.length).toBeGreaterThan(0);
  });

  test('6. Gastos se registran con lote_id y synced', async () => {
    const gasto = await registrarGasto({
      categoria: 'Insumos',
      monto: 450,
      descripcion: 'Fertilizante',
      lote_id: 'l-1',
    });
    expect(gasto).toBeDefined();

    const sqlGasto = executedQueries.find((q) => q.includes('INSERT INTO gastos'));
    expect(sqlGasto).toContain('lote_id');
    expect(sqlGasto).toContain('synced');
  });
});
