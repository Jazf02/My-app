-- ═══════════════════════════════════════════════════════════
-- AgroGámez — Esquema completo Supabase PostgreSQL
-- Preparado para ejecutar en: Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Trabajadores ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trabajadores (
  id                    TEXT PRIMARY KEY,
  nombre                TEXT NOT NULL,
  tarifa_diaria_default NUMERIC(10,2) NOT NULL DEFAULT 250,
  activo                INTEGER DEFAULT 1,
  dominical             INTEGER DEFAULT 0,
  device_id             TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Semanas de pago ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.semanas (
  id                TEXT PRIMARY KEY,
  fecha_inicio      DATE NOT NULL,
  fecha_fin         DATE NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'abierta' CHECK(estado IN ('abierta','cerrada','pagada')),
  pagada_en         TIMESTAMPTZ,
  cerrada_en        TIMESTAMPTZ,
  reabierta_en      TIMESTAMPTZ,
  reabierta_motivo  TEXT,
  device_id         TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fecha_inicio)
);

-- ─── Días trabajados (asistencia y pago diario/dominical) ─────
CREATE TABLE IF NOT EXISTS public.dias_trabajados (
  id              TEXT PRIMARY KEY,
  semana_id       TEXT NOT NULL REFERENCES public.semanas(id) ON DELETE CASCADE,
  trabajador_id   TEXT NOT NULL REFERENCES public.trabajadores(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  presente        INTEGER NOT NULL DEFAULT 0,
  tarifa_diaria   NUMERIC(10,2),
  device_id       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(semana_id, trabajador_id, fecha)
);

-- ─── Adelantos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.adelantos (
  id              TEXT PRIMARY KEY,
  semana_id       TEXT NOT NULL REFERENCES public.semanas(id) ON DELETE CASCADE,
  trabajador_id   TEXT NOT NULL REFERENCES public.trabajadores(id) ON DELETE CASCADE,
  monto           NUMERIC(10,2) NOT NULL,
  concepto        TEXT,
  fecha           DATE NOT NULL,
  revertido       INTEGER DEFAULT 0,
  device_id       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Lotes agrícolas ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lotes (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  cultivo       TEXT NOT NULL,
  variedad      TEXT,
  fecha_siembra DATE,
  estado        TEXT DEFAULT 'activo' CHECK(estado IN ('activo','cerrado')),
  device_id     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Cosechas ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cosechas (
  id              TEXT PRIMARY KEY,
  lote_id         TEXT NOT NULL REFERENCES public.lotes(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  cajas_cortadas  INTEGER DEFAULT 0,
  cajas_descarte  INTEGER DEFAULT 0,
  cajas_empacadas INTEGER DEFAULT 0,
  device_id       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Gastos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gastos (
  id          TEXT PRIMARY KEY,
  fecha       DATE NOT NULL,
  categoria   TEXT NOT NULL,
  descripcion TEXT,
  monto       NUMERIC(10,2) NOT NULL,
  lote_id     TEXT REFERENCES public.lotes(id),
  device_id   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Periodos cerrados ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.periodos_cerrados (
  id              TEXT PRIMARY KEY,
  tipo            TEXT NOT NULL CHECK(tipo IN ('semana','mes','año')),
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  cajas_cortadas  INTEGER DEFAULT 0,
  cajas_empacadas INTEGER DEFAULT 0,
  descarte        INTEGER DEFAULT 0,
  nomina_bruta    NUMERIC(10,2) DEFAULT 0,
  adelantos       NUMERIC(10,2) DEFAULT 0,
  neto            NUMERIC(10,2) DEFAULT 0,
  fecha_cierre    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Función para actualizar updated_at automáticamente ──────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Triggers updated_at ─────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_trabajadores_updated_at
  BEFORE UPDATE ON public.trabajadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_semanas_updated_at
  BEFORE UPDATE ON public.semanas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_dias_trabajados_updated_at
  BEFORE UPDATE ON public.dias_trabajados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_adelantos_updated_at
  BEFORE UPDATE ON public.adelantos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_lotes_updated_at
  BEFORE UPDATE ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_cosechas_updated_at
  BEFORE UPDATE ON public.cosechas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_gastos_updated_at
  BEFORE UPDATE ON public.gastos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Políticas RLS (Row Level Security) ──────────────────────
ALTER TABLE public.trabajadores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semanas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dias_trabajados   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adelantos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosechas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_cerrados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acceso_anon_trabajadores" ON public.trabajadores;
DROP POLICY IF EXISTS "acceso_anon_semanas" ON public.semanas;
DROP POLICY IF EXISTS "acceso_anon_dias" ON public.dias_trabajados;
DROP POLICY IF EXISTS "acceso_anon_adelantos" ON public.adelantos;
DROP POLICY IF EXISTS "acceso_anon_lotes" ON public.lotes;
DROP POLICY IF EXISTS "acceso_anon_cosechas" ON public.cosechas;
DROP POLICY IF EXISTS "acceso_anon_gastos" ON public.gastos;
DROP POLICY IF EXISTS "acceso_anon_periodos" ON public.periodos_cerrados;

DROP POLICY IF EXISTS "acceso_total_trabajadores" ON public.trabajadores;
DROP POLICY IF EXISTS "acceso_total_semanas" ON public.semanas;
DROP POLICY IF EXISTS "acceso_total_dias" ON public.dias_trabajados;
DROP POLICY IF EXISTS "acceso_total_adelantos" ON public.adelantos;
DROP POLICY IF EXISTS "acceso_total_lotes" ON public.lotes;
DROP POLICY IF EXISTS "acceso_total_cosechas" ON public.cosechas;
DROP POLICY IF EXISTS "acceso_total_gastos" ON public.gastos;
DROP POLICY IF EXISTS "acceso_total_periodos" ON public.periodos_cerrados;

CREATE POLICY "acceso_total_trabajadores" ON public.trabajadores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total_semanas" ON public.semanas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total_dias" ON public.dias_trabajados FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total_adelantos" ON public.adelantos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total_lotes" ON public.lotes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total_cosechas" ON public.cosechas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total_gastos" ON public.gastos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "acceso_total_periodos" ON public.periodos_cerrados FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

