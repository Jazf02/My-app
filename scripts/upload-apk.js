// ═══════════════════════════════════════════════════════════
// scripts/upload-apk.js — Script para subir APK a Supabase Storage
// Uso: node scripts/upload-apk.js [ruta-al-apk]
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Cargar variables de entorno desde .env si existe
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes('placeholder')) {
  console.error(
    '❌ Error: EXPO_PUBLIC_SUPABASE_URL y SUPABASE_ANON_KEY deben estar configuradas con credenciales reales en .env'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const apkPathArg = process.argv[2];
  let apkPath = apkPathArg;

  if (!apkPath) {
    // Buscar en directorio actual o descargas
    const posibles = [
      path.resolve(__dirname, '..', 'agrogamez.apk'),
      path.resolve(__dirname, '..', 'app-release.apk'),
    ];
    apkPath = posibles.find((p) => fs.existsSync(p));
  }

  if (!apkPath || !fs.existsSync(apkPath)) {
    console.error(`❌ No se encontró el archivo APK en: ${apkPath || '(sin ruta)'}`);
    console.log('Uso: node scripts/upload-apk.js ruta/al/archivo.apk');
    process.exit(1);
  }

  console.log(`📦 Leyendo APK desde: ${apkPath}`);
  const fileBuffer = fs.readFileSync(apkPath);
  const fileName = 'agrogamez.apk';

  console.log(`🚀 Subiendo ${fileName} al bucket "apps"...`);

  // Asegurar que el bucket exista
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExiste = buckets && buckets.some((b) => b.id === 'apps');

  if (!bucketExiste) {
    console.log('Creando bucket "apps" (público)...');
    await supabase.storage.createBucket('apps', { public: true });
  }

  const { data, error } = await supabase.storage.from('apps').upload(fileName, fileBuffer, {
    contentType: 'application/vnd.android.package-archive',
    upsert: true,
  });

  if (error) {
    console.error('❌ Error al subir APK:', error.message);
    process.exit(1);
  }

  const { data: publicData } = supabase.storage.from('apps').getPublicUrl(fileName);

  console.log('✅ APK subido exitosamente!');
  console.log('🔗 URL pública de descarga:');
  console.log(publicData.publicUrl);
}

main().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});

