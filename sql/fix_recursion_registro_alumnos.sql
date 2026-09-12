-- =====================================================================
-- ARREGLO: "infinite recursion detected in policy for relation registro_alumnos"
-- Pega esto en Supabase -> SQL Editor -> New query -> Run
-- =====================================================================

-- Función auxiliar: comprueba si el usuario actual participa en un
-- registro dado. Al ser SECURITY DEFINER, esta consulta interna NO vuelve
-- a pasar por la política de seguridad de la tabla (evita la recursión).
create or replace function es_miembro_de_registro(p_registro_id bigint)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from registro_alumnos
    where registro_id = p_registro_id and alumno_id = auth.uid()
  );
$$;

-- Sustituye la política antigua (la que se llamaba a sí misma) por una
-- que usa la función de arriba.
drop policy if exists "registro_alumnos_select" on registro_alumnos;
create policy "registro_alumnos_select" on registro_alumnos for select
  using (
    is_profesor()
    or es_miembro_de_registro(registro_id)
  );
