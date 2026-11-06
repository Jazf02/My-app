// lib/rendimiento.ts — Motor de cálculo de rendimiento y margen agronómico por lote
import { obtenerResumenCosechaLote } from '@/database/cosechas';
import { obtenerTotalGastos } from '@/database/gastos';

export interface ResumenRendimientoLote {
  totalCortadas: number;
  totalDescarte: number;
  totalEmpacadas: number;
  totalGastos: number;
  ingresoEstimado: number;
  margenEstimado: number;
  porcentajeEficienciaEmpaque: number;
}

/**
 * Calcula el rendimiento agronómico y el margen financiero estimado de un lote.
 * 
 * @param loteId ID del lote en SQLite.
 * @param precioPorCajaEstimado Precio estimado por caja empacada en Lempiras (L).
 */
export async function calcularRendimientoLote(
  loteId: string,
  precioPorCajaEstimado: number = 0
): Promise<ResumenRendimientoLote> {
  const cosecha = await obtenerResumenCosechaLote(loteId);
  const totalGastos = await obtenerTotalGastos(loteId);

  const ingresoEstimado = cosecha.totalEmpacadas * Math.max(0, precioPorCajaEstimado);
  const margenEstimado = ingresoEstimado - totalGastos;
  const porcentajeEficienciaEmpaque = cosecha.totalCortadas > 0
    ? (cosecha.totalEmpacadas / cosecha.totalCortadas) * 100
    : 0;

  return {
    totalCortadas: cosecha.totalCortadas,
    totalDescarte: cosecha.totalDescarte,
    totalEmpacadas: cosecha.totalEmpacadas,
    totalGastos,
    ingresoEstimado,
    margenEstimado,
    porcentajeEficienciaEmpaque: Math.round(porcentajeEficienciaEmpaque * 100) / 100,
  };
}
