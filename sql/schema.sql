-- =====================================================================
-- ESQUEMA: Registro de operaciones de hardware en taller
-- Pégalo entero en Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- PERFILES (alumno / profesor) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('alumno','profesor')),
  created_at timestamptz default now()
);

-- ---------- EQUIPOS (se nutre del Excel "InventarioTallerMontaje") ----------
-- Las columnas siguen el mismo nombre/orden que tu Excel para poder
-- importarlo directamente desde Supabase → Table editor → Import CSV.
create table if not exists equipos (
  id bigint generated always as identity primary key,
  codigo text unique not null,        -- Excel: ID (ej. "MME_FP_VIA01")
  tipo text,                          -- Excel: TIPO (ej. "ThinkCentre Lenovo")
  modelo_basico text,                 -- Excel: MODELO BASICO
  modelo text,                        -- Excel: MODELO
  sn text unique,                     -- Excel: SN (número de serie)
  product_id text,                    -- Excel: PRODUCT ID
  educa_serial text,                  -- Excel: EDUCA SERIAL
  ram text,                           -- Excel: RAM
  disco text,                         -- Excel: DISCO
  procesador text,                    -- Excel: PROCESADOR
  notas_inventario text,              -- Excel: NOTAS (incidencias/estado conocido del equipo)
  origen text,
  anio_entrada_taller int,
  estado text not null default 'libre'
    check (estado in ('libre','ocupado','en_revision')),
  ultima_modificacion_por uuid references profiles(id),
  ultima_modificacion_en timestamptz,
  ultimo_estado_funcional text,
  foto_url text,
  fotos_urls text[] not null default '{}',
  created_at timestamptz default now()
);

-- Historial: guarda el estado ANTERIOR del equipo cada vez que se edita,
-- para que ninguna modificación del inventario se pierda ni se sobrescriba
-- sin dejar rastro.
create table if not exists equipos_historial (
  id bigint generated always as identity primary key,
  equipo_id bigint not null references equipos(id) on delete cascade,
  datos_anteriores jsonb not null,
  modificado_por uuid references profiles(id),
  modificado_en timestamptz not null default now()
);

create or replace function registrar_historial_equipo()
returns trigger language plpgsql security definer set search_path = public as $$
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

-- ---------- BLOQUES LECTIVOS (horario) ----------
create table if not exists bloques_lectivos (
  id bigint generated always as identity primary key,
  nombre text not null,               -- ej: "2ª hora"
  dia_semana int not null check (dia_semana between 1 and 7), -- 1=lunes ... 7=domingo
  hora_inicio time not null,
  hora_fin time not null
);

-- ---------- REGISTROS (una operación sobre un equipo, puede ser en grupo) ----------
create table if not exists registros (
  id bigint generated always as identity primary key,
  equipo_id bigint not null references equipos(id),
  bloque_lectivo_id bigint references bloques_lectivos(id), -- ya no se usa activamente
  fuera_de_bloque boolean not null default false,            -- ya no se usa activamente
  fecha_inicio timestamptz not null default now(),
  fecha_fin timestamptz,
  enviado_revision_en timestamptz,
  dias_trabajados int not null default 1,             -- ya no se usa activamente
  ultima_actividad_fecha date not null default current_date, -- ya no se usa activamente
  fechas_actividad date[] not null default array[current_date], -- ya no se usa activamente
  bloques_contados text[] not null default '{}',
  tiempo_conectado_segundos int not null default 0,
  conexion_iniciada_en timestamptz,
  estado text not null default 'abierto'
    check (estado in ('abierto','en_revision','revisado')),
  estado_equipo_final text
    check (estado_equipo_final in (
      'desmontado_no_funcional','desmontado_funcional','piezas_fuera_no_funcional',
      'parcial_no_funcional','parcial_funcional','montado_no_funcional','montado_funcional'
    )),
  desperfecto boolean default false,
  terminado boolean default false,
  ayuda_recibida boolean default false,
  ayuda_recibida_de uuid[],
  titulo text,
  registro_anterior_id bigint references registros(id), -- ya no se usa activamente
  cerrado_automaticamente boolean default false,          -- ya no se usa activamente
  revisado_por uuid references profiles(id),
  revisado_en timestamptz,
  creado_por uuid references profiles(id),
  created_at timestamptz default now()
);

-- ---------- PARTICIPACIÓN DE CADA ALUMNO EN UN REGISTRO ----------
create table if not exists registro_alumnos (
  id bigint generated always as identity primary key,
  registro_id bigint not null references registros(id) on delete cascade,
  alumno_id uuid not null references profiles(id),
  descripcion_operaciones text,
  problemas_encontrados text,
  resultados_obtenidos text,
  foto_url text,
  fotos_urls text[] not null default '{}',
  updated_at timestamptz default now(),
  unique (registro_id, alumno_id)
);

-- ---------- NOTAS PRIVADAS DEL PROFESOR (nunca visibles para alumnos) ----------
create table if not exists notas_profesor (
  id bigint generated always as identity primary key,
  registro_id bigint not null references registros(id) on delete cascade,
  profesor_id uuid not null references profiles(id),
  nota text not null,
  created_at timestamptz default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table profiles enable row level security;
alter table equipos enable row level security;
alter table bloques_lectivos enable row level security;
alter table registros enable row level security;
alter table registro_alumnos enable row level security;
alter table notas_profesor enable row level security;

-- función auxiliar: ¿el usuario actual es profesor?
-- SECURITY DEFINER: evita que esta consulta interna vuelva a pasar por la
-- política de seguridad de "profiles" (que también llama a is_profesor()),
-- lo que causaría una recursión infinita ("stack depth limit exceeded").
create or replace function is_profesor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and rol = 'profesor'
  );
$$;

-- PROFILES: cualquier autenticado puede ver el nombre de los demás (hace
-- falta para el selector de "quién te ha ayudado" y para que el profesor
-- vea el nombre de cada alumno).
create policy "profiles_select" on profiles for select
  using (auth.uid() is not null);
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid());

-- EQUIPOS: todos los autenticados pueden leer; cualquier autenticado puede
-- crear/editar (alumno o profesor); solo el profesor puede borrar.
create policy "equipos_select" on equipos for select using (auth.uid() is not null);
create policy "equipos_insert_autenticado" on equipos for insert with check (auth.uid() is not null);
create policy "equipos_update_estado" on equipos for update using (auth.uid() is not null);
create policy "equipos_delete_profesor" on equipos for delete using (is_profesor());

alter table equipos_historial enable row level security;
create policy "equipos_historial_select" on equipos_historial for select
  using (auth.uid() is not null);

-- BLOQUES LECTIVOS: lectura para todos, escritura solo profesor
create policy "bloques_select" on bloques_lectivos for select using (auth.uid() is not null);
create policy "bloques_write_profesor" on bloques_lectivos for all using (is_profesor());

-- REGISTROS: alumno ve los suyos (donde participa, o los que ha creado él
-- mismo -- esto último hace falta para que, justo al crearlo, Postgres
-- pueda devolver la fila con RETURNING sin lanzar un error de RLS) + el
-- profesor ve todos.
create policy "registros_select" on registros for select
  using (
    is_profesor()
    or creado_por = auth.uid()
    or exists (select 1 from registro_alumnos ra where ra.registro_id = registros.id and ra.alumno_id = auth.uid())
  );
create policy "registros_insert" on registros for insert
  with check (auth.uid() is not null);
-- El cierre automático de bloque puede correr desde la sesión de
-- cualquier usuario, no solo del dueño del registro, así que el update
-- se deja abierto a cualquier autenticado.
create policy "registros_update" on registros for update
  using (auth.uid() is not null);

-- El profesor puede borrar cualquier registro en cualquier momento; el
-- alumno solo puede borrar los suyos si TODAVÍA no han sido revisados.
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

-- función auxiliar: ¿el usuario actual es profesor? (definida arriba)

-- REGISTRO_ALUMNOS: cada alumno ve su propia fila; el profesor ve todas.
-- (Nota: la app no muestra a un alumno las filas de sus compañeros de
-- grupo, solo el profesor las ve todas, así que no hace falta una
-- consulta que se referencie a sí misma -- eso causaba recursión infinita.)
create policy "registro_alumnos_select" on registro_alumnos for select
  using (
    is_profesor()
    or alumno_id = auth.uid()
  );
-- Igual que arriba: el cierre automático necesita poder crear la
-- participación de continuación en nombre de otro alumno.
create policy "registro_alumnos_insert" on registro_alumnos for insert
  with check (auth.uid() is not null);
create policy "registro_alumnos_update_own" on registro_alumnos for update
  using (alumno_id = auth.uid());

-- NOTAS_PROFESOR: SOLO el profesor puede leer o escribir. Los alumnos NUNCA.
create policy "notas_profesor_all" on notas_profesor for all
  using (is_profesor()) with check (is_profesor());

-- =====================================================================
-- Trigger: cuando se crea un usuario en auth.users, si viene con metadata
-- de rol/nombre (lo pone el profesor al crear la cuenta), crea su profile.
-- =====================================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    coalesce(new.raw_user_meta_data->>'rol', 'alumno')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- Almacenamiento de fotos (ficha del equipo y fotos de operaciones)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

create policy "fotos_lectura_publica" on storage.objects for select
  using (bucket_id = 'fotos');
create policy "fotos_subida_autenticados" on storage.objects for insert
  with check (bucket_id = 'fotos' and auth.uid() is not null);
create policy "fotos_actualizacion_autenticados" on storage.objects for update
  using (bucket_id = 'fotos' and auth.uid() is not null);

-- =====================================================================
-- Datos de ejemplo para bloques lectivos (ajusta a tu horario real)
-- =====================================================================
-- insert into bloques_lectivos (nombre, dia_semana, hora_inicio, hora_fin) values
-- ('1ª hora', 1, '08:30', '09:25'),
-- ('2ª hora', 1, '09:25', '10:20'),
-- ('3ª hora', 1, '10:20', '11:15');
