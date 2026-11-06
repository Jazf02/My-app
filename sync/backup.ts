// sync/backup.ts — Lógica de respaldo local de SQLite a Supabase Storage (Fase 5)
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { getDB } from '@/database/local';
import { hoyISO } from '@/lib/fechas';

export interface ResultadoBackup {
  exito: boolean;
  mensaje: string;
  path?: string;
  tamano?: number;
}

const MAX_BACKUPS_RETENCION = 30;

function generarUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Exporta y sube una copia de respaldo comprimida/binaria de la BD local SQLite a Supabase Storage.
 * Mantiene como máximo 30 copias de seguridad por usuario (rotación automática de la más vieja).
 */
export async function exportarBackup(userId?: string): Promise<ResultadoBackup> {
  if (Platform.OS === 'web') {
    return {
      exito: false,
      mensaje: 'El respaldo a Supabase Storage está disponible en dispositivos móviles.',
    };
  }

  const db = await getDB();
  const idLog = generarUUID();
  const fechaHoy = hoyISO();

  try {
    // 1. Verificar sesión de usuario en Supabase Auth
    let activeUserId = userId;
    if (!activeUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      activeUserId = session?.user?.id;
    }

    if (!activeUserId) {
      const msg = 'No hay usuario autenticado para realizar el respaldo en la nube.';
      await db.runAsync(
        `INSERT INTO backup_logs (id, fecha, dispositivo_id, tamano, exito) VALUES (?, ?, 'local', 0, 0);`,
        [idLog, fechaHoy]
      );
      return { exito: false, mensaje: msg };
    }

    // 2. Localizar archivo SQLite local
    const docDir = (FileSystem as any).documentDirectory || '';
    const dbPath = `${docDir}SQLite/agrogamez.db`;
    const fileInfo = await FileSystem.getInfoAsync(dbPath);

    if (!fileInfo.exists) {
      const msg = 'No se encontró el archivo de base de datos local en el dispositivo.';
      await db.runAsync(
        `INSERT INTO backup_logs (id, fecha, dispositivo_id, tamano, exito) VALUES (?, ?, 'local', 0, 0);`,
        [idLog, fechaHoy]
      );
      return { exito: false, mensaje: msg };
    }

    const tamano = fileInfo.size || 0;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const remotePath = `${activeUserId}/agrogamez_${timestamp}.db`;

    // 3. Leer archivo y subir a Supabase Storage bucket 'backups'
    const base64Data = await FileSystem.readAsStringAsync(dbPath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(remotePath, byteArray.buffer, {
        contentType: 'application/x-sqlite3',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // 4. Aplicar política de rotación (Máximo 30 backups por usuario)
    await aplicarRotacionBackups(activeUserId);

    // 5. Registrar log de éxito en SQLite local
    await db.runAsync(
      `INSERT INTO backup_logs (id, fecha, dispositivo_id, tamano, exito) VALUES (?, ?, 'cloud', ?, 1);`,
      [idLog, fechaHoy, tamano]
    );

    return {
      exito: true,
      mensaje: 'Respaldo subido exitosamente a Supabase Storage.',
      path: remotePath,
      tamano,
    };
  } catch (error: any) {
    const errorMsg = error?.message || 'Error desconocido al exportar el respaldo.';
    try {
      await db.runAsync(
        `INSERT INTO backup_logs (id, fecha, dispositivo_id, tamano, exito) VALUES (?, ?, 'error', 0, 0);`,
        [idLog, fechaHoy]
      );
    } catch (_) {
      // Ignorar errores de guardado de log para no bloquear la app
    }

    return { exito: false, mensaje: errorMsg };
  }
}

/**
 * Elimina las copias de respaldo más antiguas en Supabase Storage si el usuario tiene > 30 archivos.
 */
async function aplicarRotacionBackups(userId: string): Promise<void> {
  try {
    const { data: archivos, error } = await supabase.storage
      .from('backups')
      .list(userId, { sortBy: { column: 'created_at', order: 'asc' } });

    if (error || !archivos) {
      return;
    }

    if (archivos.length > MAX_BACKUPS_RETENCION) {
      const excedente = archivos.length - MAX_BACKUPS_RETENCION;
      const archivosAEliminar = archivos.slice(0, excedente).map((f) => `${userId}/${f.name}`);

      await supabase.storage.from('backups').remove(archivosAEliminar);
    }
  } catch (_) {
    // Si falla la rotación por conectividad, no detiene la operación de backup exitosa
  }
}
