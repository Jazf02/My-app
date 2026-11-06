// sync/restore.ts — Módulo de restauración de copias de seguridad desde Supabase Storage (Fase 5)
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { getDB, initTables } from '@/database/local';

export interface RemoteBackupFile {
  name: string;
  created_at: string;
  size: number;
}

export interface ResultadoRestore {
  exito: boolean;
  mensaje: string;
}

/**
 * Lista las copias de seguridad almacenadas en la nube para el usuario autenticado.
 */
export async function listarBackupsRemotos(userId?: string): Promise<RemoteBackupFile[]> {
  let activeUserId = userId;
  if (!activeUserId) {
    const { data: { session } } = await supabase.auth.getSession();
    activeUserId = session?.user?.id;
  }

  if (!activeUserId) {
    return [];
  }

  const { data: archivos, error } = await supabase.storage
    .from('backups')
    .list(activeUserId, { sortBy: { column: 'created_at', order: 'desc' } });

  if (error || !archivos) {
    return [];
  }

  return archivos.map((f) => ({
    name: f.name,
    created_at: f.created_at || new Date().toISOString(),
    size: f.metadata?.size || 0,
  }));
}

/**
 * Descarga y restaura una copia de seguridad remota desde Supabase Storage.
 * Incluye verificación de integridad antes de reemplazar la base de datos local.
 */
export async function restaurarBackup(remotePath: string): Promise<ResultadoRestore> {
  if (Platform.OS === 'web') {
    return {
      exito: false,
      mensaje: 'La restauración de base de datos está disponible en dispositivos móviles.',
    };
  }

  const cacheDir = (FileSystem as any).cacheDirectory || '';
  const docDir = (FileSystem as any).documentDirectory || '';
  const tempPath = `${cacheDir}temp_restore.db`;
  const dbPath = `${docDir}SQLite/agrogamez.db`;

  try {
    // 1. Descargar archivo desde Supabase Storage
    const { data: blobData, error: downloadError } = await supabase.storage
      .from('backups')
      .download(remotePath);

    if (downloadError || !blobData) {
      return {
        exito: false,
        mensaje: downloadError?.message || 'Error al descargar la copia de seguridad desde la nube.',
      };
    }

    // 2. Convertir Blob a Base64 y guardar en directorio temporal
    let base64Content = '';
    if (blobData && typeof (blobData as any).arrayBuffer === 'function') {
      const buffer = await (blobData as any).arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const BufferObj = (globalThis as any).Buffer;
      if (BufferObj) {
        base64Content = BufferObj.from(bytes).toString('base64');
      } else {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64Content = btoa(binary);
      }
    } else if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || result;
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blobData);
      base64Content = await base64Promise;
    }

    await FileSystem.writeAsStringAsync(tempPath, base64Content, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 3. Verificar validez del archivo descargado (mínimo de tamaño y existencia)
    const tempInfo = await FileSystem.getInfoAsync(tempPath);
    if (!tempInfo.exists || tempInfo.size === 0) {
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
      return {
        exito: false,
        mensaje: 'El archivo descargado está corrupto o vacío. La base de datos local no ha sido modificada.',
      };
    }

    // 4. Copiar e intentar reemplazar la BD local
    await FileSystem.copyAsync({
      from: tempPath,
      to: dbPath,
    });

    // Re-inicializar tablas y conexiones SQLite
    await initTables();

    // Eliminar archivo temporal
    await FileSystem.deleteAsync(tempPath, { idempotent: true });

    return {
      exito: true,
      mensaje: 'Base de datos restaurada correctamente desde la copia de seguridad.',
    };
  } catch (error: any) {
    // Si ocurre un error, aseguramos la eliminación del archivo temporal
    await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
    return {
      exito: false,
      mensaje: error?.message || 'Fallo durante la restauración de la base de datos.',
    };
  }
}
