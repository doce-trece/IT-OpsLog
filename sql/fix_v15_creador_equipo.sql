-- =====================================================================
-- MIGRACION v15: quién dio de alta cada equipo (no solo quién lo modificó)
-- Pega esto entero en Supabase -> SQL Editor -> Run
-- =====================================================================

alter table equipos add column if not exists creado_por uuid references profiles(id);

-- Trigger: al crear un equipo, guarda automáticamente quién lo dio de alta.
create or replace function registrar_creador_equipo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.creado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists trigger_creador_equipo on equipos;
create trigger trigger_creador_equipo
  before insert on equipos
  for each row execute function registrar_creador_equipo();

-- Nota: esto solo aplica a partir de ahora. Los equipos que ya existían
-- se quedan sin "dado de alta por" (no hay forma de saberlo a posteriori),
-- pero si alguno tiene historial de modificaciones seguirá mostrándose.
