-- ═══════════════════════════════════════════════════════════
-- supabase/migrations/002_apps_bucket.sql
-- Bucket público "apps" para distribución del APK de Android
-- ═══════════════════════════════════════════════════════════

-- 1. Crear el bucket 'apps' como público si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('apps', 'apps', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Política pública de lectura: permite que cualquier usuario o navegador descargue el APK directamente
CREATE POLICY "Public Access APK" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'apps');

-- 3. Política de subida para usuarios autenticados
CREATE POLICY "Authenticated Upload APK" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'apps' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Update APK" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'apps' AND auth.role() = 'authenticated');
