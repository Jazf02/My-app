-- ═══════════════════════════════════════════════════════════
-- database/schema.sql — Esquema SQLite AgroGámez
-- Referencia documental del esquema de base de datos
-- ═══════════════════════════════════════════════════════════

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Trabajadores ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trabajadores (
  id                    TEXT PRIMARY KEY,
  nombre                TEXT NOT NULL,
  tarifa_diaria_default REAL NOT NULL DEFAULT 250,
  sueldo_base           REAL NOT NULL DEFAULT 250,
  activo                INTEGER DEFAULT 1,
  synced                INTEGER DEFAULT 0,
  creado_en             TEXT DEFAULT (datetime('now'))
);

-- ─── Semanas de Pago ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS semanas (
  id                TEXT PRIMARY KEY,
  fecha_inicio      TEXT NOT NULL,
  fecha_fin         TEXT NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'abierta' CHECK(estado IN ('abierta','cerrada','pagada')),
  synced            INTEGER DEFAULT 0,
  pagada_en         TEXT,
  reabierta_en      TEXT,
  reabierta_motivo  TEXT
);

-- ─── Días Trabajados (Asistencia Semanal) ────────────────────
CREATE TABLE IF NOT EXISTS dias_trabajados (
  id             TEXT PRIMARY KEY,
  semana_id      TEXT NOT NULL,
  trabajador_id  TEXT NOT NULL,
  fecha          TEXT NOT NULL,
  presente       INTEGER NOT NULL DEFAULT 0,
  tarifa_diaria  REAL,
  synced         INTEGER DEFAULT 0,
  FOREIGN KEY(semana_id) REFERENCES semanas(id),
  FOREIGN KEY(trabajador_id) REFERENCES trabajadores(id),
  UNIQUE(semana_id, trabajador_id, fecha)
);

-- ─── Adelantos de Dinero ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS adelantos (
  id             TEXT PRIMARY KEY,
  semana_id      TEXT NOT NULL,
  trabajador_id  TEXT NOT NULL,
  monto          REAL NOT NULL,
  concepto       TEXT,
  fecha          TEXT NOT NULL,
  synced         INTEGER DEFAULT 0,
  FOREIGN KEY(semana_id) REFERENCES semanas(id),
  FOREIGN KEY(trabajador_id) REFERENCES trabajadores(id)
);

-- ─── Asistencia (Legacy) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS asistencia (
  id               TEXT PRIMARY KEY,
  trabajador_id    TEXT NOT NULL,
  fecha            TEXT NOT NULL,
  tipo             TEXT NOT NULL CHECK(tipo IN ('presente','inactivo','adelanto')),
  monto            REAL DEFAULT 0,
  tarifa_aplicada  REAL DEFAULT 0,
  nota             TEXT,
  FOREIGN KEY(trabajador_id) REFERENCES trabajadores(id)
);

-- ─── Lotes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lotes (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  cultivo       TEXT NOT NULL,
  variedad      TEXT,
  fecha_siembra TEXT,
  estado        TEXT DEFAULT 'activo',
  synced        INTEGER DEFAULT 0,
  creado_en     TEXT DEFAULT (datetime('now'))
);

-- ─── Cosechas ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cosechas (
  id              TEXT PRIMARY KEY,
  lote_id         TEXT NOT NULL,
  fecha           TEXT NOT NULL,
  cajas_cortadas  INTEGER DEFAULT 0,
  cajas_descarte  INTEGER DEFAULT 0,
  cajas_empacadas INTEGER DEFAULT 0,
  synced          INTEGER DEFAULT 0,
  FOREIGN KEY(lote_id) REFERENCES lotes(id)
);

-- ─── Gastos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos (
  id          TEXT PRIMARY KEY,
  fecha       TEXT NOT NULL,
  categoria   TEXT NOT NULL,
  descripcion TEXT,
  monto       REAL NOT NULL,
  lote_id     TEXT,
  synced      INTEGER DEFAULT 0
);

-- ─── Backups Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backups_log (
  id             TEXT PRIMARY KEY,
  fecha          TEXT NOT NULL,
  dispositivo_id TEXT,
  tamano         INTEGER,
  exito          INTEGER DEFAULT 0
);

-- ─── Configuración de la App ─────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracion_app (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- ─── Índices ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dias_trabajados_semana ON dias_trabajados(semana_id);
CREATE INDEX IF NOT EXISTS idx_dias_trabajados_fecha  ON dias_trabajados(fecha);
CREATE INDEX IF NOT EXISTS idx_dias_trabajados_trab   ON dias_trabajados(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_adelantos_semana       ON adelantos(semana_id);
CREATE INDEX IF NOT EXISTS idx_adelantos_trab         ON adelantos(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_cosechas_lote          ON cosechas(lote_id);
CREATE INDEX IF NOT EXISTS idx_cosechas_fecha         ON cosechas(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha           ON gastos(fecha);
