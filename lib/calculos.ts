// lib/calculos.ts — Lógica de negocio y motor de cálculo de planillas para AgroGámez
import type { DiaTrabajado, Adelanto, ResumenSemana, Asistencia, ResumenCosecha, Cosecha } from '@/types/domain';

export interface ResultadoPagoSemanal {
  diasPresentes: number;
  diasAusentes: number;
  totalGanado: number;
  totalAdelantos: number;
  totalAPagar: number;
}

/**
 * Calcula el desglose de pago semanal para un trabajador.
 * 
 * Reglas de negocio:
 * 1. Cada día presente suma la tarifa del día (si hay override `tarifa_diaria`) o la `tarifaDiariaDefault`.
 * 2. Los días ausentes no suman al total ganado.
 * 3. Se restan todos los adelantos registrados en la semana.
 * 4. El `totalAPagar` nunca es menor a 0.
 */
export function calcularPagoSemanal(
  diasTrabajados: Partial<DiaTrabajado>[],
  tarifaDiariaDefault: number,
  adelantos: Partial<Adelanto>[]
): ResultadoPagoSemanal {
  let diasPresentes = 0;
  let diasAusentes = 0;
  let totalGanado = 0;

  for (const dia of diasTrabajados) {
    const esPresente = Boolean(dia.presente);
    if (esPresente) {
      diasPresentes++;
      const tarifa = typeof dia.tarifa_diaria === 'number' && dia.tarifa_diaria > 0
        ? dia.tarifa_diaria
        : tarifaDiariaDefault;
      totalGanado += tarifa;
    } else {
      diasAusentes++;
    }
  }

  const totalAdelantos = adelantos.reduce((acc, ad) => {
    if (ad.revertido === 1) return acc;
    const monto = typeof ad.monto === 'number' ? ad.monto : 0;
    return acc + (monto > 0 ? monto : 0);
  }, 0);

  const totalAPagar = Math.max(0, totalGanado - totalAdelantos);

  return {
    diasPresentes,
    diasAusentes,
    totalGanado,
    totalAdelantos,
    totalAPagar,
  };
}

/**
 * Función legacy/compatibilidad de resumen semanal
 */
export function calcularSemana(
  sueldoBase: number,
  registros: Asistencia[]
): ResumenSemana {
  const diasTrabajadosCount = registros.filter((r) => r.asistio).length;
  const totalGanado = diasTrabajadosCount * sueldoBase;

  return {
    diasTrabajados: diasTrabajadosCount,
    totalGanado,
    totalAdelantos: 0,
    totalNeto: totalGanado,
    detalle: [],
  };
}

/**
 * Función de resumen de cosecha (Fase 3)
 */
export function calcularCosecha(registros: Cosecha[]): ResumenCosecha {
  const totalCortadas = registros.reduce((acc, r) => acc + (r.cajasCortadas || 0), 0);
  const totalDescarte = registros.reduce((acc, r) => acc + (r.cajasDescarte || 0), 0);
  const totalEmpacadas = registros.reduce((acc, r) => acc + (r.cajasEmpacadas || 0), 0);

  return {
    totalCortadas,
    totalDescarte,
    totalEmpacadas,
  };
}
