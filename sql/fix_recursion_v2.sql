-- =====================================================================
-- ARREGLO DEFINITIVO de "stack depth limit exceeded" / recursión infinita
-- en registro_alumnos. Pega esto en Supabase -> SQL Editor -> Run.
--
-- La causa: cualquier política que vuelva a consultar la MISMA tabla
-- (aunque sea a través de una función) puede acabar disparándose a sí
-- misma en bucle. La solución simple y robusta es no volver a consultar
-- registro_alumnos dentro de su propia política: cada alumno solo
-- necesita ver SU PROPIA fila (la app ya no muestra las de compañeros
-- a otros alumnos, solo al profesor).
-- =====================================================================

drop policy if exists "registro_alumnos_select" on registro_alumnos;

create policy "registro_alumnos_select" on registro_alumnos for select
  using (
    is_profesor()
    or alumno_id = auth.uid()
  );

-- Ya no hace falta la función auxiliar del intento anterior
drop function if exists es_miembro_de_registro(bigint);
