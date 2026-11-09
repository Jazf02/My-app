import { Linking, Share, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { formatearMoneda, formatearFechaCorta, hoyISO } from './fechas';
import type { ResultadoPagoSemanal } from './calculos';
import type { ResumenRendimientoLote } from './rendimiento';
import type { Semana, Trabajador, Lote, Cosecha, Gasto, DiaTrabajado, Adelanto } from '@/types/domain';

export interface ItemPlanillaExport {
  trabajador: Trabajador;
  calculo: ResultadoPagoSemanal;
}

/**
 * Genera el texto en formato legible con emojis para compartir por WhatsApp la planilla semanal.
 */
export function generarTextoWhatsAppSemana(
  semana: Semana,
  resumenes: ItemPlanillaExport[]
): string {
  const inicio = formatearFechaCorta(semana.fecha_inicio);
  const fin = formatearFechaCorta(semana.fecha_fin);

  let texto = `🌾 *AGROGÁMEZ — Planilla Semanal de Pago* 🌾\n`;
  texto += `📅 *Semana:* ${inicio} al ${fin}\n`;
  texto += `----------------------------------------\n\n`;

  let granTotalGanado = 0;
  let granTotalAdelantos = 0;
  let granTotalAPagar = 0;

  resumenes.forEach((item, index) => {
    const { trabajador, calculo } = item;
    granTotalGanado += calculo.totalGanado;
    granTotalAdelantos += calculo.totalAdelantos;
    granTotalAPagar += calculo.totalAPagar;

    texto += `${index + 1}. *${trabajador.nombre}*\n`;
    texto += `   • Días trabajados: ${calculo.diasPresentes} día(s)\n`;
    texto += `   • Total ganado: ${formatearMoneda(calculo.totalGanado)}\n`;
    if (calculo.totalAdelantos > 0) {
      texto += `   • Adelantos: -${formatearMoneda(calculo.totalAdelantos)}\n`;
    }
    texto += `   👉 *Neto a pagar: ${formatearMoneda(calculo.totalAPagar)}*\n\n`;
  });

  texto += `----------------------------------------\n`;
  texto += `💰 *TOTALES CONSOLIDADOS PLANILLA:*\n`;
  texto += `• Total Ganado: ${formatearMoneda(granTotalGanado)}\n`;
  texto += `• Total Adelantos: -${formatearMoneda(granTotalAdelantos)}\n`;
  texto += `💵 *GRAN TOTAL A PAGAR: ${formatearMoneda(granTotalAPagar)}*\n`;
  texto += `----------------------------------------\n`;
  texto += `_Reporte generado automáticamente por AgroGámez App._`;

  return texto;
}

/**
 * Abre la app de WhatsApp con el mensaje formateado.
 * Compatible con iOS Safari, PWA pantalla de inicio, Android y PC Web.
 */
export async function compartirPorWhatsApp(mensaje: string): Promise<boolean> {
  const urlUniversal = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const opened = window.open(urlUniversal, '_blank');
      if (opened) return true;
      window.location.href = urlUniversal;
      return true;
    } catch {
      window.location.href = urlUniversal;
      return true;
    }
  }

  try {
    const urlApp = `whatsapp://send?text=${encodeURIComponent(mensaje)}`;
    const puedeAbrir = await Linking.canOpenURL(urlApp);
    if (puedeAbrir) {
      await Linking.openURL(urlApp);
      return true;
    }
  } catch {}

  try {
    await Linking.openURL(urlUniversal);
    return true;
  } catch (error) {
    console.error('Error al intentar abrir WhatsApp:', error);
    return false;
  }
}

/**
 * Copia texto directamente al portapapeles en cualquier navegador o entorno web.
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {}
  }

  // Fallback con elemento textarea para navegadores que restringen clipboard API
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = texto;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copiado = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copiado;
    } catch {}
  }

  return false;
}

/**
 * Invoca el menú nativo de Compartir del sistema operativo (iOS Share Sheet / Android Share / Web Share API).
 * Permite enviar por WhatsApp, Correo, Mensajes, AirDrop o Guardar en Archivos.
 */
export async function compartirReporteNativo({
  titulo,
  texto,
  contenidoCSV,
  nombreArchivo,
}: {
  titulo: string;
  texto: string;
  contenidoCSV?: string;
  nombreArchivo?: string;
}): Promise<{ compartido: boolean; error?: string }> {
  // 1. Web Share API (Safari iOS PWA, Android Chrome, Edge)
  if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
    try {
      // Si hay archivo CSV y el navegador soporta compartir archivos reales
      if (
        contenidoCSV &&
        typeof (navigator as any).canShare === 'function' &&
        typeof File !== 'undefined'
      ) {
        const file = new File([contenidoCSV], nombreArchivo || 'Reporte_AgroGamez.csv', {
          type: 'text/csv;charset=utf-8;',
        });
        if ((navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({
            title: titulo,
            text: texto,
            files: [file],
          });
          return { compartido: true };
        }
      }

      // Compartir texto si no soporta archivos directamente
      await (navigator as any).share({
        title: titulo,
        text: texto,
      });
      return { compartido: true };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { compartido: true }; // Cancelado por el usuario deliberadamente
      }
      console.warn('[Exportar] Web Share Sheet cancelado o no disponible:', err);
    }
  }

  // 2. En dispositivos nativos (APK Android / iOS)
  if (Platform.OS !== 'web') {
    try {
      await Share.share({
        title: titulo,
        message: texto,
      });
      return { compartido: true };
    } catch (err: any) {
      return { compartido: false, error: err?.message };
    }
  }

  // 3. Si no hay share sheet disponible (ej. PC web tradicional), intentar copiar
  const copiado = await copiarAlPortapapeles(texto);
  return { compartido: copiado };
}

/**
 * Abre una ventana con el HTML listo para imprimir o guardar como PDF en cualquier dispositivo.
 */
export function imprimirReporteHTML(html: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const ventana = window.open('', '_blank');
    if (!ventana) return false;
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => {
      try {
        ventana.print();
      } catch {}
    }, 500);
    return true;
  } catch (err) {
    console.error('[Exportar] Error al imprimir:', err);
    return false;
  }
}

/**
 * Genera una plantilla HTML responsiva de la planilla semanal lista para convertir a PDF o imprimir.
 */
export function generarHTMLPlanillaSemanal(
  semana: Semana,
  resumenes: ItemPlanillaExport[]
): string {
  const inicio = formatearFechaCorta(semana.fecha_inicio);
  const fin = formatearFechaCorta(semana.fecha_fin);

  let granTotalGanado = 0;
  let granTotalAdelantos = 0;
  let granTotalAPagar = 0;

  const filas = resumenes.map((item, idx) => {
    const { trabajador, calculo } = item;
    granTotalGanado += calculo.totalGanado;
    granTotalAdelantos += calculo.totalAdelantos;
    granTotalAPagar += calculo.totalAPagar;

    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: bold;">${trabajador.nombre}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${calculo.diasPresentes}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">${formatearMoneda(calculo.totalGanado)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #E53E3E;">-${formatearMoneda(calculo.totalAdelantos)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: bold; color: #2F855A;">${formatearMoneda(calculo.totalAPagar)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>AgroGámez — Planilla Semanal</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2D3748; margin: 20px; line-height: 1.5; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2F855A; padding-bottom: 15px; }
        .header h1 { margin: 0; color: #2F855A; font-size: 24px; }
        .header p { margin: 5px 0 0; color: #718096; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background-color: #F7FAFC; padding: 12px 10px; text-align: left; font-size: 12px; font-weight: bold; color: #4A5568; border-bottom: 2px solid #E2E8F0; }
        .totals { background-color: #EDF2F7; padding: 15px; border-radius: 8px; font-size: 14px; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
        .totals-grand { font-size: 18px; font-weight: bold; color: #2F855A; border-top: 1px solid #CBD5E0; padding-top: 8px; margin-top: 4px; }
        .footer { text-align: center; font-size: 11px; color: #A0AEC0; margin-top: 40px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🌾 AGROGÁMEZ</h1>
        <p>Comprobante de Planilla Semanal de Pago</p>
        <p><strong>Período:</strong> ${inicio} — ${fin}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th style="text-align: center;">#</th>
            <th>Trabajador</th>
            <th style="text-align: center;">Días</th>
            <th style="text-align: right;">Total Ganado</th>
            <th style="text-align: right;">Adelantos</th>
            <th style="text-align: right;">Neto a Pagar</th>
          </tr>
        </thead>
        <tbody>
          ${filas}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row"><span>Total Ganado:</span> <strong>${formatearMoneda(granTotalGanado)}</strong></div>
        <div class="totals-row"><span>Total Adelantos:</span> <strong style="color: #E53E3E;">-${formatearMoneda(granTotalAdelantos)}</strong></div>
        <div class="totals-row totals-grand"><span>Gran Total a Pagar:</span> <span>${formatearMoneda(granTotalAPagar)}</span></div>
      </div>

      <div class="footer">
        <p>Documento oficial generado por la aplicación AgroGámez — Almacenamiento Local Offline-First</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Genera una plantilla HTML para el reporte agronómico y financiero de un lote.
 */
export function generarHTMLReporteLote(
  lote: Lote,
  rendimiento: ResumenRendimientoLote,
  cosechas: Cosecha[],
  gastos: Gasto[]
): string {
  const filasCosecha = cosechas.map((c) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${formatearFechaCorta(c.fecha)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; text-align: right;">${c.cajas_cortadas ?? c.cajasCortadas ?? 0}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #E53E3E;">${c.cajas_descarte ?? c.cajasDescarte ?? 0}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: bold; color: #2F855A;">${c.cajas_empacadas ?? c.cajasEmpacadas ?? 0}</td>
    </tr>
  `).join('');

  const filasGastos = gastos.map((g) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${formatearFechaCorta(g.fecha)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${g.categoria}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E2E8F0;">${g.descripcion || '-'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: bold;">${formatearMoneda(g.monto)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte Agronómico — ${lote.nombre}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2D3748; margin: 20px; line-height: 1.5; }
        .header { text-align: center; border-bottom: 2px solid #2F855A; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #2F855A; }
        .card-grid { display: flex; gap: 15px; margin-bottom: 25px; }
        .card { flex: 1; background-color: #F7FAFC; border: 1px solid #E2E8F0; padding: 15px; border-radius: 8px; text-align: center; }
        .card-val { font-size: 20px; font-weight: bold; color: #2B6CB0; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        th { background-color: #EDF2F7; padding: 10px; text-align: left; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🌾 AGROGÁMEZ — Reporte de Lote</h1>
        <h2>${lote.nombre} (${lote.cultivo}${lote.variedad ? ' - ' + lote.variedad : ''})</h2>
        <p>Estado: <strong>${lote.estado.toUpperCase()}</strong></p>
      </div>

      <div class="card-grid">
        <div class="card">
          <div>Empacadas</div>
          <div class="card-val" style="color: #2F855A;">${rendimiento.totalEmpacadas} cajas</div>
        </div>
        <div class="card">
          <div>Eficiencia</div>
          <div class="card-val">${rendimiento.porcentajeEficienciaEmpaque}%</div>
        </div>
        <div class="card">
          <div>Total Gastos</div>
          <div class="card-val" style="color: #E53E3E;">${formatearMoneda(rendimiento.totalGastos)}</div>
        </div>
        <div class="card">
          <div>Margen Net. Estimado</div>
          <div class="card-val">${formatearMoneda(rendimiento.margenEstimado)}</div>
        </div>
      </div>

      <h3>📦 Registro de Cosechas</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th style="text-align: right;">Cortadas</th>
            <th style="text-align: right;">Descarte</th>
            <th style="text-align: right;">Empacadas</th>
          </tr>
        </thead>
        <tbody>
          ${filasCosecha || '<tr><td colspan="4" style="text-align:center; padding:10px;">Sin registros de cosecha</td></tr>'}
        </tbody>
      </table>

      <h3>💵 Registro de Gastos e Insumos</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Categoría</th>
            <th>Descripción</th>
            <th style="text-align: right;">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${filasGastos || '<tr><td colspan="4" style="text-align:center; padding:10px;">Sin registros de gastos</td></tr>'}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

// Compatibilidad con funciones base legacy
export function generarTextoWhatsApp(resumen: unknown): string {
  if (resumen && typeof resumen === 'object' && 'semana' in resumen && 'resumenes' in resumen) {
    const r = resumen as { semana: Semana; resumenes: ItemPlanillaExport[] };
    return generarTextoWhatsAppSemana(r.semana, r.resumenes);
  }
  return 'Planilla de pago AgroGámez';
}

export async function generarPDF(resumen: unknown): Promise<string> {
  if (resumen && typeof resumen === 'object' && 'semana' in resumen && 'resumenes' in resumen) {
    const r = resumen as { semana: Semana; resumenes: ItemPlanillaExport[] };
    return generarHTMLPlanillaSemanal(r.semana, r.resumenes);
  }
  return '<html><body><h1>AgroGámez Document</h1></body></html>';
}

// ─── MEJORA 9: Exportación Completa (6 Secciones) ─────────────
export interface ExportarCompletoInput {
  semana: Semana;
  trabajadores: Trabajador[];
  diasTrabajados: DiaTrabajado[];
  adelantos: Adelanto[];
  resumenes: ItemPlanillaExport[];
  cosecha: {
    cortadas: number;
    empacadas: number;
    descarte: number;
  };
}

/**
 * Genera el archivo CSV con las 6 secciones requeridas por MEJORA 9.
 */
export function generarReporteCompletoCSV(input: ExportarCompletoInput): string {
  const { semana, trabajadores, diasTrabajados, adelantos, resumenes, cosecha } = input;

  // Formato periodo exacto: "Semana 19-25 oct"
  const dIni = new Date(semana.fecha_inicio + 'T00:00:00');
  const dFin = new Date(semana.fecha_fin + 'T00:00:00');
  const mesStr = dIni.toLocaleDateString('es-HN', { month: 'short' });
  const periodoStr = `Semana ${dIni.getDate()}-${dFin.getDate()} ${mesStr}`;
  const hoyStr = hoyISO();

  let csv = `=== 1. ENCABEZADO ===\n`;
  csv += `Periodo,${periodoStr}\n`;
  csv += `Fecha de Exportacion,${hoyStr}\n\n`;

  csv += `=== 2. TABLA DE ASISTENCIA ===\n`;
  csv += `Trabajador,Fecha,Estado,Monto\n`;
  diasTrabajados.forEach((d) => {
    const t = trabajadores.find((x) => x.id === d.trabajador_id);
    const nombre = t?.nombre || d.trabajador_id;
    const estado = d.presente === 1 ? 'Presente' : 'Ausente';
    const monto = d.presente === 1 ? (d.tarifa_diaria ?? t?.tarifa_diaria_default ?? 250) : 0;
    csv += `"${nombre}",${d.fecha},${estado},${monto.toFixed(2)}\n`;
  });
  csv += `\n`;

  csv += `=== 3. TABLA DE ADELANTOS ===\n`;
  csv += `Trabajador,Fecha,Monto,Nota,Estado\n`;
  adelantos.forEach((ad) => {
    const t = trabajadores.find((x) => x.id === ad.trabajador_id);
    const nombre = t?.nombre || ad.trabajador_id;
    const estadoAd = ad.revertido === 1 ? 'Revertido' : 'Activo';
    csv += `"${nombre}",${ad.fecha},${ad.monto.toFixed(2)},"${ad.concepto || 'Adelanto'}",${estadoAd}\n`;
  });
  csv += `\n`;

  csv += `=== 4. RESUMEN POR TRABAJADOR ===\n`;
  csv += `Trabajador,Dias Trabajados,Bruto,Adelantos,Neto\n`;
  let totalBruto = 0;
  let totalAdel = 0;
  let totalNeto = 0;
  resumenes.forEach((r) => {
    totalBruto += r.calculo.totalGanado;
    totalAdel += r.calculo.totalAdelantos;
    totalNeto += r.calculo.totalAPagar;
    csv += `"${r.trabajador.nombre}",${r.calculo.diasPresentes},${r.calculo.totalGanado.toFixed(2)},${r.calculo.totalAdelantos.toFixed(2)},${r.calculo.totalAPagar.toFixed(2)}\n`;
  });
  csv += `\n`;

  csv += `=== 5. PRODUCCION DE COSECHA ===\n`;
  csv += `Cajas Cortadas,Cajas Empacadas,Cajas Descarte,% Aprovechable\n`;
  const porcAprovechable =
    cosecha.cortadas > 0
      ? ((cosecha.empacadas / cosecha.cortadas) * 100).toFixed(1) + '%'
      : '0.0%';
  csv += `${cosecha.cortadas},${cosecha.empacadas},${cosecha.descarte},${porcAprovechable}\n\n`;

  csv += `=== 6. TOTALES GENERALES ===\n`;
  csv += `Nomina Bruta,Total Adelantos,Total Neto\n`;
  csv += `${totalBruto.toFixed(2)},${totalAdel.toFixed(2)},${totalNeto.toFixed(2)}\n`;

  return csv;
}

/**
 * Guarda el archivo CSV en el sistema de archivos local y lo comparte.
 */
export async function guardarYCompartirReporteCSV(input: ExportarCompletoInput): Promise<string> {
  const contenido = generarReporteCompletoCSV(input);
  const nombreArchivo = `Reporte_${input.semana.fecha_inicio}.csv`;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nombreArchivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
    return nombreArchivo;
  }

  const docDir = (FileSystem as any).documentDirectory || '';
  const rutaCompleta = `${docDir}${nombreArchivo}`;

  if (docDir) {
    await FileSystem.writeAsStringAsync(rutaCompleta, contenido, {
      encoding: (FileSystem as any).EncodingType?.UTF8 || 'utf8',
    });
  }

  try {
    await Share.share({
      title: `Reporte ${input.semana.fecha_inicio}`,
      message: contenido,
      url: rutaCompleta,
    });
  } catch (err) {
    console.warn('[Exportar] Aviso al compartir:', err);
  }

  return rutaCompleta;
}
