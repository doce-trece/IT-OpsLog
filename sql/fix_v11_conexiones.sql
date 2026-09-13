-- =====================================================================
-- MIGRACION v11: sesiones y tiempo por conexión/desconexión real
-- Pega esto entero en Supabase -> SQL Editor -> Run
-- =====================================================================

-- Bloques ya contados (para no sumar dos veces el mismo bloque el mismo día)
alter table registros add column if not exists bloques_contados text[] not null default '{}';

-- Tiempo total conectado mientras el registro está editable (segundos)
alter table registros add column if not exists tiempo_conectado_segundos int not null default 0;

-- Si no es null, hay una conexión en curso desde ese instante (para poder
-- calcular cuánto tiempo lleva conectado, y detectar sesiones sin cerrar)
alter table registros add column if not exists conexion_iniciada_en timestamptz;

-- Las columnas de la versión anterior (fechas_actividad, dias_trabajados,
-- ultima_actividad_fecha) se quedan sin usar, no hace falta borrarlas.
