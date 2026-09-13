-- =====================================================================
-- MIGRACION v8
-- Pega esto entero en Supabase -> SQL Editor -> Run
-- =====================================================================

-- 1. Título de la operación
alter table registros add column if not exists titulo text;

-- 2. Encadenado de sesiones: cuando un registro se autocierra al terminar
--    el bloque, se crea uno nuevo que "continúa" el anterior.
alter table registros add column if not exists registro_anterior_id bigint references registros(id);

-- 3. Último estado conocido del equipo (para mostrarlo con color al elegir)
alter table equipos add column if not exists ultimo_estado_funcional text;

-- 4. Fotos: equipo (ficha del inventario) y operación (reparación del alumno)
alter table equipos add column if not exists foto_url text;
alter table registro_alumnos add column if not exists foto_url text;

-- 5. Bucket de almacenamiento para las fotos (público de lectura, solo
--    usuarios logueados pueden subir)
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists "fotos_lectura_publica" on storage.objects;
create policy "fotos_lectura_publica" on storage.objects for select
  using (bucket_id = 'fotos');

drop policy if exists "fotos_subida_autenticados" on storage.objects;
create policy "fotos_subida_autenticados" on storage.objects for insert
  with check (bucket_id = 'fotos' and auth.uid() is not null);

drop policy if exists "fotos_actualizacion_autenticados" on storage.objects;
create policy "fotos_actualizacion_autenticados" on storage.objects for update
  using (bucket_id = 'fotos' and auth.uid() is not null);

-- 6. El cierre automático de bloque lo puede disparar la sesión de
--    CUALQUIER usuario que tenga la app abierta en ese momento (no
--    necesariamente el alumno dueño del registro), así que necesita
--    permiso para tocar registros y participaciones ajenas para esta
--    tarea de mantenimiento concreta.
drop policy if exists "registros_update" on registros;
create policy "registros_update" on registros for update
  using (auth.uid() is not null);

drop policy if exists "registro_alumnos_insert" on registro_alumnos;
create policy "registro_alumnos_insert" on registro_alumnos for insert
  with check (auth.uid() is not null);

-- =====================================================================
-- El resto (encadenar registros al autocerrarse, marcar terminado al
-- revisar, agrupar por día, reabrir registro...) es lógica de la
-- aplicación y ya está en el código actualizado del proyecto.
-- =====================================================================
