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

## 6. Desplegar en GitHub Pages (automático con GitHub Actions)

Ya está todo preparado en `.github/workflows/deploy.yml`: cada vez que
subas un cambio a la rama `main`, GitHub compilará el proyecto y lo
publicará solo, sin que tengas que ejecutar nada en tu ordenador.

Pasos con el asistente de este chat más abajo. Como resumen:

1. Sube el proyecto a un repo de GitHub (rama `main`).
2. En el repo → **Settings → Secrets and variables → Actions → New
   repository secret**, crea `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
   con los valores de tu proyecto Supabase.
3. En el repo → **Settings → Pages → Build and deployment → Source**,
   elige **GitHub Actions**.
4. En `vite.config.js`, cambia `base: '/taller-registro-operaciones/'` por
   `/nombre-exacto-de-tu-repo/`.
5. Haz push. En la pestaña **Actions** del repo verás el proceso
   ejecutándose; cuando termine en verde, la web estará publicada en
   `https://tu-usuario.github.io/tu-repo/`.

### Alternativa manual (sin Actions)

Si prefieres no usar Actions, también puedes desplegar a mano:
```bash
npm install
npm run build
npm run deploy   # usa gh-pages, sube dist/ a la rama gh-pages
```
(en este caso el `.env` local tiene que estar relleno antes de compilar, y
tendrás que repetir `npm run deploy` cada vez que cambies algo).

La `anon key` de Supabase **no es secreta en el sentido estricto** — está
diseñada para ir en el frontend — la seguridad real la dan las políticas RLS
que ya están en `schema.sql` (cada alumno solo ve y edita lo suyo; las notas
del profesor son invisibles para los alumnos a nivel de base de datos, no
solo de interfaz).

## 7. Login con usuario simple y recuperación de contraseña

Por defecto Supabase exige el email completo para iniciar sesión. Para que
alumnos y profesor entren con un usuario corto (tipo `alumno1`) en vez de
memorizar el correo, y puedan recuperar su contraseña ellos mismos:

1. Supabase → **SQL Editor** → pega y ejecuta `sql/usuario_simple.sql`.
   Esto añade una columna `username` a `profiles` y una función que
   traduce usuario → email para poder iniciar sesión.
2. Table Editor → **profiles** → rellena la columna `username` para cada
   alumno y para ti (profesor). Debe ser único (ej. `alumno1`, `mgarcia`,
   `profesor`).
3. Authentication → **URL Configuration**: añade la URL pública de tu web
   (la de GitHub Pages, ej. `https://doce-trece.github.io/IT-OpsLog/`)
   tanto en **Site URL** como en **Redirect URLs**. Sin esto, el enlace de
   recuperación de contraseña no podrá volver a tu web.
4. Vuelve a desplegar (o simplemente usa la web ya desplegada, no hace
   falta tocar el código para este cambio si ya subiste estos archivos).

**Cómo funciona para el usuario:** en el login escriben su `username` y su
contraseña. Si no la recuerdan, pulsan "¿Has olvidado tu contraseña?",
escriben su `username` de nuevo, y Supabase les envía un correo con un
enlace. Al pulsarlo, vuelven a la web y les aparece una pantalla para
elegir una contraseña nueva.

*Nota: el email al que llega el enlace lo manda el propio Supabase (con su
plantilla y remitente por defecto en el plan gratuito). Si prefieres que
los correos salgan con el dominio/remitente de tu centro, en Authentication
→ Emails puedes configurar un servidor SMTP propio más adelante.*

## 9. Funcionalidades avanzadas (v7)

Ejecuta `sql/fix_v7_funcionalidades_avanzadas.sql` en el SQL Editor de
Supabase para activar todo esto:

- **Equipos editables por cualquiera, con historial**: alumnos y profesor
  pueden dar de alta o editar equipos. Cada cambio guarda automáticamente
  el estado anterior en `equipos_historial`, con quién lo hizo y cuándo
  (columna `ultima_modificacion_por/en` en `equipos`, y botón "Historial"
  en el panel de equipos).
- **Nuevos estados del equipo** (de más dañado/rojo a mejor/verde):
  desmontado y no funcional → … → montado y funcional. Se definen en
  `src/lib/estados.js`.
- **Quién ha ayudado**: si se marca "ayuda recibida", aparece un selector
  con el nombre de la persona (alumno o profesor) que ayudó.
- **Desperfecto marcable en cualquier momento**: ya no hace falta esperar
  a cerrar la operación, hay un checkbox visible durante todo el trabajo.
- **Continuidad del diario entre bloques**: si un alumno vuelve a coger el
  mismo equipo y su última sesión con él NO quedó "terminada y revisada",
  el nuevo registro arranca con lo que ya había escrito. Si sí quedó
  terminada y revisada, empieza en blanco.
- **Borrado de registros**: el alumno puede borrar los suyos mientras no
  estén revisados; el profesor puede borrar o marcar como revisado
  cualquier registro en cualquier momento, esté "abierto" o "en revisión".
- **Panel del profesor ampliado**: pestañas "Abiertas ahora", "Pendientes
  de revisar", "Histórico completo", "Por alumno" (con el tiempo total
  empleado) y "Por equipo" (histórico de ese equipo en concreto). Cada
  registro de la lista muestra si está terminado (✓) y si tiene un
  desperfecto marcado (⚠).

## 11. Simplificación del modelo (v9)

Ejecuta `sql/fix_v9_simplificacion.sql` en Supabase para aplicar este
cambio de enfoque:

- **Un único registro por equipo mientras dura el trabajo**: ya no se
  crean registros nuevos al cambiar de bloque o de día. El mismo registro
  se sigue editando todo el tiempo.
- El alumno puede **enviarlo a revisión** cuando quiera (antes se llamaba
  "finalizar"), pero **sigue pudiendo editarlo** después mientras el
  profesor no lo marque como revisado. Ya no hace falta "reabrir".
- Puede **eliminarlo** en cualquier momento mientras no esté revisado.
- Se guardan las fechas de inicio, de envío a revisión y de revisión, y un
  contador de **cuántos días distintos ha tenido actividad**, para poder
  ver de un vistazo cuánto tiempo lleva un equipo entre manos.
- **Ayuda de varias personas**: el checkbox de ayuda ahora despliega una
  lista de personas (alumnos y profesor) para marcar a todas las que
  ayudaron, no solo una.
- Ya no se usan los bloques lectivos ni el cierre automático por horario
  (las tablas siguen ahí por si se quieren recuperar más adelante, pero la
  aplicación no las usa).

## 13. Sesiones de aula reales, no por calendario (v10)

Ejecuta `sql/fix_v10_fechas_actividad.sql` en Supabase. Antes, el conteo
de "sesiones de aula" contaba todos los bloques del horario entre la fecha
de inicio y ahora, aunque el alumno hubiera faltado algún día. Ahora se
guarda la lista exacta de días en los que hubo actividad real (guardar
algo, marcar un desperfecto, subir una foto...) y solo se cuentan los
bloques de esos días concretos.

## 15. Clases/grupos y FPB1 solo inventario (v13)

Ejecuta `sql/fix_v13_clases.sql` en Supabase. Esto:

- Crea la tabla `clases` con dos de partida: **SMR2** (con operaciones) y
  **FPB1** (solo inventario, de momento — se puede activar más adelante
  desde el propio panel del profesor, pestaña "Clases").
- Asocia cada equipo a una clase obligatoriamente, y actualiza el
  inventario completo con los 23 equipos de tu Excel más reciente, cada
  uno con la clase que le pusiste en la columna "GRUPO-ASIGNADO".
- Cada alumno debe estar asociado a una clase: desde el panel del
  profesor → pestaña "Clases" → "Asignar alumnos a una clase", elige la
  clase de cada uno con un desplegable. Mientras no se lo asignes, ese
  alumno no verá ningún equipo.
- Un alumno de una clase **solo ve y gestiona el inventario de su propia
  clase** (RLS aplicado en la base de datos, no solo en la pantalla).
- Si la clase tiene las operaciones **desactivadas** (como FPB1 de
  momento), el alumno entra directamente a una pantalla simplificada de
  solo inventario: puede dar de alta y editar equipos, pero no existe
  ningún flujo de "elegir equipo y registrar una operación".
- El profesor puede crear más clases (por si aparecen más grupos) y
  activar/desactivar el registro de operaciones de cada una en cualquier
  momento, todo desde la pestaña "Clases".

## 17. Alta libre de clase, "Otros usos" oculta y borrado de equipos (v14)

Ejecuta `sql/fix_v14_alta_libre_y_otros_usos.sql` en Supabase:

- Al dar de alta un equipo (alumno o profesor), ahora aparece siempre un
  selector de clase — un alumno de SMR2 puede fichar un equipo
  directamente en FPB1 si hace falta, no está limitado a la suya. Editar
  un equipo ya existente sigue restringido a tu propia clase (o al
  profesor, que puede con todas).
- Nueva clase de partida **"Otros usos"**, con `visible_para_alumnos =
  false`: no aparece en ningún selector ni listado de ningún alumno, solo
  el profesor la ve (en la pestaña "Clases" y en los selectores de
  equipo). Sirve para material que no pertenece a ninguna clase concreta.
- El profesor ya puede **eliminar cualquier equipo** desde el panel
  (botón "Eliminar" en cada fila de la pestaña Equipos). Si el equipo
  tiene registros de operaciones asociados, no se puede borrar hasta
  quitar esos registros primero (la app te avisa con un mensaje claro en
  vez del error técnico de la base de datos).

## 18. Cómo funciona el flujo (actualizado)

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
