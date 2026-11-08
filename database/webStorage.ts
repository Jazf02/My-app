// ═══════════════════════════════════════════════════════════
// database/webStorage.ts — Capa de persistencia Web
// Almacenamiento puro en localStorage / Memoria sin dependencias nativas
// ═══════════════════════════════════════════════════════════

import { lunesDeSemana, domingoDeSemana, hoyISO } from '@/lib/fechas';
import { calcularPagoSemanal, type ResultadoPagoSemanal } from '@/lib/calculos';
import type {
  Trabajador,
  CrearTrabajadorDTO,
  Semana,
  DiaTrabajado,
  Adelanto,
  CrearAdelantoDTO,
  Lote,
  Cosecha,
  ResumenCosecha,
  Gasto,
} from '@/types/domain';
import type { PeriodoCerrado, MetricasPeriodo } from './asistencia';
import type { CrearLoteDTO } from './lotes';
import type { CrearCosechaDTO } from './cosechas';
import type { CrearGastoDTO } from './gastos';

function uuid(): string {
  return 'web_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
}

// Almacén en memoria para entornos sin window.localStorage (Node/Jest)
const memoryStore = new Map<string, string>();

const storage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memoryStore.get(key) || null;
      }
    }
    return memoryStore.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {}
    }
    memoryStore.set(key, value);
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch {}
    }
    memoryStore.delete(key);
  },
};

function getList<T>(key: string): T[] {
  try {
    const raw = storage.getItem(`@agrogamez:${key}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveList<T>(key: string, list: T[]): void {
  try {
    storage.setItem(`@agrogamez:${key}`, JSON.stringify(list));
  } catch {}
}

// ─── TRABAJADORES (WEB) ──────────────────────────────────────
export async function webCrearTrabajador(input: CrearTrabajadorDTO): Promise<Trabajador> {
  const list = getList<Trabajador>('trabajadores');
  const nuevo: Trabajador = {
    id: uuid(),
    nombre: input.nombre.trim(),
    tarifa_diaria_default:
      typeof input.tarifa_diaria_default === 'number' ? input.tarifa_diaria_default : 250,
    activo: 1,
    dominical: 0,
    synced: 0,
  };
  list.push(nuevo);
  saveList('trabajadores', list);
  return nuevo;
}

export async function webObtenerTrabajadores(soloActivos: boolean = true): Promise<Trabajador[]> {
  let list = getList<Trabajador>('trabajadores');
  const seeded = typeof window !== 'undefined' ? localStorage.getItem('agrogamez_seeded') : 'true';
  if (list.length === 0 && !seeded) {
    if (typeof window !== 'undefined') localStorage.setItem('agrogamez_seeded', 'true');
    const hasSupabase = process.env.EXPO_PUBLIC_SUPABASE_URL && !process.env.EXPO_PUBLIC_SUPABASE_URL.includes('placeholder');
    if (!hasSupabase) {
      list = [
        { id: 'w1', nombre: 'Juan Pérez', tarifa_diaria_default: 250, activo: 1, dominical: 0, synced: 0 },
        { id: 'w2', nombre: 'Carlos Gómez', tarifa_diaria_default: 250, activo: 1, dominical: 0, synced: 0 },
        { id: 'w3', nombre: 'María Rodríguez', tarifa_diaria_default: 280, activo: 1, dominical: 0, synced: 0 },
      ];
      saveList('trabajadores', list);
    }
  }
  const filtrados = soloActivos ? list.filter((t) => t.activo === 1) : list;
  return filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function webObtenerTrabajadorPorId(id: string): Promise<Trabajador | null> {
  const list = await webObtenerTrabajadores(false);
  return list.find((t) => t.id === id) || null;
}

export async function webActualizarTrabajador(
  id: string,
  input: Partial<CrearTrabajadorDTO> & { dominical?: number }
): Promise<Trabajador> {
  const list = await webObtenerTrabajadores(false);
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error(`Trabajador con id ${id} no encontrado.`);

  const actual = list[idx];
  const updated: Trabajador = {
    ...actual,
    nombre: input.nombre !== undefined ? input.nombre.trim() : actual.nombre,
    tarifa_diaria_default:
      input.tarifa_diaria_default !== undefined
        ? input.tarifa_diaria_default
        : actual.tarifa_diaria_default,
    dominical: input.dominical !== undefined ? input.dominical : (actual.dominical ?? 0),
    synced: 0,
  };
  list[idx] = updated;
  saveList('trabajadores', list);
  return updated;
}

export async function webDesactivarTrabajador(id: string): Promise<void> {
  const list = await webObtenerTrabajadores(false);
  const idx = list.findIndex((t) => t.id === id);
  if (idx !== -1) {
    list[idx].activo = 0;
    saveList('trabajadores', list);
  }
}

export async function webActivarTrabajador(id: string): Promise<void> {
  const list = await webObtenerTrabajadores(false);
  const idx = list.findIndex((t) => t.id === id);
  if (idx !== -1) {
    list[idx].activo = 1;
    saveList('trabajadores', list);
  }
}

// ─── SEMANAS Y ASISTENCIA (WEB) ──────────────────────────────
export async function webObtenerOCrearSemanaParaFecha(fechaISO: string): Promise<Semana> {
  const fechaObj = new Date(fechaISO + 'T00:00:00');
  const fechaInicio = lunesDeSemana(fechaObj);
  const fechaFin = domingoDeSemana(fechaObj);

  const semanas = getList<Semana>('semanas');
  const existente = semanas.find((s) => s.fecha_inicio === fechaInicio);
  if (existente) return existente;

  const nueva: Semana = {
    id: 'sem_' + fechaInicio,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    estado: 'abierta',
    synced: 0,
  };
  semanas.push(nueva);
  saveList('semanas', semanas);
  return nueva;
}

export async function webObtenerSemanaPorId(id: string): Promise<Semana | null> {
  const semanas = getList<Semana>('semanas');
  return semanas.find((s) => s.id === id) || null;
}

export async function webObtenerSemanas(limite: number = 20): Promise<Semana[]> {
  const semanas = getList<Semana>('semanas');
  return semanas
    .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
    .slice(0, limite);
}

export async function webCerrarSemana(id: string): Promise<void> {
  const semanas = getList<Semana>('semanas');
  const idx = semanas.findIndex((s) => s.id === id);
  if (idx !== -1 && semanas[idx].estado === 'abierta') {
    semanas[idx].estado = 'cerrada';
    saveList('semanas', semanas);
  }
}

export async function webMarcarSemanaComoPagada(id: string): Promise<void> {
  const semanas = getList<Semana>('semanas');
  const idx = semanas.findIndex((s) => s.id === id);
  if (idx !== -1 && semanas[idx].estado === 'cerrada') {
    semanas[idx].estado = 'pagada';
    saveList('semanas', semanas);
  }
}

export async function webReabrirSemana(id: string): Promise<void> {
  const semanas = getList<Semana>('semanas');
  const idx = semanas.findIndex((s) => s.id === id);
  if (idx !== -1) {
    semanas[idx].estado = 'abierta';
    saveList('semanas', semanas);
  }
}

export async function webMarcarAsistencia(input: {
  semanaId: string;
  trabajadorId: string;
  fecha: string;
  presente: boolean;
  tarifaDiariaOverride?: number | null;
}): Promise<void> {
  const dias = getList<DiaTrabajado>('dias_trabajados');
  const idx = dias.findIndex(
    (d) =>
      d.semana_id === input.semanaId &&
      d.trabajador_id === input.trabajadorId &&
      d.fecha === input.fecha
  );

  const presenteInt = input.presente ? 1 : 0;
  const tarifaVal =
    typeof input.tarifaDiariaOverride === 'number' ? input.tarifaDiariaOverride : null;

  if (idx !== -1) {
    dias[idx].presente = presenteInt;
    dias[idx].tarifa_diaria = tarifaVal;
  } else {
    dias.push({
      id: uuid(),
      semana_id: input.semanaId,
      trabajador_id: input.trabajadorId,
      fecha: input.fecha,
      presente: presenteInt,
      tarifa_diaria: tarifaVal,
      synced: 0,
    });
  }
  saveList('dias_trabajados', dias);
}

export async function webObtenerAsistenciaSemanal(
  semanaId: string,
  trabajadorId?: string
): Promise<DiaTrabajado[]> {
  const dias = getList<DiaTrabajado>('dias_trabajados');
  return dias.filter((d) => {
    if (d.semana_id !== semanaId) return false;
    if (trabajadorId && d.trabajador_id !== trabajadorId) return false;
    return true;
  });
}

export async function webRegistrarAdelanto(input: CrearAdelantoDTO): Promise<Adelanto> {
  const list = getList<Adelanto>('adelantos');
  const nuevo: Adelanto = {
    id: uuid(),
    semana_id: input.semana_id,
    trabajador_id: input.trabajador_id,
    monto: input.monto,
    concepto: input.concepto || '',
    fecha: input.fecha || hoyISO(),
    revertido: 0,
    synced: 0,
  };
  list.push(nuevo);
  saveList('adelantos', list);
  return nuevo;
}

export async function webObtenerAdelantosSemana(
  semanaId: string,
  trabajadorId?: string
): Promise<Adelanto[]> {
  const list = getList<Adelanto>('adelantos');
  return list.filter((a) => {
    if (a.semana_id !== semanaId) return false;
    if (trabajadorId && a.trabajador_id !== trabajadorId) return false;
    return true;
  });
}

export async function webEliminarAdelanto(id: string): Promise<void> {
  const list = getList<Adelanto>('adelantos');
  const filtrados = list.filter((a) => a.id !== id);
  saveList('adelantos', filtrados);
}

export async function webRevertirAdelanto(id: string): Promise<void> {
  const list = getList<Adelanto>('adelantos');
  const idx = list.findIndex((a) => a.id === id);
  if (idx !== -1) {
    list[idx].revertido = 1;
    saveList('adelantos', list);
  }
}

export async function webObtenerResumenTrabajadorSemana(
  semanaId: string,
  trabajador: Trabajador
): Promise<ResultadoPagoSemanal> {
  const dias = await webObtenerAsistenciaSemanal(semanaId, trabajador.id);
  const adelantos = await webObtenerAdelantosSemana(semanaId, trabajador.id);
  return calcularPagoSemanal(dias, trabajador.tarifa_diaria_default, adelantos);
}

export async function webGuardarPeriodoCerrado(input: {
  tipo: 'semana' | 'mes' | 'año';
  fechaInicio: string;
  fechaFin: string;
  cajasCortadas: number;
  cajasEmpacadas: number;
  descarte: number;
  nominaBruta: number;
  adelantos: number;
  neto: number;
}): Promise<void> {
  const periodos = getList<PeriodoCerrado>('periodos_cerrados');
  periodos.push({
    id: uuid(),
    tipo: input.tipo,
    fecha_inicio: input.fechaInicio,
    fecha_fin: input.fechaFin,
    cajas_cortadas: input.cajasCortadas,
    cajas_empacadas: input.cajasEmpacadas,
    descarte: input.descarte,
    nomina_bruta: input.nominaBruta,
    adelantos: input.adelantos,
    neto: input.neto,
    fecha_cierre: new Date().toISOString(),
  });
  saveList('periodos_cerrados', periodos);
}

export async function webObtenerPeriodosCerrados(): Promise<PeriodoCerrado[]> {
  const periodos = getList<PeriodoCerrado>('periodos_cerrados');
  return periodos.sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
}

export async function webObtenerMetricasPeriodo(
  fechaInicio: string,
  fechaFin: string
): Promise<MetricasPeriodo> {
  const dias = getList<DiaTrabajado>('dias_trabajados');
  const trabajadores = await webObtenerTrabajadores(false);
  const cosechas = getList<Cosecha>('cosechas');

  const mapaTrabajadores = new Map(trabajadores.map((t) => [t.id, t]));
  const diasRango = dias.filter(
    (d) => d.fecha >= fechaInicio && d.fecha <= fechaFin && d.presente === 1
  );

  const conteoMap = new Map<string, { dias: number; totalGanado: number }>();
  for (const d of diasRango) {
    const t = mapaTrabajadores.get(d.trabajador_id);
    const tarifa = d.tarifa_diaria ?? t?.tarifa_diaria_default ?? 250;
    const actual = conteoMap.get(d.trabajador_id) || { dias: 0, totalGanado: 0 };
    actual.dias += 1;
    actual.totalGanado += tarifa;
    conteoMap.set(d.trabajador_id, actual);
  }

  const porTrabajador = Array.from(conteoMap.entries()).map(([tId, info]) => ({
    trabajador_id: tId,
    nombre: mapaTrabajadores.get(tId)?.nombre || 'Trabajador',
    dias_trabajados: info.dias,
    total_ganado: info.totalGanado,
  }));

  const nominaTotal = porTrabajador.reduce((acc, r) => acc + r.total_ganado, 0);
  const trabajadoresPresentes = conteoMap.size;

  const cosechasRango = cosechas.filter((c) => c.fecha >= fechaInicio && c.fecha <= fechaFin);
  const cajasCortadas = cosechasRango.reduce(
    (acc, c) => acc + (c.cajas_cortadas ?? c.cajasCortadas ?? 0),
    0
  );
  const cajasEmpacadas = cosechasRango.reduce(
    (acc, c) => acc + (c.cajas_empacadas ?? c.cajasEmpacadas ?? 0),
    0
  );
  const cajasDescarte = cosechasRango.reduce(
    (acc, c) => acc + (c.cajas_descarte ?? c.cajasDescarte ?? 0),
    0
  );
  const porcentajeAprovechable =
    cajasCortadas > 0 ? (cajasEmpacadas / cajasCortadas) * 100 : 0;

  return {
    nominaTotal,
    trabajadoresPresentes,
    cajasCortadas,
    cajasEmpacadas,
    cajasDescarte,
    porcentajeAprovechable,
    porTrabajador,
  };
}

// ─── LOTES (WEB) ─────────────────────────────────────────────
export async function webCrearLote(input: CrearLoteDTO): Promise<Lote> {
  const lotes = getList<Lote>('lotes');
  const nuevo: Lote = {
    id: uuid(),
    nombre: input.nombre.trim(),
    cultivo: input.cultivo.trim(),
    variedad: input.variedad ? input.variedad.trim() : null,
    fecha_siembra: input.fecha_siembra || null,
    estado: 'activo',
    creado_en: new Date().toISOString(),
  };
  lotes.push(nuevo);
  saveList('lotes', lotes);
  return nuevo;
}

export async function webObtenerLotes(soloActivos: boolean = true): Promise<Lote[]> {
  let lotes = getList<Lote>('lotes');
  if (lotes.length === 0) {
    lotes = [
      {
        id: 'lote_1',
        nombre: 'Lote Norte - Sandía',
        cultivo: 'Sandía',
        variedad: 'Mickey Lee',
        fecha_siembra: '2026-01-15',
        estado: 'activo',
        creado_en: new Date().toISOString(),
      },
      {
        id: 'lote_2',
        nombre: 'Lote Sur - Melón',
        cultivo: 'Melón',
        variedad: 'Cantaloupe',
        fecha_siembra: '2026-02-01',
        estado: 'activo',
        creado_en: new Date().toISOString(),
      },
    ];
    saveList('lotes', lotes);
  }
  const filtrados = soloActivos ? lotes.filter((l) => l.estado === 'activo') : lotes;
  return filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function webObtenerLotePorId(id: string): Promise<Lote | null> {
  const lotes = await webObtenerLotes(false);
  return lotes.find((l) => l.id === id) || null;
}

export async function webActualizarLote(
  id: string,
  input: Partial<CrearLoteDTO>
): Promise<Lote> {
  const lotes = await webObtenerLotes(false);
  const idx = lotes.findIndex((l) => l.id === id);
  if (idx === -1) throw new Error(`Lote con id ${id} no encontrado.`);

  const actual = lotes[idx];
  const updated: Lote = {
    ...actual,
    nombre: input.nombre !== undefined ? input.nombre.trim() : actual.nombre,
    cultivo: input.cultivo !== undefined ? input.cultivo.trim() : actual.cultivo,
    variedad: input.variedad !== undefined ? input.variedad : actual.variedad,
    fecha_siembra:
      input.fecha_siembra !== undefined ? input.fecha_siembra : actual.fecha_siembra,
  };
  lotes[idx] = updated;
  saveList('lotes', lotes);
  return updated;
}

export async function webCerrarLote(id: string): Promise<void> {
  const lotes = await webObtenerLotes(false);
  const idx = lotes.findIndex((l) => l.id === id);
  if (idx !== -1) {
    lotes[idx].estado = 'cerrado';
    saveList('lotes', lotes);
  }
}

// ─── COSECHAS (WEB) ──────────────────────────────────────────
export async function webRegistrarCosecha(input: CrearCosechaDTO): Promise<Cosecha> {
  const cosechas = getList<Cosecha>('cosechas');
  const cortadas = Math.max(0, input.cajas_cortadas || 0);
  const descarte = Math.max(0, input.cajas_descarte || 0);
  const empacadas =
    typeof input.cajas_empacadas === 'number'
      ? Math.max(0, input.cajas_empacadas)
      : Math.max(0, cortadas - descarte);

  const nueva: Cosecha = {
    id: uuid(),
    lote_id: input.lote_id,
    fecha: input.fecha || hoyISO(),
    cajas_cortadas: cortadas,
    cajas_descarte: descarte,
    cajas_empacadas: empacadas,
    synced: 0,
  };
  cosechas.push(nueva);
  saveList('cosechas', cosechas);
  return nueva;
}

export async function webObtenerCosechasPorLote(loteId: string): Promise<Cosecha[]> {
  const cosechas = getList<Cosecha>('cosechas');
  return cosechas
    .filter((c) => c.lote_id === loteId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function webObtenerResumenCosechaLote(loteId: string): Promise<ResumenCosecha> {
  const cosechas = await webObtenerCosechasPorLote(loteId);
  const totalCortadas = cosechas.reduce(
    (acc, c) => acc + (c.cajas_cortadas ?? c.cajasCortadas ?? 0),
    0
  );
  const totalDescarte = cosechas.reduce(
    (acc, c) => acc + (c.cajas_descarte ?? c.cajasDescarte ?? 0),
    0
  );
  const totalEmpacadas = cosechas.reduce(
    (acc, c) => acc + (c.cajas_empacadas ?? c.cajasEmpacadas ?? 0),
    0
  );
  return { totalCortadas, totalDescarte, totalEmpacadas };
}

export async function webEliminarCosecha(id: string): Promise<void> {
  const cosechas = getList<Cosecha>('cosechas');
  const filtrados = cosechas.filter((c) => c.id !== id);
  saveList('cosechas', filtrados);
}

export async function webObtenerResumenCosechasRango(
  fechaInicio: string,
  fechaFin: string
): Promise<ResumenCosecha> {
  const cosechas = getList<Cosecha>('cosechas');
  const enRango = cosechas.filter((c) => c.fecha >= fechaInicio && c.fecha <= fechaFin);
  return {
    totalCortadas: enRango.reduce(
      (acc, c) => acc + (c.cajas_cortadas ?? c.cajasCortadas ?? 0),
      0
    ),
    totalDescarte: enRango.reduce(
      (acc, c) => acc + (c.cajas_descarte ?? c.cajasDescarte ?? 0),
      0
    ),
    totalEmpacadas: enRango.reduce(
      (acc, c) => acc + (c.cajas_empacadas ?? c.cajasEmpacadas ?? 0),
      0
    ),
  };
}

export async function webObtenerAcumuladosCosecha(): Promise<{
  estaSemana: number;
  esteMes: number;
  esteAno: number;
}> {
  const cosechas = getList<Cosecha>('cosechas');
  const hoy = new Date();
  const inicioSemana = lunesDeSemana(hoy);
  const finSemana = domingoDeSemana(hoy);
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const inicioMes = `${y}-${m}-01`;
  const finMes = `${y}-${m}-31`;
  const inicioAno = `${y}-01-01`;
  const finAno = `${y}-12-31`;

  const total = (filtro: (c: Cosecha) => boolean) =>
    cosechas
      .filter(filtro)
      .reduce((acc, c) => acc + (c.cajas_cortadas ?? c.cajasCortadas ?? 0), 0);

  return {
    estaSemana: total((c) => c.fecha >= inicioSemana && c.fecha <= finSemana),
    esteMes: total((c) => c.fecha >= inicioMes && c.fecha <= finMes),
    esteAno: total((c) => c.fecha >= inicioAno && c.fecha <= finAno),
  };
}

// ─── GASTOS (WEB) ────────────────────────────────────────────
export async function webRegistrarGasto(input: CrearGastoDTO): Promise<Gasto> {
  const gastos = getList<Gasto>('gastos');
  const nuevo: Gasto = {
    id: uuid(),
    fecha: input.fecha || hoyISO(),
    categoria: input.categoria,
    descripcion: input.descripcion ? input.descripcion.trim() : null,
    monto: Math.max(0, input.monto || 0),
  };
  gastos.push(nuevo);
  saveList('gastos', gastos);
  return nuevo;
}

export async function webObtenerGastos(filtro?: {
  lote_id?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}): Promise<Gasto[]> {
  const gastos = getList<Gasto>('gastos');
  return gastos
    .filter((g) => {
      if (filtro?.fecha_inicio && g.fecha < filtro.fecha_inicio) return false;
      if (filtro?.fecha_fin && g.fecha > filtro.fecha_fin) return false;
      return true;
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function webObtenerTotalGastos(_loteId?: string): Promise<number> {
  const gastos = getList<Gasto>('gastos');
  return gastos.reduce((acc, g) => acc + (g.monto || 0), 0);
}

export async function webEliminarGasto(id: string): Promise<void> {
  const gastos = getList<Gasto>('gastos');
  const filtrados = gastos.filter((g) => g.id !== id);
  saveList('gastos', filtrados);
}
