-- =====================================================================
-- ARREGLO (v6): "new row violates row-level security policy for table registros"
-- Causa: al insertar y pedir RETURNING, Postgres exige que la fila nueva
-- también sea visible según la política de SELECT. En ese instante el
-- alumno aún no tiene su fila en registro_alumnos (se crea justo después),
-- así que la política no lo reconocía todavía como "su" registro.
-- Arreglo: el creador del registro (columna creado_por) siempre puede verlo.
-- Pega esto en Supabase -> SQL Editor -> Run.
-- =====================================================================

drop policy if exists "registros_select" on registros;
create policy "registros_select" on registros for select
  using (
    is_profesor()
    or creado_por = auth.uid()
    or exists (
      select 1 from registro_alumnos ra
      where ra.registro_id = registros.id and ra.alumno_id = auth.uid()
    )
  );

drop policy if exists "registros_update" on registros;
create policy "registros_update" on registros for update
  using (
    is_profesor()
    or creado_por = auth.uid()
    or exists (
      select 1 from registro_alumnos ra
      where ra.registro_id = registros.id and ra.alumno_id = auth.uid()
    )
  );
