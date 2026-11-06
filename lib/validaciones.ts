// lib/validaciones.ts — Validaciones de negocio para AgroGámez

export interface ResultadoValidacion {
  valido: boolean;
  warning: string | null;
  error: string | null;
}

/**
 * Valida el nombre de un trabajador.
 */
export function validarNombreTrabajador(nombre: string): ResultadoValidacion {
  const limpio = nombre ? nombre.trim() : '';
  if (!limpio || limpio.length < 2) {
    return {
      valido: false,
      warning: null,
      error: 'El nombre debe tener al menos 2 caracteres',
    };
  }
  return { valido: true, warning: null, error: null };
}

/**
 * Valida la tarifa diaria por defecto de un trabajador.
 */
export function validarTarifaDiaria(tarifa: number): ResultadoValidacion {
  if (isNaN(tarifa) || tarifa < 0) {
    return {
      valido: false,
      warning: null,
      error: 'La tarifa diaria debe ser un número mayor o igual a 0',
    };
  }
  return { valido: true, warning: null, error: null };
}

/**
 * Valida un monto genérico (por ejemplo para un pago o adelanto).
 */
export function validacionMonto(valor: number): ResultadoValidacion {
  if (isNaN(valor) || valor < 0) {
    return {
      valido: false,
      warning: null,
      error: 'El monto no puede ser negativo',
    };
  }
  return { valido: true, warning: null, error: null };
}

/**
 * Valida la solicitud de un adelanto comparándola con lo ganado hasta la fecha.
 * Si el adelanto supera lo ganado, emite un aviso (warning) sin bloquear la transacción.
 */
export function validacionAdelanto(
  adelanto: number,
  ganado: number
): ResultadoValidacion {
  if (isNaN(adelanto) || adelanto <= 0) {
    return {
      valido: false,
      warning: null,
      error: 'El monto del adelanto debe ser mayor a 0',
    };
  }

  if (adelanto > ganado) {
    return {
      valido: true,
      warning: 'El adelanto excede lo ganado en la semana',
      error: null,
    };
  }

  return { valido: true, warning: null, error: null };
}

/**
 * Valida una tarifa diaria u override de tarifa.
 */
export function validacionTarifa(
  tarifa: number,
  _sueldoBase?: number
): ResultadoValidacion {
  if (isNaN(tarifa) || tarifa < 0) {
    return {
      valido: false,
      warning: null,
      error: 'La tarifa no puede ser negativa',
    };
  }
  return { valido: true, warning: null, error: null };
}
