-- =====================================================================
-- LOGIN CON USUARIO SIMPLE (en vez de email completo)
-- Pega esto en Supabase -> SQL Editor -> New query -> Run
-- =====================================================================

-- 1. Añadir un nombre de usuario simple a cada perfil (ej. "alumno1", "jgarcia")
alter table profiles add column if not exists username text unique;

-- 2. Función que traduce "usuario simple" -> email real, para poder hacer
--    login con supabase.auth.signInWithPassword() (que exige un email).
--    Es SECURITY DEFINER porque un usuario normal no tiene permiso para
--    leer auth.users directamente; esta función solo expone el email
--    correspondiente a un username, nada más.
create or replace function email_from_username(p_username text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select u.email
  from auth.users u
  join profiles p on p.id = u.id
  where p.username = p_username
  limit 1;
$$;

-- Cualquiera (incluso sin sesión iniciada) puede llamar a esta función,
-- porque hace falta ANTES de tener sesión para poder hacer login.
grant execute on function email_from_username(text) to anon, authenticated;

-- =====================================================================
-- Ahora ve a Table Editor -> profiles y rellena la columna "username"
-- para cada alumno/profesor (ej. "alumno1", "profesor1"...).
-- =====================================================================
