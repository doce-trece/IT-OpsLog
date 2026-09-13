-- =====================================================================
-- MIGRACION v9: simplificación del modelo de registros
-- Pega esto entero en Supabase -> SQL Editor -> Run
-- =====================================================================

-- 1. Fechas de control del ciclo de vida del registro
alter table registros add column if not exists enviado_revision_en timestamptz;

-- 2. Seguimiento de días de trabajo (para la tarjeta "lleva X días abierto")
alter table registros add column if not exists dias_trabajados int not null default 1;
alter table registros add column if not exists ultima_actividad_fecha date not null default current_date;

-- 3. Ayuda recibida: ahora puede ser de VARIAS personas, no solo una
alter table registros drop constraint if exists registros_ayuda_recibida_de_fkey;
alter table registros alter column ayuda_recibida_de drop default;
alter table registros alter column ayuda_recibida_de type uuid[]
  using (case when ayuda_recibida_de is null then null else array[ayuda_recibida_de] end);

-- =====================================================================
-- Nota: ya NO se usan las columnas bloque_lectivo_id, fuera_de_bloque,
-- cerrado_automaticamente ni registro_anterior_id para nada nuevo. Las
-- dejamos en la tabla (no borran datos ni rompen nada) por si algún día
-- se quieren recuperar, pero la aplicación ya no las utiliza.
-- =====================================================================
