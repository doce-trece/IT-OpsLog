-- =====================================================================
-- MIGRACION v12: varias fotos (equipos y operaciones)
-- Pega esto entero en Supabase -> SQL Editor -> Run
-- =====================================================================

alter table equipos add column if not exists fotos_urls text[] not null default '{}';
alter table registro_alumnos add column if not exists fotos_urls text[] not null default '{}';

-- Si ya habías subido alguna foto suelta con la versión anterior, la
-- migramos como primer elemento de la nueva lista.
update equipos
set fotos_urls = array[foto_url]
where foto_url is not null and (fotos_urls is null or fotos_urls = '{}');

update registro_alumnos
set fotos_urls = array[foto_url]
where foto_url is not null and (fotos_urls is null or fotos_urls = '{}');
