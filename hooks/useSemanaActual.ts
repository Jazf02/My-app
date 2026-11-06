// hooks/useSemanaActual.ts — Fase 2 implementa
// Esqueleto Fase 1.

export interface UseSemanaActualResult {
  semanaId: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: 'abierta' | 'pagada' | null;
  isLoading: boolean;
}

export function useSemanaActual(): UseSemanaActualResult {
  // TODO Fase 2
  return {
    semanaId: null,
    fechaInicio: null,
    fechaFin: null,
    estado: null,
    isLoading: false,
  };
}
