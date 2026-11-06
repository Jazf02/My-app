-- supabase/migrations/001_storage.sql
-- Se aplica en Fase 5 cuando se implementa el backup a Supabase Storage.
-- Por ahora este archivo es documentación.

-- INSTRUCCIONES:
-- 1. Crear el bucket "backups" en Supabase Dashboard (Storage → New bucket)
-- 2. Marcar como PRIVATE
-- 3. Ejecutar estas políticas RLS:

-- Política de lectura: solo el propietario puede leer sus propios backups
-- CREATE POLICY "backups_owner_read" ON storage.objects
--   FOR SELECT USING (
--     bucket_id = 'backups'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );

-- Política de escritura: solo el propietario puede escribir
-- CREATE POLICY "backups_owner_write" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'backups'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );

-- Política de eliminación: solo el propietario puede borrar (para la retención de 30)
-- CREATE POLICY "backups_owner_delete" ON storage.objects
--   FOR DELETE USING (
--     bucket_id = 'backups'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );
