-- ═══════════════════════════════════════════════════════════════
-- AgroGámez — Políticas RLS para usuarios Autenticados y Móviles
-- Ejecutar en Supabase Dashboard > SQL Editor > Run (Ctrl + Enter)
-- ═══════════════════════════════════════════════════════════════

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
