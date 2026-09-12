-- =====================================================================
-- MIGRACION v7: funcionalidades avanzadas
-- Pega esto entero en Supabase -> SQL Editor -> Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EQUIPOS: alumnos y profesor pueden crear/editar, con historial
-- ---------------------------------------------------------------------
alter table equipos add column if not exists ultima_modificacion_por uuid references profiles(id);
alter table equipos add column if not exists ultima_modificacion_en timestamptz;

create table if not exists equipos_historial (
  id bigint generated always as identity primary key,
  equipo_id bigint not null references equipos(id) on delete cascade,
  datos_anteriores jsonb not null,
  modificado_por uuid references profiles(id),
  modificado_en timestamptz not null default now()
);

alter table equipos_historial enable row level security;
create policy "equipos_historial_select" on equipos_historial for select
  using (auth.uid() is not null);

-- Trigger: cada vez que se actualiza un equipo, guarda el estado ANTERIOR
-- en el historial y marca quién ha hecho el cambio y cuándo.
create or replace function registrar_historial_equipo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into equipos_historial (equipo_id, datos_anteriores, modificado_por)
  values (old.id, to_jsonb(old), auth.uid());
  new.ultima_modificacion_por := auth.uid();
  new.ultima_modificacion_en := now();
  return new;
end;
$$;

drop trigger if exists trigger_historial_equipo on equipos;
create trigger trigger_historial_equipo
  before update on equipos
  for each row execute function registrar_historial_equipo();

-- Permitir a CUALQUIER autenticado (alumno o profesor) crear y editar
-- equipos, no solo al profesor. Borrar equipos se queda solo para el
-- profesor, por seguridad.
drop policy if exists "equipos_write_profesor" on equipos;
create policy "equipos_insert_autenticado" on equipos for insert
  with check (auth.uid() is not null);

-- ---------------------------------------------------------------------
-- 2. PROFILES: cualquier autenticado puede ver el nombre de los demás
--    (hace falta para el selector de "quién te ha ayudado" y para que
--    el profesor vea el nombre del alumno en cada registro)
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select
  using (auth.uid() is not null);

-- ---------------------------------------------------------------------
-- 3. REGISTROS: nuevos estados del equipo, quién ayudó, borrado
-- ---------------------------------------------------------------------
alter table registros drop constraint if exists registros_estado_equipo_final_check;
alter table registros add constraint registros_estado_equipo_final_check
  check (estado_equipo_final in (
    'desmontado_no_funcional',
    'desmontado_funcional',
    'piezas_fuera_no_funcional',
    'parcial_no_funcional',
    'parcial_funcional',
    'montado_no_funcional',
    'montado_funcional'
  ));

alter table registros add column if not exists ayuda_recibida_de uuid references profiles(id);

-- El profesor puede borrar cualquier registro en cualquier momento.
-- El alumno solo puede borrar los suyos SI todavía no han sido revisados.
create policy "registros_delete" on registros for delete
  using (
    is_profesor()
    or (
      estado <> 'revisado'
      and (
        creado_por = auth.uid()
        or exists (select 1 from registro_alumnos ra where ra.registro_id = registros.id and ra.alumno_id = auth.uid())
      )
    )
  );

-- =====================================================================
-- Con esto termina la migración. La lógica de "continuar el diario del
-- bloque anterior" y las nuevas pantallas del profesor van en el código
-- de la aplicación (ya actualizado en el proyecto), no hace falta nada
-- más aquí.
-- =====================================================================
