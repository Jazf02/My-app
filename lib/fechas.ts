// lib/fechas.ts — Utilidades de fechas para AgroGámez
// Usa solo APIs nativas de JS (no dependencias externas).

/**
 * Retorna la fecha de hoy en formato YYYY-MM-DD.
 */
export function hoyISO(): string {
  const hoy = new Date();
  return fechaToISO(hoy);
}

/**
 * Convierte un Date a string YYYY-MM-DD en hora local.
 */
export function fechaToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna el número de semana ISO de una fecha.
 */
export function semanaISO(date: Date): number {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  // Jueves de la semana actual (ISO 8601 ancla en jueves)
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const primerSemana = new Date(tmp.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((tmp.getTime() - primerSemana.getTime()) / 86400000 -
        3 +
        ((primerSemana.getDay() + 6) % 7)) /
        7
    )
  );
}

/**
 * Retorna el lunes de la semana de la fecha dada (formato YYYY-MM-DD).
 */
export function lunesDeSemana(date: Date): string {
  const tmp = new Date(date.getTime());
  const dia = tmp.getDay(); // 0=Dom, 1=Lun, ...
  const diff = dia === 0 ? -6 : 1 - dia;
  tmp.setDate(tmp.getDate() + diff);
  return fechaToISO(tmp);
}

/**
 * Retorna el domingo de la semana de la fecha dada (formato YYYY-MM-DD).
 */
export function domingoDeSemana(date: Date): string {
  const tmp = new Date(date.getTime());
  const dia = tmp.getDay();
  const diff = dia === 0 ? 0 : 7 - dia;
  tmp.setDate(tmp.getDate() + diff);
  return fechaToISO(tmp);
}

/**
 * Formatea una fecha YYYY-MM-DD como "Lun 6 Oct".
 */
export function formatearFechaCorta(iso: string): string {
  const date = new Date(iso + 'T00:00:00');
  return date.toLocaleDateString('es-HN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Nombres de días de la semana en español (Lun → Dom).
 */
export const DIAS_SEMANA = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

/**
 * Formatea un monto numérico a formato de Lempiras hondureñas (ej. L. 1,250.00).
 */
export function formatearMoneda(monto: number): string {
  const num = isNaN(monto) ? 0 : monto;
  return `L. ${num.toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

