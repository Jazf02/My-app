// ═══════════════════════════════════════════════════════════
// sync/syncEngine.ts — Motor de sincronización bidireccional
// Sincroniza datos locales (SQLite / localStorage) con Supabase
// Garantiza funcionamiento Offline-First: guarda local y luego sube
// ═══════════════════════════════════════════════════════════

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getDB } from '@/database/local';
import { setEstadoSync, getEstadoSync } from './status';
import type { EstadoSync } from '@/types';

// Constantes de almacenamiento web
const WEB_KEY_PREFIX = 'agrogamez_';

/**
 * Comprueba si hay conexión activa con el servidor de Supabase.
 */
export async function verificarConexionSupabase(): Promise<boolean> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      return false;
    }
    // Ping ligero a auth o health
    const { error } = await supabase.from('trabajadores').select('id').limit(1);
    // Si no hay error de red (incluso si la tabla está vacía o da error de RLS no es un error de conexión)
    if (error && error.message.includes('fetch')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ─── SINCRONIZACIÓN EN MÓVIL (SQLite) ──────────────────────────

async function syncTrabajadoresMobile(): Promise<void> {
  const db = await getDB();
  // 1. Subir locales no sincronizados
  const pendientes = await db.getAllAsync<any>(
    'SELECT * FROM trabajadores WHERE synced = 0;'
  );

  for (const t of pendientes) {
    const { error } = await supabase.from('trabajadores').upsert({
      id: t.id,
      nombre: t.nombre,
      tarifa_diaria_default: t.tarifa_diaria_default,
      activo: t.activo,
      dominical: t.dominical ?? 0,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      await db.runAsync('UPDATE trabajadores SET synced = 1 WHERE id = ?;', [t.id]);
    }
  }

  // 2. Descargar remotos nuevos o actualizados
  const { data: remotos, error: fetchErr } = await supabase
    .from('trabajadores')
    .select('*');

  if (!fetchErr && remotos) {
    for (const r of remotos) {
      await db.runAsync(
        `INSERT INTO trabajadores (id, nombre, tarifa_diaria_default, activo, dominical, synced)
         VALUES (?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           nombre = excluded.nombre,
           tarifa_diaria_default = excluded.tarifa_diaria_default,
           activo = excluded.activo,
           dominical = excluded.dominical,
           synced = 1;`,
        [r.id, r.nombre, r.tarifa_diaria_default, r.activo, r.dominical ?? 0]
      );
    }
  }
}

async function syncSemanasMobile(): Promise<void> {
  const db = await getDB();
  const pendientes = await db.getAllAsync<any>(
    'SELECT * FROM semanas WHERE synced = 0;'
  );

  for (const s of pendientes) {
    const { error } = await supabase.from('semanas').upsert({
      id: s.id,
      fecha_inicio: s.fecha_inicio,
      fecha_fin: s.fecha_fin,
      estado: s.estado,
      pagada_en: s.pagada_en,
      reabierta_en: s.reabierta_en,
      reabierta_motivo: s.reabierta_motivo,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      await db.runAsync('UPDATE semanas SET synced = 1 WHERE id = ?;', [s.id]);
    }
  }

  const { data: remotos, error: fetchErr } = await supabase
    .from('semanas')
    .select('*');

  if (!fetchErr && remotos) {
    for (const r of remotos) {
      await db.runAsync(
        `INSERT INTO semanas (id, fecha_inicio, fecha_fin, estado, pagada_en, reabierta_en, reabierta_motivo, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           estado = excluded.estado,
           pagada_en = excluded.pagada_en,
           reabierta_en = excluded.reabierta_en,
           reabierta_motivo = excluded.reabierta_motivo,
           synced = 1;`,
        [r.id, r.fecha_inicio, r.fecha_fin, r.estado, r.pagada_en, r.reabierta_en, r.reabierta_motivo]
      );
    }
  }
}

async function syncDiasTrabajadosMobile(): Promise<void> {
  const db = await getDB();
  const pendientes = await db.getAllAsync<any>(
    'SELECT * FROM dias_trabajados WHERE synced = 0;'
  );

  for (const d of pendientes) {
    const { error } = await supabase.from('dias_trabajados').upsert({
      id: d.id,
      semana_id: d.semana_id,
      trabajador_id: d.trabajador_id,
      fecha: d.fecha,
      presente: d.presente,
      tarifa_diaria: d.tarifa_diaria,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      await db.runAsync('UPDATE dias_trabajados SET synced = 1 WHERE id = ?;', [d.id]);
    }
  }

  const { data: remotos, error: fetchErr } = await supabase
    .from('dias_trabajados')
    .select('*');

  if (!fetchErr && remotos) {
    for (const r of remotos) {
      await db.runAsync(
        `INSERT INTO dias_trabajados (id, semana_id, trabajador_id, fecha, presente, tarifa_diaria, synced)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(semana_id, trabajador_id, fecha) DO UPDATE SET
           presente = excluded.presente,
           tarifa_diaria = excluded.tarifa_diaria,
           synced = 1;`,
        [r.id, r.semana_id, r.trabajador_id, r.fecha, r.presente, r.tarifa_diaria]
      );
    }
  }
}

async function syncAdelantosMobile(): Promise<void> {
  const db = await getDB();
  const pendientes = await db.getAllAsync<any>(
    'SELECT * FROM adelantos WHERE synced = 0;'
  );

  for (const a of pendientes) {
    const { error } = await supabase.from('adelantos').upsert({
      id: a.id,
      semana_id: a.semana_id,
      trabajador_id: a.trabajador_id,
      monto: a.monto,
      concepto: a.concepto,
      fecha: a.fecha,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      await db.runAsync('UPDATE adelantos SET synced = 1 WHERE id = ?;', [a.id]);
    }
  }

  const { data: remotos, error: fetchErr } = await supabase
    .from('adelantos')
    .select('*');

  if (!fetchErr && remotos) {
    for (const r of remotos) {
      await db.runAsync(
        `INSERT INTO adelantos (id, semana_id, trabajador_id, monto, concepto, fecha, synced)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           monto = excluded.monto,
           concepto = excluded.concepto,
           synced = 1;`,
        [r.id, r.semana_id, r.trabajador_id, r.monto, r.concepto, r.fecha]
      );
    }
  }
}

// ─── SINCRONIZACIÓN EN WEB (localStorage) ─────────────────────

function getWebCollection(key: string): any[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(`${WEB_KEY_PREFIX}${key}`);
  return raw ? JSON.parse(raw) : [];
}

function setWebCollection(key: string, data: any[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${WEB_KEY_PREFIX}${key}`, JSON.stringify(data));
}

async function syncTrabajadoresWeb(): Promise<void> {
  const items = getWebCollection('trabajadores');
  const pendientes = items.filter((t) => t.synced === 0);

  // Subir pendientes
  for (const t of pendientes) {
    const { error } = await supabase.from('trabajadores').upsert({
      id: t.id,
      nombre: t.nombre,
      tarifa_diaria_default: t.tarifa_diaria_default,
      activo: t.activo,
      dominical: t.dominical ?? 0,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      t.synced = 1;
    }
  }

  // Descargar remotos
  const { data: remotos, error: fetchErr } = await supabase
    .from('trabajadores')
    .select('*');

  if (!fetchErr && remotos) {
    const mapa = new Map(items.map((i) => [i.id, i]));
    for (const r of remotos) {
      mapa.set(r.id, {
        id: r.id,
        nombre: r.nombre,
        tarifa_diaria_default: Number(r.tarifa_diaria_default),
        activo: r.activo,
        dominical: r.dominical ?? 0,
        synced: 1,
      });
    }
    setWebCollection('trabajadores', Array.from(mapa.values()));
  } else {
    setWebCollection('trabajadores', items);
  }
}

async function syncSemanasWeb(): Promise<void> {
  const items = getWebCollection('semanas');
  const pendientes = items.filter((s) => s.synced === 0);

  for (const s of pendientes) {
    const { error } = await supabase.from('semanas').upsert({
      id: s.id,
      fecha_inicio: s.fecha_inicio,
      fecha_fin: s.fecha_fin,
      estado: s.estado,
      pagada_en: s.pagada_en,
      reabierta_en: s.reabierta_en,
      reabierta_motivo: s.reabierta_motivo,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      s.synced = 1;
    }
  }

  const { data: remotos, error: fetchErr } = await supabase
    .from('semanas')
    .select('*');

  if (!fetchErr && remotos) {
    const mapa = new Map(items.map((i) => [i.id, i]));
    for (const r of remotos) {
      mapa.set(r.id, {
        id: r.id,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        estado: r.estado,
        pagada_en: r.pagada_en,
        reabierta_en: r.reabierta_en,
        reabierta_motivo: r.reabierta_motivo,
        synced: 1,
      });
    }
    setWebCollection('semanas', Array.from(mapa.values()));
  } else {
    setWebCollection('semanas', items);
  }
}

async function syncDiasTrabajadosWeb(): Promise<void> {
  const items = getWebCollection('dias_trabajados');
  const pendientes = items.filter((d) => d.synced === 0);

  for (const d of pendientes) {
    const { error } = await supabase.from('dias_trabajados').upsert({
      id: d.id,
      semana_id: d.semana_id,
      trabajador_id: d.trabajador_id,
      fecha: d.fecha,
      presente: d.presente,
      tarifa_diaria: d.tarifa_diaria,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      d.synced = 1;
    }
  }

  const { data: remotos, error: fetchErr } = await supabase
    .from('dias_trabajados')
    .select('*');

  if (!fetchErr && remotos) {
    const mapa = new Map(items.map((i) => [`${i.semana_id}_${i.trabajador_id}_${i.fecha}`, i]));
    for (const r of remotos) {
      const clave = `${r.semana_id}_${r.trabajador_id}_${r.fecha}`;
      mapa.set(clave, {
        id: r.id,
        semana_id: r.semana_id,
        trabajador_id: r.trabajador_id,
        fecha: r.fecha,
        presente: r.presente,
        tarifa_diaria: r.tarifa_diaria !== null ? Number(r.tarifa_diaria) : null,
        synced: 1,
      });
    }
    setWebCollection('dias_trabajados', Array.from(mapa.values()));
  } else {
    setWebCollection('dias_trabajados', items);
  }
}

async function syncAdelantosWeb(): Promise<void> {
  const items = getWebCollection('adelantos');
  const pendientes = items.filter((a) => a.synced === 0);

  for (const a of pendientes) {
    const { error } = await supabase.from('adelantos').upsert({
      id: a.id,
      semana_id: a.semana_id,
      trabajador_id: a.trabajador_id,
      monto: a.monto,
      concepto: a.concepto,
      fecha: a.fecha,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      a.synced = 1;
    }
  }

  const { data: remotos, error: fetchErr } = await supabase
    .from('adelantos')
    .select('*');

  if (!fetchErr && remotos) {
    const mapa = new Map(items.map((i) => [i.id, i]));
    for (const r of remotos) {
      mapa.set(r.id, {
        id: r.id,
        semana_id: r.semana_id,
        trabajador_id: r.trabajador_id,
        monto: Number(r.monto),
        concepto: r.concepto,
        fecha: r.fecha,
        synced: 1,
      });
    }
    setWebCollection('adelantos', Array.from(mapa.values()));
  } else {
    setWebCollection('adelantos', items);
  }
}

// ─── FUNCIÓN PRINCIPAL DE SINCRONIZACIÓN ─────────────────────

let _sincronizando = false;

/**
 * Ejecuta una sincronización completa de la base de datos local con Supabase.
 * - Sube registros modificados localmente (`synced = 0`)
 * - Descarga registros nuevos o modificados de Supabase
 * - Actualiza el estado visual a 'sincronizado' o 'error'
 */
export async function ejecutarSincronizacion(): Promise<{ exito: boolean; mensaje: string }> {
  if (_sincronizando) {
    return { exito: true, mensaje: 'Sincronización en curso...' };
  }

  _sincronizando = true;
  setEstadoSync('sincronizando');

  try {
    const hayConexion = await verificarConexionSupabase();
    if (!hayConexion) {
      setEstadoSync('offline');
      _sincronizando = false;
      return { exito: false, mensaje: 'Sin conexión a internet. Los datos se guardaron localmente.' };
    }

    if (Platform.OS === 'web') {
      await syncTrabajadoresWeb();
      await syncSemanasWeb();
      await syncDiasTrabajadosWeb();
      await syncAdelantosWeb();
    } else {
      await syncTrabajadoresMobile();
      await syncSemanasMobile();
      await syncDiasTrabajadosMobile();
      await syncAdelantosMobile();
    }

    setEstadoSync('sincronizado');
    _sincronizando = false;
    return { exito: true, mensaje: 'Datos sincronizados exitosamente con la nube.' };
  } catch (error: any) {
    console.error('[SyncEngine] Error durante la sincronización:', error);
    setEstadoSync('error');
    _sincronizando = false;
    return {
      exito: false,
      mensaje: error?.message || 'Error al sincronizar datos.',
    };
  }
}

/**
 * Inicia el temporizador de sincronización periódica en segundo plano.
 * Intenta sincronizar cada 2 minutos si hay conexión.
 */
let _syncInterval: any = null;

export function iniciarSyncEnSegundoPlano(): void {
  if (_syncInterval) return;

  // Ejecutar primera sincronización después de 3 segundos
  setTimeout(() => {
    ejecutarSincronizacion().catch(() => {});
  }, 3000);

  // Programar sincronización periódica cada 2 minutos
  _syncInterval = setInterval(() => {
    ejecutarSincronizacion().catch(() => {});
  }, 120000);
}

export function detenerSyncEnSegundoPlano(): void {
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
  }
}

