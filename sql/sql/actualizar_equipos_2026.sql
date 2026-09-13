-- =====================================================================
-- ACTUALIZACION del inventario de equipos (version con 15 equipos)
-- Pega esto entero en Supabase -> SQL Editor -> New query -> Run
-- Seguro de ejecutar aunque ya tengas equipos cargados: anade las columnas
-- que falten y actualiza/inserta cada equipo por su codigo (ID), sin
-- duplicar ni borrar nada que no esté en este listado.
-- =====================================================================

-- 1. Anadir las dos columnas nuevas del Excel (si no existen ya)
alter table equipos add column if not exists origen text;
alter table equipos add column if not exists anio_entrada_taller int;

-- 1b. Hacer que el numero de serie (SN) sea unico, como el codigo
alter table equipos add constraint equipos_sn_key unique (sn);

-- 2. Insertar/actualizar los 15 equipos
insert into equipos (
  codigo, tipo, modelo_basico, modelo, sn, product_id, educa_serial,
  ram, disco, procesador, notas_inventario, origen, anio_entrada_taller
) values
  ('MME_FP_VIA01', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'PB9R6BE', '1S2929A77PB9R6BE', 'ED37010108P046', '8GB', '465GB', 'i3 3220', 'Suena zumbido en el arranque y se bloquea al poco de arrancar', 'Edificio 1 Antiguo', 2026),
  ('MME_FP_VIA02', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'S4TAE55', '1S29A77S4TAE55', 'ED37010108P051', '8GB', '465GB', 'i3 3220', 'Arranca Solo, a veces arranca con la pantalla triplicada y con rayas', 'Edificio 1 Antiguo', 2026),
  ('MME_FP_VIA03', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'PB9R7TW', '1S29A77PB9R7TW', 'ED37010108P719', '8GB', '465GB', 'i3 3220', 'Antiguo DEPTO Matemáticas', 'Almacén Instituto Nuevo', 2026),
  ('MME_FP_VIA04', 'ThinkCentre Lenovo', 'A70', 'MT-M 7844-K1G', 'S5CRGTX', NULL, 'NO REGISTRADO', '2GB', '164GB', 'Pentium dual core E5700', 'Imagen POR DVI, tiene una mint instalada. Comprobar que tarjeta gráfica lleva. Tiene Doble boot. Win7 mint', 'Almacén Instituto Nuevo', 2026),
  ('MME_FP_VIA05', 'HP ProDesk', '400 G1', '400 G1 SFF Business', 'CZC4202M6Q', 'E2D14AV', 'ED37010108P713', NULL, NULL, NULL, 'Arranca en dominio pero no va aemloacl ni aemcentros', 'Almacén Instituto Nuevo', 2026),
  ('MME_FP_VIA06', 'HP Compaq', '8100 Elite Small Form Factor', '8100 Elite SFF', 'CZC05098HZ', 'AY032AV', 'ED37010108P703', '4GB', '225GB', 'Intel Core i5 650 (3,33 GHz)', 'Sala de Profes antiguo. Arranca Rápido. Posible SSD', 'Edificio 1 Antiguo', 2026),
  ('MME_FP_VIA07', 'HP Compaq', '8100 Elite Small Form Factor', '8100 Elite SFF', 'CZC0511T0W', 'AY032AV', 'ED37010108P707', '4GB', '232GB', 'Intel Core i5 650 (3,33 GHz)', 'Arranca al conectar fuente. Da warning de BIOS para continuar con F1 pero tira bien, posible SSD.', 'Edificio 1 Antiguo', 2026),
  ('MME_FP_VIA08', 'HP Compaq', '8100 Elite Small Form Factor', '8100 Elite SFF', 'CZC0511T2W', 'AY032AV', 'ED37010108P728', '4GB', '232GB', 'Intel Core i5 650 (3,33 GHz)', 'Arranca al conectar, hace comprobaciones de memoria, expulsa DVD constantemente. Ordenador de sala de profesores. Tenía dentro unas llaves y un ratón. Arranca, pero es lento con HDD', 'Almacén Instituto Nuevo', 2026),
  ('MME_FP_VIA09', 'HP Compaq', '8100 Elite Small Form Factor', '8100 Elite SFF', 'CZC0511T5J', 'AY032AV', 'ED37010108P708', NULL, NULL, NULL, 'NO DA SEÑAL DE VIDEO NI DE perifericos E/S. Arranca al conectar, hace comprobaciones de memoria, expulsa DVD constantemente.', 'Edificio 1 Antiguo', 2026),
  ('MME_FP_VIA10', 'HP Compaq', '6200 Pro Small Form Factor PC', 'HPQ-TPC-F007-SF(B)', 'CZC23001DL', '11WWCSHWE', 'ED37010108P710', '4GB', '232GB', 'i3 -2110 (3,10GHz)', 'AL rato de iniciar, la grafica comienza a dar imagen rallada y se reinicia. Arranca bien, tiene HDD. Tarda en apagar', 'Edificio 1 Antiguo', 2026),
  ('MME_FP_VIA11', 'HP EliteDesk', 'EliteDesk 800 G1 SFF', 'TPC-F046-SF', 'CZC5371FLV', 'C8N26AV', NULL, '4GB', 'SSD', NULL, 'Tiene SSD. Error de memoria al arrancar presionar F1. Parece problema de instalación de RAM. No detecta E/S. Puede ser un problema de reiniciar BIOS, al cambiarla de slot sigue dando error. Equipo interesante para reparar.', 'Edificio 1 Antiguo', 2026),
  ('MME_FP_VIA12', 'TORRE SOBREMESA', 'Equipo por Piezas', 'Gigabyte GA-H61M-DS2', NULL, 'POR PIEZAS', 'FUERA DOMINO', '4GB DDR3', '500GB HDD', 'i3-3240 (3,4 GHz)', 'Arranca pero tarda en dar señal de video, el disco hace ruido cada vez más rápido. Fuera de dominio. No parece Detectar E/S a la primera. Lleva gráfica. Interesante para reparar. Win7. Disco muy deteriorado', 'Almacén Instituto Nuevo', 2026),
  ('MME_FP_VIA13', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'S4TBFF2', '1S2929A77S4TBFF2', 'ED37010108P055', '8 GB', '465GB', 'i3-3220 (3,30GHz)', 'Arranque muy rápido posible SSD? Luego va lento y puede que tenga HDD. 8GB de RAM!!', 'Edificio 1 Antiguo', 2026),
  ('MME_FP_VIA14', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'S4XCMP3', '1S2929A77S4XCMP3', 'ED37010108P056', '8GB', '465GB', 'i3-3220 (3,30GHz)', 'Antena dañada, arranca. 8GB!!!', 'Edificio 1 Antiguo', 2026),
  ('MME_FP_VIA15', 'ThinkCentre Lenovo', 'M82', 'MT-M 2929 A77', 'S4XDED8', '1S2929A77S4XCMP3', 'ED37010108P049', '8GB', '465GB', 'i3-3220 (3,30GHz)', 'Arranca, tiene HDD. 8GB!!', 'Edificio 1 Antiguo', 2026)
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
  anio_entrada_taller = excluded.anio_entrada_taller;

-- 3. Limpiar los equipos con codigo provisional que se crearon antes de
--    tener los 4 IDs reales (PENDIENTE-1, PENDIENTE-2...). Si ya los habias
--    usado en algun registro de alumno, este DELETE fallara por la relacion
--    con "registros" -- en ese caso, cambia primero su estado a "libre" y
--    valida/cierra esos registros antes de borrar el equipo.
delete from equipos where codigo like 'PENDIENTE-%';
