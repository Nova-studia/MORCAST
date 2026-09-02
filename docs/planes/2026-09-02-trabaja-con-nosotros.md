# "Trabaja con nosotros" — plan de trabajo

> **Para quien lo ejecute:** cada paso lleva su casilla (`- [ ]`). Se hace en
> orden. Cada tarea termina con algo que funciona y se puede probar solo.

**Meta:** que Morcast publique sus vacantes desde el panel y que cualquiera
pueda mandar su solicitud de empleo, con currículum opcional, desde
`morcast.mx/empleo`.

**Arquitectura:** se calca del flujo que ya existe para el alta de clientes —
formulario público → acción de servidor con la llave de servicio → tabla sin
política de inserción → el panel lo trabaja. La diferencia es que **quien
aplica no tiene sesión**, así que el archivo lo sube el servidor, no el
navegador.

**Herramientas:** Next.js 16 (App Router), React 19, Supabase (Postgres + Auth
+ Storage), Resend para correo, `node --test` para las pruebas.

**Diseño:** `docs/disenos/2026-09-02-trabaja-con-nosotros.md` — se lee junto con
este plan.

## Restricciones que aplican a TODAS las tareas

- **Todo en español**: nombres de archivo, variables, funciones, comentarios y
  textos de pantalla. Es como está escrito el resto del proyecto.
- **Los comentarios explican POR QUÉ, no qué.** El código de este proyecto se
  lee como una explicación; lo que se agregue tiene que leerse igual.
- **El repo es PÚBLICO.** Ni una llave, ni un secreto, ni un dato real de una
  persona en ningún archivo que se suba.
- **No se empuja a `main` sin autorización de Luis.** `git push` a `main` ES el
  despliegue: se trabaja en local, se compila y se prueba, y se sube junto.
- **Modo demostración obligatorio:** cada pantalla nueva funciona sin base de
  datos, con `haySupabase()` / `haySupabaseNavegador()`. Es lo que permite
  revisarla sin tocar producción.
- **Al terminar cada tarea:** `npm test` (78 pruebas hoy, todas pasando) y
  `npm run build` con código de salida 0.
- **Cubeta:** `curriculums`, privada, sin ninguna política de acceso público.
- **Retención:** 12 meses, todas las solicitudes sin importar su estado.
- **Tope anti-spam:** 3 solicitudes por teléfono cada 24 horas.
- **Currículum:** PDF, JPG o PNG, máximo 5 MB, validado **en el servidor**.

## Antes de empezar: dos cosas que dependen de otras personas

- [ ] **Confirmar con el socio que su plan de Vercel permite tareas
  programadas.** El Aviso de Privacidad va a prometer que los currículums se
  borran al año, y quien lo cumple es esa tarea (Tarea 11). Si su plan no las
  tiene, hay que cambiar esa parte del diseño **antes** de prometerlo.
- [ ] **Pedirle a Luis el icono del menú** (`trabaja-con-nosotros.png` y
  `.webp`, 96 px, en `Web/public/img/iconos-animados/`). Si no llega a tiempo,
  la Tarea 10 arranca con `documentos`, que ya existe, y cambiarlo después es
  una línea.

---

### Tarea 1: Las reglas, en un módulo que se puede probar solo

Las pruebas de este proyecto importan de módulos `.mjs` **sin React ni
Supabase** (así es `lib/estado-cliente.mjs`). Todo lo que tenga una regla que
valga la pena comprobar vive aquí, no dentro de una pantalla.

**Archivos:**
- Crear: `Web/lib/empleo.mjs`
- Crear: `Web/tests/empleo.test.mjs`

**Interfaces:**
- Consume: nada.
- Produce: `LIMITES`, `TIPOS_CV`, `MAX_CV_BYTES`, `MESES_QUE_SE_GUARDA`,
  `ESTADOS_SOLICITUD`, `AREAS`, `TIPOS_VACANTE`, `TOPE_POR_DIA`,
  `texto(v, max)`, `folioEmpleo(fecha)`, `validarSolicitud(entrada)`,
  `validarArchivo(archivo)`, `fechaDeCorte(hoy, meses)`,
  `puedeBorrarseVacante(numeroDeSolicitudes)`, `nombreDeVacante(vacante)`,
  `fichaDeVacante(vacante)`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

```js
// Web/tests/empleo.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITES, MAX_CV_BYTES, MESES_QUE_SE_GUARDA,
  texto, folioEmpleo, validarSolicitud, validarArchivo,
  fechaDeCorte, puedeBorrarseVacante, nombreDeVacante, fichaDeVacante,
} from "../lib/empleo.mjs";

const buena = {
  nombre: "Juan Pérez",
  telefono: "868 111 2233",
  puesto: "Chofer de roll off",
  experiencia: "Tres años manejando volteo en una constructora.",
  aviso: true,
};

test("recorta el texto al límite en vez de reventar", () => {
  assert.equal(texto("x".repeat(500), LIMITES.nombre).length, LIMITES.nombre);
  assert.equal(texto("  hola  ", 10), "hola");
  assert.equal(texto(null, 10), "");
});

test("una solicitud completa pasa", () => {
  const r = validarSolicitud(buena);
  assert.equal(r.ok, true);
  assert.equal(r.limpia.nombre, "Juan Pérez");
});

test("sin nombre, sin teléfono o sin experiencia no pasa", () => {
  for (const campo of ["nombre", "telefono", "experiencia"]) {
    const r = validarSolicitud({ ...buena, [campo]: "" });
    assert.equal(r.ok, false, `${campo} vacío deberia fallar`);
  }
});

test("el correo es OPCIONAL, pero si viene tiene que parecer correo", () => {
  assert.equal(validarSolicitud({ ...buena, correo: "" }).ok, true);
  assert.equal(validarSolicitud({ ...buena, correo: "no-es-correo" }).ok, false);
  assert.equal(validarSolicitud({ ...buena, correo: "juan@gmail.com" }).ok, true);
});

test("sin aceptar el aviso no pasa, y ese es el punto", () => {
  assert.equal(validarSolicitud({ ...buena, aviso: false }).ok, false);
});

test("el telefono se guarda solo con digitos, para que el tope no se burle", () => {
  // "868 111 2233" y "8681112233" son la misma persona: si se guardaran
  // distinto, mandar la misma solicitud con y sin espacios saltaria el tope.
  assert.equal(validarSolicitud(buena).limpia.telefono, "8681112233");
  assert.equal(
    validarSolicitud({ ...buena, telefono: "(868) 111-2233" }).limpia.telefono,
    "8681112233"
  );
});

test("el folio lleva el año y no se repite", () => {
  const f = folioEmpleo(new Date("2026-09-02T12:00:00Z"));
  assert.match(f, /^EMP-2026-[A-Z0-9]{4}$/);
  const muchos = new Set(Array.from({ length: 500 }, () => folioEmpleo()));
  assert.ok(muchos.size > 490, "500 folios seguidos no deberian chocar casi nunca");
});

test("el archivo: solo PDF, JPG o PNG y hasta 5 MB", () => {
  assert.equal(validarArchivo(null).ok, true, "sin archivo tambien vale");
  assert.equal(validarArchivo({ type: "application/pdf", size: 1000 }).ok, true);
  assert.equal(validarArchivo({ type: "image/jpeg", size: 1000 }).ok, true);
  assert.equal(validarArchivo({ type: "application/zip", size: 1000 }).ok, false);
  assert.equal(validarArchivo({ type: "application/pdf", size: MAX_CV_BYTES + 1 }).ok, false);
});

test("el corte de los 12 meses cuenta bien, incluso en año bisiesto", () => {
  assert.equal(MESES_QUE_SE_GUARDA, 12);
  const corte = fechaDeCorte(new Date("2026-09-02T00:00:00Z"));
  assert.equal(corte.toISOString().slice(0, 10), "2025-09-02");
  // 29 de febrero: al restar 12 meses no existe el 29-feb-2027, y JavaScript
  // se pasaria al 1 de marzo. Se prefiere el ultimo dia del mes: borrar un dia
  // DESPUES es legal; borrar un dia ANTES de tiempo, no.
  const bisiesto = fechaDeCorte(new Date("2028-02-29T00:00:00Z"));
  assert.equal(bisiesto.toISOString().slice(0, 10), "2027-02-28");
});

test("una solicitud sin vacante NO imprime undefined", () => {
  // Es el error exacto que salio en /admin/recolecciones el 2-sep: la pantalla
  // escribia `${s.chofer} (de la ruta)` y sin chofer imprimia la palabra
  // "undefined" en vivo. Aqui la mayoria de las solicitudes van SIN vacante.
  assert.equal(nombreDeVacante(null), "Solicitud general");
  assert.equal(nombreDeVacante(undefined), "Solicitud general");
  assert.equal(nombreDeVacante({ puesto: "Chofer de roll off" }), "Chofer de roll off");
  assert.equal(nombreDeVacante({}), "Solicitud general");
});

test("la ficha se arma sin separadores colgando", () => {
  assert.equal(
    fichaDeVacante({ area: "operacion", tipo: "tiempo-completo" }),
    "Operación · Tiempo completo"
  );
  // Sin tipo NO debe quedar "Operación ·"
  assert.equal(fichaDeVacante({ area: "operacion" }), "Operación");
  assert.equal(fichaDeVacante({}), "");
});

test("una vacante con candidatos no se puede borrar", () => {
  assert.equal(puedeBorrarseVacante(0).ok, true);
  assert.equal(puedeBorrarseVacante(1).ok, false);
  assert.match(puedeBorrarseVacante(3).motivo, /3 candidatos/);
});
```

- [ ] **Paso 2: Correr las pruebas y comprobar que fallan**

Correr: `cd Web && npm test`
Se espera: `Cannot find module '../lib/empleo.mjs'`

- [ ] **Paso 3: Escribir el módulo**

```js
// Web/lib/empleo.mjs
/**
 * LAS REGLAS DE "TRABAJA CON NOSOTROS", SUELTAS Y COMPROBABLES.
 *
 * Este archivo NO importa React ni Supabase a propósito: las pruebas del
 * proyecto (`npm test`) corren con `node --test` y sólo pueden importar
 * módulos así. Si una regla vive dentro de una pantalla, nadie la prueba.
 *
 * Lo usan los dos lados: la acción de servidor que recibe la solicitud y el
 * formulario del navegador, que valida lo mismo para ser amable. Quien manda
 * es el servidor; el navegador sólo se adelanta.
 */

export const LIMITES = {
  nombre: 120,
  telefono: 30,
  correo: 160,
  puesto: 120,
  experiencia: 2000,
};

/** Lo que se acepta como currículum. */
export const TIPOS_CV = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_CV_BYTES = 5 * 1024 * 1024;

/** Cuánto se guarda una solicitud. Lo promete el Aviso de Privacidad. */
export const MESES_QUE_SE_GUARDA = 12;

/**
 * Cuántas puede mandar el mismo teléfono en 24 horas.
 *
 * ⚠️ Este número está escrito DOS veces: aquí y en la función
 * `puede_solicitar_empleo` de `db/021`. Manda **el SQL**, porque es donde la
 * decisión es atómica; éste sirve sólo para redactar el mensaje. Si se cambia
 * uno, se cambia el otro.
 */
export const TOPE_POR_DIA = 3;

export const ESTADOS_SOLICITUD = ["nueva", "revisada", "contactada", "descartada"];
export const AREAS = ["operacion", "oficina"];
export const TIPOS_VACANTE = ["tiempo-completo", "medio-tiempo", "temporal"];

/** Recorta al límite en vez de reventar. Igual que en `acciones-alta.js`. */
export const texto = (v, max) => String(v ?? "").trim().slice(0, max);

/**
 * Folio de la solicitud: `EMP-2026-8F3K`.
 *
 * Sufijo al azar y NO un consecutivo, calcado de `solicitudes_alta`. Un
 * consecutivo obligaría a leer la tabla antes de escribir —o a un disparador
 * con candado— para resolver una carrera que así ni siquiera existe. Se lee
 * igual por teléfono.
 */
export function folioEmpleo(fecha = new Date()) {
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
  return `EMP-${fecha.getFullYear()}-${azar}`;
}

/** Sólo dígitos: "868 111 2233" y "(868) 111-2233" son la misma persona. */
const soloDigitos = (v) => String(v ?? "").replace(/\D/g, "");

export function validarSolicitud(entrada) {
  const nombre = texto(entrada?.nombre, LIMITES.nombre);
  const telefono = soloDigitos(entrada?.telefono).slice(0, LIMITES.telefono);
  const correo = texto(entrada?.correo, LIMITES.correo);
  const puesto = texto(entrada?.puesto, LIMITES.puesto);
  const experiencia = texto(entrada?.experiencia, LIMITES.experiencia);

  if (!nombre) return { ok: false, motivo: "Falta tu nombre." };
  if (telefono.length < 10) {
    return { ok: false, motivo: "El teléfono debe tener 10 dígitos." };
  }
  if (!puesto) return { ok: false, motivo: "Dinos qué puesto buscas." };
  if (!experiencia) {
    return { ok: false, motivo: "Cuéntanos dónde has trabajado." };
  }
  // El correo es opcional a propósito: el chofer o el ayudante muchas veces
  // no usa correo, y exigirlo lo dejaría fuera. Pero si lo escribe, que sirva.
  if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    return { ok: false, motivo: "El correo no parece válido." };
  }
  if (!entrada?.aviso) {
    return { ok: false, motivo: "Hay que aceptar el Aviso de Privacidad." };
  }

  return {
    ok: true,
    limpia: { nombre, telefono, correo, puesto, experiencia },
  };
}

/** Sin archivo también vale: el currículum es opcional. */
export function validarArchivo(archivo) {
  if (!archivo) return { ok: true };
  if (!TIPOS_CV.includes(archivo.type)) {
    return { ok: false, motivo: "El currículum debe ser PDF, JPG o PNG." };
  }
  if (Number(archivo.size) > MAX_CV_BYTES) {
    return { ok: false, motivo: "El currículum no puede pasar de 5 MB." };
  }
  return { ok: true };
}

/**
 * Desde qué fecha para atrás se borra.
 *
 * `setMonth` se pasa de mes cuando el día no existe en el mes destino (el 29
 * de febrero restándole 12 meses caería en el 1 de marzo). Se corrige hacia
 * ATRÁS: borrar un día después de tiempo es legal, borrar un día antes no.
 */
export function fechaDeCorte(hoy = new Date(), meses = MESES_QUE_SE_GUARDA) {
  const dia = hoy.getUTCDate();
  const corte = new Date(hoy);
  corte.setUTCMonth(corte.getUTCMonth() - meses);
  if (corte.getUTCDate() !== dia) corte.setUTCDate(0);
  return corte;
}

/**
 * Cómo se llama la vacante de una solicitud, en pantalla.
 *
 * La mayoría de las solicitudes van SIN vacante (son generales), así que este
 * caso NO es raro: es el normal. Escribirlo suelto en la pantalla imprimiría
 * la palabra "undefined" en vivo — que es exactamente lo que le pasó a
 * /admin/recolecciones y se arregló el 2-sep-2026.
 */
export function nombreDeVacante(vacante) {
  return vacante?.puesto || "Solicitud general";
}

/** Etiquetas legibles de área y tipo. */
const NOMBRE_AREA = { operacion: "Operación", oficina: "Oficina" };
const NOMBRE_TIPO = {
  "tiempo-completo": "Tiempo completo",
  "medio-tiempo": "Medio tiempo",
  temporal: "Temporal",
};

/**
 * "Operación · Tiempo completo".
 *
 * Las piezas vacías se caen ANTES de unirlas. Escrito a mano con el "·" en
 * medio, una vacante sin tipo saldría como "Operación ·", con el separador
 * colgando de la nada.
 */
export function fichaDeVacante(vacante) {
  return [NOMBRE_AREA[vacante?.area], NOMBRE_TIPO[vacante?.tipo]]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Una vacante con candidatos NO se borra, se cierra. Si se borrara, sus
 * solicitudes quedarían apuntando al vacío y se perdería a qué aplicó cada
 * quien.
 */
export function puedeBorrarseVacante(numeroDeSolicitudes) {
  const n = Number(numeroDeSolicitudes) || 0;
  if (n > 0) {
    return {
      ok: false,
      motivo: `Esta vacante tiene ${n} candidato${n === 1 ? "" : "s"}. Ciérrala en vez de borrarla, para no perder a quién aplicó.`,
    };
  }
  return { ok: true };
}
```

- [ ] **Paso 4: Correr las pruebas y comprobar que pasan**

Correr: `cd Web && npm test`
Se espera: las 78 de antes + las 12 nuevas, todas en verde.

- [ ] **Paso 5: Guardar**

```bash
git add Web/lib/empleo.mjs Web/tests/empleo.test.mjs
git commit -m "Reglas de las solicitudes de empleo, con sus pruebas"
```

---

### Tarea 2: El Aviso de Privacidad, ANTES de recabar nada

Va primero a propósito: **no se puede recabar un dato y avisar después**. Y la
acción de servidor (Tarea 5) necesita la constante de versión que nace aquí.

**Archivos:**
- Modificar: `Web/lib/datos.js` (agregar `AVISO_PRIVACIDAD`)
- Modificar: `Web/app/(claro)/aviso-de-privacidad/page.js`

**Interfaces:**
- Consume: nada.
- Produce: `AVISO_PRIVACIDAD = { version: "2026-09-02" }` desde `@/lib/datos`.

- [ ] **Paso 1: Agregar la constante de versión**

En `Web/lib/datos.js`, junto a las demás constantes de la empresa:

```js
/**
 * VERSIÓN DEL AVISO DE PRIVACIDAD.
 *
 * Es la fecha en que cambió el TEXTO, no la del día. Cada solicitud de empleo
 * guarda cuál aceptó: si algún día alguien pregunta bajo qué términos entregó
 * sus datos, la respuesta sale de la base y no de la memoria de nadie.
 *
 * 🔑 Se sube esta fecha CADA VEZ que se toque el texto del aviso.
 */
export const AVISO_PRIVACIDAD = { version: "2026-09-02" };
```

- [ ] **Paso 2: Escribir la sección nueva del aviso**

En `Web/app/(claro)/aviso-de-privacidad/page.js`, después de la sección de
finalidades, con el mismo marcado que usan las secciones que ya están:

```jsx
<h2 className="h4 mt-5">Si nos mandas una solicitud de empleo</h2>
<p>
  Cuando envías una solicitud desde <strong>Trabaja con nosotros</strong>{" "}
  recabamos tu <strong>nombre, teléfono, el puesto que buscas y tu
  experiencia</strong>; tu <strong>correo</strong> sólo si decides dejarlo, y
  tu <strong>currículum</strong> sólo si decides adjuntarlo.
</p>
<p>
  Los usamos <strong>únicamente</strong> para evaluar tu candidatura y para
  contactarte. No se comparten con nadie, no se usan para publicidad y no se
  cruzan con la información de nuestros clientes.
</p>
<p>
  <strong>Los conservamos 12 meses</strong> a partir del día que los envías, y
  después se borran solos, incluido tu currículum. Si quieres que los
  borremos antes, escríbenos a{" "}
  <a href={`mailto:${EMPRESA.correos[0]}`}>
    <Correo correo={EMPRESA.correos[0]} />
  </a>{" "}
  con tu nombre y el folio que te dimos al enviarla.
</p>
```

⚠️ Si `Correo` no está importado en ese archivo, agregar
`import Correo from "@/components/Correo";`.

- [ ] **Paso 3: Comprobar que se ve bien**

```bash
cd Web && npm run build   # codigo de salida 0
npx next dev -p 3456
```
Abrir `http://localhost:3456/aviso-de-privacidad` a 390 px y a 1440 px y leer
la sección nueva completa.

- [ ] **Paso 4: Guardar**

```bash
git add Web/lib/datos.js "Web/app/(claro)/aviso-de-privacidad/page.js"
git commit -m "Aviso de Privacidad: que recabamos de un candidato y cuanto lo guardamos"
```

---

### Tarea 3: La migración de la base

**Archivos:**
- Crear: `Web/db/021-trabaja-con-nosotros.sql`

**Interfaces:**
- Consume: `es_personal()` (ya existe, db/002).
- Produce: tablas `vacantes`, `solicitudes_empleo`, `intentos_empleo`; función
  `puede_solicitar_empleo(text)`; cubeta `curriculums`.

- [ ] **Paso 1: Escribir la migración**

```sql
-- =====================================================================
--  021 — TRABAJA CON NOSOTROS: vacantes y solicitudes de empleo
--
--  Se corre en Supabase → SQL Editor → New query → Run.
--
--  Lo que hace distinto a esto de todo lo anterior: QUIEN APLICA NO TIENE
--  SESION. Por eso `solicitudes_empleo` no lleva politica de insercion y la
--  cubeta `curriculums` no lleva ninguna politica publica: escribe el
--  servidor con la llave de servicio, que se salta el RLS.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
--  VACANTES — las publica Morcast desde el panel.
-- ---------------------------------------------------------------------
create table if not exists public.vacantes (
  id          uuid primary key default gen_random_uuid(),
  puesto      text not null,
  area        text not null check (area in ('operacion','oficina')),
  tipo        text not null check (tipo in ('tiempo-completo','medio-tiempo','temporal')),
  descripcion text not null default '',
  requisitos  jsonb not null default '[]'::jsonb,
  estado      text not null default 'abierta' check (estado in ('abierta','cerrada')),
  creada_por  uuid references public.perfiles(id) on delete set null,
  creado      timestamptz not null default now()
);
create index if not exists vacantes_estado_idx on public.vacantes (estado, creado desc);

alter table public.vacantes enable row level security;

-- Solo el personal. La pagina publica NO lee de aqui con la llave anonima:
-- la lee el servidor y devuelve solo lo que se enseña (ver acciones-empleo).
drop policy if exists vacantes_personal on public.vacantes;
create policy vacantes_personal on public.vacantes
  for all to authenticated
  using (es_personal()) with check (es_personal());

-- ---------------------------------------------------------------------
--  SOLICITUDES DE EMPLEO — las manda cualquiera desde la pagina publica.
-- ---------------------------------------------------------------------
create table if not exists public.solicitudes_empleo (
  id                uuid primary key default gen_random_uuid(),
  folio             text unique not null,
  nombre            text not null,
  telefono          text not null,
  correo            text,                    -- opcional a proposito
  puesto            text not null,
  -- `set null` ademas del candado de la aplicacion: si alguien borrara una
  -- vacante por SQL directo, la solicitud sobrevive.
  vacante_id        uuid references public.vacantes(id) on delete set null,
  experiencia       text not null,
  cv_ruta           text,                    -- null si no subio nada
  estado            text not null default 'nueva'
                      check (estado in ('nueva','revisada','contactada','descartada')),
  notas             text not null default '',
  aviso_aceptado_en timestamptz not null default now(),
  aviso_version     text not null,
  creado            timestamptz not null default now()
);
create index if not exists solicitudes_empleo_creado_idx on public.solicitudes_empleo (creado desc);
create index if not exists solicitudes_empleo_estado_idx on public.solicitudes_empleo (estado);
create index if not exists solicitudes_empleo_vacante_idx on public.solicitudes_empleo (vacante_id);

alter table public.solicitudes_empleo enable row level security;

-- Lee y trabaja solo el personal. SIN POLITICA DE INSERT, a proposito: si se
-- abriera al publico, cualquiera llenaria la tabla de basura desde fuera.
drop policy if exists solicitudes_empleo_lee_personal on public.solicitudes_empleo;
create policy solicitudes_empleo_lee_personal on public.solicitudes_empleo
  for select to authenticated using (es_personal());

drop policy if exists solicitudes_empleo_edita_personal on public.solicitudes_empleo;
create policy solicitudes_empleo_edita_personal on public.solicitudes_empleo
  for update to authenticated using (es_personal()) with check (es_personal());

drop policy if exists solicitudes_empleo_borra_personal on public.solicitudes_empleo;
create policy solicitudes_empleo_borra_personal on public.solicitudes_empleo
  for delete to authenticated using (es_personal());

-- ---------------------------------------------------------------------
--  FRENO — 3 solicitudes por telefono cada 24 horas.
--
--  NO se reusa `intentos_recuperacion`: esa guarda la hora del ultimo intento
--  y sirve para permitir UNO por ventana. Aqui hacen falta TRES, o sea un
--  contador. Lo que si se reusa es la tecnica: la decision en UNA sentencia,
--  que es lo que la hace atomica.
-- ---------------------------------------------------------------------
create table if not exists public.intentos_empleo (
  telefono text primary key,
  intentos integer not null default 1,
  ventana  timestamptz not null default now()
);

-- Con RLS encendido y sin politicas queda cerrada a todo el mundo. Solo la
-- toca el servidor con la llave de servicio. Si se pudiera leer, seria una
-- lista de telefonos de gente buscando trabajo.
alter table public.intentos_empleo enable row level security;

create index if not exists intentos_empleo_ventana_idx on public.intentos_empleo (ventana);

comment on table public.intentos_empleo is
  'Freno de la pagina publica de empleo. Un renglon por telefono.';

create or replace function public.puede_solicitar_empleo(p_telefono text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_intentos integer;
begin
  insert into public.intentos_empleo (telefono, intentos, ventana)
  values (p_telefono, 1, now())
  on conflict (telefono) do update
    set intentos = case
          when intentos_empleo.ventana < now() - interval '24 hours' then 1
          else intentos_empleo.intentos + 1
        end,
        ventana = case
          when intentos_empleo.ventana < now() - interval '24 hours' then now()
          else intentos_empleo.ventana
        end
  returning intentos into v_intentos;

  -- ⚠️ El 3 tambien esta en `TOPE_POR_DIA` de lib/empleo.mjs, que solo lo usa
  -- para redactar el mensaje. Aqui es donde MANDA. Si se cambia uno, el otro.
  return coalesce(v_intentos, 1) <= 3;
end;
$$;

comment on function public.puede_solicitar_empleo(text) is
  'Anota el intento y dice si cabe. 3 por telefono cada 24 horas.';

-- Que solo el servidor pueda invocarla, igual que 018 con la suya. Es
-- SECURITY DEFINER: sin este revoke, cualquiera con la llave anonima podria
-- llamarla desde el navegador y quemarle la cuota a un telefono ajeno, o
-- tantear cuales ya mandaron solicitud.
revoke all on function public.puede_solicitar_empleo(text) from public, anon, authenticated;
grant execute on function public.puede_solicitar_empleo(text) to service_role;

commit;

-- =====================================================================
--  LA CUBETA — se crea a mano en Supabase → Storage → New bucket:
--    nombre: curriculums
--    Public bucket: NO
--  Y despues se corre esto:
-- =====================================================================

-- Solo el personal, y nadie mas. No hay politica para anonimos NI para
-- clientes: quien aplica nunca toca Storage, sube el servidor por el.
drop policy if exists curriculums_personal on storage.objects;
create policy curriculums_personal on storage.objects
  for all to authenticated
  using (bucket_id = 'curriculums' and es_personal())
  with check (bucket_id = 'curriculums' and es_personal());
```

- [ ] **Paso 2: Aplicarla en Supabase**

🔴 **Esto lo corre Luis**, no el agente: el clasificador de seguridad bloquea
las escrituras a la base. En Supabase → SQL Editor → pegar el archivo → Run.
Luego crear la cubeta `curriculums` (privada) y correr el último bloque.

- [ ] **Paso 3: Comprobar que quedó**

```bash
cd Web && node -e "
const {createClient}=require('@supabase/supabase-js');const fs=require('fs');
const e=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const sb=createClient(e.SUPABASE_URL,e.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
(async()=>{
  for (const t of ['vacantes','solicitudes_empleo','intentos_empleo']) {
    const {error}=await sb.from(t).select('*',{count:'exact',head:true});
    console.log(t, error? 'FALTA: '+error.message : 'OK');
  }
  const {data,error}=await sb.rpc('puede_solicitar_empleo',{p_telefono:'0000000000'});
  console.log('freno', error? 'FALTA: '+error.message : 'OK -> '+data);
  const {data:b}=await sb.storage.listBuckets();
  console.log('cubeta curriculums', b?.some(x=>x.name==='curriculums')?'OK':'FALTA');
})();
"
```
Se espera: cinco `OK`. Después borrar el renglón de prueba del freno:
`delete from intentos_empleo where telefono = '0000000000';`

- [ ] **Paso 4: Guardar**

```bash
git add Web/db/021-trabaja-con-nosotros.sql
git commit -m "Base: vacantes, solicitudes de empleo, freno y cubeta de curriculums"
```

---

### Tarea 4: Los datos de ejemplo del modo demostración

Sin esto, las dos pantallas nuevas se caen cuando no hay Supabase — y el modo
demostración es lo que permite revisarlas sin tocar producción.

**Archivos:**
- Crear: `Web/lib/empleo-datos.js`

**Interfaces:**
- Consume: nada.
- Produce: `VACANTES_SEED`, `SOLICITUDES_EMPLEO_SEED`.

- [ ] **Paso 1: Escribir los datos**

```js
/**
 * Datos de EJEMPLO para el modo demostración (cuando no hay Supabase).
 *
 * 🔑 Gente y empresas INVENTADAS. Nunca se "mejoran" con datos reales para
 * que parezcan más creíbles: este archivo va a un repo público.
 */

export const VACANTES_SEED = [
  {
    id: "VAC-DEMO-1",
    puesto: "Chofer de roll off",
    area: "operacion",
    tipo: "tiempo-completo",
    descripcion: "Movimiento e intercambio de tolvas en el área de Matamoros.",
    requisitos: ["Licencia federal vigente", "Experiencia en roll off", "Disponibilidad de lunes a sábado"],
    estado: "abierta",
    creado: "2026-08-20T10:00:00Z",
  },
  {
    id: "VAC-DEMO-2",
    puesto: "Ayudante de recolección",
    area: "operacion",
    tipo: "tiempo-completo",
    descripcion: "Apoyo en ruta de recolección de residuos sólidos urbanos.",
    requisitos: ["Secundaria terminada", "Condición física para trabajo en ruta"],
    estado: "abierta",
    creado: "2026-08-25T10:00:00Z",
  },
  {
    id: "VAC-DEMO-3",
    puesto: "Auxiliar administrativo",
    area: "oficina",
    tipo: "medio-tiempo",
    descripcion: "Captura, archivo y seguimiento telefónico a clientes.",
    requisitos: ["Manejo de Excel", "Buena redacción"],
    estado: "cerrada",
    creado: "2026-07-10T10:00:00Z",
  },
];

export const SOLICITUDES_EMPLEO_SEED = [
  {
    id: "SOL-DEMO-1",
    folio: "EMP-2026-4KD2",
    nombre: "Ana Ruiz",
    telefono: "8681234567",
    correo: "ana.ruiz@ejemplo.mx",
    puesto: "Auxiliar administrativo",
    vacante_id: null,
    experiencia: "Cinco años en captura y atención a clientes en una distribuidora.",
    cv_ruta: null,
    estado: "nueva",
    notas: "",
    creado: "2026-08-28T16:30:00Z",
  },
  {
    id: "SOL-DEMO-2",
    folio: "EMP-2026-9QT7",
    nombre: "Ramiro Elizondo",
    telefono: "8687712204",
    correo: "",
    puesto: "Chofer de roll off",
    vacante_id: "VAC-DEMO-1",
    experiencia: "Tres años manejando volteo de 14 m³. Licencia federal vigente.",
    cv_ruta: null,
    estado: "revisada",
    notas: "Se le llamó, queda pendiente de pasar por la oficina.",
    creado: "2026-08-30T09:15:00Z",
  },
];
```

- [ ] **Paso 2: Guardar**

```bash
git add Web/lib/empleo-datos.js
git commit -m "Datos de ejemplo de vacantes y solicitudes para el modo demostracion"
```

---

### Tarea 5: Las acciones de servidor

El corazón de la función. Aquí está lo que hace distinto a esto de todo lo
demás: **el archivo lo sube el servidor**.

**Archivos:**
- Crear: `Web/app/acciones-empleo.js`
- Modificar: `Web/lib/correo.js` (agregar dos correos)

**Interfaces:**
- Consume: `validarSolicitud`, `validarArchivo`, `folioEmpleo` (Tarea 1);
  `AVISO_PRIVACIDAD` (Tarea 2); `puede_solicitar_empleo` (Tarea 3);
  `VACANTES_SEED` (Tarea 4).
- Produce: `vacantesAbiertas()` → `Promise<Array>`;
  `enviarSolicitudEmpleo(formData)` → `Promise<{ok, folio?, motivo?}>`.

- [ ] **Paso 1: Agregar los dos correos**

Al final de `Web/lib/correo.js`, con el mismo estilo que `correoAvisoInterno`:

```js
/** A MORCAST: llegó una solicitud de empleo. */
export async function correoAvisoEmpleo(datos) {
  const fila = (etiqueta, valor) =>
    valor
      ? `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;white-space:nowrap;vertical-align:top">${etiqueta}</td><td style="padding:6px 0">${esc(valor)}</td></tr>`
      : "";
  return enviar({
    from: REMITENTE,
    to: [CORREO_AVISOS],
    ...(datos.correo ? { reply_to: datos.correo } : {}),
    subject: `Solicitud de empleo — ${datos.nombre} (${datos.puesto})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Nueva solicitud de empleo</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">
        ${fila("Folio", datos.folio)}
        ${fila("Nombre", datos.nombre)}
        ${fila("Teléfono", datos.telefono)}
        ${fila("Correo", datos.correo)}
        ${fila("Puesto", datos.puesto)}
        ${fila("Experiencia", datos.experiencia)}
        ${fila("Currículum", datos.traeCurriculum ? "Sí, adjunto en el panel" : "No adjuntó")}
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Ábrela en el panel, en <strong>Trabaja con nosotros</strong>. El currículum
        no viaja en este correo a propósito: se ve desde el panel con un enlace que
        caduca, para que no se multiplique en bandejas de entrada.</p>`),
  });
}

/** AL CANDIDATO: acuse, sólo si dejó correo. */
export async function correoAcuseEmpleo({ correo, nombre, folio, puesto }) {
  if (!correo) return { ok: true, omitido: true };
  return enviar({
    from: REMITENTE,
    to: [correo],
    subject: `Recibimos tu solicitud — ${folio}`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Gracias, ${esc(nombre)}</h1>
      <p style="font-size:14px;line-height:1.6">
        Recibimos tu solicitud para <strong>${esc(puesto)}</strong>. Tu folio es
        <strong>${esc(folio)}</strong>.</p>
      <p style="font-size:14px;line-height:1.6">
        Si tu perfil encaja con una vacante, te contactamos por teléfono. Guardamos
        tu información 12 meses y después se borra.</p>`),
  });
}
```

- [ ] **Paso 2: Escribir las acciones**

```js
// Web/app/acciones-empleo.js
"use server";

import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { correoAvisoEmpleo, correoAcuseEmpleo } from "@/lib/correo";
import { AVISO_PRIVACIDAD } from "@/lib/datos";
import { VACANTES_SEED } from "@/lib/empleo-datos";
import { validarSolicitud, validarArchivo, folioEmpleo } from "@/lib/empleo.mjs";

/**
 * LAS VACANTES DE LA PÁGINA PÚBLICA.
 *
 * Se leen desde el SERVIDOR, no desde el navegador con la llave anónima: así
 * la tabla no queda abierta a nadie. Es la misma vía que ya usa
 * `zonasDeCobertura()` para el mapa de la página pública.
 *
 * Devuelve SOLO lo que la pantalla enseña. Quién la creó y cuándo no tienen
 * por qué salir al público.
 */
export async function vacantesAbiertas() {
  if (!haySupabase()) {
    return VACANTES_SEED.filter((v) => v.estado === "abierta");
  }

  const { data, error } = await supabaseServidor()
    .from("vacantes")
    .select("id, puesto, area, tipo, descripcion, requisitos")
    .eq("estado", "abierta")
    .order("creado", { ascending: false });

  if (error) {
    // Que no haya vacantes y que la base falle se dibujan igual —el formulario
    // sigue abajo—, pero en el registro tienen que distinguirse.
    console.error("[empleo] no se pudieron leer las vacantes:", error.message);
    return [];
  }
  return data || [];
}

/**
 * RECIBE UNA SOLICITUD.
 *
 * Llega como FormData porque trae un archivo. El orden importa y no es
 * casual:
 *   1. se valida (servidor, no navegador),
 *   2. se pregunta el freno,
 *   3. se SUBE el archivo,
 *   4. se ESCRIBE el registro — y si esto falla, se borra el archivo,
 *   5. y hasta el final se manda el correo.
 *
 * El correo va al final y su fallo NO tumba la solicitud: en agosto de 2026
 * el formulario de contacto estuvo un mes diciendo "Gracias" sin mandar nada.
 * Aquí, si el correo falla, la solicitud ya está guardada y no se pierde.
 */
export async function enviarSolicitudEmpleo(formData) {
  const entrada = {
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono"),
    correo: formData.get("correo"),
    puesto: formData.get("puesto"),
    experiencia: formData.get("experiencia"),
    aviso: formData.get("aviso") === "si",
  };
  const vacanteId = formData.get("vacanteId") || null;
  const archivo = formData.get("curriculum");
  const traeArchivo = archivo && typeof archivo === "object" && archivo.size > 0;

  const v = validarSolicitud(entrada);
  if (!v.ok) return { ok: false, motivo: v.motivo };

  const a = validarArchivo(traeArchivo ? archivo : null);
  if (!a.ok) return { ok: false, motivo: a.motivo };

  const folio = folioEmpleo();
  const { nombre, telefono, correo, puesto, experiencia } = v.limpia;

  if (!haySupabase()) return { ok: true, demo: true, folio };

  const sb = supabaseServidor();

  // 2) El freno. Una sola sentencia en la base: dos solicitudes al mismo
  //    tiempo no pueden saltarse el tope.
  const { data: cabe, error: errFreno } = await sb.rpc("puede_solicitar_empleo", {
    p_telefono: telefono,
  });
  if (errFreno) {
    console.error("[empleo] fallo el freno:", errFreno.message);
    return { ok: false, motivo: "No se pudo enviar. Inténtalo de nuevo." };
  }
  if (!cabe) {
    return {
      ok: false,
      motivo: "Ya recibimos tu solicitud. Morcast la tiene y te contactará; no hace falta mandarla otra vez.",
    };
  }

  // 3) El archivo primero. Si el registro falla después, se borra: currículums
  //    huérfanos en la cubeta son archivos de una persona que nadie sabe de
  //    quién son.
  let cvRuta = null;
  if (traeArchivo) {
    const extension = (archivo.name.split(".").pop() || "pdf").toLowerCase();
    cvRuta = `${folio}/${Date.now()}.${extension}`;
    const { error: errSubida } = await sb.storage
      .from("curriculums")
      .upload(cvRuta, archivo, { contentType: archivo.type, upsert: false });
    if (errSubida) {
      console.error("[empleo] no se pudo subir el curriculum:", errSubida.message);
      return { ok: false, motivo: "No se pudo subir tu currículum. Inténtalo de nuevo." };
    }
  }

  // 4) El registro.
  // La vacante se pudo cerrar mientras esta persona llenaba el formulario. La
  // solicitud entra IGUAL, como solicitud general: no se tira su trabajo por
  // una carrera que no es suya. Se le avisa al final.
  let vacanteValida = null;
  let vacanteSeCerro = false;
  if (vacanteId) {
    const { data: vac } = await sb
      .from("vacantes").select("id, estado").eq("id", vacanteId).maybeSingle();
    if (vac?.estado === "abierta") vacanteValida = vac.id;
    else vacanteSeCerro = true;
  }

  const { error: errFila } = await sb.from("solicitudes_empleo").insert({
    folio, nombre, telefono,
    correo: correo || null,
    puesto,
    vacante_id: vacanteValida,
    experiencia,
    cv_ruta: cvRuta,
    aviso_version: AVISO_PRIVACIDAD.version,
  });

  if (errFila) {
    if (cvRuta) await sb.storage.from("curriculums").remove([cvRuta]);
    console.error("[empleo] no se pudo guardar:", errFila.message);
    return { ok: false, motivo: "No se pudo guardar tu solicitud. Inténtalo de nuevo." };
  }

  // 5) Los correos, hasta el final y sin poder tumbar nada.
  try {
    await correoAvisoEmpleo({ folio, nombre, telefono, correo, puesto, experiencia, traeCurriculum: Boolean(cvRuta) });
    await correoAcuseEmpleo({ correo, nombre, folio, puesto });
  } catch (e) {
    console.error("[empleo] la solicitud SI se guardo, pero el correo fallo:", e?.message);
  }

  return {
    ok: true,
    folio,
    aviso: vacanteSeCerro
      ? "Ese puesto acaba de cerrarse, pero tu solicitud quedó registrada y la tomamos en cuenta para las próximas vacantes."
      : null,
  };
}
```

- [ ] **Paso 3: Comprobar que compila**

```bash
cd Web && npm run build   # codigo de salida 0
```

- [ ] **Paso 4: Guardar**

```bash
git add Web/app/acciones-empleo.js Web/lib/correo.js
git commit -m "Acciones de servidor de empleo: leer vacantes y recibir solicitudes"
```

---

### Tarea 6: El formulario

**Archivos:**
- Crear: `Web/components/FormularioEmpleo.js`

**Interfaces:**
- Consume: `enviarSolicitudEmpleo` (Tarea 5); `validarArchivo`, `LIMITES`
  (Tarea 1).
- Produce: `<FormularioEmpleo vacantes={[]} />`, componente de navegador.

- [ ] **Paso 1: Escribirlo**

Se calca de `Web/components/FormularioCotizacion.js`, que ya resuelve el envío,
los estados y los mensajes. Reglas que no se negocian:

- **El contrato con el servidor, que no se negocia** (así lo lee
  `enviarSolicitudEmpleo`): los campos se llaman `nombre`, `telefono`,
  `correo`, `puesto`, `experiencia` y `curriculum`; la casilla del aviso es
  `name="aviso" value="si"` (sin marcar no viaja, y eso es justo lo que la
  hace obligatoria); y la vacante va en un campo oculto `name="vacanteId"`,
  vacío cuando es una solicitud general.
- Es `"use client"` y usa las clases `mc-form`, `form-control`, `form-select`
  del sitio público.
- El `<select>` de puesto lista las vacantes abiertas **más** la opción
  `"Cualquier puesto disponible"`. Si la página trae `?vacante=<id>`, viene
  escogida y se manda `vacanteId`.
- El archivo se manda con `FormData`; el `<input type="file">` lleva
  `accept="application/pdf,image/jpeg,image/png"` y valida con
  `validarArchivo()` **antes** de enviar, para ser amable. Quien manda es el
  servidor.
- La casilla del aviso es obligatoria y enlaza a `/aviso-de-privacidad`.
- El botón se deshabilita mientras envía y dice "Enviando…".
- Al terminar bien: se enseña el folio y el formulario se limpia.
- Al terminar mal: se enseña `motivo` tal cual y **no** se limpia nada — que la
  persona no tenga que volver a escribir todo.
- 🔴 **"Gracias" sólo si `r.ok`.** Nunca antes.

El envío, que es donde se equivoca todo el mundo:

```jsx
const enviar = async (e) => {
  e.preventDefault();
  setError("");

  // Amabilidad, no seguridad: quien manda es el servidor.
  const revision = validarArchivo(archivo);
  if (!revision.ok) { setError(revision.motivo); return; }

  setEnviando(true);
  const datos = new FormData(e.currentTarget);
  if (archivo) datos.set("curriculum", archivo);

  const r = await enviarSolicitudEmpleo(datos);
  setEnviando(false);

  if (!r.ok) {
    // NO se limpia nada: que no tenga que volver a escribirlo todo.
    setError(r.motivo);
    return;
  }
  // Y hasta aqui, con r.ok en la mano, se dice "gracias".
  setListo({ folio: r.folio, aviso: r.aviso });
  e.target.reset();
  setArchivo(null);
};
```

- [ ] **Paso 2: Probarlo a mano**

Con `npx next dev -p 3456` (se monta en la Tarea 7). Se prueba: sin nombre, sin
aceptar el aviso, con un `.zip`, con un archivo de más de 5 MB, y bien.

- [ ] **Paso 3: Guardar**

```bash
git add Web/components/FormularioEmpleo.js
git commit -m "Formulario de solicitud de empleo"
```

---

### Tarea 7: La página pública

**Archivos:**
- Crear: `Web/app/(claro)/empleo/page.js`

**Interfaces:**
- Consume: `vacantesAbiertas()` (Tarea 5); `<FormularioEmpleo>` (Tarea 6);
  `Encabezado` de `@/components/Secciones`.

- [ ] **Paso 1: Escribirla**

Componente de servidor (como el resto de `(claro)`), con `metadata` que
incluya título, descripción y `alternates.canonical: "/empleo"`.

Tres bloques, en este orden:

1. `<Encabezado miga="Trabaja con nosotros" titulo="Trabaja con nosotros"
   descripcion="…" />`
2. **Vacantes abiertas.** `const vacantes = await vacantesAbiertas();`
   - Con vacantes: una tarjeta `mc-tarjeta` por vacante con puesto, las
     etiquetas de área y tipo (`mc-tarjeta-etiqueta`), la descripción, los
     requisitos como lista con palomita, y un enlace
     `/empleo?vacante=<id>#solicitud` que dice "Aplicar a esta vacante".
   - **Sin vacantes**: NO se pinta una rejilla vacía. Se pinta
     `<div className="mc-nota">` con: *"Ahora mismo no tenemos vacantes
     abiertas, pero déjanos tus datos y te buscamos cuando se abra una."*
3. **La solicitud**, con `id="solicitud"`:
   `<FormularioEmpleo vacantes={vacantes} />`

En el teléfono las tarjetas van a **una columna** (`col-12 col-md-6
col-lg-4`): a dos columnas en 390 px el texto se queda con una palabra por
renglón.

- [ ] **Paso 2: Verla**

```bash
cd Web && npx next dev -p 3456
```
Abrirla a **390 px y a 1440 px**, con vacantes y sin ellas (apagando las tres
del ejemplo). Comprobar que no hay desborde horizontal:
`document.scrollingElement.scrollWidth === innerWidth`.

- [ ] **Paso 3: Guardar**

```bash
git add "Web/app/(claro)/empleo/page.js"
git commit -m "Pagina publica Trabaja con nosotros"
```

---

### Tarea 8: Los enlaces a la página

**Archivos:**
- Modificar: `Web/lib/datos.js` (`NAVEGACION_SECUNDARIA`)
- Modificar: `Web/app/(claro)/equipo/page.js`

- [ ] **Paso 1: El pie de página**

En `NAVEGACION_SECUNDARIA` de `lib/datos.js`, agregar al final:

```js
  { texto: "Trabaja con nosotros", href: "/empleo" },
```

**No entra en `NAVEGACION`**: el menú de arriba tiene seis entradas a propósito
y no debe competir con los servicios.

- [ ] **Paso 2: La banda al final de /equipo**

Antes del `<BandaCTA>` que ya está, con el mismo marcado de sección:

```jsx
<section className="mc-seccion">
  <div className="container">
    <div className="mc-nota">
      <strong>¿Quieres manejar una de estas unidades?</strong> Morcast contrata
      choferes y ayudantes de recolección en Matamoros.{" "}
      <Link href="/empleo">Ver vacantes y dejar tu solicitud</Link>.
    </div>
  </div>
</section>
```

⚠️ Comprobar que `Link` esté importado en ese archivo.

- [ ] **Paso 3: Comprobar**

`npm run build` en 0, y ver el pie y `/equipo` a 390 px y 1440 px.

- [ ] **Paso 4: Guardar**

```bash
git add Web/lib/datos.js "Web/app/(claro)/equipo/page.js"
git commit -m "Enlaces a Trabaja con nosotros desde el pie y desde Equipo"
```

---

### Tarea 9: La lectura del panel

**Archivos:**
- Crear: `Web/lib/datos-empleo.js`
- Modificar: `Web/lib/datos-archivos.js` (agregar `enlaceCurriculum`)

**Interfaces:**
- Consume: `VACANTES_SEED`, `SOLICITUDES_EMPLEO_SEED` (Tarea 4);
  `puedeBorrarseVacante` (Tarea 1).
- Produce: `listarVacantes()`, `guardarVacante(v)`, `cambiarEstadoVacante(id,
  estado)`, `borrarVacante(id)`, `listarSolicitudesEmpleo()`,
  `cambiarEstadoSolicitud(id, estado, notas)`,
  `contarSolicitudesPorVacante()`; y `enlaceCurriculum(ruta)`.

- [ ] **Paso 1: El enlace del currículum**

Al final de `Web/lib/datos-archivos.js`, junto a los otros dos atajos:

```js
/**
 * Atajo para el currículum de un candidato.
 *
 * Éste SÍ vive aquí, aunque la SUBIDA no: subir lo hace el servidor, porque
 * quien aplica no tiene sesión. Leerlo lo hace el panel, que sí la tiene.
 */
export const enlaceCurriculum = (ruta) => enlaceTemporal("curriculums", ruta);
```

- [ ] **Paso 2: El módulo de lectura**

`Web/lib/datos-empleo.js`, `"use client"`, calcado de `lib/datos-clientes.js`:
cada función arranca con `if (!haySupabaseNavegador()) return <semilla>;` y
después consulta con `supabaseNavegador()`.

🔑 **`borrarVacante` cuenta primero**, y usa `puedeBorrarseVacante()` de la
Tarea 1 — la misma regla que la pantalla usa para apagar el botón. La regla
vive en un solo lugar:

```js
export async function borrarVacante(id) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { count, error: errConteo } = await supabaseNavegador()
    .from("solicitudes_empleo")
    .select("*", { count: "exact", head: true })
    .eq("vacante_id", id);
  if (errConteo) return { ok: false, motivo: errConteo.message };

  const permiso = puedeBorrarseVacante(count || 0);
  if (!permiso.ok) return permiso;

  const { error } = await supabaseNavegador().from("vacantes").delete().eq("id", id);
  if (error) return { ok: false, motivo: error.message };
  return { ok: true };
}
```

`contarSolicitudesPorVacante()` devuelve `{ [vacanteId]: número }` en **una
sola consulta**, no una por vacante. La usa la pantalla (Tarea 10) para apagar
el botón de borrar, y la usa `borrarVacante` para negarse. Es el mismo dato,
pedido una vez:

```js
export async function contarSolicitudesPorVacante() {
  if (!haySupabaseNavegador()) {
    return SOLICITUDES_EMPLEO_SEED.reduce((acc, s) => {
      if (s.vacante_id) acc[s.vacante_id] = (acc[s.vacante_id] || 0) + 1;
      return acc;
    }, {});
  }
  const { data, error } = await supabaseNavegador()
    .from("solicitudes_empleo")
    .select("vacante_id")
    .not("vacante_id", "is", null);
  if (error) return {};
  return (data || []).reduce((acc, s) => {
    acc[s.vacante_id] = (acc[s.vacante_id] || 0) + 1;
    return acc;
  }, {});
}
```

`cambiarEstadoSolicitud` **cuenta las filas que cambió**: un `update` que no
encuentra fila no da error, responde 200 y cambia cero — y la pantalla diría
que se guardó sin que se guardara. Es el mismo error que ya mordió al proyecto
en `acciones-alta-cliente.js`.

- [ ] **Paso 3: Guardar**

```bash
git add Web/lib/datos-empleo.js Web/lib/datos-archivos.js
git commit -m "Lectura y escritura de vacantes y solicitudes desde el panel"
```

---

### Tarea 10: La pantalla del panel

**Archivos:**
- Crear: `Web/app/(admin)/admin/empleo/page.js`
- Modificar: `Web/components/admin/AdminShell.js`

**Interfaces:**
- Consume: todo lo de la Tarea 9; `enlaceCurriculum`; `registrar` de
  `@/lib/bitacora`.

- [ ] **Paso 1: La entrada del rail**

En el arreglo de enlaces de `AdminShell.js`, después de `Altas de clientes`:

```js
  { href: "/admin/empleo", texto: "Trabaja con nosotros", gif: "documentos" },
```

⚠️ `gif: "documentos"` es provisional, porque **no existe un icono para esto**.
Si Luis entrega `trabaja-con-nosotros.png` y `.webp` en
`public/img/iconos-animados/`, se cambia esa palabra y ya. No se reusa
`usuarios-y-roles`: en el rail recogido el icono es lo ÚNICO que se ve, y dos
iguales se vuelven indistinguibles.

- [ ] **Paso 2: La pantalla**

`"use client"`, con la estructura de `app/(admin)/admin/altas/page.js`
(pestañas + lista + panel de detalle).

**Pestaña "Vacantes":** lista con su estado; formulario de alta y edición
(puesto, área, tipo, descripción, requisitos uno por renglón); botones
**Cerrar** / **Reabrir** y **Borrar**. El de borrar se **apaga** cuando la
vacante tiene candidatos, con el motivo visible al lado — no sólo en el
`title`: en una tableta el `title` ni siquiera existe, y un botón apagado sin
explicación es lo más frustrante de una interfaz.

```jsx
{(() => {
  const permiso = puedeBorrarseVacante(conteos[v.id] || 0);
  return (
    <span className="pt-accion-con-motivo">
      <button
        type="button"
        className="pt-btn"
        disabled={!permiso.ok}
        onClick={() => quitarVacante(v.id)}
        title={permiso.ok ? "Borrar la vacante" : permiso.motivo}
      >
        <Trash /> Borrar
      </button>
      {/* El motivo VISIBLE, no solo en el title: en una tableta el title no
          existe, y Luis ya devolvio una pantalla por esto mismo el 1-sep. */}
      {!permiso.ok && (
        <small style={{ color: "var(--mc-gris)" }}>{permiso.motivo}</small>
      )}
    </span>
  );
})()}
```

Y el nombre de la vacante en la bandeja **siempre** pasa por
`nombreDeVacante()` (Tarea 1): la mayoría de las solicitudes no traen vacante,
y escribirlo suelto imprimiría "undefined" en vivo.

**Pestaña "Candidatos":** bandeja con filtros por estado y por vacante. Cada
renglón: folio, fecha, nombre, teléfono, puesto y si trae currículum. Al
abrirlo: la experiencia completa, un botón de **WhatsApp**
(`https://wa.me/52<telefono>`), **Ver currículum** (que pide
`enlaceCurriculum(cv_ruta)` en el momento del clic, no al pintar la lista —
son enlaces que caducan), las notas y los cuatro estados.

Cada cambio llama a `registrar({ accion: "empleo.estado", tabla:
"solicitudes_empleo", registroId: id, detalle: … })`.

Estados vacíos con `pt-vacio`, **nunca** un encabezado de tabla colgando sobre
la nada.

- [ ] **Paso 3: Verla**

Entrar en modo demostración (`admin@morcast.mx` / `admin`) a **390 px y 1440
px**. Comprobar que la barra de arriba no se desborda y que la tabla cabe o se
desliza dentro de `.pt-tabla-wrap`.

- [ ] **Paso 4: Guardar**

```bash
git add "Web/app/(admin)/admin/empleo/page.js" Web/components/admin/AdminShell.js
git commit -m "Panel: vacantes y bandeja de candidatos"
```

---

### Tarea 11: El borrado a los 12 meses

🔴 **No se empieza sin haber confirmado que el Vercel del socio permite tareas
programadas** (ver el principio del plan).

**Archivos:**
- Crear: `Web/app/api/tareas/purgar-empleo/route.js`
- Crear: `Web/vercel.json`
- Modificar: `Web/.env.local` (local, **no** se sube)

- [ ] **Paso 1: La ruta**

```js
// Web/app/api/tareas/purgar-empleo/route.js
/**
 * BORRA LAS SOLICITUDES DE MÁS DE 12 MESES.
 *
 * La llama una tarea programada de Vercel una vez al día. Lo que el Aviso de
 * Privacidad promete, lo cumple esto — por eso no se deja a que alguien abra
 * una pantalla: si nadie entra en tres meses, la promesa es mentira.
 *
 * Borra TODAS las de más de 12 meses, sin importar su estado, también las ya
 * contactadas. Inventar excepciones sería prometer una cosa y hacer otra.
 */
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { fechaDeCorte } from "@/lib/empleo.mjs";

export async function GET(peticion) {
  const autorizacion = peticion.headers.get("authorization");
  if (!process.env.CRON_SECRET || autorizacion !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!haySupabase()) return Response.json({ ok: true, demo: true });

  const sb = supabaseServidor();
  const corte = fechaDeCorte().toISOString();

  const { data: viejas, error } = await sb
    .from("solicitudes_empleo")
    .select("id, cv_ruta")
    .lt("creado", corte);

  if (error) {
    console.error("[purga] no se pudieron leer:", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  if (!viejas?.length) return Response.json({ ok: true, borradas: 0 });

  // Primero los archivos. Al revés quedarían currículums huérfanos que ya
  // nadie sabe de quién son.
  const rutas = viejas.map((s) => s.cv_ruta).filter(Boolean);
  if (rutas.length) {
    const { error: errArchivos } = await sb.storage.from("curriculums").remove(rutas);
    if (errArchivos) {
      console.error("[purga] no se pudieron borrar los archivos:", errArchivos.message);
      return Response.json({ ok: false }, { status: 500 });
    }
  }

  const { error: errFilas } = await sb
    .from("solicitudes_empleo")
    .delete()
    .in("id", viejas.map((s) => s.id));

  if (errFilas) {
    console.error("[purga] no se pudieron borrar los registros:", errFilas.message);
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ ok: true, borradas: viejas.length, archivos: rutas.length });
}
```

- [ ] **Paso 2: Declarar la tarea**

`Web/vercel.json` (no existía):

```json
{
  "crons": [
    { "path": "/api/tareas/purgar-empleo", "schedule": "0 9 * * *" }
  ]
}
```

- [ ] **Paso 3: El secreto**

Generar uno y ponerlo en `.env.local` **y** en las variables de Vercel:

```bash
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```
🔴 **Nunca al repo**, que es público.

- [ ] **Paso 4: Probarla**

```bash
cd Web && npx next dev -p 3456
# sin el secreto: 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3456/api/tareas/purgar-empleo
# con el secreto: 200
curl -s -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  http://localhost:3456/api/tareas/purgar-empleo
```
Se espera: `401` y luego `{"ok":true,"borradas":0}`.

- [ ] **Paso 5: Guardar**

```bash
git add Web/app/api/tareas/purgar-empleo/route.js Web/vercel.json
git commit -m "Tarea diaria que borra las solicitudes de mas de 12 meses"
```

---

### Tarea 12: Probarlo de punta a punta antes de proponer el despliegue

- [ ] **Paso 1: Lo automático**

```bash
cd Web && npm test          # 78 + las nuevas, todas en verde
npm run build               # codigo de salida 0
```

- [ ] **Paso 2: El recorrido completo, con la base de verdad**

Con el servidor apuntando a Supabase real:

1. Publicar una vacante desde el panel.
2. Verla en `/empleo`.
3. Mandar una solicitud **con** currículum desde el teléfono (390 px).
4. Mandar otra **sin** currículum y **sin correo**.
5. Que las dos aparezcan en la bandeja del panel.
6. Abrir el currículum con "Ver currículum".
7. **Comprobar que el correo salió de verdad** — en la bandeja de Resend o en
   el buzón, no que la pantalla dijo que salió.
8. Intentar borrar la vacante que ya tiene candidatos: tiene que negarse y
   decir por qué.
9. Mandar cuatro solicitudes seguidas con el mismo teléfono: la cuarta se
   frena.

- [ ] **Paso 3: Que la cubeta esté cerrada**

Sin sesión, intentar abrir
`<SUPABASE_URL>/storage/v1/object/public/curriculums/<ruta>` y confirmar que
**no** se puede.

- [ ] **Paso 4: Limpiar lo de la prueba**

Borrar de producción la vacante y las solicitudes de prueba, y sus archivos de
la cubeta.

- [ ] **Paso 5: 🔴 EL CANDADO LEGAL — antes de proponer siquiera el despliegue**

El Aviso de Privacidad (Tarea 2) **ya promete** que los currículums "se borran
solos" a los 12 meses. Ese texto no puede llegar a `main` mientras la promesa
no sea verdad. Comprobar las tres, y que las tres den que sí:

1. La Tarea 11 está terminada y `vercel.json` declara la tarea programada.
2. El plan de Vercel del socio **permite** tareas programadas (confirmado por
   él, no supuesto).
3. La ruta contesta 401 sin el secreto y 200 con él.

Si alguna falla, **no se despliega el Aviso**: o se espera, o se cambia el
texto por uno que diga la verdad de ese momento. Publicar una web que promete
un borrado que no ocurre es exposición legal para Morcast, no un detalle de
redacción.

- [ ] **Paso 6: Enseñárselo a Luis y pedirle autorización para desplegar**

🔴 **No se empuja a `main` sin su visto bueno.** `git push` a `main` ES el
despliegue.

---

## Lo que este plan NO hace

- No crea el papel de "auxiliar de administrador": no existe en la base y es su
  propio proyecto (§7 del diseño).
- No mete "Trabaja con nosotros" en el menú principal.
- No toca las apps de Android ni de iPhone.
- No adjunta el currículum al correo: se abre desde el panel con enlace que
  caduca.
