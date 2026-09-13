-- =====================================================================
-- PASO 1 (diagnóstico): descomenta y ejecuta esta consulta SOLA primero
-- si quieres ver qué política hay ahora mismo. Si no te interesa mirarlo,
-- sáltate directo al PASO 2 de abajo, que ya lo arregla igualmente.
-- =====================================================================
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where tablename = 'registros';


-- =====================================================================
-- PASO 2 (arreglo forzado): recrea las políticas de "registros" desde
-- cero, sea cual sea su estado actual. Pega esto en Supabase -> SQL
-- Editor -> Run.
-- =====================================================================
drop policy if exists "registros_select" on registros;
drop policy if exists "registros_insert" on registros;
drop policy if exists "registros_update" on registros;

create policy "registros_select" on registros for select
  using (
    is_profesor()
    or exists (
      select 1 from registro_alumnos ra
      where ra.registro_id = registros.id and ra.alumno_id = auth.uid()
    )
  );

create policy "registros_insert" on registros for insert
  with check (auth.uid() is not null);

create policy "registros_update" on registros for update
  using (
    is_profesor()
    or exists (
      select 1 from registro_alumnos ra
      where ra.registro_id = registros.id and ra.alumno_id = auth.uid()
    )
  );
