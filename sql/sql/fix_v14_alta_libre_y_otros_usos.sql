-- =====================================================================
-- MIGRACION v14
-- Pega esto entero en Supabase -> SQL Editor -> Run
-- =====================================================================

-- 1. Marca qué clases son visibles para los alumnos (en selects, listas...)
alter table clases add column if not exists visible_para_alumnos boolean not null default true;

-- 2. Clase "Otros usos": no debe aparecer nunca en ningún panel de alumno
insert into clases (nombre, permite_operaciones, visible_para_alumnos)
values ('Otros usos', false, false)
on conflict (nombre) do update set visible_para_alumnos = false;

-- 3. Los alumnos ya no pueden ver esta clase (ni ninguna otra marcada como
--    no visible) ni en el select del alta ni consultando la tabla directamente.
drop policy if exists "clases_select" on clases;
create policy "clases_select" on clases for select
  using (is_profesor() or visible_para_alumnos = true);

-- 4. Dar de alta un equipo: CUALQUIER autenticado puede crearlo en
--    CUALQUIER clase (un alumno de SMR2 debe poder darlo de alta
--    directamente en FPB1, por ejemplo). Editar uno ya existente sigue
--    restringido a la propia clase (o al profesor, que puede con todas).
drop policy if exists "equipos_insert_autenticado" on equipos;
create policy "equipos_insert_autenticado" on equipos for insert
  with check (auth.uid() is not null);

-- =====================================================================
-- El borrado de equipos ya estaba permitido solo al profesor desde hace
-- varias versiones (política "equipos_delete_profesor"); lo que faltaba
-- era el botón en la interfaz, que ya está en el código actualizado.
-- =====================================================================
