import { Linking, Share, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { jsPDF } from 'jspdf';
import { esComputadoraWeb } from './dispositivo';
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
 * Previene que la PWA de iOS se congele o descargue la vista.
 */
export async function compartirPorWhatsApp(mensaje: string): Promise<boolean> {
  const urlUniversal = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const esStandalone =
        Boolean(
          (window.navigator as any)?.standalone === true ||
          (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
        );

      // En iOS PWA en pantalla de inicio, usar whatsapp:// mediante link seguro
      if (esStandalone) {
        const a = document.createElement('a');
        a.href = `whatsapp://send?text=${encodeURIComponent(mensaje)}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try {
            document.body.removeChild(a);
          } catch {}
        }, 500);
        return true;
      }

      // En navegador estándar (Chrome, Safari, Edge)
      const opened = window.open(urlUniversal, '_blank', 'noopener,noreferrer');
      if (opened) return true;

      // Fallback con elemento <a> sin reescribir window.location.href
      const a = document.createElement('a');
      a.href = urlUniversal;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch {}
      }, 500);
      return true;
    } catch (e) {
      console.warn('[WhatsApp] Error al abrir:', e);
      return false;
    }
  }

  // En Android nativo o iOS nativo
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
 * Protegido contra bloqueos y congelamientos en iOS PWA.
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
      const esStandalone =
        typeof window !== 'undefined' &&
        Boolean(
          (window.navigator as any)?.standalone === true ||
          (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
        );

      // En iOS PWA no pasar archivos Blob crudos para evitar que WebKit congele la memoria
      if (
        !esStandalone &&
        contenidoCSV &&
        typeof (navigator as any).canShare === 'function' &&
        typeof File !== 'undefined'
      ) {
        try {
          const file = new File([contenidoCSV], nombreArchivo || 'Reporte_AgroGamez.csv', {
            type: 'text/csv;charset=utf-8;',
          });
          if ((navigator as any).canShare({ files: [file] })) {
            await (navigator as any).share({
              title: titulo,
              files: [file],
            });
            if (typeof window !== 'undefined' && window.focus) window.focus();
            return { compartido: true };
          }
        } catch {
          // Continuar con compartir texto si falla el archivo
        }
      }

      // Compartir texto de forma limpia y confiable
      await (navigator as any).share({
        title: titulo,
        text: texto,
      });

      // Restaurar el foco en el viewport para prevenir touch events bloqueados
      if (typeof window !== 'undefined' && window.focus) {
        window.focus();
      }

      return { compartido: true };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { compartido: true }; // Cancelación normal del usuario
      }
      console.warn('[Exportar] Web Share cancelado o no disponible:', err);
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

  // 3. Fallback en PC: copiar al portapapeles
  const copiado = await copiarAlPortapapeles(texto);
  return { compartido: copiado };
}

/**
 * Interfaz para la generación directa de archivos PDF de planilla
 */
export interface InputPDFPeriodo {
  periodoEtiqueta: string;
  fechaInicio?: string;
  fechaFin?: string;
  resumenes: ItemPlanillaExport[];
  cosecha?: { cortadas: number; empacadas: number; descarte: number };
  nombreArchivo?: string;
}

/**
 * Genera un archivo PDF vectorial oficial de AgroGámez y lo descarga o comparte.
 * Utiliza jsPDF sin popups ni llamadas a window.print, garantizando 0% de congelamiento en iOS PWA y Android.
 */
export async function generarYGuardarPDFPeriodo(
  input: InputPDFPeriodo
): Promise<{ exito: boolean; nombreArchivo: string }> {
  const { periodoEtiqueta, fechaInicio, fechaFin, resumenes, cosecha } = input;
  const etiquetaLimpia = (periodoEtiqueta || 'Periodo')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  const nombreArchivo = input.nombreArchivo || `AgroGamez_Planilla_${etiquetaLimpia}.pdf`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Encabezado Superior Corporativo Verde
  doc.setFillColor(27, 94, 32); // #1B5E20
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('AGROGÁMEZ', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Sistema Integral Agrícola — Comprobante Oficial de Nómina', 14, 18);

  let y = 32;

  // Título y Período
  doc.setTextColor(27, 94, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Comprobante de Planilla: ${periodoEtiqueta}`, 14, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const rangoFechas = fechaInicio && fechaFin ? `Rango: ${fechaInicio} al ${fechaFin}   |   ` : '';
  doc.text(`${rangoFechas}Emisión: ${new Date().toLocaleString()}`, 14, y);
  y += 8;

  // Si hay datos de cosecha registrados, imprimir resumen de producción
  if (cosecha && (cosecha.cortadas > 0 || cosecha.empacadas > 0 || cosecha.descarte > 0)) {
    doc.setFillColor(240, 253, 244); // #F0FDF4
    doc.setDrawColor(187, 247, 208); // #BBF7D0
    doc.roundedRect(14, y, pageWidth - 28, 12, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(22, 101, 52);
    doc.text('Producción Agrícola Registrada:', 18, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.text(
      `Cortadas: ${cosecha.cortadas} cajas   |   Empacadas: ${cosecha.empacadas} cajas   |   Descarte: ${cosecha.descarte} cajas`,
      18,
      y + 9.5
    );
    y += 16;
  }

  // Encabezado de la Tabla
  doc.setFillColor(240, 244, 240);
  doc.rect(14, y, pageWidth - 28, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(27, 94, 32);
  doc.text('#', 16, y + 5);
  doc.text('Trabajador', 24, y + 5);
  doc.text('Días', 85, y + 5);
  doc.text('Ganado Bruto', 110, y + 5);
  doc.text('Adelantos', 142, y + 5);
  doc.text('Neto a Pagar', 172, y + 5);
  y += 8;

  let granTotalGanado = 0;
  let granTotalAdelantos = 0;
  let granTotalAPagar = 0;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);

  resumenes.forEach((item, i) => {
    const { trabajador, calculo } = item;
    granTotalGanado += calculo.totalGanado;
    granTotalAdelantos += calculo.totalAdelantos;
    granTotalAPagar += calculo.totalAPagar;

    if (y > pageHeight - 32) {
      doc.addPage();
      // Encabezado de página adicional
      doc.setFillColor(27, 94, 32);
      doc.rect(0, 0, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`AGROGÁMEZ — ${periodoEtiqueta} (continuación)`, 14, 8);

      y = 18;
      doc.setFillColor(240, 244, 240);
      doc.rect(14, y, pageWidth - 28, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(27, 94, 32);
      doc.text('#', 16, y + 5);
      doc.text('Trabajador', 24, y + 5);
      doc.text('Días', 85, y + 5);
      doc.text('Ganado Bruto', 110, y + 5);
      doc.text('Adelantos', 142, y + 5);
      doc.text('Neto a Pagar', 172, y + 5);
      y += 8;
    }

    if (i % 2 === 1) {
      doc.setFillColor(249, 250, 249);
      doc.rect(14, y - 4, pageWidth - 28, 6.5, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(String(i + 1), 16, y);
    doc.text(trabajador.nombre.substring(0, 28), 24, y);
    doc.text(String(calculo.diasPresentes), 87, y);
    doc.text(`L. ${calculo.totalGanado.toFixed(2)}`, 110, y);

    doc.setTextColor(198, 40, 40);
    doc.text(`-L. ${calculo.totalAdelantos.toFixed(2)}`, 142, y);

    doc.setTextColor(27, 94, 32);
    doc.setFont('helvetica', 'bold');
    doc.text(`L. ${calculo.totalAPagar.toFixed(2)}`, 172, y);

    y += 6.5;
  });

  y += 4;
  if (y > pageHeight - 35) {
    doc.addPage();
    y = 20;
  }

  // Tarjeta de Totales Finales
  doc.setFillColor(232, 245, 233); // #E8F5E9
  doc.setDrawColor(165, 214, 167); // #A5D6A7
  doc.roundedRect(14, y, pageWidth - 28, 20, 3, 3, 'FD');

  doc.setTextColor(27, 94, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RESUMEN DE CIERRE FINANCIERO', 18, y + 6);

  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text(`Total Ganado Bruto: L. ${granTotalGanado.toFixed(2)}`, 18, y + 14);

  doc.setTextColor(198, 40, 40);
  doc.text(`Total Adelantos: -L. ${granTotalAdelantos.toFixed(2)}`, 78, y + 14);

  doc.setTextColor(27, 94, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`NETO A PAGAR: L. ${granTotalAPagar.toFixed(2)}`, 138, y + 14);

  // Pie de página oficial en todas las páginas
  const totalPages = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `AgroGámez — Sistema Integral Agrícola (Offline-First)   •   Página ${p} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  // Entrega en Entorno Web / PWA iOS / Android
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = doc.output('blob');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nombreArchivo;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch {}
      }, 10000);
      return { exito: true, nombreArchivo };
    }
  }

  // Entorno Móvil Nativo (APK Android)
  const docDir = (FileSystem as any).documentDirectory || '';
  const rutaCompleta = `${docDir}${nombreArchivo}`;
  if (docDir) {
    const base64 = doc.output('datauristring').split(',')[1];
    await FileSystem.writeAsStringAsync(rutaCompleta, base64, {
      encoding: (FileSystem as any).EncodingType?.Base64 || 'base64',
    });
    try {
      await Share.share({
        title: input.periodoEtiqueta || 'Planilla AgroGámez PDF',
        url: rutaCompleta,
      });
    } catch {}
  }
  return { exito: true, nombreArchivo };
}

/**
 * Abre una ventana con el HTML listo para imprimir únicamente en computadoras de escritorio.
 * En iPhone / iOS PWA o dispositivos móviles, está estrictamente bloqueado para evitar
 * el deadlock de WebKit que congela la app.
 */
export function imprimirReporteHTML(html: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  // En teléfonos, iPads y PWA instalada, window.print() CONGELA el thread de WebKit.
  // Solo se permite imprimir desde computadoras de escritorio / laptops.
  if (!esComputadoraWeb()) {
    console.warn('[Exportar] Impresión de navegador omitida en móvil para prevenir bloqueo de WebKit.');
    return false;
  }

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
  periodoEtiqueta?: string;
  fechaInicio?: string;
  fechaFin?: string;
  nombreArchivo?: string;
  semana?: Semana;
  trabajadores: Trabajador[];
  diasTrabajados: DiaTrabajado[];
  adelantos: Adelanto[];
  resumenes: ItemPlanillaExport[];
  cosecha: {
    cortadas: number;
    empacadas: number;
    descarte: number;
  };
  totales?: {
    nominaBruta: number;
    totalAdelantos: number;
    totalNeto: number;
  };
}

/**
 * Genera el texto en formato legible con emojis para compartir por WhatsApp un período arbitrario (semana, mes, año, rango).
 */
export function generarTextoWhatsAppPeriodo(input: {
  periodoEtiqueta: string;
  fechaInicio?: string;
  fechaFin?: string;
  resumenes: ItemPlanillaExport[];
  cosecha?: { cortadas: number; empacadas: number; descarte: number };
}): string {
  const { periodoEtiqueta, fechaInicio, fechaFin, resumenes, cosecha } = input;
  let texto = `🌾 *AGROGÁMEZ — Reporte de Pago y Producción* 🌾\n`;
  texto += `📅 *Período:* ${periodoEtiqueta}\n`;
  if (fechaInicio && fechaFin) {
    texto += `🗓️ *Fechas:* ${fechaInicio} al ${fechaFin}\n`;
  }
  texto += `----------------------------------------\n\n`;

  let granTotalGanado = 0;
  let granTotalAdelantos = 0;
  let granTotalAPagar = 0;

  if (resumenes.length === 0) {
    texto += `_No se registraron jornadas en este período._\n\n`;
  } else {
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
  }

  texto += `----------------------------------------\n`;
  texto += `💰 *TOTALES CONSOLIDADOS:* \n`;
  texto += `• Total Ganado Bruto: ${formatearMoneda(granTotalGanado)}\n`;
  texto += `• Total Adelantos: -${formatearMoneda(granTotalAdelantos)}\n`;
  texto += `💵 *GRAN TOTAL NETO: ${formatearMoneda(granTotalAPagar)}*\n`;

  if (cosecha && (cosecha.cortadas > 0 || cosecha.empacadas > 0)) {
    const ef =
      cosecha.cortadas > 0
        ? ((cosecha.empacadas / cosecha.cortadas) * 100).toFixed(1)
        : '0.0';
    texto += `\n📦 *PRODUCCIÓN AGRÍCOLA:* \n`;
    texto += `• Cortadas: ${cosecha.cortadas} cajas\n`;
    texto += `• Empacadas: ${cosecha.empacadas} cajas\n`;
    texto += `• Descarte: ${cosecha.descarte} cajas (${ef}% aprovechable)\n`;
  }

  texto += `----------------------------------------\n`;
  texto += `_Reporte generado automáticamente por AgroGámez App._`;
  return texto;
}

/**
 * Genera el documento HTML imprimible/guardable en PDF para cualquier período seleccionado.
 */
export function generarHTMLPlanillaPeriodo(input: {
  periodoEtiqueta: string;
  fechaInicio?: string;
  fechaFin?: string;
  resumenes: ItemPlanillaExport[];
  cosecha?: { cortadas: number; empacadas: number; descarte: number };
}): string {
  const { periodoEtiqueta, fechaInicio, fechaFin, resumenes, cosecha } = input;

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

  const seccionCosecha = cosecha && (cosecha.cortadas > 0 || cosecha.empacadas > 0)
    ? `
      <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; padding: 12px 16px; border-radius: 8px; margin-bottom: 25px;">
        <h3 style="margin: 0 0 6px 0; color: #166534; font-size: 14px;">📦 Producción Agrícola Registrada</h3>
        <p style="margin: 0; font-size: 13px; color: #15803D;">
          Cortadas: <strong>${cosecha.cortadas}</strong> cajas |
          Empacadas: <strong>${cosecha.empacadas}</strong> cajas |
          Descarte: <strong>${cosecha.descarte}</strong> cajas
        </p>
      </div>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>AgroGámez — ${periodoEtiqueta}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2D3748; margin: 24px; line-height: 1.5; }
        .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #2F855A; padding-bottom: 15px; }
        .header h1 { margin: 0; color: #2F855A; font-size: 24px; }
        .header p { margin: 4px 0 0; color: #718096; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        th { background-color: #F7FAFC; padding: 12px 10px; text-align: left; font-size: 12px; font-weight: bold; color: #4A5568; border-bottom: 2px solid #E2E8F0; }
        .totals { background-color: #EDF2F7; padding: 16px; border-radius: 8px; font-size: 14px; margin-bottom: 25px; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
        .totals-grand { font-size: 18px; font-weight: bold; color: #2F855A; border-top: 1px solid #CBD5E0; padding-top: 8px; margin-top: 6px; }
        .footer { text-align: center; font-size: 11px; color: #A0AEC0; margin-top: 30px; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🌾 AGROGÁMEZ</h1>
        <p>Comprobante Oficial de Nómina y Producción</p>
        <p><strong>${periodoEtiqueta}</strong>${fechaInicio && fechaFin ? ` (${fechaInicio} al ${fechaFin})` : ''}</p>
      </div>

      ${seccionCosecha}

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
          ${filas || '<tr><td colspan="6" style="text-align:center; padding:15px;">Sin jornadas registradas en este período</td></tr>'}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row"><span>Total Ganado Bruto:</span> <strong>${formatearMoneda(granTotalGanado)}</strong></div>
        <div class="totals-row"><span>Total Adelantos:</span> <strong style="color: #E53E3E;">-${formatearMoneda(granTotalAdelantos)}</strong></div>
        <div class="totals-row totals-grand"><span>Gran Total a Pagar:</span> <span>${formatearMoneda(granTotalAPagar)}</span></div>
      </div>

      <div class="footer">
        <p>Documento oficial emitido por AgroGámez — Sistema Integral Agrícola (Offline-First)</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Genera el archivo CSV con las 6 secciones requeridas respetando estrictamente el período seleccionado.
 * Añade marca BOM UTF-8 (\uFEFF) para visualización perfecta en Microsoft Excel.
 */
export function generarReporteCompletoCSV(input: ExportarCompletoInput): string {
  const { trabajadores, diasTrabajados, adelantos, resumenes, cosecha } = input;

  const ini = input.fechaInicio || input.semana?.fecha_inicio || '';
  const fin = input.fechaFin || input.semana?.fecha_fin || '';
  let periodoStr = input.periodoEtiqueta || '';
  if (!periodoStr && input.semana) {
    const dIni = new Date(input.semana.fecha_inicio + 'T00:00:00');
    const dFin = new Date(input.semana.fecha_fin + 'T00:00:00');
    const mesStr = dIni.toLocaleDateString('es-HN', { month: 'short' });
    periodoStr = `Semana ${dIni.getDate()}-${dFin.getDate()} ${mesStr}`;
  } else if (!periodoStr) {
    periodoStr = ini && fin ? `Periodo ${ini} al ${fin}` : 'Historial Completo';
  }
  const hoyStr = hoyISO();

  // \uFEFF asegura compatibilidad con acentos y monedas en Microsoft Excel
  let csv = `\uFEFF=== 1. ENCABEZADO ===\n`;
  csv += `Periodo,${periodoStr}\n`;
  if (ini && fin) {
    csv += `Rango de Fechas,${ini} al ${fin}\n`;
  }
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
 * Compatible con nombres de archivo por período y descarga garantizada en Web/iOS.
 */
export async function guardarYCompartirReporteCSV(input: ExportarCompletoInput): Promise<string> {
  const contenido = generarReporteCompletoCSV(input);
  const etiquetaLimpia = (input.periodoEtiqueta || input.semana?.fecha_inicio || 'Reporte')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  const nombreArchivo = input.nombreArchivo || `AgroGamez_${etiquetaLimpia}.csv`;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nombreArchivo;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch {}
      }, 5000);
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
      title: input.periodoEtiqueta || `Reporte AgroGámez`,
      message: contenido,
      url: rutaCompleta,
    });
  } catch (err) {
    console.warn('[Exportar] Aviso al compartir nativo:', err);
  }

  return rutaCompleta;
}
