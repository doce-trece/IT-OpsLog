-- =====================================================================
-- MIGRACION v13: clases/grupos, inventario por clase, FPB1 solo inventario
-- Pega esto entero en Supabase -> SQL Editor -> Run
-- =====================================================================

-- 1. Tabla de clases/espacios (puedes anadir mas desde el panel del profesor)
create table if not exists clases (
  id bigint generated always as identity primary key,
  nombre text unique not null,
  permite_operaciones boolean not null default true
);

alter table clases enable row level security;
drop policy if exists "clases_select" on clases;
create policy "clases_select" on clases for select using (auth.uid() is not null);
drop policy if exists "clases_write_profesor" on clases;
create policy "clases_write_profesor" on clases for all using (is_profesor()) with check (is_profesor());

-- Semilla: SMR2 (con operaciones) y FPB1 (solo inventario, de momento)
insert into clases (nombre, permite_operaciones) values
  ('SMR2', true),
  ('FPB1', false)
on conflict (nombre) do nothing;

-- 2. Cada alumno pertenece a una clase (el profesor no necesita ninguna)
alter table profiles add column if not exists clase_id bigint references clases(id);

-- 3. Cada equipo pertenece obligatoriamente a una clase
alter table equipos add column if not exists clase_id bigint references clases(id);

-- 4. Funciones auxiliares (SECURITY DEFINER para evitar recursion en RLS,
--    igual que con is_profesor())
create or replace function clase_actual()
returns bigint language sql stable security definer set search_path = public as 84
  select clase_id from profiles where id = auth.uid();
84;

create or replace function puede_gestionar_equipo(p_clase_id bigint)
returns boolean language sql stable security definer set search_path = public as 84
  select is_profesor() or clase_actual() = p_clase_id;
84;

create or replace function puede_operar_equipo(p_equipo_id bigint)
returns boolean language sql stable security definer set search_path = public as 84
  select
    is_profesor()
    or exists (
      select 1 from equipos eq
      join clases c on c.id = eq.clase_id
      where eq.id = p_equipo_id
        and eq.clase_id = clase_actual()
        and c.permite_operaciones = true
    );
84;

-- 5. Actualizar el inventario con los 23 equipos y su clase asignada
--    (upsert por codigo: actualiza si ya existia, inserta si es nuevo)
insert into equipos (
  codigo, tipo, modelo_basico, modelo, sn, product_id, educa_serial,
  ram, disco, procesador, notas_inventario, origen, anio_entrada_taller, clase_id
) values
  ('MME_FP_VIA01', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'PB9R6BE', '1S2929A77PB9R6BE', 'ED37010108P046', '8GB', '465GB', 'i3 3220', 'Suena zumbido en el arranque y se bloquea al poco de arrancar', 'Edificio 1 Antiguo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA02', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'S4TAE55', '1S29A77S4TAE55', 'ED37010108P051', '8GB', '465GB', 'i3 3220', 'Arranca Solo, a veces arranca con la pantalla triplicada y con rayas', 'Edificio 1 Antiguo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA03', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'PB9R7TW', '1S29A77PB9R7TW', 'ED37010108P719', '8GB', '465GB', 'i3 3220', 'Antiguo DEPTO Matemáticas', 'Almacén Instituto Nuevo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA04', 'ThinkCentre Lenovo', 'A70', 'MT-M 7844-K1G', 'S5CRGTX', NULL, 'NO REGISTRADO', '2GB', '164GB', 'Pentium dual core E5700', 'Imagen POR DVI, tiene una mint instalada. Comprobar que tarjeta gráfica lleva. Tiene Doble boot. Win7 mint', 'Almacén Instituto Nuevo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA05', 'HP ProDesk', '400 G1', '400 G1 SFF Business', 'CZC4202M6Q', 'E2D14AV', 'ED37010108P713', NULL, NULL, NULL, 'Arranca en dominio pero no va aemloacl ni aemcentros', 'Almacén Instituto Nuevo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA06', 'HP Compaq', '8100 Elite Small Form Factor', '8100 Elite SFF', 'CZC05098HZ', 'AY032AV', 'ED37010108P703', '4GB', '225GB', 'Intel Core i5 650 (3,33 GHz)', 'Sala de Profes antiguo. Arranca Rápido. Posible SSD', 'Edificio 1 Antiguo', 2026, (select id from clases where nombre = 'FPB1')),
  ('MME_FP_VIA07', 'HP Compaq', '8100 Elite Small Form Factor', '8100 Elite SFF', 'CZC0511T0W', 'AY032AV', 'ED37010108P707', '4GB', '232GB', 'Intel Core i5 650 (3,33 GHz)', 'Arranca al conectar fuente. Da warning de BIOS para continuar con F1 pero tira bien, posible SSD.', 'Edificio 1 Antiguo', 2026, (select id from clases where nombre = 'FPB1')),
  ('MME_FP_VIA08', 'HP Compaq', '8100 Elite Small Form Factor', '8100 Elite SFF', 'CZC0511T2W', 'AY032AV', 'ED37010108P728', '4GB', '232GB', 'Intel Core i5 650 (3,33 GHz)', 'Arranca al conectar, hace comprobaciones de memoria, expulsa DVD constantemente. Ordenador de sala de profesores. Tenía dentro unas llaves y un ratón. Arranca, pero es lento con HDD', 'Almacén Instituto Nuevo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA09', 'HP Compaq', '8100 Elite Small Form Factor', '8100 Elite SFF', 'CZC0511T5J', 'AY032AV', 'ED37010108P708', NULL, NULL, NULL, 'NO DA SEÑAL DE VIDEO NI DE perifericos E/S. Arranca al conectar, hace comprobaciones de memoria, expulsa DVD constantemente.', 'Edificio 1 Antiguo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA10', 'HP Compaq', '6200 Pro Small Form Factor PC', 'HPQ-TPC-F007-SF(B)', 'CZC23001DL', '11WWCSHWE', 'ED37010108P710', '4GB', '232GB', 'i3 -2110 (3,10GHz)', 'AL rato de iniciar, la grafica comienza a dar imagen rallada y se reinicia. Arranca bien, tiene HDD. Tarda en apagar', 'Edificio 1 Antiguo', 2026, (select id from clases where nombre = 'FPB1')),
  ('MME_FP_VIA11', 'HP EliteDesk', 'EliteDesk 800 G1 SFF', 'TPC-F046-SF', 'CZC5371FLV', 'C8N26AV', NULL, '4GB', 'SSD', NULL, 'Tiene SSD. Error de memoria al arrancar presionar F1. Parece problema de instalación de RAM. No detecta E/S. Puede ser un problema de reiniciar BIOS, al cambiarla de slot sigue dando error. Equipo interesante para reparar.', 'Edificio 1 Antiguo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA12', 'TORRE SOBREMESA', 'Equipo por Piezas', 'Gigabyte GA-H61M-DS2', NULL, 'POR PIEZAS', 'FUERA DOMINO', '4GB DDR3', '500GB HDD', 'i3-3240 (3,4 GHz)', 'Arranca pero tarda en dar señal de video, el disco hace ruido cada vez más rápido. Fuera de dominio. No parece Detectar E/S a la primera. Lleva gráfica. Interesante para reparar. Win7. Disco muy deteriorado', 'Almacén Instituto Nuevo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA13', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'S4TBFF2', '1S2929A77S4TBFF2', 'ED37010108P055', '8 GB', '465GB', 'i3-3220 (3,30GHz)', 'Arranque muy rápido posible SSD? Luego va lento y puede que tenga HDD. 8GB de RAM!!', 'Edificio 1 Antiguo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA14', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'S4XCMP3', '1S2929A77S4XCMP3', 'ED37010108P056', '8GB', '465GB', 'i3-3220 (3,30GHz)', 'Antena dañada, arranca. 8GB!!!', 'Edificio 1 Antiguo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA15', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'S4XDED8', '1S2929A77S4XCMP3', 'ED37010108P049', '8GB', '465GB', 'i3-3220 (3,30GHz)', 'Arranca, tiene HDD. 8GB!!', 'Edificio 1 Antiguo', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA16', 'Asus Clónico', 'P5R8L/DP', 'Clónico', 'PL640000M035687', NULL, NULL, NULL, NULL, NULL, 'Referencia por número de placa. Arranca, pero no tiene disco conectado, pita por lo que parece problemas de memoria o CPU, sin frontal, carcasa sin atornillar', 'Edificio 1 Antiguo FPB1', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA17', 'Asus SFF', 'Parece clonico pero SFF', NULL, NULL, NULL, 'FUERA DOMINO', '3GB', '20GB y 50GB', 'Intel Core 2 6500 2,13GHz', 'Fuerte sonido , de ventiladores. Le cuesta arrancar pero llega a la BIOS', 'Edificio 1 Antiguo FPB1', 2026, (select id from clases where nombre = 'SMR2')),
  ('MME_FP_VIA18', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'S4VKKL2', '1S2929A77S4VKKL2', '??', NULL, NULL, NULL, 'NO ARRANCA, DA ERROR SIN VIDEO, sonido de intento de inicio de ventilador, disco o algo. Puede que falten peizas o conexión por haber estado en el taller de montaje del curso pasado', 'SMR2', 2025, (select id from clases where nombre = 'FPB1')),
  ('MME_FP_VIA19', 'ThinkCentre Lenovo', 'M91p', 'MT-M 4518 W8W', 'S4DDXG8', '1S4518W8WS4DDXG8', 'ED37010108P045', '4GB', 'SSD?', 'Intel Core i5 2400 3,10GHz', 'Arranca al encender, arranca windows. El disco no suena mucho y arranca rápido. FUERA DE DOMINIO, Formateado por Capitán en su momento durante 25/26. No tenemos contraseña', 'SMR2', 2025, (select id from clases where nombre = 'FPB1')),
  ('MME_FP_VIA20', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'S4TBLA1', '1S2929A77S4TBLA1', 'ED37010108P043', '8GB', '465GB', 'i3-3220 (3,30GHz)', 'Suenan cosas sueltas dentro, Arranca al encender, tiene sistema win10. FUERA DE DOMINO. Usuario SI Password Si', 'SMR2', 2025, (select id from clases where nombre = 'FPB1')),
  ('MME_FP_VIA21', 'Futijsu ESPRIMO C5730 E-Star', NULL, 'USD-D2804', 'YKLT068233', 'C5730P0022SE', 'ED37010108P073', '4GB', '160GB ?', 'Intel Core Duo E7400 (2.80GHz)', 'Arranca al conectar, suena poco y tiene una Mint, Tarda', 'SMR2', 2025, (select id from clases where nombre = 'FPB1')),
  ('MME_FP_VIA22', 'Futijsu ESPRIMO C5730 E-Star', NULL, 'USD-D2804', 'YKLT068233', 'C5730P0022SE', 'ED37010108P073', '4GB', '160GB', 'Intel Core Duo E7400 (2.80GHz)', 'Hace un primer arranque con bastante Ruido, pero arranca con una Mint. Instalado por Mario, NO ENCUENTRO SERIAL NUMBER ÚNICO, INDISTINGUIBLE. Excepto por la etiqueta de DOMINIO', 'SMR2', 2025, (select id from clases where nombre = 'FPB1')),
  ('MME_FP_VIA23', 'Innobo Torre', 'INNOBO INN15315', 'INN15315-16469', 1531500298, NULL, NULL, NULL, NULL, NULL, 'Le falta la FA, placa foxxvonn, tiene memotia y hdd', 'SMR2', 2025, (select id from clases where nombre = 'FPB1'))
on conflict (codigo) do update set
  tipo = excluded.tipo,
  modelo_basico = excluded.modelo_basico,
  modelo = excluded.modelo,
  sn = excluded.sn,
  product_id = excluded.product_id,
  educa_serial = excluded.educa_serial,
  ram = excluded.ram,
  disco = excluded.disco,
  procesador = excluded.procesador,
  notas_inventario = excluded.notas_inventario,
  origen = excluded.origen,
  anio_entrada_taller = excluded.anio_entrada_taller,
  clase_id = excluded.clase_id;

-- Limpieza de los equipos provisionales de la primera importacion, si
-- todavia quedaba alguno sin ID real
delete from equipos where codigo like 'PENDIENTE-%';

-- 6. Si por lo que sea quedara algun equipo sin clase (no deberia, revisa
--    el resultado de esta consulta despues de ejecutar el script):
--    select codigo from equipos where clase_id is null;
--    Como red de seguridad, para que la restriccion NOT NULL no rompa
--    nada, los que se queden sin clase se asignan a la primera que exista.
--    CAMBIALOS A MANO si no es correcto.
update equipos set clase_id = (select id from clases order by id limit 1)
where clase_id is null;

alter table equipos alter column clase_id set not null;

-- 7. Politicas de seguridad: cada clase ve y gestiona SOLO su propio
--    inventario; el profesor ve y gestiona todas.
drop policy if exists "equipos_select" on equipos;
create policy "equipos_select" on equipos for select
  using (is_profesor() or clase_id = clase_actual());

drop policy if exists "equipos_insert_autenticado" on equipos;
create policy "equipos_insert_autenticado" on equipos for insert
  with check (puede_gestionar_equipo(clase_id));

drop policy if exists "equipos_update_estado" on equipos;
create policy "equipos_update_estado" on equipos for update
  using (puede_gestionar_equipo(clase_id))
  with check (puede_gestionar_equipo(clase_id));

-- 8. Solo se puede abrir un registro de operaciones sobre un equipo de tu
--    propia clase, y solo si esa clase tiene las operaciones activadas
--    (FPB1 las tiene desactivadas de momento).
drop policy if exists "registros_insert" on registros;
create policy "registros_insert" on registros for insert
  with check (auth.uid() is not null and puede_operar_equipo(equipo_id));

-- =====================================================================
-- Despues de ejecutar esto, en Supabase -> Table Editor -> profiles,
-- asigna a cada alumno su clase_id (el id de SMR2 o FPB1 en la tabla
-- clases). Los alumnos sin clase asignada no podran ver ningun equipo.
-- =====================================================================
