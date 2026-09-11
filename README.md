# Registro de operaciones de hardware — Taller

Prototipo funcional: React + Supabase, desplegable en GitHub Pages.
Como todo corre contra Supabase (nube), funciona desde cualquier red con
internet — incluida la red corporativa de la Junta — sin necesitar un
servidor propio ni acceso local.

## 1. Crear el proyecto en Supabase

1. Ve a https://supabase.com → **New project** (plan gratuito es suficiente
   para empezar).
2. Cuando esté creado, entra en **SQL Editor** → **New query**, pega todo el
   contenido de `sql/schema.sql` y ejecútalo. Esto crea las tablas, los
   permisos de seguridad (RLS) y el trigger que crea automáticamente el
   perfil de cada usuario nuevo.
3. En **Project Settings → API** copia:
   - `Project URL`
   - `anon public key`

## 2. Configurar el proyecto local

```bash
npm install
cp .env.example .env
# edita .env y pega la URL y la clave anon de Supabase
npm run dev
```

## 3. Crear las cuentas de alumnos y profesor

Como es un centro educativo, lo más sencillo es que **tú (profesor/a)**
crees las cuentas, no que se registren solos:

1. Supabase → **Authentication → Users → Add user** (puedes poner
   `alumno1@tucentro.es` + una contraseña sencilla, o el correo real).
2. En **User metadata** (al crear el usuario) añade:
   ```json
   { "nombre": "Nombre Apellido", "rol": "alumno" }
   ```
   Para tu propia cuenta de profesor, pon `"rol": "profesor"`.
3. El trigger `handle_new_user` creará automáticamente su fila en `profiles`
   con ese nombre y rol.

   *Truco para dar de alta a 20-30 alumnos de golpe:* Supabase tiene un
   endpoint de administración (`auth.admin.createUser`) que se puede llamar
   desde un script Node con la **service_role key** (nunca la uses en el
   frontend). Si quieres, te preparo ese script de importación masiva desde
   un Excel con la lista de alumnos.

## 4. Cargar los equipos desde tu Excel

Ya tienes listo `sql/equipos_import.csv`, generado directamente a partir de
`InventarioTallerMOntaje.xlsx` con las columnas ya mapeadas a la tabla
`equipos` (codigo, tipo, modelo_basico, modelo, sn, product_id,
educa_serial, ram, disco, procesador, notas_inventario).

1. Supabase → **Table Editor → equipos → Insert → Import data from CSV**.
2. Sube `sql/equipos_import.csv`.

⚠ **4 de los 9 equipos no tenían ID en tu Excel** (los dos HP Compaq 8100,
el HP ProDesk 400 G1 y el ThinkCentre A70). Como el ID es el código único
que identifica al equipo en la app, les he puesto un código provisional
(`PENDIENTE-1`, `PENDIENTE-2`...) para que el CSV sea importable ya. Te
recomiendo asignarles un ID real en tu Excel (seguramente algo como
`MME_FP_VIA04`, `05`... siguiendo tu propia nomenclatura) y luego corregir
esos códigos en Supabase → Table Editor → equipos, o simplemente editarlos
a mano en el panel del profesor.

Si actualizas el Excel más adelante, repite el mismo proceso: vuelve a
exportar/generar el CSV y usa "Import data from CSV" (Supabase te dejará
elegir si quieres añadir filas nuevas o hacer upsert por `codigo`).

También puedes añadir o editar equipos uno a uno desde el propio panel del
profesor (pestaña "Equipos").

## 5. Configurar los bloques lectivos (horario)

En **SQL Editor**, adapta e inserta tu horario real (días 1=lunes … 7=domingo):

```sql
insert into bloques_lectivos (nombre, dia_semana, hora_inicio, hora_fin) values
('1ª hora', 1, '08:30', '09:25'),
('2ª hora', 1, '09:25', '10:20'),
('3ª hora', 1, '10:20', '11:15');
-- repite para cada día que tengas clase de taller
```

El sistema detecta automáticamente en qué bloque está el alumno según la
hora actual. Si no hay bloque activo, puede registrar la operación igualmente
marcada como "fuera de bloque" (para esos casos esporádicos que comentabas).

**Importante sobre el autocierre:** en este prototipo, el cierre automático
de operaciones sin finalizar se comprueba cada vez que alguien abre la app
(alumno o profesor). Para un cierre 100% puntual al segundo exacto en que
termina la clase, incluso sin que nadie tenga la app abierta, el siguiente
paso sería programar una **Supabase Edge Function con cron** (te la preparo
si quieres dar ese salto).

## 6. Desplegar en GitHub Pages

1. Sube este proyecto a un repositorio de GitHub.
2. En `vite.config.js`, cambia `base: '/taller-registro-operaciones/'` por
   `/nombre-de-tu-repo/`.
3. Como GitHub Pages es estático, **las variables de entorno hay que
   metértelas en el build**. La forma más cómoda: en el repo, ve a
   **Settings → Secrets and variables → Actions** y añade
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Luego usa una GitHub
   Action de despliegue (te preparo el workflow `.yml` si me confirmas que
   quieres ir por este camino) o, más simple para empezar:
   ```bash
   npm run build
   npm run deploy   # usa gh-pages, sube dist/ a la rama gh-pages
   ```
   (con esta segunda opción basta con tener el `.env` local relleno antes
   de compilar).
4. Activa GitHub Pages en el repo apuntando a la rama `gh-pages`.

La `anon key` de Supabase **no es secreta en el sentido estricto** — está
diseñada para ir en el frontend — la seguridad real la dan las políticas RLS
que ya están en `schema.sql` (cada alumno solo ve y edita lo suyo; las notas
del profesor son invisibles para los alumnos a nivel de base de datos, no
solo de interfaz).

## Cómo funciona el flujo

- **Alumno**: entra → ve el bloque lectivo actual → elige un equipo libre (o
  se une a uno "ocupado" si un compañero ya abrió un registro en grupo) →
  rellena su descripción/problemas/resultados → al terminar, marca el
  estado final del equipo y cierra. El equipo queda "en revisión" y el
  alumno no puede coger otro hasta que el profesor lo valide.
- **Si no cierra a tiempo**: al terminar el bloque lectivo, el registro se
  cierra solo (queda marcado como "cerrado automáticamente" para que lo
  veas claramente en tu panel).
- **Profesor**: ve todos los registros pendientes de revisar, el detalle de
  lo que ha escrito cada alumno por separado, puede añadir notas privadas
  (nunca visibles para el alumnado) y, al marcar "revisado", libera el
  equipo para que se pueda volver a usar.

## Próximos pasos posibles (no incluidos aún)

- Script de importación masiva de alumnos desde Excel.
- GitHub Action para desplegar automáticamente en cada `push`.
- Edge Function con cron para el autocierre exacto sin depender de que
  alguien abra la app.
- Exportar el histórico de un alumno o de un equipo a PDF/Excel.

Dime cuál de estos quieres que monte a continuación.
