# Registro con Google — plan de implementación

> **Para quien lo ejecute (agente o persona):** SUB-SKILL OBLIGATORIA — usa
> `superpowers:subagent-driven-development` (recomendada) o
> `superpowers:executing-plans` para ejecutar tarea por tarea. Los pasos llevan
> casilla (`- [ ]`) para ir marcándolos.

**Goal:** Que cualquiera pueda registrarse en morcast.mx con un clic usando Google, sin que eso le dé acceso a nada, y que la empresa lo active desde el panel.

**Architecture:** El estado "registrado sin activar" ya existe en la base (rol `pendiente`, migración 003). El trabajo es: una función pura que decide a dónde va cada quien, quitarle a `proxy.js` la suposición que falla abierto, dos pantallas nuevas (capturar y esperar), una acción de servidor que guarda el registro en `solicitudes_alta`, y otra que lo activa desde `/admin/altas` **sin tocar al usuario** (a diferencia del alta normal, que lo crea).

**Tech Stack:** Next.js 16.2 (App Router, `proxy.js` en vez de `middleware.js`), React 19.2, `@supabase/ssr` 0.12, `@supabase/supabase-js` 2.110, Resend por `fetch` directo, Phosphor Icons 2.1.10, pruebas con `node --test` (no hay Jest ni Vitest en el proyecto).

**Spec:** `docs/superpowers/specs/2026-08-27-registro-google-design.md`

## Global Constraints

- **Rama de trabajo: `registro-google`.** En Vercel, `git push` a `main` **es** el despliegue. Nada se empuja a `main` sin autorización expresa de Luis.
- **Directorio base: `Web/`.** Todas las rutas de este plan son relativas a la raíz del repo, o sea empiezan con `Web/`.
- **Todo en español**: nombres de funciones, variables, comentarios, mensajes y textos de pantalla. Es la convención del repo entero.
- **El rol viaja en `app_metadata`, NUNCA en `user_metadata`.** `user_metadata` lo edita el propio usuario desde su navegador.
- **Nunca meter la llave de servicio (`SUPABASE_SERVICE_ROLE_KEY`) en código de navegador.** Sólo en `"use server"` o en `route.js`.
- **La contraseña nunca entra a la bitácora** (`lib/bitacora.js`), que leen varias personas.
- **Un `update` de Supabase que no encuentra fila NO da error**: responde 200 y cambia cero. Siempre `.select(...)` y contar `data.length`.
- **Los correos no tumban la operación**: van en `try/catch`, y el fallo se anota con `console.error`.
- **Iconos**: importar siempre de `@phosphor-icons/react/dist/ssr`, y verificar que existan con `node tests/verificar-iconos.mjs`.
- La migración `017` se aplica a la base **antes** de desplegar el código.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `Web/lib/destino-sesion.mjs` *(nuevo)* | **Sólo decide a dónde va cada quien.** Sin dependencias, sin red, sin React — para poder probarla con `node --test`. La consultan `proxy.js` y `/auth/callback`, así que la regla se escribe una vez. |
| `Web/tests/destino-sesion.test.mjs` *(nuevo)* | Su prueba, incluida la regresión del `?? "cliente"`. |
| `Web/db/017-registro-abierto.sql` *(nuevo)* | Columnas de origen en `solicitudes_alta`, índice único por usuario y `servicios_por_mes` opcional. |
| `Web/proxy.js` *(modificar)* | Guardia del servidor. Deja de suponer el rol y aprende que la sala de espera es la casa de quien no tiene sello. |
| `Web/lib/solicitudes-registro.js` *(nuevo)* | Consulta la solicitud de un usuario con la llave de servicio. **Sin `"use server"`**: recibe un id, y lo que se exporta de un `"use server"` queda abierto al mundo. |
| `Web/app/acciones-registro.js` *(nuevo)* | Acciones de servidor del registro: guardar los datos y consultar los propios. Aparte de `acciones-alta.js` porque es otro flujo (usuario con sesión, no formulario público). |
| `Web/lib/correo.js` *(modificar)* | Tres plantillas nuevas. Reusa `plantilla()` y `enviar()`, que es la parte que de verdad se comparte. |
| `Web/app/auth/callback/route.js` *(nuevo)* | Cambia el código de OAuth por sesión y reparte según `destino-sesion`. |
| `Web/app/(portal)/portal/registro/page.js` *(nuevo)* | La captura corta: empresa y teléfono. |
| `Web/app/(portal)/portal/pendiente/page.js` *(nuevo)* | El aviso de espera con los medios de contacto y el botón de revisar. |
| `Web/app/(portal)/layout.js` *(modificar)* | Las dos pantallas nuevas van fuera del shell protegido. |
| `Web/app/(portal)/portal/login/page.js` *(modificar)* | El botón "Continuar con Google". |
| `Web/app/acciones-alta-cliente.js` *(modificar)* | `activarCuentaRegistrada`: activa a alguien que **ya existe**. |
| `Web/lib/datos-altas.js` *(modificar)* | Leer las columnas nuevas. |
| `Web/app/(admin)/admin/altas/page.js` *(modificar)* | Distintivo de origen, filtro y botón "Activar cuenta". |

**Orden de dependencias:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Cada tarea deja algo que se puede probar solo.

---

### Task 1: La decisión de destino (lógica pura)

Es la única pieza con reglas de verdad, y la única que se puede probar sin navegador ni base. Va primera a propósito: las tareas 3 y 5 sólo la consultan.

**Files:**
- Create: `Web/lib/destino-sesion.mjs`
- Test: `Web/tests/destino-sesion.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `casaDe(rol: string|null|undefined) => string` — a qué área pertenece un rol. Devuelve `"/admin"`, `"/chofer"`, `"/portal"` o `"/portal/pendiente"`. **No necesita la base.**
  - `decidirDestino({ rol: string|null|undefined, tieneSolicitud?: boolean }) => string` — igual que `casaDe`, salvo que a quien no tiene sello lo parte en `"/portal/registro"` (no ha capturado) o `"/portal/pendiente"` (ya capturó).
  - `DESTINOS` — objeto con las rutas: `{ admin, chofer, portal, registro, pendiente }`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `Web/tests/destino-sesion.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { casaDe, decidirDestino, DESTINOS } from "../lib/destino-sesion.mjs";

test("cada rol sellado va a su area", () => {
  assert.equal(casaDe("dueno"), DESTINOS.admin);
  assert.equal(casaDe("admin"), DESTINOS.admin);
  assert.equal(casaDe("operador"), DESTINOS.chofer);
  assert.equal(casaDe("cliente"), DESTINOS.portal);
});

// LA REGRESION QUE IMPORTA. proxy.js hacia `app_metadata?.rol ?? "cliente"`,
// asi que quien llegaba sin sello quedaba bautizado cliente y el guardia lo
// dejaba pasar a /portal. Si alguien vuelve a poner esa suposicion, aqui
// truena.
test("sin rol NO se supone cliente: la casa es la sala de espera", () => {
  assert.equal(casaDe(null), DESTINOS.pendiente);
  assert.equal(casaDe(undefined), DESTINOS.pendiente);
  assert.equal(casaDe(""), DESTINOS.pendiente);
  assert.notEqual(casaDe(null), DESTINOS.portal);
});

test("el rol pendiente y cualquier rol desconocido tampoco entran", () => {
  assert.equal(casaDe("pendiente"), DESTINOS.pendiente);
  assert.equal(casaDe("superadmin"), DESTINOS.pendiente);
  assert.equal(casaDe("Cliente"), DESTINOS.pendiente); // ojo: distingue mayusculas
});

test("decidirDestino parte al pendiente segun si ya capturo sus datos", () => {
  assert.equal(decidirDestino({ rol: null, tieneSolicitud: false }), DESTINOS.registro);
  assert.equal(decidirDestino({ rol: null, tieneSolicitud: true }), DESTINOS.pendiente);
  assert.equal(decidirDestino({ rol: "pendiente", tieneSolicitud: false }), DESTINOS.registro);
});

test("a quien ya tiene sello no le afecta si hay solicitud o no", () => {
  assert.equal(decidirDestino({ rol: "cliente", tieneSolicitud: false }), DESTINOS.portal);
  assert.equal(decidirDestino({ rol: "cliente", tieneSolicitud: true }), DESTINOS.portal);
  assert.equal(decidirDestino({ rol: "operador", tieneSolicitud: true }), DESTINOS.chofer);
});

test("sin argumentos no truena", () => {
  assert.equal(decidirDestino(), DESTINOS.registro);
  assert.equal(decidirDestino({}), DESTINOS.registro);
});
```

- [ ] **Step 2: Correrla y ver que falla**

```bash
cd Web && node --test tests/destino-sesion.test.mjs
```

Esperado: FALLA con `Cannot find module '../lib/destino-sesion.mjs'`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `Web/lib/destino-sesion.mjs`:

```js
/**
 * A DONDE VA CADA QUIEN AL ENTRAR.
 *
 * Vive aparte, sin dependencias y en .mjs a proposito: asi la puede importar
 * tanto Next (como `lib/punto-en-zona.mjs`, que ya se usa igual) como
 * `node --test`, sin navegador y sin base de datos. La regla se escribe una
 * vez y la consultan los dos lugares que la necesitan: `proxy.js` en cada
 * peticion, y `/auth/callback` al volver de Google.
 *
 * REGLA DE ORO: aqui NO se supone nada. Quien no trae un rol conocido en
 * `app_metadata` NO entra. `proxy.js` hacia `?? "cliente"` y eso bautizaba
 * cliente a cualquier recien llegado sin sello.
 */

export const DESTINOS = {
  admin: "/admin",
  chofer: "/chofer",
  portal: "/portal",
  registro: "/portal/registro",
  pendiente: "/portal/pendiente",
};

/**
 * El area a la que pertenece un rol. No necesita la base, para que el
 * guardia del servidor no tenga que consultar nada en cada peticion.
 */
export function casaDe(rol) {
  if (rol === "dueno" || rol === "admin") return DESTINOS.admin;
  if (rol === "operador") return DESTINOS.chofer;
  if (rol === "cliente") return DESTINOS.portal;
  return DESTINOS.pendiente;
}

/**
 * Igual que `casaDe`, pero para quien SI puede consultar la base: al que no
 * tiene sello lo manda a capturar sus datos si todavia no lo hizo.
 */
export function decidirDestino({ rol, tieneSolicitud = false } = {}) {
  const casa = casaDe(rol);
  if (casa !== DESTINOS.pendiente) return casa;
  return tieneSolicitud ? DESTINOS.pendiente : DESTINOS.registro;
}
```

- [ ] **Step 4: Correr la prueba y verla pasar**

```bash
cd Web && node --test tests/destino-sesion.test.mjs
```

Esperado: `# pass 6` y `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add Web/lib/destino-sesion.mjs Web/tests/destino-sesion.test.mjs
git commit -m "La decision de a donde va cada quien, en un solo lugar y con prueba"
```

---

### Task 2: Migración 017

**Files:**
- Create: `Web/db/017-registro-abierto.sql`

**Interfaces:**
- Consumes: nada.
- Produces: en `public.solicitudes_alta`, las columnas `origen` (`'formulario'|'google'`), `usuario_id` (uuid, nulo) y `correo_verificado` (boolean). `servicios_por_mes` pasa a aceptar nulo.

- [ ] **Step 1: Comprobar el estado ANTES (es la "prueba que falla")**

```bash
cd Web
export PGPASSWORD=$(tr -d ' \r\n' < .env.db-password)
PSQL="/c/Program Files/PostgreSQL/17/bin/psql.exe"
CONN="host=aws-0-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.mbdmulygpupahocpylze sslmode=require"
"$PSQL" "$CONN" -t -c "select column_name from information_schema.columns where table_name='solicitudes_alta' and column_name in ('origen','usuario_id','correo_verificado');"
```

Esperado: **cero renglones**. Si ya salen, la migración ya se aplicó: no la repitas, pasa al Step 5.

> El `<ref>` del usuario (`postgres.mbdmulygpupahocpylze`) sale de
> `NEXT_PUBLIC_SUPABASE_URL` en `Web/.env.local`. La contraseña está en
> `Web/.env.db-password`, que git ignora.

- [ ] **Step 2: Escribir la migración**

Crear `Web/db/017-registro-abierto.sql`:

```sql
-- =====================================================================
--  MORCAST DEL NORTE — 017: registro abierto con Google
--  Se corre DESPUES de 016-ubicacion-de-la-evidencia.sql.
-- =====================================================================
--
--  QUE ABRE ESTO
--  -------------
--  Cualquiera puede registrarse solo con su cuenta de Google. Registrarse
--  NO da acceso a nada: la persona queda con rol 'pendiente' y sin empresa,
--  asi que el RLS no le entrega una sola fila. Entra cuando Morcast la
--  activa desde el panel.
--
--  LO QUE NO HACE FALTA, PORQUE YA ESTABA
--  --------------------------------------
--  El rol 'pendiente' y el disparador que lo asigna los puso la 003 el
--  11-ago-2026, por el mismo motivo (createUser tronaba con
--  "perfiles violates check constraint perfil_coherente"). Verificado
--  contra produccion antes de escribir esto: `perfiles_rol_check` ya
--  incluye 'pendiente' y `nuevo_usuario()` ya hace
--  coalesce(raw_app_meta_data->>'rol', 'pendiente').
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) De donde vino cada solicitud, y a que usuario pertenece.
--
--    `usuario_id` es lo que permite activar: sin el no se sabe a QUIEN
--    ponerle el sello. Va `on delete set null` y no `cascade`: si algun dia
--    se borra la cuenta, la solicitud se conserva como historia de que esa
--    empresa toco la puerta.
-- ---------------------------------------------------------------------
alter table public.solicitudes_alta
  add column if not exists origen            text    not null default 'formulario',
  add column if not exists usuario_id        uuid    references auth.users(id) on delete set null,
  add column if not exists correo_verificado boolean not null default false;

alter table public.solicitudes_alta drop constraint if exists solicitudes_alta_origen_check;
alter table public.solicitudes_alta
  add constraint solicitudes_alta_origen_check check (origen in ('formulario','google'));

-- Una persona deja sus datos UNA vez. Sin esto, recargar la pantalla de
-- registro crea filas gemelas y el panel muestra la misma empresa dos veces.
-- Parcial (`where usuario_id is not null`) para no estorbarle a las miles de
-- solicitudes del formulario publico, que no tienen usuario.
create unique index if not exists solicitudes_alta_usuario_idx
  on public.solicitudes_alta (usuario_id) where usuario_id is not null;

-- ---------------------------------------------------------------------
-- 2) Cuantas recolecciones al mes deja de ser obligatorio.
--
--    El formulario largo siempre lo pregunta; el registro con Google NO.
--    Rellenarlo con un numero inventado es el mismo error que ponerle a un
--    manifiesto el RFC de la empresa de ejemplo: el panel ensenaria un dato
--    que el cliente nunca dijo. Mejor vacio, y en pantalla una raya.
-- ---------------------------------------------------------------------
alter table public.solicitudes_alta alter column servicios_por_mes drop not null;

alter table public.solicitudes_alta
  drop constraint if exists solicitudes_alta_servicios_por_mes_check;
alter table public.solicitudes_alta
  add constraint solicitudes_alta_servicios_por_mes_check
  check (servicios_por_mes is null or servicios_por_mes between 1 and 200);

-- ---------------------------------------------------------------------
-- 3) Cosmetico, y a prueba de futuro: quitar el default 'cliente' del rol.
--
--    Hoy es inalcanzable —los tres insert sobre `perfiles` escriben el rol a
--    mano, y el unico sitio del codigo que crea usuarios es
--    activarCuentaCliente, que siempre manda app_metadata.rol— pero un
--    default que dice "cliente" es una invitacion a que el proximo insert se
--    lo salte. Que la columna no opine.
-- ---------------------------------------------------------------------
alter table public.perfiles alter column rol drop default;

commit;
```

- [ ] **Step 3: Aplicarla**

```bash
cd Web
export PGPASSWORD=$(tr -d ' \r\n' < .env.db-password)
"/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  "host=aws-0-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.mbdmulygpupahocpylze sslmode=require" \
  -v ON_ERROR_STOP=1 -f db/017-registro-abierto.sql
```

Esperado: `BEGIN … ALTER TABLE … CREATE INDEX … COMMIT`, sin ningún `ERROR`.

> Si truena por el nombre de un `constraint`, míralo con:
> `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.solicitudes_alta'::regclass;`
> y ajusta el `drop constraint if exists` al nombre real. La migración va en
> **una sola transacción**, así que un error no deja la base a medias.

- [ ] **Step 4: Comprobar el estado DESPUÉS**

```bash
cd Web
export PGPASSWORD=$(tr -d ' \r\n' < .env.db-password)
"/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  "host=aws-0-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.mbdmulygpupahocpylze sslmode=require" \
  -t \
  -c "select column_name||' / nulo='||is_nullable from information_schema.columns where table_name='solicitudes_alta' and column_name in ('origen','usuario_id','correo_verificado','servicios_por_mes') order by column_name;" \
  -c "select 'default rol => '||coalesce(column_default,'(ninguno)') from information_schema.columns where table_name='perfiles' and column_name='rol';" \
  -c "select indexname from pg_indexes where tablename='solicitudes_alta' and indexname='solicitudes_alta_usuario_idx';"
```

Esperado, exactamente:
```
 correo_verificado / nulo=NO
 origen / nulo=NO
 servicios_por_mes / nulo=YES      <-- era NO
 usuario_id / nulo=YES
 default rol => (ninguno)          <-- era 'cliente'::text
 solicitudes_alta_usuario_idx
```

- [ ] **Step 5: Comprobar que no rompió el formulario público que ya existía**

```bash
cd Web
export PGPASSWORD=$(tr -d ' \r\n' < .env.db-password)
"/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  "host=aws-0-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.mbdmulygpupahocpylze sslmode=require" \
  -t -c "select count(*)||' solicitudes viejas, todas con origen=formulario: '||(count(*) filter (where origen='formulario') = count(*))::text from public.solicitudes_alta;"
```

Esperado: las filas que ya había, todas con `origen = formulario` (el `default` se las puso). Si el número es 0 porque la tabla está vacía, también está bien.

- [ ] **Step 6: Commit**

```bash
git add Web/db/017-registro-abierto.sql
git commit -m "Migracion 017: de donde vino cada solicitud y a que usuario pertenece"
```

---

### Task 3: Quitarle a `proxy.js` la suposición que falla abierto

**Files:**
- Modify: `Web/proxy.js:95-115` (el bloque que calcula `rol`, `esPersonal`, `suCasa` y aplica los tres rebotes)

**Interfaces:**
- Consumes: `casaDe`, `DESTINOS` de `Web/lib/destino-sesion.mjs` (Task 1).
- Produces: el guardia manda a `/portal/pendiente` a todo el que no traiga un rol conocido, y deja entrar a `/portal/registro` y `/portal/pendiente` **sólo con sesión**.

- [ ] **Step 1: Importar la decisión**

En `Web/proxy.js`, junto a los imports de arriba, agregar:

```js
import { casaDe, DESTINOS } from "@/lib/destino-sesion.mjs";
```

- [ ] **Step 2: Reemplazar el cálculo del rol**

Buscar este bloque:

```js
  // El rol viaja dentro del token, en app_metadata, que solo se puede escribir
  // con la llave de servicio. Leerlo de aquí evita ir a la base de datos en
  // cada petición. (user_metadata NO sirve: eso lo edita el propio usuario.)
  const rol = user.app_metadata?.rol ?? "cliente";
  const esPersonal = rol === "dueno" || rol === "admin";

  /** A dónde pertenece cada rol. Ahí se manda a quien se equivoque de puerta. */
  const suCasa = esPersonal ? "/admin" : rol === "operador" ? "/chofer" : "/portal";
```

y dejarlo así:

```js
  // El rol viaja dentro del token, en app_metadata, que solo se puede escribir
  // con la llave de servicio. Leerlo de aquí evita ir a la base de datos en
  // cada petición. (user_metadata NO sirve: eso lo edita el propio usuario.)
  //
  // ⚠️ Aquí había `?? "cliente"`. Eso bautizaba cliente a cualquiera que
  // llegara SIN sello —que es justo lo que produce el registro abierto con
  // Google— y el guardia lo dejaba pasar a /portal. Fallaba abierto. Ahora la
  // decisión la toma `casaDe()`, que no supone nada y está probada en
  // `tests/destino-sesion.test.mjs`.
  const rol = user.app_metadata?.rol ?? null;
  const esPersonal = rol === "dueno" || rol === "admin";

  /** A dónde pertenece cada rol. Ahí se manda a quien se equivoque de puerta. */
  const suCasa = casaDe(rol);
```

- [ ] **Step 3: Dejar entrar a la sala de espera, pero sólo con sesión**

Justo antes del bloque de los tres rebotes (`if (zonaAdmin && !esPersonal) …`), agregar:

```js
  // Las dos pantallas del registro son la casa de quien todavía no tiene
  // sello. Se dejan pasar AQUÍ y no en `ABIERTAS` a propósito: en ABIERTAS
  // entraría cualquiera sin sesión, y estas dos pantallas no tienen nada que
  // enseñarle a quien no ha entrado. Quien ya tiene su área se va a la suya:
  // un cliente activo no tiene por qué ver la sala de espera.
  const salaDeEspera =
    ruta.startsWith(DESTINOS.pendiente) || ruta.startsWith(DESTINOS.registro);
  if (salaDeEspera) {
    return suCasa === DESTINOS.pendiente ? respuesta : aSuCasa();
  }
```

- [ ] **Step 4: Verificar que la lógica del guardia sigue cubierta por la prueba**

```bash
cd Web && node --test tests/destino-sesion.test.mjs
```

Esperado: `# fail 0`. (La decisión que ahora usa `proxy.js` es exactamente la que se probó en la Task 1; el guardia sólo la cablea.)

- [ ] **Step 5: Verificar que compila**

```bash
cd Web && npm run build
```

Esperado: termina con código 0. Si se queja de que no encuentra `@/lib/destino-sesion.mjs`, revisa que la extensión `.mjs` vaya escrita en el import — así se importa ya `lib/punto-en-zona.mjs` desde `app/(portal)/portal/alta/page.js`.

- [ ] **Step 6: Commit**

```bash
git add Web/proxy.js
git commit -m "El guardia deja de suponer que quien no trae rol es cliente"
```

---

### Task 4: Guardar el registro (acción de servidor + correos)

**Files:**
- Create: `Web/lib/solicitudes-registro.js`
- Create: `Web/app/acciones-registro.js`
- Modify: `Web/lib/correo.js` (agregar tres funciones al final)

**Interfaces:**
- Consumes: `supabaseServidor`, `haySupabase` de `@/lib/supabase`; `supabaseSesion` de `@/lib/supabase-sesion`; `registrar` de `@/lib/bitacora`; `plantilla`, `enviar`, `esc`, `REMITENTE`, `CORREO_AVISOS` (internos de `lib/correo.js`).
- Produces:
  - `solicitudDeUsuario(usuarioId: string) => Promise<{ id, folio, empresa, estado } | null>` — en `lib/solicitudes-registro.js`, **sólo para el servidor**
  - `miSolicitud() => Promise<{ id, folio, empresa, estado } | null>` — en `acciones-registro.js`, sin parámetros: el id sale de la sesión. Es la que pueden llamar las pantallas.
  - `registrarConGoogle({ empresa: string, telefono: string }) => Promise<{ ok: true, folio: string } | { ok: false, motivo: string }>`
  - `correoAvisoRegistro(datos)`, `correoAcuseRegistro(datos)`, `correoCuentaActivada({ correo, contacto, empresa, folio })` en `lib/correo.js`

- [ ] **Step 1: Agregar las tres plantillas de correo**

Al final de `Web/lib/correo.js`:

```js
/* ------------------------------------------------------------------ */
/* Registro abierto con Google                                         */
/*                                                                     */
/* Son funciones aparte y no un parámetro de correoAvisoAlta /         */
/* correoAcuseAlta a propósito: esas dos hablan de cobertura y de      */
/* "pediste N recolecciones al mes", y el registro con Google no       */
/* pregunta ninguna de las dos cosas. Meterles un `if` las volvería    */
/* dos correos disfrazados de uno. Lo que sí se reusa —`plantilla()` y */
/* `enviar()`— es la parte que de verdad se comparte.                  */
/* ------------------------------------------------------------------ */

/** Aviso a Morcast: alguien se registró solo. */
export async function correoAvisoRegistro(datos) {
  const fila = (etiqueta, valor) =>
    valor
      ? `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;white-space:nowrap;vertical-align:top">${etiqueta}</td><td style="padding:6px 0">${esc(String(valor))}</td></tr>`
      : "";

  return enviar({
    from: REMITENTE,
    to: [CORREO_AVISOS],
    reply_to: datos.correo,
    subject: `Registro nuevo — ${datos.empresa} (${datos.folio})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Alguien se registró con Google</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Creó su cuenta en morcast.mx. <strong>Todavía no tiene acceso a nada</strong>:
        entra al portal hasta que ustedes activen la cuenta.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">
        ${fila("Folio", datos.folio)}
        ${fila("Empresa", datos.empresa)}
        ${fila("Contacto", datos.contacto)}
        ${fila("Teléfono", datos.telefono)}
        ${fila("Correo", datos.correo)}
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Está en el panel, en <strong>Altas de clientes</strong>
        (morcast.mx/admin/altas), con el filtro <strong>Se registraron</strong>.
        Ahí mismo está el botón para activarle la cuenta.</p>`),
  });
}

/** Acuse para quien se registró. */
export async function correoAcuseRegistro(datos) {
  return enviar({
    from: REMITENTE,
    to: [datos.correo],
    subject: `Recibimos tu registro — Morcast del Norte (${datos.folio})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Recibimos tu registro</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Hola ${esc(datos.contacto)}, ya quedó registrada
        <strong>${esc(datos.empresa)}</strong>. Tu folio es
        <strong>${esc(datos.folio)}</strong>.</p>
      <p style="margin:0 0 14px;font-size:14px">
        El siguiente paso lo damos nosotros: revisamos tus datos y te
        contactamos para activarte la cuenta. Mientras tanto, tu acceso al
        portal todavía no está abierto.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Te buscamos al ${esc(datos.telefono)}. Si algo cambió, responde a este correo.</p>`),
  });
}

/**
 * Aviso de que la cuenta ya quedó activa.
 *
 * ⚠️ NO lleva la contraseña adentro, a propósito. La contraseña se la enseña
 * el panel a quien activa, una sola vez, para que se la mande por WhatsApp.
 * Una contraseña dentro de un correo se queda ahí para siempre, en el buzón
 * del cliente y en el de quien reenvíe el hilo.
 */
export async function correoCuentaActivada({ correo, contacto, empresa, folio }) {
  return enviar({
    from: REMITENTE,
    to: [correo],
    subject: `Tu cuenta ya está activa — Morcast del Norte`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Tu cuenta ya está activa</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Hola ${esc(contacto)}, ya puedes entrar al portal de
        <strong>${esc(empresa)}</strong>. Tu número de cliente es
        <strong>${esc(folio)}</strong>.</p>
      <p style="margin:0 0 14px;font-size:14px">
        Entra en <a href="https://morcast.mx/portal/login" style="color:#144C4F">morcast.mx/portal/login</a>
        con el mismo botón de Google que usaste para registrarte.</p>
      <p style="margin:0 0 14px;font-size:14px">
        Ahí puedes agendar recolecciones, ver tu historial, descargar tus
        manifiestos y consultar tu saldo.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        ¿Dudas? Responde a este correo o llámanos al 868 384 9478.</p>`),
  });
}
```

- [ ] **Step 2: Escribir el ayudante que consulta la solicitud**

Va en un archivo **sin** `"use server"` a propósito: recibe un id, y lo que se exporta de un archivo `"use server"` queda abierto al mundo.

Crear `Web/lib/solicitudes-registro.js`:

```js
import { supabaseServidor, haySupabase } from "@/lib/supabase";

/**
 * ¿Este usuario ya dejó sus datos?
 *
 * ⚠️ Va con la llave de SERVICIO, no con la sesión del usuario. La política
 * `solicitudes_alta_lee_personal` (010) sólo le entrega esa tabla al personal
 * de Morcast, así que preguntando con la sesión del recién registrado la
 * respuesta sería siempre "no hay nada" y lo mandaríamos a capturar sus datos
 * otra vez, en cada entrada, para siempre.
 *
 * 🔴 Este archivo NO lleva `"use server"`, y por eso recibe un `usuarioId`
 * sin peligro: sólo lo pueden llamar el manejador de `/auth/callback` y la
 * acción de servidor, los dos del lado del servidor. Si esta función se
 * exportara desde un `"use server"`, cualquiera podría mandarle el uuid de
 * otra persona y sacarle su folio y su empresa.
 */
export async function solicitudDeUsuario(usuarioId) {
  if (!haySupabase() || !usuarioId) return null;

  const { data, error } = await supabaseServidor()
    .from("solicitudes_alta")
    .select("id, folio, empresa, estado")
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (error) {
    console.error("[registro] no se pudo consultar la solicitud:", error.message);
    return null;
  }
  return data || null;
}
```

- [ ] **Step 3: Escribir la acción de servidor**

Crear `Web/app/acciones-registro.js`:

```js
"use server";

import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { supabaseSesion } from "@/lib/supabase-sesion";
import { solicitudDeUsuario } from "@/lib/solicitudes-registro";
import { correoAvisoRegistro, correoAcuseRegistro } from "@/lib/correo";
import { registrar } from "@/lib/bitacora";

/**
 * EL REGISTRO ABIERTO: alguien entró con Google y deja sus datos.
 *
 * Va aparte de `acciones-alta.js` porque es otro flujo: aquel es un
 * formulario público de quien NO tiene sesión; este lo usa alguien que
 * acaba de identificarse con Google y ya tiene usuario.
 *
 * De quién es la solicitud NO se lee de lo que mande el navegador: sale de
 * la SESIÓN. Si viniera del formulario, cualquiera podría registrar datos a
 * nombre del usuario de otro.
 *
 * La escritura va con la llave de servicio porque `solicitudes_alta` no
 * tiene política de INSERT a propósito (010): si se abriera al público,
 * cualquiera podría llenarla de basura sin pasar por la pantalla.
 */

const LIMITES = { empresa: 120, contacto: 120, telefono: 30 };
const texto = (v, max) => String(v ?? "").trim().slice(0, max);

/** Los teléfonos de Matamoros son de 10 dígitos; se aceptan 10 a 15 por si traen lada. */
const digitos = (v) => String(v ?? "").replace(/\D/g, "");

function folioNuevo() {
  // REG-2026-8F3K. Prefijo distinto al de `acciones-alta.js` (ALTA-) para
  // que quien lo lea por teléfono sepa de cuál de las dos puertas vino.
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REG-${new Date().getFullYear()}-${azar}`;
}

/** El usuario de la sesión, comprobado contra el servidor de Supabase. */
async function usuarioDeLaSesion() {
  const supabase = await supabaseSesion();
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}

/**
 * La solicitud de QUIEN PREGUNTA. Sin parámetros a propósito.
 *
 * 🔴 La versión con `usuarioId` NO puede exportarse desde aquí. Todo lo que
 * un archivo `"use server"` exporta queda como un endpoint abierto al mundo,
 * así que cualquiera podría mandarle el uuid de otra persona y sacarle su
 * folio y su empresa. El id sale de la sesión y de ningún otro lado; el
 * ayudante que sí recibe un id vive en `lib/solicitudes-registro.js`, que no
 * es "use server" y por lo tanto no se puede llamar desde fuera.
 */
export async function miSolicitud() {
  const user = await usuarioDeLaSesion();
  if (!user) return null;
  return solicitudDeUsuario(user.id);
}

/** Guarda los datos mínimos de quien acaba de entrar con Google. */
export async function registrarConGoogle({ empresa, telefono }) {
  if (!haySupabase()) return { ok: true, demo: true, folio: folioNuevo() };

  const user = await usuarioDeLaSesion();
  if (!user) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar con Google." };

  // Quien ya tiene sello no pasa por aquí: es un cliente activo.
  if (user.app_metadata?.rol) {
    return { ok: false, motivo: "Tu cuenta ya está dada de alta." };
  }

  const limpio = {
    empresa: texto(empresa, LIMITES.empresa),
    telefono: texto(telefono, LIMITES.telefono),
    contacto: texto(
      user.user_metadata?.full_name || user.user_metadata?.name || user.email,
      LIMITES.contacto
    ),
    correo: texto(user.email, 160).toLowerCase(),
  };

  if (!limpio.empresa) return { ok: false, motivo: "Escribe el nombre de tu empresa." };
  const tel = digitos(limpio.telefono);
  if (tel.length < 10 || tel.length > 15) {
    return { ok: false, motivo: "El teléfono debe traer 10 dígitos (por ejemplo 868 384 9478)." };
  }

  // Si ya se había registrado, no se duplica: se le devuelve su folio y se
  // sigue adelante. La pantalla lo manda a la sala de espera igual, y así
  // recargar o darle dos veces al botón no crea filas gemelas ni truena
  // contra el índice único de la 017.
  const yaEsta = await solicitudDeUsuario(user.id);
  if (yaEsta) return { ok: true, folio: yaEsta.folio, repetido: true };

  const fila = {
    folio: folioNuevo(),
    origen: "google",
    usuario_id: user.id,
    correo_verificado: Boolean(user.email_confirmed_at),
    empresa: limpio.empresa,
    contacto: limpio.contacto,
    telefono: limpio.telefono,
    correo: limpio.correo,
    // No se pregunta y NO se inventa: el panel lo enseña como raya.
    servicios_por_mes: null,
    // La cobertura se calcula con un domicilio, y aquí todavía no hay.
    en_cobertura: false,
  };

  const { error } = await supabaseServidor().from("solicitudes_alta").insert(fila);
  if (error) {
    console.error("[registro] no se pudo guardar:", error.message);
    return { ok: false, motivo: "No se pudo guardar tu registro. Inténtalo de nuevo." };
  }

  // Los correos NO tumban el registro si fallan: ya quedó guardado. Pero el
  // fallo SÍ se anota — es la lección del mes que el sitio estuvo mudo sin
  // que nadie se enterara.
  try {
    await correoAvisoRegistro(fila);
  } catch (e) {
    console.error("[registro] aviso a Morcast falló:", e?.message);
  }
  try {
    await correoAcuseRegistro(fila);
  } catch (e) {
    console.error("[registro] acuse al cliente falló:", e?.message);
  }

  await registrar({
    accion: "registro_google",
    tabla: "solicitudes_alta",
    registroId: fila.folio,
    detalle: { empresa: limpio.empresa, correo: limpio.correo },
  });

  return { ok: true, folio: fila.folio };
}
```

- [ ] **Step 4: Verificar que compila**

```bash
cd Web && npm run build
```

Esperado: código 0.

- [ ] **Step 5: Probar la acción contra la base, sin navegador**

Crear un usuario que simula un registro de Google (**sin `rol` en `app_metadata`**, que es literalmente lo que Google produce) y comprobar que `solicitudDeUsuario` no lo encuentra todavía:

```bash
cd Web
node --input-type=module -e "
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.auth.admin.createUser({
  email: 'prueba-google@morcast-qa.mx', email_confirm: true,
  user_metadata: { full_name: 'Persona de Prueba' },
});
console.log(error ? 'ERROR: ' + error.message : 'usuario creado: ' + data.user.id);
const { data: p } = await sb.from('perfiles').select('rol, cliente_id').eq('id', data.user.id).single();
console.log('su perfil quedó como:', p);
"
```

Esperado: `usuario creado: <uuid>` y `su perfil quedó como: { rol: 'pendiente', cliente_id: null }`.

**Ese `rol: 'pendiente'` es la prueba de que la base ya falla cerrado** (lo dejó la migración 003). Guarda el uuid: lo usan las tareas 5, 8 y 9. Se borra en la Task 9.

- [ ] **Step 6: Commit**

```bash
git add Web/app/acciones-registro.js Web/lib/solicitudes-registro.js Web/lib/correo.js
git commit -m "Guardar el registro de Google, con sus dos correos"
```

---

### Task 5: La ruta de retorno de OAuth

**Files:**
- Create: `Web/app/auth/callback/route.js`

**Interfaces:**
- Consumes: `decidirDestino` de `@/lib/destino-sesion.mjs` (Task 1); `solicitudDeUsuario` de `@/lib/solicitudes-registro` (Task 4).
- Produces: la ruta `GET /auth/callback?code=…`, que deja la sesión en cookies y redirige.

- [ ] **Step 1: Escribir la ruta**

Crear `Web/app/auth/callback/route.js`:

```js
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decidirDestino } from "@/lib/destino-sesion.mjs";
import { solicitudDeUsuario } from "@/lib/solicitudes-registro";

/**
 * VUELTA DE GOOGLE.
 *
 * Supabase manda aquí con `?code=…`. Ese código se cambia por una sesión, y
 * la sesión se escribe en COOKIES —no en localStorage— para que `proxy.js`
 * pueda leerla desde el servidor. Por eso esto es un `route.js` y no una
 * página: sólo un manejador de ruta puede escribir cookies en Next.
 *
 * `/auth` ya estaba en la lista `ABIERTAS` de `proxy.js`, así que esta ruta
 * se alcanza sin sesión — que es justo lo que hace falta para crearla.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorDeGoogle = url.searchParams.get("error_description") || url.searchParams.get("error");

  const aLogin = (motivo) => {
    const destino = new URL("/portal/login", url.origin);
    destino.searchParams.set("error", motivo);
    return NextResponse.redirect(destino);
  };

  // Google rebota así cuando la persona cancela en su pantalla de permisos.
  if (errorDeGoogle) return aLogin("No se completó la entrada con Google.");
  if (!code) return aLogin("Falta el código de Google. Vuelve a intentarlo.");

  const galleta = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return galleta.getAll();
        },
        setAll(porEscribir) {
          porEscribir.forEach(({ name, value, options }) => galleta.set(name, value, options));
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.user) {
    console.error("[auth] no se pudo canjear el código:", error?.message);
    return aLogin("No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
  }

  const rol = data.user.app_metadata?.rol ?? null;

  // Sólo se consulta la solicitud si hace falta: quien ya tiene sello se va a
  // su área sin pasar por la base.
  const tieneSolicitud = rol ? false : Boolean(await solicitudDeUsuario(data.user.id));

  return NextResponse.redirect(new URL(decidirDestino({ rol, tieneSolicitud }), url.origin));
}
```

- [ ] **Step 2: Verificar que compila y que la ruta existe**

```bash
cd Web && npm run build
```

Esperado: código 0, y en el listado de rutas que imprime `next build` aparece `/auth/callback`.

- [ ] **Step 3: Verificar que el guardia la deja pasar sin sesión**

```bash
cd Web && grep -n '"/auth"' proxy.js
```

Esperado: la línea dentro de `const ABIERTAS = [...]`. Si no está, agrégala — sin eso, la vuelta de Google rebota al login antes de poder crear la sesión.

- [ ] **Step 4: Commit**

```bash
git add Web/app/auth/callback/route.js
git commit -m "Vuelta de Google: cambia el codigo por sesion y reparte segun el sello"
```

---

### Task 6: La pantalla de captura

**Files:**
- Create: `Web/app/(portal)/portal/registro/page.js`
- Modify: `Web/app/(portal)/layout.js:14-17`

**Interfaces:**
- Consumes: `registrarConGoogle` de `@/app/acciones-registro` (Task 4); `supabaseNavegador`, `haySupabaseNavegador` de `@/lib/supabase-navegador`.
- Produces: la ruta `/portal/registro`.

- [ ] **Step 1: Sacar las dos pantallas nuevas del shell protegido**

En `Web/app/(portal)/layout.js`, cambiar:

```js
  // El login y el alta los usa gente SIN sesión: van fuera del shell protegido.
  if (ruta === "/portal/login" || ruta === "/portal/alta") {
    return <div className="pt-body">{children}</div>;
  }
```

por:

```js
  // Fuera del shell protegido. El login y el alta los usa gente SIN sesión;
  // registro y pendiente los usa gente CON sesión pero SIN sello, y el shell
  // exige justamente ese sello: montarlo ahí las rebotaría al login.
  const SIN_SHELL = ["/portal/login", "/portal/alta", "/portal/registro", "/portal/pendiente"];
  if (SIN_SHELL.includes(ruta)) {
    return <div className="pt-body">{children}</div>;
  }
```

- [ ] **Step 2: Escribir la pantalla**

Crear `Web/app/(portal)/portal/registro/page.js`:

```js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { registrarConGoogle } from "@/app/acciones-registro";

/**
 * CAPTURA MÍNIMA después de entrar con Google.
 *
 * Google entrega nombre y correo, nada más. Sin empresa y sin teléfono
 * Morcast no puede ni identificar quién tocó la puerta ni contactarlo por
 * WhatsApp, que es como trabaja. Son los dos únicos campos a propósito: todo
 * lo demás (domicilio, residuos, RFC) se levanta al contactarlo.
 *
 * Va FUERA del shell protegido: quien llega aquí tiene sesión pero no tiene
 * sello, y el shell exige el sello.
 */
export default function RegistroPortal() {
  const router = useRouter();
  const [quien, setQuien] = useState(null);
  const [empresa, setEmpresa] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!haySupabaseNavegador()) {
      setQuien({ nombre: "Modo demostración", correo: "demo@morcast.mx" });
      return;
    }
    supabaseNavegador().auth.getUser().then(({ data: { user } }) => {
      if (!vivo) return;
      if (!user) {
        router.replace("/portal/login");
        return;
      }
      setQuien({
        nombre: user.user_metadata?.full_name || user.user_metadata?.name || "",
        correo: user.email || "",
      });
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const r = await registrarConGoogle({ empresa, telefono });
    if (!r.ok) {
      setError(r.motivo);
      setEnviando(false);
      return;
    }
    // refresh() antes de navegar: obliga al servidor a releer la sesión.
    router.refresh();
    router.replace("/portal/pendiente");
  };

  if (!quien) {
    return (
      <div className="pt-login">
        <div className="pt-cargando">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="pt-login">
      <div
        className="pt-login-form-lado"
        /* `.pt-login` es una rejilla de DOS columnas (portal.css:592).
           Esta pantalla monta un solo hijo, asi que sin esto la tarjeta
           se queda en la mitad izquierda con la derecha en blanco. No
           lleva `margin: 0 auto`: `.pt-login-form-lado` ya centra con
           flex, y en el telefono la rejilla colapsa a una columna, donde
           `1 / -1` sigue siendo correcto. */
        style={{ gridColumn: "1 / -1" }}
      >
        <div className="pt-login-card">
          <Link href="/" className="pt-login-marca" aria-label="Ir a la página de Morcast del Norte">
            <Image
              src="/img/logo-h.png"
              alt="Morcast del Norte"
              width={688}
              height={200}
              style={{ width: "auto", height: 48 }}
              priority
            />
          </Link>

          <h1>Un paso más</h1>
          <p>
            Ya te identificamos como <strong>{quien.correo}</strong>. Sólo nos faltan dos
            datos para poder contactarte.
          </p>

          {error && (
            <div className="pt-login-error" role="alert">
              <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} />
              {error}
            </div>
          )}

          <form onSubmit={enviar}>
            <div className="pt-campo">
              <label htmlFor="empresa">Nombre de tu empresa</label>
              <input
                id="empresa"
                type="text"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Industrias del Golfo, S.A. de C.V."
                maxLength={120}
                required
                autoFocus
              />
            </div>

            <div className="pt-campo">
              <label htmlFor="telefono">Teléfono o WhatsApp</label>
              <input
                id="telefono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="868 384 9478"
                maxLength={30}
                required
              />
            </div>

            <button
              type="submit"
              className="pt-btn pt-btn-verde"
              style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem" }}
              disabled={enviando}
            >
              {enviando ? "Enviando…" : <>Enviar mi registro <ArrowRight /></>}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: "1.1rem" }}>
            Registrarte no te da acceso todavía. Morcast revisa tus datos y activa tu cuenta.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar que el logotipo que usa existe**

```bash
cd Web && ls public/img/logo-h.png
```

Esperado: lo encuentra. **No copies `logo-h-blanco.png` de las otras pantallas**: ése es el del panel, que va sobre fondo oscuro, y aquí la tarjeta es clara — se vería un rectángulo en blanco sobre blanco. Los cinco que existen son `logo-h.png`, `logo-h-blanco.png`, `logo-morcast.png`, `logo-morcast-blanco.png` y `logo-compacto-blanco.png`.

- [ ] **Step 4: Verificar iconos y compilación**

```bash
cd Web && node tests/verificar-iconos.mjs && npm run build
```

Esperado: `todos los iconos importados existen en Phosphor` y build en código 0.

- [ ] **Step 5: Commit**

```bash
git add "Web/app/(portal)/portal/registro/page.js" "Web/app/(portal)/layout.js"
git commit -m "Pantalla de captura: empresa y telefono despues de entrar con Google"
```

---

### Task 7: La pantalla de espera

**Files:**
- Create: `Web/app/(portal)/portal/pendiente/page.js`

**Interfaces:**
- Consumes: `EMPRESA` de `@/lib/datos`; `supabaseNavegador`, `haySupabaseNavegador` de `@/lib/supabase-navegador`; `cerrarSesion` de `@/lib/portal-sesion`; `miSolicitud` de `@/app/acciones-registro`.
- Produces: la ruta `/portal/pendiente`.

- [ ] **Step 1: Escribir la pantalla**

Crear `Web/app/(portal)/portal/pendiente/page.js`:

```js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Clock, Phone, Envelope, WhatsappLogo, ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import { EMPRESA } from "@/lib/datos";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { cerrarSesion } from "@/lib/portal-sesion";
import { miSolicitud } from "@/app/acciones-registro";

/**
 * SALA DE ESPERA: la cuenta existe pero la empresa todavía no la activa.
 *
 * Los teléfonos y correos salen de `EMPRESA` (lib/datos.js) y NO se escriben
 * aquí a mano: los correos de hoy son los personales del cliente, marcados
 * como temporales, y se cambian por los buzones @morcast.mx cuando se los
 * entreguen. Escritos aquí, esta pantalla se quedaría vieja sin que nadie lo
 * note.
 */
export default function PendientePortal() {
  const router = useRouter();
  const [folio, setFolio] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [sinNovedad, setSinNovedad] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!haySupabaseNavegador()) return;
    supabaseNavegador().auth.getUser().then(async ({ data: { user } }) => {
      if (!vivo) return;
      if (!user) {
        router.replace("/portal/login");
        return;
      }
      // Si ya trae sello, aquí no pinta nada.
      if (user.app_metadata?.rol) {
        router.replace("/portal");
        return;
      }
      // Sin parametro: la accion saca el id de la sesion. Ver el comentario
      // de `miSolicitud` en acciones-registro.js.
      const solicitud = await miSolicitud();
      if (!vivo) return;
      // Llegó sin haber capturado nada: primero los datos.
      if (!solicitud) {
        router.replace("/portal/registro");
        return;
      }
      setFolio(solicitud.folio);
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  /**
   * "Ya me activaron — revisar".
   *
   * ⚠️ Poner el sello en el panel NO cambia el token que esta persona ya
   * tiene en su navegador: seguiría viendo este aviso hasta que caduque, como
   * una hora. `refreshSession()` pide uno nuevo, y ese sí trae el sello.
   * Sin este botón, la entrega parece rota justo en el minuto en que Morcast
   * activa a alguien y se lo dice por teléfono.
   */
  const revisar = async () => {
    setRevisando(true);
    setSinNovedad(false);
    const { data } = await supabaseNavegador().auth.refreshSession();
    if (data?.user?.app_metadata?.rol) {
      router.refresh();
      router.replace("/portal");
      return;
    }
    setRevisando(false);
    setSinNovedad(true);
  };

  const salir = async () => {
    await cerrarSesion();
    router.refresh();
    router.replace("/portal/login");
  };

  const soloDigitos = (t) => String(t || "").replace(/\D/g, "");

  return (
    <div className="pt-login">
      <div
        className="pt-login-form-lado"
        /* `.pt-login` es una rejilla de DOS columnas (portal.css:592).
           Esta pantalla monta un solo hijo, asi que sin esto la tarjeta
           se queda en la mitad izquierda con la derecha en blanco. No
           lleva `margin: 0 auto`: `.pt-login-form-lado` ya centra con
           flex, y en el telefono la rejilla colapsa a una columna, donde
           `1 / -1` sigue siendo correcto. */
        style={{ gridColumn: "1 / -1" }}
      >
        <div className="pt-login-card">
          <Link href="/" className="pt-login-marca" aria-label="Ir a la página de Morcast del Norte">
            <Image
              src="/img/logo-h.png"
              alt="Morcast del Norte"
              width={688}
              height={200}
              style={{ width: "auto", height: 48 }}
              priority
            />
          </Link>

          <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Clock weight="duotone" /> Tu cuenta está en espera
          </h1>

          <p>
            Tu cuenta ya está <strong>registrada</strong>, pero todavía{" "}
            <strong>no está activada</strong>. Por favor espera mientras la empresa la
            revisa y la activa. Te avisamos por correo en cuanto quede lista.
          </p>

          {folio && (
            <p style={{ fontSize: "0.9rem", color: "var(--mc-gris)" }}>
              Tu folio de registro es <strong>{folio}</strong>. Tenlo a la mano si nos llamas.
            </p>
          )}

          <div style={{ margin: "1.4rem 0 0.6rem", fontWeight: 600 }}>
            ¿Tienes dudas? Contáctanos:
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {EMPRESA.telefonos.map((tel) => (
              <a key={tel} className="pt-btn" href={`tel:${soloDigitos(tel)}`}>
                <Phone /> {tel}
              </a>
            ))}
            <a
              className="pt-btn"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent(
                `Hola, me registré en morcast.mx${folio ? ` con el folio ${folio}` : ""} y quiero preguntar por la activación de mi cuenta.`
              )}`}
            >
              <WhatsappLogo /> WhatsApp
            </a>
            {EMPRESA.correos.map((correo) => (
              <a key={correo} className="pt-btn" href={`mailto:${correo}?subject=${encodeURIComponent(`Activación de mi cuenta${folio ? ` (${folio})` : ""}`)}`}>
                <Envelope /> {correo}
              </a>
            ))}
          </div>

          <p style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: "0.9rem" }}>
            {EMPRESA.horario}
          </p>

          <hr style={{ margin: "1.4rem 0", opacity: 0.15 }} />

          <button
            type="button"
            className="pt-btn pt-btn-verde"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={revisar}
            disabled={revisando}
          >
            <ArrowClockwise /> {revisando ? "Revisando…" : "Ya me activaron — revisar"}
          </button>

          {sinNovedad && (
            <p style={{ fontSize: "0.86rem", color: "var(--mc-gris)", marginTop: "0.6rem", textAlign: "center" }}>
              Todavía no. En cuanto la empresa la active, este botón te deja entrar.
            </p>
          )}

          <p style={{ textAlign: "center", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={salir}
              style={{ background: "none", border: "none", color: "var(--mc-gris)", cursor: "pointer", fontSize: "0.86rem", textDecoration: "underline" }}
            >
              Cerrar sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que los cuatro iconos existen en Phosphor 2.1.10**

```bash
cd Web && node tests/verificar-iconos.mjs
```

Esperado: `todos los iconos importados existen en Phosphor`.

Los cinco de esta pantalla (`Clock`, `Phone`, `Envelope`, `WhatsappLogo`, `ArrowClockwise`) **ya se verificaron uno por uno contra la 2.1.10 al escribir este plan: los cinco existen**. Aun así córrelo: es el chequeo que cazó un `MapPinSlash` inexistente el 26-ago, y el síntoma de un icono que no existe es que la pantalla entera deja de compilar.

- [ ] **Step 3: Verificar que `EMPRESA` trae los campos que usa la pantalla**

```bash
cd Web && node --input-type=module -e "
const t = await import('fs').then(m => m.readFileSync('lib/datos.js','utf8'));
for (const c of ['telefonos','whatsapp','correos','horario'])
  console.log(c + ': ' + (new RegExp('^\\\\s*' + c + ':','m').test(t) ? 'existe' : 'FALTA'));
"
```

Esperado: los cuatro dicen `existe`.

- [ ] **Step 4: Compilar**

```bash
cd Web && npm run build
```

Esperado: código 0.

- [ ] **Step 5: Commit**

```bash
git add "Web/app/(portal)/portal/pendiente/page.js"
git commit -m "Sala de espera: el aviso, los medios de contacto y el boton de revisar"
```

---

### Task 8: El botón de Google en el login, y la activación en el panel

Van juntos porque son las dos puntas del mismo circuito: sin el botón nadie se registra, y sin la activación nadie sale de la sala de espera. Un revisor no aprobaría uno sin el otro.

**Files:**
- Modify: `Web/app/(portal)/portal/login/page.js` (agregar el botón)
- Modify: `Web/app/acciones-alta-cliente.js` (agregar `activarCuentaRegistrada` al final)
- Modify: `Web/lib/datos-altas.js` (`CAMPOS` y `aPantalla`)
- Modify: `Web/app/(admin)/admin/altas/page.js` (filtro, distintivo y botón)

**Interfaces:**
- Consumes: `correoCuentaActivada` de `@/lib/correo` (Task 4); `exigirPersonal`, `supabaseServidor` (ya existen en `acciones-alta-cliente.js`).
- Produces: `activarCuentaRegistrada({ solicitudId: string, password: string }) => Promise<{ ok: true, cliente: {id, folio, empresa}, correo: string } | { ok: false, motivo: string }>`

- [ ] **Step 1: El botón de Google en el login**

En `Web/app/(portal)/portal/login/page.js`, dentro del componente y antes del `return`, agregar:

```js
  // Mensaje de vuelta de /auth/callback cuando algo salió mal con Google.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("error");
    if (e) setError(e);
  }, []);

  /**
   * Entrar con Google.
   *
   * `redirectTo` apunta a nuestro `/auth/callback`, que es quien escribe la
   * sesión en cookies. Se arma con `window.location.origin` y no con una URL
   * escrita a mano: así funciona igual en morcast.mx, en localhost y en las
   * vistas previas de Vercel. Esas tres direcciones tienen que estar dadas de
   * alta en Supabase (Authentication → URL Configuration).
   */
  const entrarConGoogle = async () => {
    setError("");
    setEnviando(true);
    const { error: err } = await supabaseNavegador().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setError("No se pudo abrir la entrada con Google. Inténtalo de nuevo.");
      setEnviando(false);
    }
    // Si no hubo error el navegador ya se está yendo a Google: no se apaga
    // `enviando`, para que no parpadee el botón mientras navega.
  };
```

y agregar el import arriba:

```js
import { supabaseNavegador } from "@/lib/supabase-navegador";
```

Luego, dentro de `.pt-login-card`, **justo después** de `{error && <div className="pt-login-error">{error}</div>}` y **antes** del `<form onSubmit={entrar}>`:

```jsx
          <button
            type="button"
            className="pt-btn"
            style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem" }}
            onClick={entrarConGoogle}
            disabled={enviando}
          >
            {/* El logotipo de Google va como SVG en línea: la CSP del sitio no
                deja traer imágenes de otros dominios, y Phosphor no trae la G
                de cuatro colores. */}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
            </svg>
            Continuar con Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", margin: "1.1rem 0" }}>
            <span style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.15 }} />
            <span style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>o con tu correo</span>
            <span style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.15 }} />
          </div>
```

- [ ] **Step 2: La acción que activa a quien ya existe**

Al final de `Web/app/acciones-alta-cliente.js`:

```js
/**
 * ACTIVAR A ALGUIEN QUE YA EXISTE (se registró solo con Google).
 *
 * Es un camino aparte de `activarCuentaCliente`, y la diferencia importa:
 * aquella CREA el usuario; aquí el usuario ya existe y es de esa persona.
 *
 * 🔴 POR ESO EL DESHACER ES DISTINTO. Si algo truena a media faena,
 * `activarCuentaCliente` borra el usuario. Hacer eso aquí sería destruir la
 * cuenta de Google de alguien real. Aquí se deshace lo que NOSOTROS creamos
 * —la empresa y el sello— y el usuario no se toca nunca.
 */
export async function activarCuentaRegistrada({ solicitudId, password }) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { quien, error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  if (!password || String(password).length < 8) {
    return { ok: false, motivo: "La contraseña debe tener al menos 8 caracteres." };
  }

  const sb = supabaseServidor();

  const { data: solicitud, error: errSolicitud } = await sb
    .from("solicitudes_alta")
    .select("id, folio, empresa, contacto, telefono, correo, usuario_id, origen")
    .eq("id", solicitudId)
    .single();

  if (errSolicitud || !solicitud) {
    return { ok: false, motivo: "No se encontró esa solicitud." };
  }
  if (!solicitud.usuario_id) {
    return {
      ok: false,
      motivo: "Esta solicitud no tiene cuenta ligada. Se activa con el alta normal, no por aquí.",
    };
  }

  const uid = solicitud.usuario_id;

  // ¿Ya estaba activada? Volver a hacerlo crearía una empresa duplicada.
  const { data: perfilPrevio } = await sb
    .from("perfiles").select("rol, cliente_id").eq("id", uid).maybeSingle();
  if (perfilPrevio?.cliente_id) {
    return { ok: false, motivo: "Esa cuenta ya está activada y ligada a una empresa." };
  }

  // 1) La empresa. El folio lo asigna la base (db/014), con su candado
  //    contra carreras: calcularlo aquí sería leer el máximo y luego escribir.
  const { data: cliente, error: errCliente } = await sb
    .from("clientes")
    .insert({
      empresa: solicitud.empresa,
      contacto: solicitud.contacto || null,
      correo: solicitud.correo,
      telefono: solicitud.telefono || null,
      estado: "activo",
    })
    .select("id, folio, empresa")
    .single();

  if (errCliente || !cliente) {
    return { ok: false, motivo: `No se pudo crear la empresa: ${errCliente?.message || "error desconocido"}` };
  }

  // Deshacer: SOLO lo que creamos nosotros. El usuario NO se toca.
  const deshacer = async () => {
    try {
      await sb.auth.admin.updateUserById(uid, { app_metadata: { rol: null, cliente_id: null } });
    } catch { /* se reporta el error de origen */ }
    try {
      await sb.from("perfiles").update({ rol: "pendiente", cliente_id: null }).eq("id", uid);
    } catch { /* idem */ }
    try {
      await sb.from("clientes").delete().eq("id", cliente.id);
    } catch { /* idem */ }
  };

  // 2) El sello y la contraseña, en una sola llamada. El disparador
  //    `sincronizar_perfil()` (db/003) ve cambiar el app_metadata y acomoda
  //    `perfiles` solo. Va DESPUÉS de crear la empresa porque ese disparador
  //    ignora un rol 'cliente' sin `cliente_id`: sería incoherente.
  const { error: errSello } = await sb.auth.admin.updateUserById(uid, {
    password: String(password),
    app_metadata: { rol: "cliente", cliente_id: cliente.id },
  });

  if (errSello) {
    await deshacer();
    return { ok: false, motivo: `No se pudo activar el acceso: ${errSello.message}` };
  }

  // 3) Completar lo que el disparador no toca (nombre y teléfono), y
  //    asegurar el amarre por si el disparador no hubiera corrido.
  const { data: perfil, error: errPerfil } = await sb
    .from("perfiles")
    .update({
      nombre: solicitud.contacto || solicitud.empresa,
      rol: "cliente",
      cliente_id: cliente.id,
      telefono: solicitud.telefono || null,
      activo: true,
    })
    .eq("id", uid)
    .select("id");

  // Un UPDATE que no encuentra fila NO da error: responde 200 y cambia cero.
  if (errPerfil || !perfil?.length) {
    await deshacer();
    return {
      ok: false,
      motivo: `No se pudo ligar la cuenta con la empresa: ${errPerfil?.message || "no se guardó ninguna fila"}`,
    };
  }

  // 4) La solicitud queda trabajada. Que esto falle no invalida la activación.
  await sb.from("solicitudes_alta").update({ estado: "aprobada" }).eq("id", solicitud.id);

  try {
    await correoCuentaActivada({
      correo: solicitud.correo,
      contacto: solicitud.contacto || solicitud.empresa,
      empresa: cliente.empresa,
      folio: cliente.folio,
    });
  } catch (e) {
    console.error("[activar] aviso al cliente falló:", e?.message);
  }

  await registrar({
    accion: "activar_cuenta_registrada",
    tabla: "clientes",
    registroId: cliente.id,
    detalle: {
      folio: cliente.folio,
      empresa: cliente.empresa,
      correo: solicitud.correo,
      solicitud: solicitud.folio,
      // La contraseña NO se registra. La bitácora la leen varias personas.
    },
  });

  return {
    ok: true,
    cliente: { id: cliente.id, folio: cliente.folio, empresa: cliente.empresa },
    correo: solicitud.correo,
    creadaPor: quien.correo,
  };
}
```

Y agregar al import de correos que ya está arriba del archivo (si no hay ninguno, crear la línea):

```js
import { correoCuentaActivada } from "@/lib/correo";
```

- [ ] **Step 3: Que la capa de datos traiga las columnas nuevas**

En `Web/lib/datos-altas.js`, la constante `CAMPOS` es una plantilla de texto que hoy termina así:

```js
  en_cobertura, rutas_que_cubren, estado, notas, creado
`;
```

Dejarla así:

```js
  en_cobertura, rutas_que_cubren, estado, notas, creado,
  origen, usuario_id
`;
```

> ⚠️ La coma va al final de `creado`, no al principio del renglón nuevo. Es una
> lista de columnas de SQL dentro de una plantilla: una coma de más o de menos
> rompe el `select` entero y `listarAltas()` devolvería `[]` sin decir por qué
> — la pantalla se quedaría vacía y parecería que no hay solicitudes.

Y en `aPantalla`, dentro del objeto que devuelve, agregar dos renglones justo antes de `creado: f.creado,`:

```js
    origen: f.origen || "formulario",
    usuarioId: f.usuario_id || null,
```

- [ ] **Step 4: El panel**

En `Web/app/(admin)/admin/altas/page.js`:

1. Agregar al import de iconos: `GoogleLogo` y `UserCircle` (verifícalos en el Step 6).
2. Agregar el import de la acción:

```js
import { activarCuentaRegistrada } from "@/app/acciones-alta-cliente";
```

3. Agregar el estado y la función de activar, junto a `marcar`:

```js
  const [activando, setActivando] = useState(false);
  const [credencial, setCredencial] = useState(null); // { correo, password, folio }

  /** Contraseña legible por teléfono: sin l/1/O/0, que se confunden al dictarla. */
  const contrasenaNueva = () => {
    const abc = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    return Array.from({ length: 12 }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
  };

  const activar = async (a) => {
    setError("");
    setActivando(true);
    const password = contrasenaNueva();
    const r = await activarCuentaRegistrada({ solicitudId: a.id, password });
    setActivando(false);
    if (!r.ok) { setError(r.motivo || "No se pudo activar."); return; }
    // Se enseña UNA vez: no se guarda en ningún lado ni entra a la bitácora.
    setCredencial({ correo: r.correo, password, folio: r.cliente.folio });
    await recargar();
    setSel((s) => (s && s.id === a.id ? { ...s, estado: "aprobada" } : s));
  };
```

4. En la lista de filtros, agregar uno más al arreglo que se mapea:

```js
        {[{ id: "nueva", texto: `Sin atender (${nuevas})` }, ...ESTADOS.slice(1),
          { id: "google", texto: `Se registraron (${altas.filter((a) => a.origen === "google").length})` },
          { id: "todas", texto: "Todas" }].map((f) => (
```

y cambiar el cálculo de `lista` para que entienda el filtro nuevo:

```js
  const lista =
    filtro === "todas" ? altas
    : filtro === "google" ? altas.filter((a) => a.origen === "google")
    : altas.filter((a) => a.estado === filtro);
```

5. En la tabla, en la celda del folio, poner el distintivo:

```jsx
                      <td className="folio">
                        {a.origen === "google" && (
                          <GoogleLogo
                            weight="bold"
                            title="Se registró con Google"
                            style={{ marginRight: 5, verticalAlign: "-2px" }}
                          />
                        )}
                        {a.folio}
                      </td>
```

6. En la columna "Al mes", que ahora puede venir vacía:

```jsx
                      <td className="num">{a.serviciosPorMes ?? "—"}</td>
```

7. En el detalle, cambiar `<Dato etiqueta="Recolecciones al mes" valor={sel.serviciosPorMes} />` por:

```jsx
              <Dato
                etiqueta="Recolecciones al mes"
                valor={sel.serviciosPorMes ?? (sel.origen === "google" ? "No lo preguntamos en el registro" : null)}
              />
```

8. En la barra de botones del detalle, **antes** del botón "Aprobar":

```jsx
                {sel.origen === "google" && sel.estado !== "aprobada" && (
                  <button
                    type="button"
                    className="pt-btn pt-btn-verde"
                    onClick={() => activar(sel)}
                    disabled={activando}
                  >
                    <UserCircle /> {activando ? "Activando…" : "Activar cuenta"}
                  </button>
                )}
```

9. Y el aviso con la contraseña, justo debajo de esa barra de botones:

```jsx
              {credencial && (
                <div className="pt-card" style={{ marginTop: "1rem", padding: "0.9rem" }}>
                  <strong>Cuenta activada — cliente {credencial.folio}</strong>
                  <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                    Esta contraseña se enseña <strong>una sola vez</strong> y no se guarda
                    en ningún lado. Mándasela ahora; le sirve para entrar desde la app del
                    teléfono (en la página puede entrar con su Google).
                  </p>
                  <p style={{ margin: "0 0 0.6rem", fontFamily: "monospace", fontSize: "1.05rem" }}>
                    {credencial.correo}<br />{credencial.password}
                  </p>
                  <a
                    className="pt-btn"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://wa.me/52${(sel.telefono || "").replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Tu cuenta de Morcast del Norte ya está activa. Entra en morcast.mx/portal/login con tu cuenta de Google, o con este correo y contraseña desde la app: ${credencial.correo} / ${credencial.password}`
                    )}`}
                  >
                    Mandar por WhatsApp
                  </a>
                  <button
                    type="button"
                    className="pt-btn"
                    style={{ marginLeft: 8 }}
                    onClick={() => setCredencial(null)}
                  >
                    Ya la mandé
                  </button>
                </div>
              )}
```

10. Y actualizar el texto de la cabecera de la pantalla:

```jsx
        <p>
          Quien llena <strong>Cotización/Alta</strong> en la página cae aquí, y también
          quien <strong>se registra con Google</strong>. A esos últimos les aparece el
          botón <strong>Activar cuenta</strong>: su acceso ya existe, sólo falta ligarlo
          con su empresa.
        </p>
```

- [ ] **Step 5: Verificar que no quedó ningún `pt-` inventado**

El 26-ago se perdió tiempo con clases de CSS que no existían (`pt-login-form`, `pt-chip`), y el síntoma es silencioso: la pantalla sale sin estilos y nadie ve un error.

```bash
cd Web
grep -oh 'className="[^"]*"' "app/(portal)/portal/registro/page.js" "app/(portal)/portal/pendiente/page.js" "app/(admin)/admin/altas/page.js" \
  | tr ' "' '\n\n' | grep -E '^(pt|mc|ch)-' | sort -u > /tmp/usadas.txt
grep -ohE '\.(pt|mc|ch)-[a-zA-Z0-9_-]+' app/**/*.css app/*.css 2>/dev/null | tr -d '.' | sort -u > /tmp/definidas.txt
comm -23 /tmp/usadas.txt /tmp/definidas.txt
```

Esperado: **ninguna línea**. Cada clase que salga hay que definirla en el CSS del área o cambiarla por una que sí exista.

- [ ] **Step 6: Iconos y compilación**

```bash
cd Web && node tests/verificar-iconos.mjs && npm run build
```

Esperado: `todos los iconos importados existen en Phosphor` y build en código 0. `GoogleLogo` y `UserCircle` **ya se verificaron contra la 2.1.10 al escribir este plan: los dos existen**.

- [ ] **Step 7: Commit**

```bash
git add "Web/app/(portal)/portal/login/page.js" Web/app/acciones-alta-cliente.js Web/lib/datos-altas.js "Web/app/(admin)/admin/altas/page.js"
git commit -m "Boton de Google en el login y activacion desde el panel, sin tocar al usuario"
```

---

### Task 9: QA de punta a punta y limpieza

Todo lo anterior **compila**. Compilar no atrapa lógica, y en este proyecto lo que ha salido siempre ha salido probando, no leyendo.

**Files:** ninguno (sólo verificación).

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la evidencia de que funciona, y la base tal como estaba.

- [ ] **Step 1: Levantar el sitio**

```bash
cd Web && npm run dev
```

- [ ] **Step 2: Comprobar que el pendiente NO ve nada en la base**

Con el uuid del usuario de prueba de la Task 4 (llamémoslo `$UID`):

```bash
cd Web
export PGPASSWORD=$(tr -d ' \r\n' < .env.db-password)
"/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  "host=aws-0-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.mbdmulygpupahocpylze sslmode=require" <<SQL
begin;
select set_config('request.jwt.claims',
  json_build_object('sub','$UID','role','authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;
select 'clientes'    as tabla, count(*) from public.clientes
union all select 'solicitudes', count(*) from public.solicitudes_recoleccion
union all select 'movimientos', count(*) from public.movimientos_saldo
union all select 'recolecciones', count(*) from public.recolecciones;
rollback;
SQL
```

Esperado: **0 en las cuatro**.

> ⚠️ Consultar como `postgres` NO prueba nada: esa cuenta se salta todo el
> RLS. Hacerse pasar por el usuario es la única forma de ver lo que ve él.

- [ ] **Step 3: Comprobar que el pendiente no puede ascenderse solo**

```bash
cd Web
export PGPASSWORD=$(tr -d ' \r\n' < .env.db-password)
"/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  "host=aws-0-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.mbdmulygpupahocpylze sslmode=require" <<SQL
begin;
select set_config('request.jwt.claims',
  json_build_object('sub','$UID','role','authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;
update public.perfiles set rol = 'admin' where id = '$UID';
rollback;
SQL
```

Esperado: **falla** con `No puedes cambiar tu rol, tu empresa ni tu estado.` (lo lanza `perfil_sin_escalar()`). Si el `update` pasa, PARA: hay un agujero.

- [ ] **Step 4: Comprobar el guardia contra el sitio levantado**

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/portal
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/portal/pendiente
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/portal/login
```

Esperado: los dos primeros **307 hacia `/portal/login`** (sin sesión no se llega a ninguna de las dos), y el login **200**.

- [ ] **Step 5: El circuito completo, en el navegador**

Sin el proveedor de Google encendido no se puede hacer clic en el botón, así que se entra como el usuario de prueba poniéndole una contraseña por la Admin API, que deja la sesión en el mismo estado en que la deja Google (**usuario sin `rol`**):

```bash
cd Web
node --input-type=module -e "
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
const u = data.users.find(x => x.email === 'prueba-google@morcast-qa.mx');
await sb.auth.admin.updateUserById(u.id, { password: 'PruebaQA2026x' });
console.log('listo, entra con prueba-google@morcast-qa.mx / PruebaQA2026x — uid ' + u.id);
"
```

Luego, en el navegador, comprobar **en este orden**:

1. Entrar en `/portal/login` con ese correo → **debe caer en `/portal/registro`**, no en el portal. *(Es la regresión del `?? "cliente"`.)*
2. Escribir empresa y teléfono → **debe caer en `/portal/pendiente`** y verse el folio `REG-2026-XXXX`.
3. Recargar `/portal/pendiente` → **sigue ahí**, no manda a capturar otra vez. *(Prueba que `miSolicitud` va con la llave de servicio; si fuera con la del usuario, el RLS devolvería nada y rebotaría a `/portal/registro`.)*
4. Escribir `/portal` a mano en la barra → **rebota a `/portal/pendiente`**.
5. Pulsar **"Ya me activaron — revisar"** → dice que todavía no.
6. En otra pestaña, entrar al panel como `morcastmx@gmail.com` / `0011002`, ir a `/admin/altas`, filtro **"Se registraron"** → ahí está, con el distintivo de Google y "Al mes" en raya.
7. Pulsar **"Activar cuenta"** → aparece el recuadro con la contraseña una sola vez.
8. Volver a la pestaña del cliente y pulsar **"Ya me activaron — revisar"** → **entra al portal** y ve su empresa, no la de ejemplo.

> ⚠️ El demonio de `browse` se reinicia solo cada pocos comandos en esta
> laptop: pasos cortos y revalidar la sesión. Y antes de dar por fallido un
> paso, **mirar la base**: en el QA del 21-ago, 2 de 3 "timeouts" sí se habían
> ejecutado.

- [ ] **Step 6: Comprobar en la base que la activación quedó bien**

```bash
cd Web
export PGPASSWORD=$(tr -d ' \r\n' < .env.db-password)
"/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  "host=aws-0-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.mbdmulygpupahocpylze sslmode=require" \
  -c "select p.rol, c.folio, c.empresa from public.perfiles p join public.clientes c on c.id = p.cliente_id where p.id = '$UID';" \
  -c "select accion, detalle->>'folio' from public.bitacora where accion in ('registro_google','activar_cuenta_registrada') order by creado desc limit 5;"
```

Esperado: `rol = cliente` con su folio y empresa, y los dos renglones de bitácora. **En la bitácora no debe aparecer la contraseña por ningún lado.**

- [ ] **Step 7: Limpiar TODO lo de prueba**

```bash
cd Web
node --input-type=module -e "
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
const u = data.users.find(x => x.email === 'prueba-google@morcast-qa.mx');
if (!u) { console.log('no habia usuario de prueba'); process.exit(0); }
const { data: p } = await sb.from('perfiles').select('cliente_id').eq('id', u.id).maybeSingle();
await sb.from('solicitudes_alta').delete().eq('usuario_id', u.id);
await sb.auth.admin.deleteUser(u.id);              // el perfil se va en cascada
if (p?.cliente_id) await sb.from('clientes').delete().eq('id', p.cliente_id);
console.log('limpio');
"
```

- [ ] **Step 8: Comprobar que la base quedó como estaba**

```bash
cd Web
export PGPASSWORD=$(tr -d ' \r\n' < .env.db-password)
"/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  "host=aws-0-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.mbdmulygpupahocpylze sslmode=require" \
  -t -c "select 'clientes: '||count(*) from public.clientes;" \
  -c "select 'solicitudes con usuario: '||count(*) from public.solicitudes_alta where usuario_id is not null;" \
  -c "select 'usuarios de prueba: '||count(*) from auth.users where email like '%morcast-qa.mx';"
```

Esperado: `clientes: 4` (los que había), `solicitudes con usuario: 0`, `usuarios de prueba: 0`.

- [ ] **Step 9: Commit final y resumen**

```bash
git add -A
git commit -m "QA del registro con Google: probado de punta a punta contra la base real"
git log --oneline main..registro-google
```

**No empujar.** El despliegue lo decide Luis, y `git push` a `main` publica.

---

## Lo que queda pendiente al terminar

- 🔴 **El brinco a Google no se probó**, y no se puede hasta que estén el cliente OAuth en Google Cloud Console y el proveedor activado en Supabase, con las tres URL de retorno. Todo lo demás sí quedó probado.
- 🔴 **El enlace de identidades tampoco se probó, y es lo primero que hay que mirar al encender el proveedor.** El spec (§6) da por bueno que quien entre con Google usando el correo de un cliente que Morcast ya dio de alta **conserve su rol y entre directo al portal**, porque Supabase enlaza las dos identidades cuando el correo viene verificado. Es comportamiento de Supabase, no código nuestro, así que **no se puede comprobar sin el proveedor encendido**. La prueba: activar a alguien, cerrar sesión, y volver a entrar con el botón de Google — debe caer en `/portal`, no en `/portal/registro`. Si cayera en el registro, Supabase habría creado un usuario aparte y hay que revisar la opción de enlace de cuentas en el tablero.
- 🔵 Las apps de iPhone y Android **no se tocaron**, a propósito. Un cliente activado entra a la app con la contraseña que le dio el panel.
- 🔔 **El saldo mensual sigue detenido** esperando la lista de precios de la empresa. No lo toca este trabajo.
