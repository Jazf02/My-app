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

// Clave oficial compartida con database/webStorage.ts
const WEB_KEY_PREFIX = '@agrogamez:';

// Callbacks para notificar a las pantallas cuando la sync termina
type SyncCallback = () => void;
const _syncCompletadoListeners: SyncCallback[] = [];

export function suscribirSyncCompletado(cb: SyncCallback): () => void {
  _syncCompletadoListeners.push(cb);
  return () => {
    const idx = _syncCompletadoListeners.indexOf(cb);
    if (idx !== -1) _syncCompletadoListeners.splice(idx, 1);
  };
}

function notificarSyncCompletado(): void {
  _syncCompletadoListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

/**
 * Comprueba si hay conexión activa con el servidor de Supabase.
 */
export async function verificarConexionSupabase(): Promise<boolean> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      return false;
    }
    const { error } = await supabase.from('trabajadores').select('id').limit(1);
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
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const raw =
    window.localStorage.getItem(`${WEB_KEY_PREFIX}${key}`) ||
    window.localStorage.getItem(`agrogamez_${key}`);
  return raw ? JSON.parse(raw) : [];
}

function setWebCollection(key: string, data: any[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(`${WEB_KEY_PREFIX}${key}`, JSON.stringify(data));
}

async function syncTrabajadoresWeb(): Promise<void> {
  const items = getWebCollection('trabajadores');

  // 1. Subir a Supabase todos los trabajadores que tengamos localmente
  for (const t of items) {
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

  // 2. Descargar todos los trabajadores remotos de Supabase
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

  for (const s of items) {
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

  for (const d of items) {
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

  for (const a of items) {
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

async function syncLotesWeb(): Promise<void> {
  const items = getWebCollection('lotes');

  for (const l of items) {
    const { error } = await supabase.from('lotes').upsert({
      id: l.id,
      nombre: l.nombre,
      cultivo: l.cultivo,
      variedad: l.variedad,
      fecha_siembra: l.fecha_siembra,
      estado: l.estado,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      l.synced = 1;
    }
  }

  const { data: remotos, error: fetchErr } = await supabase
    .from('lotes')
    .select('*');

  if (!fetchErr && remotos) {
    const mapa = new Map(items.map((i) => [i.id, i]));
    for (const r of remotos) {
      mapa.set(r.id, {
        id: r.id,
        nombre: r.nombre,
        cultivo: r.cultivo,
        variedad: r.variedad,
        fecha_siembra: r.fecha_siembra,
        estado: r.estado,
        synced: 1,
      });
    }
    setWebCollection('lotes', Array.from(mapa.values()));
  } else {
    setWebCollection('lotes', items);
  }
}

async function syncCosechasWeb(): Promise<void> {
  const items = getWebCollection('cosechas');

  for (const c of items) {
    const { error } = await supabase.from('cosechas').upsert({
      id: c.id,
      lote_id: c.lote_id,
      fecha: c.fecha,
      cajas_cortadas: c.cajas_cortadas,
      cajas_descarte: c.cajas_descarte,
      cajas_empacadas: c.cajas_empacadas,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      c.synced = 1;
    }
  }

  const { data: remotos, error: fetchErr } = await supabase
    .from('cosechas')
    .select('*');

  if (!fetchErr && remotos) {
    const mapa = new Map(items.map((i) => [i.id, i]));
    for (const r of remotos) {
      mapa.set(r.id, {
        id: r.id,
        lote_id: r.lote_id,
        fecha: r.fecha,
        cajas_cortadas: Number(r.cajas_cortadas),
        cajas_descarte: Number(r.cajas_descarte),
        cajas_empacadas: Number(r.cajas_empacadas),
        synced: 1,
      });
    }
    setWebCollection('cosechas', Array.from(mapa.values()));
  } else {
    setWebCollection('cosechas', items);
  }
}

async function syncGastosWeb(): Promise<void> {
  const items = getWebCollection('gastos');

  for (const g of items) {
    const { error } = await supabase.from('gastos').upsert({
      id: g.id,
      fecha: g.fecha,
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: g.monto,
      lote_id: g.lote_id,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      g.synced = 1;
    }
  }

  const { data: remotos, error: fetchErr } = await supabase
    .from('gastos')
    .select('*');

  if (!fetchErr && remotos) {
    const mapa = new Map(items.map((i) => [i.id, i]));
    for (const r of remotos) {
      mapa.set(r.id, {
        id: r.id,
        fecha: r.fecha,
        categoria: r.categoria,
        descripcion: r.descripcion,
        monto: Number(r.monto),
        lote_id: r.lote_id,
        synced: 1,
      });
    }
    setWebCollection('gastos', Array.from(mapa.values()));
  } else {
    setWebCollection('gastos', items);
  }
}

async function syncPeriodosCerradosWeb(): Promise<void> {
  const items = getWebCollection('periodos_cerrados');

  for (const p of items) {
    const { error } = await supabase.from('periodos_cerrados').upsert({
      id: p.id,
      tipo: p.tipo,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin,
      cajas_cortadas: p.cajas_cortadas,
      cajas_empacadas: p.cajas_empacadas,
      descarte: p.descarte,
      nomina_bruta: p.nomina_bruta,
      adelantos: p.adelantos,
      neto: p.neto,
      fecha_cierre: p.fecha_cierre,
    });

    if (!error) {
      p.synced = 1;
    }
  }

  const { data: remotos, error: fetchErr } = await supabase
    .from('periodos_cerrados')
    .select('*');

  if (!fetchErr && remotos) {
    const mapa = new Map(items.map((i) => [i.id, i]));
    for (const r of remotos) {
      mapa.set(r.id, {
        id: r.id,
        tipo: r.tipo,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        cajas_cortadas: Number(r.cajas_cortadas),
        cajas_empacadas: Number(r.cajas_empacadas),
        descarte: Number(r.descarte),
        nomina_bruta: Number(r.nomina_bruta),
        adelantos: Number(r.adelantos),
        neto: Number(r.neto),
        fecha_cierre: r.fecha_cierre,
        synced: 1,
      });
    }
    setWebCollection('periodos_cerrados', Array.from(mapa.values()));
  } else {
    setWebCollection('periodos_cerrados', items);
  }
}

// ─── FUNCIÓN PRINCIPAL DE SINCRONIZACIÓN ─────────────────────

let _sincronizando = false;

/**
 * Ejecuta una sincronización completa bidireccional con Supabase.
 * - Sube registros locales a la nube
 * - Descarga registros remotos para que aparezcan en todos los dispositivos
 * - Notifica a las pantallas para refrescar la vista en vivo
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
      await syncLotesWeb();
      await syncCosechasWeb();
      await syncGastosWeb();
      await syncPeriodosCerradosWeb();
    } else {
      await syncTrabajadoresMobile();
      await syncSemanasMobile();
      await syncDiasTrabajadosMobile();
      await syncAdelantosMobile();
    }

    setEstadoSync('sincronizado');
    _sincronizando = false;
    notificarSyncCompletado();
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

let _syncInterval: any = null;

export function iniciarSyncEnSegundoPlano(): void {
  if (_syncInterval) return;

  // Ejecutar primera sincronización inmediata
  setTimeout(() => {
    ejecutarSincronizacion().catch(() => {});
  }, 1000);

  // Sincronización periódica cada 30 segundos si hay conexión
  _syncInterval = setInterval(() => {
    ejecutarSincronizacion().catch(() => {});
  }, 30000);
}

export function detenerSyncEnSegundoPlano(): void {
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
  }
}
