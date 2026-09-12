-- =====================================================================
-- ARREGLO DEFINITIVO (v3): fuerza la política sin recursión + permite a
-- los alumnos cambiar el estado de un equipo (libre/ocupado/en_revision)
-- Pega esto entero en Supabase -> SQL Editor -> Run
-- =====================================================================

-- 1. Quitar CUALQUIER política antigua en registro_alumnos que pueda
--    estar causando recursión, y dejar solo la simple y segura.
drop policy if exists "registro_alumnos_select" on registro_alumnos;
drop function if exists es_miembro_de_registro(bigint);

create policy "registro_alumnos_select" on registro_alumnos for select
  using (
    is_profesor()
    or alumno_id = auth.uid()
  );

-- 2. Permitir que cualquier alumno autenticado pueda cambiar el estado de
--    un equipo (libre -> ocupado -> en_revision -> libre). Antes solo lo
--    podía hacer el profesor, y por eso fallaba justo después de crear
--    el registro.
drop policy if exists "equipos_update_profesor" on equipos;
create policy "equipos_update_estado" on equipos for update
  using (auth.uid() is not null);
