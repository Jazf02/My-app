// hooks/useResumenSemanal.ts — Fase 2 implementa
// Esqueleto Fase 1.

import type { ResumenSemana } from '@/types';

export interface UseResumenSemanalResult {
  resumen: ResumenSemana | null;
  isLoading: boolean;
}

export function useResumenSemanal(
  _trabajadorId: string | null
): UseResumenSemanalResult {
  // TODO Fase 2
  return { resumen: null, isLoading: false };
}
