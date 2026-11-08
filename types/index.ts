// ═══════════════════════════════════════════════════════════
// types/index.ts — Tipos globales y de dominio de AgroGámez
// ═══════════════════════════════════════════════════════════

// ─── Trabajadores ───────────────────────────────────────────
export interface Trabajador {
  id: string;
  nombre: string;
  tarifa_diaria_default: number;
  activo: number; // 1 = activo, 0 = inactivo
  dominical?: number; // 1 = trabaja domingos, 0 = no
  synced: number; // 0 = pendiente, 1 = synced
  created_at?: string;
  updated_at?: string;
}

export interface CrearTrabajadorDTO {
  nombre: string;
  tarifa_diaria_default?: number;
}

// ─── Semanas ────────────────────────────────────────────────
export type EstadoSemana = 'abierta' | 'cerrada' | 'pagada';

export interface Semana {
  id: string;
  fecha_inicio: string; // ISO YYYY-MM-DD (Lunes)
  fecha_fin: string;    // ISO YYYY-MM-DD (Domingo)
  estado: EstadoSemana;
  synced: number;
  created_at?: string;
  updated_at?: string;
}

// ─── Asistencia / Días Trabajados ───────────────────────────
export interface DiaTrabajado {
  id: string;
  semana_id: string;
  trabajador_id: string;
  fecha: string; // ISO YYYY-MM-DD
  presente: number; // 1 = presente, 0 = ausente
  tarifa_diaria: number | null; // null usa la tarifa_diaria_default del trabajador
  synced: number;
  created_at?: string;
  updated_at?: string;
}

export type TipoAsistencia = 'presente' | 'inactivo' | 'adelanto';

export interface Asistencia {
  id: string;
  trabajador_id: string;
  fecha: string;
  tipo: TipoAsistencia;
  monto: number;
  tarifa_aplicada: number;
  nota: string | null;
  asistio?: boolean;
}

// ─── Adelantos ──────────────────────────────────────────────
export interface Adelanto {
  id: string;
  semana_id: string;
  trabajador_id: string;
  monto: number;
  concepto: string | null;
  fecha: string;
  revertido?: number; // 1 = revertido, 0 = activo
  synced: number;
  created_at?: string;
  updated_at?: string;
}

export interface CrearAdelantoDTO {
  semana_id: string;
  trabajador_id: string;
  monto: number;
  concepto?: string;
  fecha?: string;
}

// ─── Configuración ──────────────────────────────────────────
export interface Configuracion {
  clave: string;
  valor: string;
  updated_at?: string;
}

// ─── Lotes ──────────────────────────────────────────────────
export type EstadoLote = 'activo' | 'cerrado';

export interface Lote {
  id: string;
  nombre: string;
  cultivo: string;
  variedad: string | null;
  fecha_siembra: string | null;
  estado: EstadoLote;
  creado_en: string;
}

// ─── Cosechas ───────────────────────────────────────────────
export interface Cosecha {
  id: string;
  lote_id: string;
  fecha: string;
  cajasCortadas?: number;
  cajasDescarte?: number;
  cajasEmpacadas?: number;
  cajas_cortadas?: number;
  cajas_descarte?: number;
  cajas_empacadas?: number;
  synced?: number;
}

// ─── Gastos ─────────────────────────────────────────────────
export type CategoriaGasto = 'Insumos' | 'Mano de obra' | 'Otros';

export interface Gasto {
  id: string;
  fecha: string;
  categoria: CategoriaGasto;
  descripcion: string | null;
  monto: number;
}

// ─── Backup ─────────────────────────────────────────────────
export interface BackupLog {
  id: string;
  fecha: string;
  dispositivo_id: string | null;
  tamano: number | null;
  exito: number; // 1 = éxito, 0 = fallo
}

// ─── Estado de Sincronización ───────────────────────────────
export type EstadoSync = 'sincronizado' | 'pendiente' | 'offline' | 'error';

// ─── Resúmenes de cálculo ───────────────────────────────────
export interface ResumenSemana {
  diasTrabajados: number;
  totalGanado: number;
  totalAdelantos: number;
  totalNeto: number;
  detalle: Array<{
    fecha: string;
    tipo: TipoAsistencia;
    tarifa_aplicada: number;
    monto: number;
  }>;
}

export interface ResumenCosecha {
  totalCortadas: number;
  totalDescarte: number;
  totalEmpacadas: number;
}

// ─── Auth (local PIN + Supabase Cloud Auth) ───────────────────
export interface AuthContextValue {
  /** true cuando el usuario ingresó correctamente (PIN o Supabase) */
  isLoggedIn: boolean;
  /** true mientras se verifica la sesión o se carga el estado inicial */
  isLoading: boolean;
  /** true si ya existe un PIN configurado localmente */
  hasPin: boolean;
  /** Correo del usuario autenticado en la nube si aplica */
  userEmail?: string | null;
  /** Verifica el PIN y abre la sesión local */
  login: (pin: string) => Promise<void>;
  /** Iniciar sesión con Correo y Contraseña en Supabase */
  loginWithEmail: (email: string, password: string) => Promise<void>;
  /** Registrar nuevo usuario con Correo y Contraseña en Supabase */
  registerWithEmail: (email: string, password: string) => Promise<void>;
  /** Configura el PIN por primera vez */
  setupPin: (pin: string) => Promise<void>;
  /** Cierra la sesión */
  logout: () => Promise<void>;
}
