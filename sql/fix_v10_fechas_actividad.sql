-- =====================================================================
-- MIGRACION v10: contar sesiones solo en días con actividad real
-- Pega esto entero en Supabase -> SQL Editor -> Run
-- =====================================================================

alter table registros add column if not exists fechas_actividad date[] not null default array[current_date];

-- Migra lo que ya hubiera: si un registro ya tenía "ultima_actividad_fecha"
-- guardada, la metemos como primer elemento de la nueva lista (no es
-- perfecto para el histórico ya abierto, pero a partir de ahora todo se
-- registrará con precisión día a día).
update registros
set fechas_actividad = array[coalesce(ultima_actividad_fecha, fecha_inicio::date)]
where fechas_actividad = array[current_date] and ultima_actividad_fecha is not null;
