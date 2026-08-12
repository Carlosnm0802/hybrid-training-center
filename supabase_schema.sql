-- ==========================================
-- Esquema de Base de Datos - Hybrid Training Center
-- ==========================================

-- 1. Habilitar la extensión de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLA: usuarios
-- ==========================================
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'recepcion', 'coach')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- TABLA: alumnos
-- ==========================================
CREATE TABLE public.alumnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_completo TEXT NOT NULL,
    telefono TEXT NOT NULL,
    email TEXT NOT NULL,
    modalidad TEXT NOT NULL CHECK (modalidad IN ('boxeo', 'hibrido', 'combo')),
    condicion_medica TEXT,
    contacto_emergencia_nombre TEXT,
    contacto_emergencia_telefono TEXT,
    fecha_alta TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_vigencia_hasta DATE,
    tipo_plan_actual TEXT CHECK (tipo_plan_actual IN ('clase', 'semana', 'mensual', 'combo', NULL)),
    clase_disponible BOOLEAN DEFAULT FALSE
);

-- ==========================================
-- TABLA: pagos
-- ==========================================
-- NOTA: Para el folio en esta fase usaremos un TEXT que la app calcula (max + 1)
-- En el futuro se recomienda crear una SEQUENCE nativa de postgres para evitar colisiones.
CREATE TABLE public.pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio TEXT NOT NULL UNIQUE,
    alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
    conceptos JSONB NOT NULL,
    monto_total NUMERIC NOT NULL,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    registrado_por UUID NOT NULL REFERENCES public.usuarios(id),
    editado BOOLEAN DEFAULT FALSE
);

-- ==========================================
-- TABLA: checkins
-- ==========================================
CREATE TABLE public.checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    registrado_por UUID NOT NULL REFERENCES public.usuarios(id),
    alerta_mostrada BOOLEAN DEFAULT FALSE
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios autenticados (permitir todo a usuarios logueados por ahora)
-- NOTA: En un caso más estricto, podríamos separar por rol, pero para este MVP:
-- Todos los usuarios autenticados ('authenticated' role en Supabase) pueden leer/escribir.

-- Usuarios
CREATE POLICY "Usuarios autenticados pueden leer usuarios" 
ON public.usuarios FOR SELECT TO authenticated USING (true);

-- Alumnos
CREATE POLICY "Usuarios autenticados pueden gestionar alumnos" 
ON public.alumnos FOR ALL TO authenticated USING (true);

-- Pagos
CREATE POLICY "Usuarios autenticados pueden gestionar pagos" 
ON public.pagos FOR ALL TO authenticated USING (true);

-- Checkins
CREATE POLICY "Usuarios autenticados pueden gestionar checkins" 
ON public.checkins FOR ALL TO authenticated USING (true);

-- ==========================================
-- TRIGGER AUTOMÁTICO (Opcional pero útil)
-- Para insertar en 'usuarios' automáticamente al crear un usuario en 'auth.users'
-- (Esto se recomienda configurar desde la app o crear el trigger si creas cuentas desde código)
-- ==========================================
