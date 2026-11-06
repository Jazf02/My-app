// ═══════════════════════════════════════════════════════════
// sync/status.ts — Estado de sincronización (esqueleto Fase 1)
// Fase 5 implementa la lógica completa.
// ═══════════════════════════════════════════════════════════

import type { EstadoSync } from '@/types';

// Estado actual de sync (por ahora siempre offline)
let _estadoActual: EstadoSync = 'offline';
let _listeners: Array<(estado: EstadoSync) => void> = [];

/**
 * Obtiene el estado actual de sincronización.
 */
export function getEstadoSync(): EstadoSync {
  return _estadoActual;
}

/**
 * Actualiza el estado de sincronización y notifica a los listeners.
 * Fase 5 llama a esta función desde backup/restore.
 */
export function setEstadoSync(estado: EstadoSync): void {
  _estadoActual = estado;
  _listeners.forEach((fn) => fn(estado));
}

/**
 * Suscribe a cambios de estado de sync.
 * Devuelve función para desuscribirse.
 */
export function suscribirEstadoSync(
  callback: (estado: EstadoSync) => void
): () => void {
  _listeners.push(callback);
  return () => {
    _listeners = _listeners.filter((fn) => fn !== callback);
  };
}
