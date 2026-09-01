# Cargar la operación real, estados de cliente y modo Hold — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meter la operación real de Morcast (42 clientes, 68 puntos, 64 servicios, 5 rutas) a la base de producción, sacar los 5 clientes de prueba, y dejar el sistema diciendo la verdad sobre lo que todavía no tiene: expedientes incompletos marcados como tales, y un modo Hold que apaga las cifras inventadas.

**Architecture:** Tres fases con puertas humanas entre ellas. Primero el **código** (el modo Hold, las etiquetas de estado, la zona de cobertura) porque desplegarlo después dejaría a 16 clientes reales etiquetados como "Morosos" en vivo. Después la **migración**, que es aditiva y no rompe nada. Al final el **script de carga**, en cuatro piezas: un volcado del Excel a JSON, un módulo de reglas puro y probado, una tabla de equivalencias escrita a mano, y el cargador que es lo único que toca la base.

**Tech Stack:** Next.js (versión del repo — leer `node_modules/next/dist/docs/` antes de tocar convenciones), React, Supabase (postgres-js + RLS), `node --test` para pruebas, Python 3 con `openpyxl` para el volcado del Excel, `psql` 17 para migraciones.

**Spec:** `docs/superpowers/specs/2026-09-01-cargar-operacion-real-design.md`

## Global Constraints

- **Rama de trabajo: `operacion-real`.** NADA se empuja a `main` sin autorización explícita de Luis: en Vercel el push a `main` *es* el despliegue.
- **Idioma del código:** identificadores, comentarios y mensajes de commit en español, sin acentos en los mensajes de commit. Es el estilo de todo el repositorio.
- **Los comentarios explican POR QUÉ, no QUÉ.** El repositorio documenta la trampa que motivó cada decisión. Seguir ese estilo.
- **Estado nuevo:** `pendiente-info` en la base, **"Pendiente por información"** en pantalla. Nunca al revés.
- **Vara de completitud:** un cliente queda `activo` sólo si tiene `contacto` **y** `telefono` **y** `correo`. Cualquier otra cosa es `pendiente-info`. Lo fiscal (RFC, domicilio) **no** entra en la vara.
- **Cifras:** se apagan del lado del **cliente** (portal). Del lado de **Morcast** (panel) se conservan, con el banner encima.
- **Escrituras a Supabase:** siempre `.select()` y **contar las filas devueltas**. Un INSERT o UPDATE bloqueado por RLS responde 200 sin error y sin escribir nada.
- **Migraciones:** por `psql`, con `-v ON_ERROR_STOP=1 --single-transaction`.
- **Ruta del cuaderno:** `C:\Users\andre\Downloads\MORCAST - Cuaderno de captura LLENO.xlsx`.

## Mapa de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `Web/lib/estado-sistema.js` | El interruptor del Hold y su motivo. Una sola verdad. |
| `Web/components/AvisoHold.js` | La banda ámbar. Sólo presentación. |
| `Web/lib/estado-cliente.mjs` | Qué le falta a un cliente y cómo se llama su estado. Puro. |
| `Web/lib/zona-matamoros.mjs` | El polígono único de cobertura mientras no haya zonas por ruta. |
| `Web/db/019-la-operacion-real.sql` | La migración. |
| `Web/scripts/cuaderno/extraer.py` | Excel → JSON, sin reglas. |
| `Web/scripts/cuaderno/cuaderno.json` | El volcado, versionado en el repo. |
| `Web/scripts/cuaderno/normalizar.mjs` | Todas las reglas de limpieza. Puro. |
| `Web/scripts/cuaderno/equivalencias.js` | Tabla a mano de nombres rotos → cliente real. |
| `Web/scripts/cuaderno/respaldar.mjs` | Volcado de la base a JSON antes de borrar. |
| `Web/scripts/cuaderno/limpiar.mjs` | Borrado de los datos de prueba. |
| `Web/scripts/cuaderno/cargar.mjs` | Lo único que escribe la operación real. |
| `Web/tests/estado-cliente.test.mjs` | Pruebas de la vara de completitud. |
| `Web/tests/zona-matamoros.test.mjs` | Pruebas del polígono. |
| `Web/tests/normalizar.test.mjs` | Pruebas de las reglas de limpieza. |
| `Web/tests/estado-sistema.test.mjs` | El Hold nunca se enciende sin motivo. |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `Web/components/portal/PortalShell.js:195` | Montar `<AvisoHold/>` |
| `Web/components/admin/AdminShell.js:189` | Montar `<AvisoHold lado="admin"/>` |
| `Web/app/(portal)/portal/cotizador/page.js` | Apagar montos y PDF durante el Hold |
| `Web/app/(portal)/portal/agregar-saldo/page.js` | Apagar cifras durante el Hold |
| `Web/app/(portal)/portal/page.js` | Apagar la tarjeta de saldo durante el Hold |
| `Web/app/(admin)/admin/clientes/page.js:29,127-129` | Tres etiquetas en vez de Activo/Moroso |
| `Web/lib/datos-clientes.js:57` | Dejar pasar el estado tal cual |
| `Web/lib/datos-panel.js:23` | Contar también los pendientes |
| `Web/lib/rutas-datos.js:21-22` | `DIAS_SEMANA` gana el domingo |
| `Web/app/acciones-alta.js:32` | `zonasDeCobertura()` cae a la zona única |

---

## FASE A — Código (se despliega ANTES que los datos)

### Task 1: El interruptor del Hold y su aviso

**Files:**
- Create: `Web/lib/estado-sistema.js`
- Create: `Web/components/AvisoHold.js`
- Create: `Web/tests/estado-sistema.test.mjs`
- Modify: `Web/components/portal/PortalShell.js:195`
- Modify: `Web/components/admin/AdminShell.js:189`

**Interfaces:**
- Consumes: nada.
- Produces: `HOLD` (objeto `{activo: boolean, titulo: string, motivo: string, desde: string}`), `enHold(): boolean`, y el componente por omisión `AvisoHold({lado})` donde `lado` es `"portal"` (por omisión) o `"admin"`.

- [ ] **Step 1: Escribir la prueba que falla**

`Web/tests/estado-sistema.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { HOLD, enHold } from "../lib/estado-sistema.js";

test("enHold refleja el interruptor", () => {
  assert.equal(enHold(), HOLD.activo === true);
});

// Un Hold encendido sin motivo es una trampa para el que lo encuentre
// dentro de tres meses: sabe que algo esta apagado y no por que.
test("el Hold nunca se enciende sin decir por que", () => {
  if (HOLD.activo) {
    assert.ok(HOLD.motivo && HOLD.motivo.trim().length > 20,
      "HOLD.activo es true pero HOLD.motivo esta vacio o es demasiado corto");
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(HOLD.desde),
      "HOLD.desde debe ser una fecha AAAA-MM-DD");
  }
});
```

- [ ] **Step 2: Correrla para verificar que falla**

Run: `cd Web && node --test tests/estado-sistema.test.mjs`
Expected: FAIL — `Cannot find module '../lib/estado-sistema.js'`

- [ ] **Step 3: Escribir el interruptor**

`Web/lib/estado-sistema.js`:

```js
/**
 * EL MODO HOLD — Morcast todavia no esta cobrando.
 *
 * DE DONDE SALE ESTO
 * El 1-sep-2026 se cargo la operacion real (42 clientes, 68 puntos, 64
 * servicios) desde el cuaderno que devolvio la empresa. Pero el cuaderno
 * llego con CERO precios en los 64 servicios, asi que los 12 montos del
 * cotizador siguen siendo los que invento Claude en agosto.
 *
 * Mientras eso siga asi, el sistema tiene los datos pero NO puede hablar de
 * dinero con el cliente. Este interruptor lo dice en voz alta, dentro del
 * propio sistema, en vez de dejarlo en la memoria de quien lo construyo.
 *
 * COMO SE APAGA
 * Se apaga en el MISMO commit en que entran los precios reales a
 * `CATALOGO_COTIZADOR` (lib/portal-datos.js). No antes: apagar el Hold sin
 * precios cargados devuelve al cotizador los montos inventados. Por eso el
 * interruptor vive en un archivo y no en una tabla con un boton en el panel:
 * el boton daria una libertad que en realidad no existe.
 */
export const HOLD = {
  activo: true,
  titulo: "Sistema en preparación",
  motivo:
    "Estamos cargando la operación y afinando la lista de precios. " +
    "Todavía no se generan cobros.",
  desde: "2026-09-01",
};

/** ¿Está el sistema en espera? Usar esto, no `HOLD.activo` suelto. */
export function enHold() {
  return HOLD.activo === true;
}
```

- [ ] **Step 4: Correr la prueba para verificar que pasa**

Run: `cd Web && node --test tests/estado-sistema.test.mjs`
Expected: PASS (2 pruebas)

- [ ] **Step 5: Escribir el componente del aviso**

`Web/components/AvisoHold.js`:

```js
"use client";

import { Warning } from "@phosphor-icons/react/dist/ssr";
import { HOLD, enHold } from "@/lib/estado-sistema";

/**
 * La banda de "sistema en espera".
 *
 * Es una BANDA, no un modal, a proposito: hay que poder trabajar con ella
 * puesta. Un modal obligaria a cerrarlo en cada carga de pagina y a los dos
 * dias nadie lo leeria.
 *
 * `lado="admin"` agrega la linea que le falta al equipo de Morcast: saber que
 * esto MISMO lo esta viendo su cliente.
 */
export default function AvisoHold({ lado = "portal" }) {
  if (!enHold()) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: "0.7rem",
        alignItems: "flex-start",
        background: "#fff8e1",
        border: "1px solid #f0c36d",
        borderRadius: "10px",
        padding: "0.8rem 1rem",
        marginBottom: "1.2rem",
        color: "#6b4e00",
        fontSize: "0.9rem",
        lineHeight: 1.45,
      }}
    >
      <Warning size={20} weight="fill" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
      <div>
        <strong>{HOLD.titulo}.</strong> {HOLD.motivo}
        {lado === "admin" && (
          <div style={{ marginTop: "0.35rem", opacity: 0.85 }}>
            Tus clientes ven este mismo aviso en su portal, y las cifras están
            ocultas de su lado. Aquí siguen visibles.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Montarlo en los dos shells**

En `Web/components/portal/PortalShell.js`, agregar el import arriba junto a los demás:

```js
import AvisoHold from "@/components/AvisoHold";
```

y cambiar la línea 195-196 de:

```js
          <main className="pt-content">
            <TransicionPagina>{children}</TransicionPagina>
```

a:

```js
          <main className="pt-content">
            <AvisoHold />
            <TransicionPagina>{children}</TransicionPagina>
```

En `Web/components/admin/AdminShell.js`, el mismo import, y la línea 189-190 pasa a:

```js
          <main className="pt-content">
            <AvisoHold lado="admin" />
            <TransicionPagina>{children}</TransicionPagina>
```

> El aviso va DENTRO de `<main>` y FUERA de `<TransicionPagina>`: dentro de la
> transición se desvanecería y reaparecería en cada navegación, que es
> exactamente el parpadeo que uno no quiere de un aviso permanente.

- [ ] **Step 7: Verificar a ojo**

Run: `cd Web && npm run dev`
Abrir `http://localhost:3000/admin` y `http://localhost:3000/portal` con sesión.
Expected: la banda ámbar aparece arriba del contenido en las dos, y en el panel trae la línea extra. Al navegar entre pantallas **no parpadea**.

- [ ] **Step 8: Commit**

```bash
git add Web/lib/estado-sistema.js Web/components/AvisoHold.js Web/tests/estado-sistema.test.mjs Web/components/portal/PortalShell.js Web/components/admin/AdminShell.js
git commit -m "Modo Hold: el interruptor y el aviso en los dos shells"
```

---

### Task 2: Apagar las cifras del lado del cliente

**Files:**
- Modify: `Web/app/(portal)/portal/cotizador/page.js`
- Modify: `Web/app/(portal)/portal/agregar-saldo/page.js:141-170`
- Modify: `Web/app/(portal)/portal/page.js:160-178`
- Modify: `Web/app/(portal)/portal/reportes/page.js`

> ⚠️ **`/portal/reportes` no está en la tabla de la sección 5.3 del spec: es un
> hueco del spec que salió al revisar el plan.** La pantalla llama a `pesos()`
> y baja un PDF con `descargarReportePDF`. La regla del spec —"del lado del
> cliente se apaga todo"— aplica igual, así que entra aquí. Anotarlo en el
> spec al terminar.

**Interfaces:**
- Consumes: `enHold()` de `Web/lib/estado-sistema.js` (Task 1).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Apagar el cotizador**

En `Web/app/(portal)/portal/cotizador/page.js`, agregar al bloque de imports:

```js
import { enHold, HOLD } from "@/lib/estado-sistema";
```

y como primera línea del cuerpo del componente `CotizadorPortal`, antes de cualquier `useState`:

```js
  // Los 12 precios de `CATALOGO_COTIZADOR` los invento Claude en agosto-2026;
  // la empresa devolvio el cuaderno con CERO precios. Un cotizador que suma
  // montos falsos y los baja en un PDF con membrete es la superficie mas
  // peligrosa del portal: ese PDF sobrevive al Hold y anda suelto para
  // siempre. Por eso aqui no se ocultan los numeros: no se llega a calcular.
  if (enHold()) return <CotizadorEnEspera />;
```

y al final del archivo, fuera de `CotizadorPortal` (**fuera**: un componente
definido dentro de otro se remonta en cada render y en el móvil cierra el
teclado — ya pasó en `/portal/nueva-clave`):

```js
function CotizadorEnEspera() {
  return (
    <div className="pt-card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
      <FileText size={48} weight="duotone" style={{ opacity: 0.5, marginBottom: "1rem" }} />
      <h2 style={{ marginBottom: "0.6rem" }}>{HOLD.titulo}</h2>
      <p style={{ maxWidth: "42ch", margin: "0 auto 1.4rem", color: "var(--mc-gris)" }}>
        Estamos afinando nuestra lista de precios. Mientras tanto,
        cotizamos por escrito: escríbenos y te contestamos con los montos
        de tus servicios.
      </p>
      <a className="mc-btn mc-btn-verde" href="/contacto">
        Pedir una cotización
      </a>
    </div>
  );
}
```

> El botón lleva a `/contacto`, que ya existe y ya manda correo por Resend.
> No se inventa una pantalla nueva para esto.

- [ ] **Step 2: Verificar el cotizador**

Run: `cd Web && npm run dev`, abrir `http://localhost:3000/portal/cotizador`
Expected: la tarjeta de espera. **Ningún monto en pantalla, ningún botón de descarga.**

- [ ] **Step 3: Apagar las cifras de agregar-saldo**

En `Web/app/(portal)/portal/agregar-saldo/page.js` el bloque de datos bancarios
ya distingue `DATOS_DEPOSITO.demo`. Se le suma el Hold: agregar el import

```js
import { enHold, HOLD } from "@/lib/estado-sistema";
```

y envolver el bloque de cifras (los `pesos(...)` del resumen de saldo, **no**
el formulario de subir comprobante) con:

```js
{enHold() ? (
  <p className="pt-nota" style={{ margin: 0 }}>
    {HOLD.motivo} Tu saldo aparecerá aquí en cuanto empiece la facturación.
  </p>
) : (
  /* el bloque de cifras que ya existe, tal cual */
)}
```

> El formulario para reportar un depósito **se queda funcionando**. Si alguien
> deposita de todos modos, Morcast tiene que poder recibir el comprobante; lo
> que se apaga es la cifra, no la capacidad de registrar dinero que llegó.

- [ ] **Step 4: Apagar la tarjeta de saldo del panel del cliente**

En `Web/app/(portal)/portal/page.js`, agregar el import de `enHold` y envolver
la tarjeta de saldo y la estadística "Por pagar" (líneas ~160-178) con el mismo
patrón: si `enHold()`, en lugar del monto se muestra `—` y de subtexto
`"Sin cobros todavía"`.

```js
<div className="pt-stat-valor">{enHold() ? "—" : pesos(cuenta.porPagar)}</div>
<div className="pt-stat-sub">
  {enHold()
    ? "Sin cobros todavía"
    : real
      ? (cuenta.diasCredito ? `Crédito a ${cuenta.diasCredito} días` : "Pago de contado")
      : `Corte: ${fechaLarga(CUENTA.proximoCorte)}`}
</div>
```

El botón "Agregar saldo" **se conserva**, por la misma razón del paso 3.

- [ ] **Step 5: Apagar los montos de `/portal/reportes`**

En `Web/app/(portal)/portal/reportes/page.js`, agregar el import de `enHold` y
`HOLD`, y envolver **cada** `pesos(...)` y el botón de descargar el PDF con la
misma regla:

```js
{enHold() ? "—" : pesos(valor)}
```

y para el botón:

```js
{!enHold() && (
  /* el boton de descargar el reporte, tal cual */
)}
```

Arriba de la tabla, cuando `enHold()`, poner la nota:

```js
<p className="pt-nota">
  Los importes aparecerán aquí en cuanto empiece la facturación.
  Los servicios y sus fechas sí son reales.
</p>
```

> Los **servicios y sus fechas se quedan visibles**: son ciertos y le sirven al
> cliente. Lo único que no es cierto todavía es el dinero.

- [ ] **Step 6: Verificar las cuatro pantallas**

Run: `cd Web && npm run dev`
Recorrer `/portal`, `/portal/cotizador`, `/portal/agregar-saldo` y `/portal/reportes` con sesión de cliente.
Expected: **cero cifras de dinero en las cuatro.** El formulario de comprobante sigue ahí; los servicios y fechas de `/portal/reportes` siguen ahí.
Después abrir `/admin/saldos`, `/admin/reportes` y `/admin/clientes`: **las cifras del panel SIGUEN visibles**, con la banda ámbar arriba.

- [ ] **Step 7: Commit**

```bash
git add "Web/app/(portal)/portal/cotizador/page.js" "Web/app/(portal)/portal/agregar-saldo/page.js" "Web/app/(portal)/portal/page.js" "Web/app/(portal)/portal/reportes/page.js"
git commit -m "Hold: apagar las cifras del lado del cliente, no las de Morcast"
```

---

### Task 3: El estado del cliente y sus tres etiquetas

**Files:**
- Create: `Web/lib/estado-cliente.mjs`
- Create: `Web/tests/estado-cliente.test.mjs`
- Modify: `Web/lib/datos-clientes.js:57`
- Modify: `Web/app/(admin)/admin/clientes/page.js:29,127-129`
- Modify: `Web/lib/datos-panel.js:23`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `CAMPOS_PARA_OPERAR: Array<{campo: string, etiqueta: string}>`
  - `loQueFalta(cliente: object): string[]` — etiquetas legibles de los campos vacíos
  - `estadoPorCompletitud(cliente: object): "activo" | "pendiente-info"`
  - `etiquetaEstado(estado: string): {texto: string, clase: string}`
  - **Task 9 (`normalizar.mjs`) consume `estadoPorCompletitud`. No duplicar la regla.**

- [ ] **Step 1: Escribir las pruebas que fallan**

`Web/tests/estado-cliente.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loQueFalta,
  estadoPorCompletitud,
  etiquetaEstado,
} from "../lib/estado-cliente.mjs";

const completo = {
  empresa: "AGAR",
  contacto: "CRUZ A. CASAS",
  telefono: "8681490531",
  correo: "facturacion@agarlabels.com",
};

test("un cliente con contacto, telefono y correo esta completo", () => {
  assert.deepEqual(loQueFalta(completo), []);
  assert.equal(estadoPorCompletitud(completo), "activo");
});

// ESTA es la prueba que impide que un cambio futuro deje entrar a los 16
// pendientes por descuido. 13 de los 42 clientes del cuaderno llegaron sin
// correo, y el correo es por donde llega el acceso al portal.
test("sin correo NO esta completo, aunque tenga todo lo demas", () => {
  const sinCorreo = { ...completo, correo: "" };
  assert.deepEqual(loQueFalta(sinCorreo), ["correo"]);
  assert.equal(estadoPorCompletitud(sinCorreo), "pendiente-info");
});

test("sin telefono ni contacto reporta los dos, en orden", () => {
  const pelado = { ...completo, contacto: "", telefono: null };
  assert.deepEqual(loQueFalta(pelado), ["persona de contacto", "teléfono"]);
  assert.equal(estadoPorCompletitud(pelado), "pendiente-info");
});

// El cuaderno trae "N-A" tecleado a mano en la columna de correo. Si llegara
// asi a la base, un cliente sin correo se veria completo.
// El guion largo NO viene del cuaderno: lo pone `datos-clientes.js` al mapear
// `contacto: c.contacto || "—"`. Es el relleno mas peligroso de todos porque
// nos lo hacemos solos.
test("el guion largo de nuestra propia capa de datos no cuenta como dato", () => {
  assert.equal(estadoPorCompletitud({ ...completo, contacto: "—" }), "pendiente-info");
  assert.deepEqual(loQueFalta({ ...completo, contacto: "—" }), ["persona de contacto"]);
});

test("los rellenos vacios no cuentan como dato", () => {
  for (const relleno of ["N-A", "n/a", "NA", "-", "  ", "NO", ".", "—"]) {
    assert.equal(
      estadoPorCompletitud({ ...completo, correo: relleno }),
      "pendiente-info",
      `"${relleno}" se colo como correo valido`
    );
  }
});

test("lo fiscal NO entra en la vara", () => {
  // Exigir domicilio fiscal dejaria 2 clientes activos de 42: la empresa
  // lleno esa columna con el REGIMEN en 28 de ellos.
  const sinFiscal = { ...completo, rfc: null, domicilio_fiscal: null };
  assert.equal(estadoPorCompletitud(sinFiscal), "activo");
});

test("cada estado tiene su etiqueta y su clase de badge", () => {
  assert.deepEqual(etiquetaEstado("activo"), { texto: "Activo", clase: "ok" });
  assert.deepEqual(etiquetaEstado("pendiente-info"), {
    texto: "Pendiente por información",
    clase: "prog",
  });
  assert.deepEqual(etiquetaEstado("suspendido"), { texto: "Suspendido", clase: "mal" });
  assert.deepEqual(etiquetaEstado("baja"), { texto: "Baja", clase: "" });
});

test("un estado desconocido no truena la tabla", () => {
  assert.deepEqual(etiquetaEstado("inventado"), { texto: "inventado", clase: "" });
});
```

- [ ] **Step 2: Correrlas para verificar que fallan**

Run: `cd Web && node --test tests/estado-cliente.test.mjs`
Expected: FAIL — `Cannot find module '../lib/estado-cliente.mjs'`

- [ ] **Step 3: Escribir el módulo**

`Web/lib/estado-cliente.mjs`:

```js
/**
 * QUE LE FALTA A UN CLIENTE, Y COMO SE LLAMA SU ESTADO.
 *
 * DE DONDE SALE ESTO
 * El cuaderno que devolvio la empresa el 27-ago-2026 trae la operacion real,
 * pero incompleta: de 42 clientes, 13 no tienen correo, 13 no tienen telefono
 * y 13 no tienen persona de contacto. Cargarlos como "activos" seria mentir;
 * no cargarlos seria seguir con una base de mentira.
 *
 * POR QUE LA VARA ES CONTACTO + TELEFONO + CORREO
 * Es lo que hace falta para OPERAR: a quien se le llama y a donde se le manda
 * su acceso al portal. Lo fiscal (RFC, domicilio) se dejo FUERA a proposito:
 * exigirlo dejaria 2 clientes activos de 42, porque la empresa lleno la
 * columna de domicilio fiscal con el REGIMEN en 28 de ellos. Lo fiscal sirve
 * para facturar, no para operar, y bloquear la operacion por eso seria
 * castigar a Morcast por un error de captura.
 *
 * LO QUE FALTA NO SE GUARDA EN UNA COLUMNA
 * Se calcula aqui, mirando los campos. Guardarlo seria una copia que se
 * desincroniza en cuanto alguien llene el telefono.
 *
 * ⚠️ `scripts/cuaderno/normalizar.mjs` importa `estadoPorCompletitud` de aqui.
 * La regla vive en UN solo lugar: dos copias de una regla acaban diciendo
 * cosas distintas.
 */

/** Lo que hace falta para operar, en el orden en que se le reporta a Morcast. */
export const CAMPOS_PARA_OPERAR = [
  { campo: "contacto", etiqueta: "persona de contacto" },
  { campo: "telefono", etiqueta: "teléfono" },
  { campo: "correo", etiqueta: "correo" },
];

/**
 * Rellenos que la gente teclea cuando no tiene el dato. En el cuaderno hay
 * "N-A" literal en la columna de correo: si llegara asi a la base, un cliente
 * sin correo se veria completo.
 */
const RELLENOS = new Set([
  "na", "n/a", "n-a", "n.a.", "no", "-", "--", ".", "ninguno", "sin correo",
  // El guion largo lo pone NUESTRA propia capa de datos: `datos-clientes.js`
  // mapea `contacto: c.contacto || "—"` para que la tabla no salga con
  // huecos. Sin esta entrada, un cliente sin persona de contacto llegaria
  // aqui con "—" y se veria completo — el bug se lo habriamos hecho nosotros
  // solos, no la empresa.
  "—", "–",
]);

/** ¿Este campo trae un dato de verdad? */
export function hayDato(valor) {
  const v = String(valor ?? "").trim();
  if (!v) return false;
  return !RELLENOS.has(v.toLowerCase());
}

/** Las etiquetas de lo que le falta al cliente. Vacio = esta completo. */
export function loQueFalta(cliente) {
  return CAMPOS_PARA_OPERAR
    .filter(({ campo }) => !hayDato(cliente?.[campo]))
    .map(({ etiqueta }) => etiqueta);
}

/** El estado que le toca por lo que trae, sin mirar lo fiscal. */
export function estadoPorCompletitud(cliente) {
  return loQueFalta(cliente).length ? "pendiente-info" : "activo";
}

/**
 * Como se llama cada estado en pantalla.
 *
 * Antes esta pantalla pintaba `estatus === "activo" ? "Activo" : "Moroso"`.
 * Con el estado nuevo, los 16 clientes a los que solo les falta un telefono
 * habrian aparecido en vivo ACUSADOS DE MOROSOS.
 */
const ETIQUETAS = {
  activo: { texto: "Activo", clase: "ok" },
  "pendiente-info": { texto: "Pendiente por información", clase: "prog" },
  suspendido: { texto: "Suspendido", clase: "mal" },
  baja: { texto: "Baja", clase: "" },
};

export function etiquetaEstado(estado) {
  return ETIQUETAS[estado] || { texto: String(estado ?? ""), clase: "" };
}
```

- [ ] **Step 4: Correr las pruebas para verificar que pasan**

Run: `cd Web && node --test tests/estado-cliente.test.mjs`
Expected: PASS (7 pruebas)

- [ ] **Step 5: Dejar pasar el estado en la capa de datos**

En `Web/lib/datos-clientes.js`, la línea 57 dice:

```js
    estatus: c.estado === "activo" ? "activo" : c.estado,
```

que es un no-op enrevesado. Cambiarla por:

```js
    estatus: c.estado,
```

y agregar al `select` de la línea 41 los campos que la pantalla necesita para
decir **qué** le falta:

```js
      .select("id, folio, empresa, contacto, correo, telefono, plan, estado, desde, dias_credito, limite_credito, nota_interna")
```

y al objeto devuelto:

```js
    notaInterna: c.nota_interna || "",
```

> `nota_interna` la crea la migración de la Task 5. Esta tarea se puede
> terminar y probar antes: mientras la columna no exista, Supabase devuelve
> error en el `select`. **Por eso el orden real es Task 5 antes que este paso**
> — ver la nota de orden al final de la Fase A.

- [ ] **Step 6: Las tres etiquetas en la pantalla**

En `Web/app/(admin)/admin/clientes/page.js`, agregar el import:

```js
import { etiquetaEstado, loQueFalta } from "@/lib/estado-cliente.mjs";
```

Cambiar la línea 29:

```js
  const activos = lista.filter((c) => c.estatus === "activo").length;
```

por:

```js
  const activos = lista.filter((c) => c.estatus === "activo").length;
  const pendientes = lista.filter((c) => c.estatus === "pendiente-info").length;
```

y las líneas 127-129:

```js
                    <span className={`pt-badge ${c.estatus === "activo" ? "ok" : "ruta"}`}>
                      {c.estatus === "activo" ? "Activo" : "Moroso"}
                    </span>
```

por:

```js
                    {(() => {
                      const et = etiquetaEstado(c.estatus);
                      const falta = loQueFalta(c);
                      return (
                        <span
                          className={`pt-badge ${et.clase}`}
                          title={falta.length ? `Falta: ${falta.join(", ")}` : ""}
                        >
                          {et.texto}
                        </span>
                      );
                    })()}
```

Y en la fila de totales de la cabecera de la pantalla, junto al conteo de
activos, mostrar `pendientes` con la etiqueta "Pendientes por información".

- [ ] **Step 7: Contar los pendientes en el tablero**

En `Web/lib/datos-panel.js`, la línea 23 cuenta sólo los activos. Agregar una
consulta hermana en el mismo `Promise.all` y devolver el conteo:

```js
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("estado", "activo"),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("estado", "pendiente-info"),
```

Ajustar la desestructuración del `Promise.all` (`const [clientes, pendientes, cotizaciones, servicios, saldos] = ...`) y agregar `clientesPendientes: pendientes.count ?? 0` al objeto devuelto.

> Va en el mismo `Promise.all` y no en una llamada aparte: son dos conteos con
> `head: true`, no traen filas, y separarlos agregaría un viaje de red por cada
> carga del tablero.

- [ ] **Step 8: Verificar a ojo**

Run: `cd Web && npm run dev`, abrir `/admin/clientes`
Expected: los 5 clientes de prueba siguen saliendo **Activo** en verde (todos tienen correo). Ninguno dice "Moroso".

- [ ] **Step 9: Commit**

```bash
git add Web/lib/estado-cliente.mjs Web/tests/estado-cliente.test.mjs Web/lib/datos-clientes.js "Web/app/(admin)/admin/clientes/page.js" Web/lib/datos-panel.js
git commit -m "Estado del cliente: pendiente-info y tres etiquetas en vez de Activo/Moroso"
```

---

### Task 4: `DIAS_SEMANA` gana el domingo

**Files:**
- Modify: `Web/lib/rutas-datos.js:21-22`

**Interfaces:**
- Consumes: nada.
- Produces: `DIAS_SEMANA` pasa de 6 a 7 elementos. Lo consumen `app/(admin)/admin/rutas/page.js:97,284` y la Task 10 (`normalizar.mjs`).

- [ ] **Step 1: Cambiar la constante y su comentario**

En `Web/lib/rutas-datos.js`, líneas 21-22:

```js
/** Se opera de lunes a sábado. Nunca domingo. */
export const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
```

pasa a:

```js
/**
 * Los dias en que puede pasar una unidad.
 *
 * Aqui decia "se opera de lunes a sabado, nunca domingo". Era una suposicion
 * de Claude, y el cuaderno real de la empresa (27-ago-2026) la desmiente:
 * RUTA 10 y RUTA 11, las dos de TPI, trabajan "LUNES A DOMINGO".
 *
 * ⚠️ No es cosmetico: `/admin/rutas` FILTRA los dias guardados contra esta
 * lista (`DIAS_SEMANA.filter(d => dias.includes(d))`). Con el domingo fuera,
 * el domingo de esas dos rutas se borraba solo, sin avisar, la primera vez
 * que alguien abriera la ruta en el panel y guardara.
 */
export const DIAS_SEMANA = [
  "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo",
];
```

- [ ] **Step 2: Verificar que el panel lo respeta**

Run: `cd Web && npm run dev`, abrir `/admin/rutas` y editar cualquier ruta.
Expected: aparece la casilla de **domingo** en el selector de días, y al guardar una ruta con domingo marcado, el domingo se conserva al recargar.

- [ ] **Step 3: Commit**

```bash
git add Web/lib/rutas-datos.js
git commit -m "Las rutas pueden operar en domingo: RUTA 10 y 11 de TPI lo hacen"
```

---

### Task 5: La migración `019`

**Files:**
- Create: `Web/db/019-la-operacion-real.sql`

**Interfaces:**
- Consumes: nada.
- Produces: `clientes.estado` acepta `'pendiente-info'`; existen `clientes.nota_interna text` y `suscripciones.dias text[]`. Las Tasks 3, 12 y 14 dependen de esto.

- [ ] **Step 1: Escribir la migración**

`Web/db/019-la-operacion-real.sql`:

```sql
-- =====================================================================
--  019 — LA OPERACION REAL
--
--  Prepara la base para recibir el cuaderno que devolvio la empresa el
--  27-ago-2026: 42 clientes, 68 puntos, 64 servicios y 5 rutas de la
--  operacion de verdad, en lugar de los 5 clientes de prueba de agosto.
--
--  Se corre con:
--    psql "<cadena>" -v ON_ERROR_STOP=1 --single-transaction -f 019-...sql
--
--  ES ADITIVA: ensancha un CHECK y agrega dos columnas que ningun codigo
--  desplegado lee ni exige. El sitio en vivo no se entera.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) UN ESTADO NUEVO: 'pendiente-info'
--
-- El cuaderno llego incompleto: de 42 clientes, 13 sin correo, 13 sin
-- telefono, 13 sin persona de contacto. Cargarlos como 'activo' seria
-- mentir; dejarlos fuera seria seguir con una base de mentira.
--
-- ⚠️ NO SE TOCA NINGUNA POLITICA DE RLS, Y ES DELIBERADO. El estado del
-- cliente nunca ha controlado el acceso al portal — eso lo controla tener
-- perfil con rol 'cliente' — y no va a empezar aqui. Mezclar "le falta el
-- telefono" con "puede entrar" es como se cuelan los agujeros de permisos.
-- ---------------------------------------------------------------------
alter table public.clientes drop constraint if exists clientes_estado_check;
alter table public.clientes add constraint clientes_estado_check
  check (estado in ('activo','pendiente-info','suspendido','baja'));

-- ---------------------------------------------------------------------
-- 2) UN LUGAR PARA LAS DUDAS ABIERTAS
--
-- El cuaderno dejo 7 preguntas sin respuesta ("¿KARZO y KARZINI son la
-- misma empresa?", "¿Nacionales son 9 sucursales o 9 clientes?"). Hoy
-- viven en un Excel que nadie va a volver a abrir. Aqui quedan pegadas al
-- cliente al que le tocan.
--
-- Es INTERNA: la ve el personal de Morcast, nunca el cliente. Las
-- politicas de `clientes` ya separan las dos vistas.
-- ---------------------------------------------------------------------
alter table public.clientes add column if not exists nota_interna text;

comment on column public.clientes.nota_interna is
  'Dudas y pendientes sobre el expediente. Interna: no se le muestra al cliente.';

-- ---------------------------------------------------------------------
-- 3) LOS DIAS EN QUE SE VISITA CADA PUNTO
--
-- ⚠️ DE DONDE SALE ESTE DATO, Y CUANTO SE LE PUEDE CREER:
-- La hoja 1 del cuaderno pedia las RUTAS, pero sus renglones 6-45 resultaron
-- ser otra cosa: un calendario de PUNTOS, en el MISMO ORDEN que la hoja 3.
-- Se verifico cruzando la colonia de cada renglon: 39 de 40 coinciden
-- exactas.
--
-- O sea que este dato NO lo declaro la empresa: se dedujo de la POSICION de
-- los renglones. Es bueno —es la materia prima de la agenda del chofer dia
-- por dia— pero quien lo use despues tiene que saber que salio de un cruce y
-- no de una respuesta. Antes de construir la agenda sobre esto, conviene
-- confirmarselo a la empresa.
--
-- Se guarda ahora porque el dato ya esta en el archivo y no guardarlo obliga
-- a rehacer el cruce desde cero mas adelante.
-- ---------------------------------------------------------------------
alter table public.suscripciones add column if not exists dias text[] not null default '{}';

comment on column public.suscripciones.dias is
  'Dias de la semana en que se visita el punto. DEDUCIDO por posicion del '
  'cuaderno (hoja 1 renglones 6-45 vs hoja 3), 39/40 verificados. No lo '
  'declaro la empresa: confirmar antes de construir la agenda encima.';
```

- [ ] **Step 2: Aplicarla**

```bash
cd Web
PGPASSWORD=$(cat .env.db-password | tr -d '\r\n') \
  "/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  "postgresql://postgres.mbdmulygpupahocpylze@aws-0-ca-central-1.pooler.supabase.com:5432/postgres" \
  -v ON_ERROR_STOP=1 --single-transaction -f db/019-la-operacion-real.sql
```

Expected: `ALTER TABLE` × 4, `COMMENT` × 2, sin errores.

- [ ] **Step 3: Verificar que el estado nuevo se acepta y que nada viejo se rompió**

```bash
PGPASSWORD=$(cat .env.db-password | tr -d '\r\n') \
  "/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  "postgresql://postgres.mbdmulygpupahocpylze@aws-0-ca-central-1.pooler.supabase.com:5432/postgres" \
  -v ON_ERROR_STOP=1 -c "
begin;
update clientes set estado='pendiente-info' where folio='MOR-2026-0004';
select folio, estado from clientes where folio='MOR-2026-0004';
rollback;
select column_name from information_schema.columns
 where table_name='clientes' and column_name='nota_interna';
select column_name from information_schema.columns
 where table_name='suscripciones' and column_name='dias';
"
```

Expected: la fila sale `pendiente-info` dentro de la transacción, el `rollback` la deja como estaba, y las dos columnas aparecen. **El `rollback` es obligatorio: no se cambian datos reales en este paso.**

- [ ] **Step 4: Commit**

```bash
git add Web/db/019-la-operacion-real.sql
git commit -m "Migracion 019: estado pendiente-info, nota interna y dias de la suscripcion"
```

---

### Task 6: La zona única de cobertura

**Files:**
- Create: `Web/lib/zona-matamoros.mjs`
- Create: `Web/tests/zona-matamoros.test.mjs`
- Modify: `Web/app/acciones-alta.js:32-55`

**Interfaces:**
- Consumes: `puntoEnZona(punto, poligono)` de `Web/lib/punto-en-zona.mjs`.
- Produces: `ZONA_MATAMOROS: {clave, nombre, tipo, dias, zona}` — `zona` es `Array<[number, number]>` en `[lat, lng]`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`Web/tests/zona-matamoros.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { ZONA_MATAMOROS } from "../lib/zona-matamoros.mjs";
import { puntoEnZona } from "../lib/punto-en-zona.mjs";

const dentro = (p) => puntoEnZona(p, ZONA_MATAMOROS.zona);

test("el poligono es valido", () => {
  assert.ok(Array.isArray(ZONA_MATAMOROS.zona));
  assert.ok(ZONA_MATAMOROS.zona.length >= 3, "hacen falta al menos 3 vertices");
  for (const v of ZONA_MATAMOROS.zona) {
    assert.equal(v.length, 2, `vertice mal formado: ${JSON.stringify(v)}`);
    assert.ok(v[0] > 25 && v[0] < 26.5, `latitud fuera de Matamoros: ${v[0]}`);
    assert.ok(v[1] < -97 && v[1] > -98, `longitud fuera de Matamoros: ${v[1]}`);
  }
});

test("el centro de Matamoros esta cubierto", () => {
  // MATAMOROS_CENTRO de lib/rutas-datos.js
  assert.equal(dentro([25.869, -97.5027]), true);
});

test("cubre lo que cubrian las 3 zonas que sustituye", () => {
  // Un punto de cada banda: norte, centro e industrial.
  assert.equal(dentro([25.90, -97.55]), true, "banda norte");
  assert.equal(dentro([25.86, -97.50]), true, "banda centro");
  assert.equal(dentro([25.82, -97.45]), true, "banda industrial");
});

test("Reynosa NO esta cubierta", () => {
  // A 100 km. Si esto pasa, el verificador le dice "si te cubrimos" a
  // media frontera y Morcast recibe prospectos a los que no puede servir.
  assert.equal(dentro([26.0508, -98.2878]), false);
});

test("el Golfo NO esta cubierto", () => {
  assert.equal(dentro([25.87, -97.15]), false);
});
```

- [ ] **Step 2: Correrlas para verificar que fallan**

Run: `cd Web && node --test tests/zona-matamoros.test.mjs`
Expected: FAIL — `Cannot find module '../lib/zona-matamoros.mjs'`

- [ ] **Step 3: Escribir el módulo**

`Web/lib/zona-matamoros.mjs`:

```js
/**
 * LA ZONA DE COBERTURA, MIENTRAS NO HAYA POLIGONOS POR RUTA.
 *
 * DE DONDE SALE ESTO
 * El cuaderno del 27-ago-2026 da las 5 rutas reales de Morcast con sus dias,
 * su chofer y su unidad, pero la cobertura viene como NOMBRES DE COLONIAS
 * ("pedro cardenas, lauro villar, avenida del maestro"), no como coordenadas.
 * La columna `rutas.zona` guarda un poligono, y de ahi vive el verificador de
 * cobertura de la pagina publica — el que capta prospectos y los guarda en
 * `zonas_pedidas`.
 *
 * Si las 5 rutas entraran con zona vacia, el verificador le diria que NO hay
 * cobertura a todo el mundo, incluida la gente que si la tiene.
 *
 * QUE ES ESTE POLIGONO
 * El contorno exterior de las 3 zonas que existian antes (RT-NORTE,
 * RT-CENTRO, RT-INDUSTRIAL), que en agosto ya se habian ampliado a toda la
 * ciudad de Matamoros. O sea: EXACTAMENTE la misma superficie que el sitio
 * viene prometiendo desde entonces. No se promete de mas ni de menos.
 *
 * Las tres eran bandas apiladas que compartian borde. La union se traza
 * siguiendo el borde este de las tres de norte a sur y cerrando por el sur y
 * el oeste. Donde la banda industrial tenia una muesca hacia adentro se pasa
 * derecho: la muesca queda DENTRO. Es cobertura de mas, no de menos, y en un
 * captador de prospectos ese es el lado correcto para equivocarse — un
 * "cuentanos donde estas" se resuelve con una llamada; un "no te cubrimos"
 * falso pierde al cliente en silencio.
 *
 * ⚠️ VIVE EN EL CODIGO, NO EN `rutas`. Tiene que sobrevivir al borrado de las
 * 3 rutas demo, y ademas dice la verdad sobre lo que es: la cobertura de la
 * EMPRESA, no la zona de ninguna ruta.
 *
 * CUANDO SE QUITA: cuando la empresa entregue los poligonos por ruta. Ese dia
 * `zonasDeCobertura()` vuelve a leer de `rutas` y este archivo se borra.
 */
export const ZONA_MATAMOROS = {
  clave: "COBERTURA-MATAMOROS",
  nombre: "Matamoros y zona industrial",
  tipo: "manual",
  dias: [],
  zona: [
    // Borde norte y este de la banda norte
    [25.9291, -97.605], [25.9291, -97.57], [25.9251, -97.565], [25.925, -97.56],
    [25.9291, -97.555], [25.9291, -97.55], [25.9182, -97.54], [25.9193, -97.535],
    [25.885, -97.52], [25.8869, -97.51], [25.8963, -97.5], [25.8787, -97.495],
    [25.8826, -97.49], [25.8775, -97.485], [25.8837, -97.475], [25.8744, -97.47],
    [25.8804, -97.465], [25.8826, -97.46], [25.872, -97.46],
    // Borde este de la banda centro
    [25.8661, -97.455], [25.8541, -97.45], [25.8487, -97.445], [25.8476, -97.405],
    [25.845, -97.405],
    // Borde este y sur de la banda industrial
    [25.838, -97.4], [25.8361, -97.395], [25.795, -97.395], [25.795, -97.605],
    // El borde oeste cierra solo contra el primer vertice
  ],
};
```

- [ ] **Step 4: Correr las pruebas para verificar que pasan**

Run: `cd Web && node --test tests/zona-matamoros.test.mjs`
Expected: PASS (5 pruebas)

- [ ] **Step 5: Que `zonasDeCobertura()` caiga a la zona única**

En `Web/app/acciones-alta.js`, agregar el import:

```js
import { ZONA_MATAMOROS } from "@/lib/zona-matamoros.mjs";
```

y cambiar el `return` final de `zonasDeCobertura()` (líneas ~44-55). Donde hoy dice:

```js
  return (data || [])
    .filter((r) => Array.isArray(r.zona) && r.zona.length >= 3)
    .map((r) => ({ ... }));
```

poner:

```js
  const conZona = (data || [])
    .filter((r) => Array.isArray(r.zona) && r.zona.length >= 3)
    .map((r) => ({
      id: r.id,
      clave: r.clave,
      nombre: r.nombre,
      tipo: r.tipo,
      dias: r.dias || [],
      zona: r.zona,
      activa: true,
    }));

  // Las 5 rutas reales entraron SIN poligono: el cuaderno da nombres de
  // colonias, no coordenadas. Sin este respaldo el verificador le contestaria
  // "no hay cobertura" a todo el mundo, incluida la gente que si la tiene.
  // Se quita el dia que la empresa entregue las zonas por ruta.
  if (!conZona.length) {
    return [{ id: ZONA_MATAMOROS.clave, ...ZONA_MATAMOROS, activa: true }];
  }
  return conZona;
```

- [ ] **Step 6: Verificar el verificador**

Run: `cd Web && npm run dev`, abrir `http://localhost:3000/portal/alta`
Expected: el mapa dibuja las 3 zonas actuales (todavía existen). Poner un punto en el centro de Matamoros → **sí hay cobertura**. Un punto en Reynosa → **no hay cobertura** y ofrece dejar el teléfono.

> La verificación de que el respaldo funciona se hace en la Task 17, cuando las
> 3 rutas demo ya no existan. **Anotarlo ahí, no darlo por probado aquí.**

- [ ] **Step 7: Commit**

```bash
git add Web/lib/zona-matamoros.mjs Web/tests/zona-matamoros.test.mjs Web/app/acciones-alta.js
git commit -m "Zona unica de cobertura mientras las rutas no traigan poligono"
```

---

### Task 7: 🚪 PUERTA — build, pruebas y **primer despliegue**

**Files:** ninguno nuevo.

**Interfaces:**
- Consumes: todo lo de las Tasks 1-6.
- Produces: el código en `main` y en vivo, **antes** de que los datos cambien.

- [ ] **Step 1: Correr toda la batería de pruebas**

Run: `cd Web && node --test tests/`
Expected: PASS en los 7 archivos (`destino-sesion`, `nonce-google`, `origen`, `punto-en-zona`, `estado-sistema`, `estado-cliente`, `zona-matamoros`).

- [ ] **Step 2: Compilar**

Run: `cd Web && npm run build`
Expected: build limpio, sin errores ni advertencias nuevas.

- [ ] **Step 3: Recorrido a ojo con el servidor de producción local**

Run: `cd Web && npm run start`

Recorrer y confirmar:
- `/admin` → banda ámbar con la línea extra; cifras **visibles**
- `/admin/clientes` → los 5 de prueba en **Activo** verde; ninguno "Moroso"
- `/admin/rutas` → aparece el domingo
- `/portal` → banda ámbar; "Por pagar" en `—`
- `/portal/cotizador` → tarjeta de espera, **cero montos**
- `/portal/agregar-saldo` → sin cifras, con el formulario de comprobante vivo
- `/portal/alta` → el mapa dibuja y el verificador responde bien

- [ ] **Step 4: 🚪 PEDIRLE AUTORIZACIÓN A LUIS**

**NO CONTINUAR SIN SU "SÍ" EXPLÍCITO.** Presentarle: qué se va a desplegar, que es sólo código (los datos no se tocan todavía), y que en Vercel el push es el despliegue.

- [ ] **Step 5: Fusionar y desplegar**

```bash
git checkout main
git merge --no-ff operacion-real -m "Modo Hold, estados de cliente y zona unica de cobertura"
git push origin main
```

> ⚠️ Si `git push` da 403, es la cuenta equivocada en el llavero: el repo bueno
> es `Nova-studia/MORCAST` y hace falta `gh auth switch --user jsamuelglz00`.

- [ ] **Step 6: Verificar en vivo, esperando el redespliegue**

Esperar a que Vercel termine (no verificar al minuto: da falsos negativos).
Abrir `https://morcast.mx/admin` y `https://morcast.mx/portal`.
Expected: la banda ámbar en las dos, el cotizador apagado, ningún "Moroso".

- [ ] **Step 7: Volver a la rama de trabajo**

```bash
git checkout operacion-real
git merge main
```

---

## FASE B — El script de carga

### Task 8: Volcar el Excel a JSON

**Files:**
- Create: `Web/scripts/cuaderno/extraer.py`
- Create: `Web/scripts/cuaderno/cuaderno.json`

**Interfaces:**
- Consumes: `C:\Users\andre\Downloads\MORCAST - Cuaderno de captura LLENO.xlsx`.
- Produces: `cuaderno.json` con la forma
  `{archivo: string, extraido: string, hojas: {[nombre: string]: string[][]}}`.
  Cada celda es **string** (vacía si estaba vacía), sin recortar ni limpiar.
  Lo consumen las Tasks 12 y 14.

- [ ] **Step 1: Escribir el extractor**

`Web/scripts/cuaderno/extraer.py`:

```python
# -*- coding: utf-8 -*-
"""
EL CUADERNO DE LA EMPRESA -> JSON, SIN NINGUNA REGLA.

POR QUE EXISTE ESTE PASO
El .xlsx es un binario que vive fuera del repositorio y que nadie puede
revisar en un diff. Con el JSON adentro, la carga es reproducible y
auditable: dentro de seis meses se ve exactamente con que datos se poblo la
base de Morcast.

ESTE ARCHIVO NO LIMPIA NADA. Ni recorta espacios, ni convierte "N-A" en nulo,
ni arregla nombres. Todas las reglas viven en `normalizar.mjs`, que es puro y
esta probado. Si la limpieza se colara aqui, dejaria de haber una copia fiel
de lo que la empresa entrego.

Se corre una sola vez:
    python scripts/cuaderno/extraer.py
"""
import json
import sys
from datetime import datetime, date
from pathlib import Path

import openpyxl

ORIGEN = Path(r"C:\Users\andre\Downloads\MORCAST - Cuaderno de captura LLENO.xlsx")
DESTINO = Path(__file__).with_name("cuaderno.json")


def celda(v):
    """Todo sale como texto. Las fechas en ISO para que no dependan del locale."""
    if v is None:
        return ""
    if isinstance(v, (datetime, date)):
        return v.date().isoformat() if isinstance(v, datetime) else v.isoformat()
    return str(v)


def main():
    if not ORIGEN.exists():
        sys.exit(f"No se encontro el cuaderno en {ORIGEN}")

    libro = openpyxl.load_workbook(ORIGEN, data_only=True)
    hojas = {}
    for hoja in libro.worksheets:
        hojas[hoja.title] = [
            [celda(c) for c in fila]
            for fila in hoja.iter_rows(values_only=True)
        ]

    salida = {
        "archivo": ORIGEN.name,
        "extraido": datetime.now().isoformat(timespec="seconds"),
        "hojas": hojas,
    }
    DESTINO.write_text(
        json.dumps(salida, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    print(f"Escrito {DESTINO}")
    for nombre, filas in hojas.items():
        print(f"  {nombre}: {len(filas)} renglones")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Correrlo**

Run: `cd Web && python scripts/cuaderno/extraer.py`
Expected:
```
Escrito .../cuaderno.json
  LÉEME: 21 renglones
  1 Rutas: 62 renglones
  2 Clientes: 64 renglones
  3 Puntos de recoleccion: 75 renglones
  4 Servicio contratado: 84 renglones
  Listas válidas: 17 renglones
```

- [ ] **Step 3: Verificar que el volcado es fiel**

```bash
cd Web && node -e "
const c = require('./scripts/cuaderno/cuaderno.json');
const cli = c.hojas['2 Clientes'].slice(5).filter(f => f[0].trim());
console.log('clientes con nombre:', cli.length);           // 44
console.log('primer cliente:', JSON.stringify(cli[0][0]));  // 'AEROPUERTO'
console.log('correo de AEROPUERTO:', JSON.stringify(cli[0][3])); // 'N-A' sin tocar
"
```
Expected: `44`, `"AEROPUERTO"`, `"N-A"` — **el `N-A` sigue ahí sin limpiar**, que es la prueba de que este paso no aplica reglas.

- [ ] **Step 4: Commit**

```bash
git add Web/scripts/cuaderno/extraer.py Web/scripts/cuaderno/cuaderno.json
git commit -m "Volcado fiel del cuaderno de la empresa a JSON versionado"
```

---

### Task 9: Reglas de limpieza — celdas

**Files:**
- Create: `Web/scripts/cuaderno/normalizar.mjs`
- Create: `Web/tests/normalizar.test.mjs`

**Interfaces:**
- Consumes: `hayDato()` de `Web/lib/estado-cliente.mjs` (Task 3).
- Produces:
  - `limpio(txt: string): string|null`
  - `telefono(txt: string): string|null`
  - `esRegimen(txt: string): boolean`
  - `nombreClave(txt: string): string` — clave de comparación (mayúsculas, sin acentos, espacios colapsados)
  - `esRenglonDeInstrucciones(fila: string[]): boolean`
  - Las Tasks 10, 11, 12 y 14 las consumen.

- [ ] **Step 1: Escribir las pruebas que fallan**

`Web/tests/normalizar.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  limpio,
  telefono,
  esRegimen,
  nombreClave,
  esRenglonDeInstrucciones,
} from "../scripts/cuaderno/normalizar.mjs";

// Cada prueba se llama por el renglon REAL del cuaderno que la obligo a
// existir. Asi, dentro de un año, se sabe contra que se escribio la regla.

test("los rellenos que tecleo la empresa se vuelven nulo de verdad", () => {
  // AEROPUERTO trae "N-A" literal en la columna de correo.
  for (const v of ["N-A", "NA", "N/A", "n.a.", "NO", "-", "--", "", "   "]) {
    assert.equal(limpio(v), null, `"${v}" debio quedar en null`);
  }
});

test("un dato de verdad se conserva recortado", () => {
  assert.equal(limpio("  ABRAHAM  "), "ABRAHAM");
  assert.equal(limpio("facturacion@agarlabels.com"), "facturacion@agarlabels.com");
});

test("el telefono de AGAR pierde los adornos", () => {
  // El cuaderno trae "(868)1490531".
  assert.equal(telefono("(868)1490531"), "8681490531");
  assert.equal(telefono("868 170 7754"), "8681707754");
  assert.equal(telefono("5612603034"), "5612603034");
});

test("un telefono vacio o de relleno es nulo, no una cadena de ceros", () => {
  assert.equal(telefono("N-A"), null);
  assert.equal(telefono(""), null);
});

test("el domicilio fiscal que en realidad es el REGIMEN se reconoce", () => {
  // 28 de los 42 clientes traen esto en la columna de domicilio.
  assert.equal(esRegimen("General de Ley Personas Morales"), true);
  assert.equal(esRegimen("GENERAL DE LEY PERSONAS MORALES"), true);
  assert.equal(esRegimen("Régimen Simplificado de Confianza"), true);
  assert.equal(esRegimen("Personas Físicas con Actividades Empresariales"), true);
});

test("un domicilio de verdad NO se confunde con un regimen", () => {
  assert.equal(esRegimen("CALLE GIUSEPPE VERDI #105, VILLA COAPA"), false);
  assert.equal(esRegimen("AVENIDA UNIONES, ZONA INDUSTRIAL"), false);
});

test("los nombres se comparan sin acentos, sin dobles espacios y sin guiones", () => {
  assert.equal(nombreClave("  Carne-Mart  "), "CARNE MART");
  // Verificado contra el cuaderno: estos dos son los que de verdad rompian.
  assert.equal(nombreClave('Carne-Mart "Coliseo"'), "CARNE MART COLISEO");
  assert.equal(nombreClave("NACIONAL AV DEL NIÑO"), "NACIONAL AV DEL NINO");
  assert.equal(nombreClave("RUTA10"), "RUTA10");
  assert.equal(nombreClave("Nacionales"), "NACIONALES");
  assert.equal(nombreClave("MCDONALD'S"), "MCDONALDS");
  assert.equal(nombreClave("CINÉPOLIS"), "CINEPOLIS");
});

test("el renglon de instrucciones NO es un servicio", () => {
  // Este texto de ayuda del cuaderno se colo entre los datos de la hoja 4 y
  // parecia un servicio con una empresa de 180 caracteres.
  const colado = [
    "RECOLECCIONES AL MES es el dato que más importa y el que más se olvida. " +
      "Es cuántas veces pasan en total durante el mes. Si un punto tiene dos " +
      "tipos de residuo con equipos distintos, anótelo en dos renglones.",
    "", "", "", "", "", "", "", "",
  ];
  assert.equal(esRenglonDeInstrucciones(colado), true);
});

test("un servicio de verdad NO se descarta como instruccion", () => {
  const real = ["AGAR", "SUCURSAL", "4", "Residuos Sólidos Urbanos (RSU)",
                "CONTENEDOR ", "3 M3", "1", "", ""];
  assert.equal(esRenglonDeInstrucciones(real), false);
});
```

- [ ] **Step 2: Correrlas para verificar que fallan**

Run: `cd Web && node --test tests/normalizar.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/cuaderno/normalizar.mjs'`

- [ ] **Step 3: Escribir las reglas**

`Web/scripts/cuaderno/normalizar.mjs`:

```js
/**
 * LAS REGLAS DE LIMPIEZA DEL CUADERNO.
 *
 * Funciones PURAS: no tocan red, ni disco, ni la base. Por eso se pueden
 * probar de verdad, y por eso cada regla de aqui nace de un renglon real del
 * cuaderno que la empresa devolvio el 27-ago-2026.
 *
 * `extraer.py` deja el volcado fiel; aqui es donde se decide que significa.
 */

import { hayDato } from "../../lib/estado-cliente.mjs";

/** Un dato de verdad, o `null`. Nunca la cadena "N-A". */
export function limpio(txt) {
  const v = String(txt ?? "").trim();
  return hayDato(v) ? v : null;
}

/**
 * Solo los digitos. El cuaderno trae "(868)1490531" y "868 170 7754".
 * No se valida el largo: hay telefonos de 7 digitos legitimos en la region y
 * rechazarlos perderia el unico contacto de ese cliente.
 */
export function telefono(txt) {
  const v = limpio(txt);
  if (!v) return null;
  const digitos = v.replace(/\D/g, "");
  return digitos.length ? digitos : null;
}

/**
 * ¿Este "domicilio fiscal" es en realidad el REGIMEN fiscal?
 *
 * En 28 de los 42 clientes la empresa escribio "General de Ley Personas
 * Morales" en la columna del domicilio. No es basura: es un dato bueno en el
 * cajon equivocado, y `clientes.regimen` existe y esta vacia. Se muda, no se
 * tira.
 */
export function esRegimen(txt) {
  const v = String(txt ?? "").toLowerCase();
  return /r[eé]gimen|ley\s+personas|personas?\s+morales|personas?\s+f[ií]sicas|simplificado\s+de\s+confianza/.test(v);
}

/**
 * La clave con la que se comparan nombres entre hojas.
 *
 * Sin acentos (el cuaderno escribe "CINEPOLIS" y "CINÉPOLIS"), sin apostrofes
 * ("MCDONALD'S"), con los guiones como espacio ("Carne-Mart" vs "CARNE MART")
 * y sin espacios dobles.
 *
 * ⚠️ Esto NO es para adivinar a que cliente pertenece un punto huerfano. Eso
 * se resuelve UNICAMENTE en `equivalencias.js`, a mano. Esto sirve para que
 * "  Carne-Mart " y "CARNE MART" se reconozcan como el mismo texto, no para
 * decidir que dos nombres parecidos son la misma empresa.
 */
export function nombreClave(txt) {
  return String(txt ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Comillas simples Y DOBLES. El cuaderno trae `Carne-Mart "Coliseo"` con
    // comillas dobles y la hoja de clientes lo llama `CARNE MART` a secas: sin
    // quitarlas, esos dos nombres nunca se reconocen como el mismo.
    .replace(/['’"“”]/g, "")
    .replace(/-/g, " ")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/**
 * Un renglon de ayuda del cuaderno que se colo entre los datos.
 *
 * En la hoja 4 aparecio el texto "RECOLECCIONES AL MES es el dato que mas
 * importa..." ocupando la columna de empresa. Sin esta regla se habria
 * intentado mapear como un servicio de una empresa de 180 caracteres, y el
 * script se habria detenido pidiendo una equivalencia para algo que no es un
 * cliente.
 *
 * Se reconoce por lo que es —una frase larga, sola en su renglon— y no por su
 * texto exacto: si la empresa reenvia el cuaderno con la ayuda reacomodada,
 * la regla sigue sirviendo.
 */
export function esRenglonDeInstrucciones(fila) {
  const primera = String(fila?.[0] ?? "").trim();
  if (primera.length < 80) return false;
  const restoVacio = (fila || []).slice(1).every((c) => !String(c ?? "").trim());
  return restoVacio;
}
```

- [ ] **Step 4: Correr las pruebas para verificar que pasan**

Run: `cd Web && node --test tests/normalizar.test.mjs`
Expected: PASS (9 pruebas)

- [ ] **Step 5: Commit**

```bash
git add Web/scripts/cuaderno/normalizar.mjs Web/tests/normalizar.test.mjs
git commit -m "Reglas de limpieza del cuaderno: celdas, telefonos y el regimen mal puesto"
```

---

### Task 10: Reglas de limpieza — días, tipo de ruta y frecuencia

**Files:**
- Modify: `Web/scripts/cuaderno/normalizar.mjs` (agregar al final)
- Modify: `Web/tests/normalizar.test.mjs` (agregar al final)

**Interfaces:**
- Consumes: `limpio` y `nombreClave` de la Task 9. **NO consume `DIAS_SEMANA`**: define su propio `ORDEN` porque para resolver rangos ("LUNES A DOMINGO") necesita el domingo al final por semantica, y en `DIAS_SEMANA` esta al final por el orden del panel. Depender de una constante de presentacion para calcular rangos es un amarre falso.
- Produces:
  - `diasDesdeTexto(txt: string): {dias: string[], porLlamada: boolean}`
  - `tipoDeRuta(txt: string): "manual"|"roll-off"|"compactador"|null`
  - `frecuenciaPorMes(n: number|string): "semanal"|"quincenal"|"mensual"`
  - `claveDeRuta(txt: string): string|null` — `"RUTA10"` → `"RUTA-10"`
  - Las Tasks 12 y 14 las consumen.

- [ ] **Step 1: Agregar las pruebas que fallan**

Agregar al final de `Web/tests/normalizar.test.mjs`:

```js
import {
  diasDesdeTexto,
  tipoDeRuta,
  frecuenciaPorMes,
  claveDeRuta,
} from "../scripts/cuaderno/normalizar.mjs";

test("un dia suelto", () => {
  assert.deepEqual(diasDesdeTexto("LUNES"), { dias: ["lunes"], porLlamada: false });
  assert.deepEqual(diasDesdeTexto("miercoles"), { dias: ["miércoles"], porLlamada: false });
  assert.deepEqual(diasDesdeTexto("SABADO"), { dias: ["sábado"], porLlamada: false });
});

test("dos dias unidos por Y", () => {
  assert.deepEqual(diasDesdeTexto("LUNES Y JUEVES"),
    { dias: ["lunes", "jueves"], porLlamada: false });
  assert.deepEqual(diasDesdeTexto("MIERCOLES Y SABADO"),
    { dias: ["miércoles", "sábado"], porLlamada: false });
});

test("un rango con A", () => {
  assert.deepEqual(diasDesdeTexto("LUNES A SABADO"), {
    dias: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    porLlamada: false,
  });
});

// RUTA 10 y RUTA 11, las de TPI. Es la razon por la que DIAS_SEMANA gano el
// domingo: sin el, este dia se borraba solo al editar la ruta en el panel.
test("LUNES A DOMINGO son los siete dias", () => {
  const r = diasDesdeTexto("LUNES A DOMINGO");
  assert.equal(r.dias.length, 7);
  assert.ok(r.dias.includes("domingo"));
});

test("POR LLAMADA no es un dia", () => {
  // 8 puntos del cuaderno dicen esto. Meterlos en un dia fijo inventaria una
  // visita que nadie acordo; dejarlos sin marca los volveria invisibles.
  assert.deepEqual(diasDesdeTexto("POR LLAMADA"), { dias: [], porLlamada: true });
});

test("un texto que no dice nada no inventa dias", () => {
  assert.deepEqual(diasDesdeTexto(""), { dias: [], porLlamada: false });
  assert.deepEqual(diasDesdeTexto("N-A"), { dias: [], porLlamada: false });
});

test("los tipos de ruta como los escribio la empresa", () => {
  assert.equal(tipoDeRuta("roll off"), "roll-off");
  assert.equal(tipoDeRuta("ROLL -OFF"), "roll-off");
  assert.equal(tipoDeRuta("compactador"), "compactador");
  assert.equal(tipoDeRuta("manual"), "manual");
  assert.equal(tipoDeRuta("lo que sea"), null);
});

test("la clave de ruta se empareja aunque falte el espacio", () => {
  // El cuaderno escribe "RUTA 10" en una hoja y "RUTA10" en otra.
  assert.equal(claveDeRuta("RUTA 3"), "RUTA-3");
  assert.equal(claveDeRuta("RUTA10"), "RUTA-10");
  assert.equal(claveDeRuta("ruta 11"), "RUTA-11");
  assert.equal(claveDeRuta("N-A"), null);
});

test("la frecuencia sale de las recolecciones al mes", () => {
  assert.equal(frecuenciaPorMes(30), "semanal");
  assert.equal(frecuenciaPorMes(4), "semanal");
  assert.equal(frecuenciaPorMes(3), "quincenal");
  assert.equal(frecuenciaPorMes(2), "quincenal");
  assert.equal(frecuenciaPorMes(1), "mensual");
  // Sin dato: la frecuencia mas conservadora. El numero exacto se guarda
  // aparte en `servicios_por_mes`, asi que no se pierde nada.
  assert.equal(frecuenciaPorMes(""), "mensual");
  assert.equal(frecuenciaPorMes(0), "mensual");
});
```

- [ ] **Step 2: Correrlas para verificar que fallan**

Run: `cd Web && node --test tests/normalizar.test.mjs`
Expected: FAIL — `diasDesdeTexto is not a function` (o error de import)

- [ ] **Step 3: Escribir las reglas**

Agregar al final de `Web/scripts/cuaderno/normalizar.mjs`:

```js
/* ==================================================================== */
/* DIAS, TIPO DE RUTA Y FRECUENCIA                                      */
/* ==================================================================== */

/** El orden de la semana laboral, empezando en lunes. `DIAS_SEMANA` no sirve
 *  aqui porque su orden es el del panel, y para resolver rangos hace falta
 *  saber que el domingo va AL FINAL. */
const ORDEN = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Sin acentos y en minusculas, para comparar contra lo que tecleo la empresa. */
const pelado = (s) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const PELADOS = ORDEN.map(pelado); // ["lunes", ..., "miercoles", ...]

/**
 * Los dias en que se pasa, sacados del texto libre del cuaderno.
 *
 * La empresa escribio: "LUNES", "miercoles", "LUNES Y JUEVES",
 * "MARTES Y VIERNES", "LUNES A SABADO", "LUNES A DOMINGO" y "POR LLAMADA".
 *
 * "POR LLAMADA" NO ES UN DIA, y es la unica de estas que importa de verdad:
 * son 8 puntos que se atienden cuando el cliente llama. Meterlos en un dia
 * fijo inventaria una visita que nadie acordo, y dejarlos sin ninguna marca
 * los volveria invisibles en la agenda. Se devuelve la bandera aparte.
 */
export function diasDesdeTexto(txt) {
  const v = pelado(limpio(txt) ?? "");
  if (!v) return { dias: [], porLlamada: false };

  if (/por\s+llamada|a\s+solicitud|cuando\s+llam/.test(v)) {
    return { dias: [], porLlamada: true };
  }

  // Rango: "lunes a sabado", "lunes a domingo".
  const rango = v.match(/(\w+)\s+a\s+(\w+)/);
  if (rango) {
    const desde = PELADOS.indexOf(rango[1]);
    const hasta = PELADOS.indexOf(rango[2]);
    if (desde >= 0 && hasta >= desde) {
      return { dias: ORDEN.slice(desde, hasta + 1), porLlamada: false };
    }
  }

  // Lista: "lunes y jueves", "martes, viernes".
  const dias = ORDEN.filter((_, i) => new RegExp(`\\b${PELADOS[i]}\\b`).test(v));
  return { dias, porLlamada: false };
}

/** Los tres tipos de `rutas.tipo`, como los escribio la empresa. */
export function tipoDeRuta(txt) {
  const v = pelado(limpio(txt) ?? "").replace(/[\s-]/g, "");
  if (!v) return null;
  if (v.includes("rolloff")) return "roll-off";
  if (v.includes("compactador")) return "compactador";
  if (v.includes("manual")) return "manual";
  return null;
}

/**
 * `RUTA 10` y `RUTA10` son la misma ruta.
 * El cuaderno usa las dos formas en hojas distintas.
 */
export function claveDeRuta(txt) {
  const v = limpio(txt);
  if (!v) return null;
  const m = pelado(v).match(/ruta\s*0*(\d+)/);
  return m ? `RUTA-${Number(m[1])}` : null;
}

/**
 * De "recolecciones al mes" a la frecuencia que acepta `suscripciones`.
 *
 * Es una simplificacion, y a proposito: el numero EXACTO se guarda en
 * `suscripciones.servicios_por_mes`, asi que nada se pierde al redondear
 * aqui. `frecuencia` sirve para decirle al cliente "cada cuando pasamos";
 * el conteo real vive en la otra columna.
 */
export function frecuenciaPorMes(n) {
  const v = Number(String(n ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(v) || v <= 0) return "mensual";
  if (v >= 4) return "semanal";
  if (v >= 2) return "quincenal";
  return "mensual";
}
```

- [ ] **Step 4: Correr las pruebas para verificar que pasan**

Run: `cd Web && node --test tests/normalizar.test.mjs`
Expected: PASS (18 pruebas: las 9 de la Task 9 más 9 nuevas)

- [ ] **Step 5: Commit**

```bash
git add Web/scripts/cuaderno/normalizar.mjs Web/tests/normalizar.test.mjs
git commit -m "Reglas del cuaderno: dias de la semana, tipo de ruta y frecuencia"
```

---

### Task 11: La tabla de equivalencias, y las preguntas que quedan

**Files:**
- Create: `Web/scripts/cuaderno/equivalencias.js`

**Interfaces:**
- Consumes: `nombreClave` de la Task 9.
- Produces:
  - `EMPRESAS: {[claveDelCuaderno: string]: string}` — nombre roto → nombre del cliente real
  - `PUNTOS: {[claveDelCuaderno: string]: {empresa: string, alias: string}}` — servicio que cubre varios puntos → el punto que le toca
  - `SIN_RESOLVER: string[]` — los casos que **Luis** tiene que decidir
  - Las Tasks 12 y 14 las consumen.

- [ ] **Step 1: Sacar la lista exacta de lo que hay que mapear**

```bash
cd Web && node -e "
const c = require('./scripts/cuaderno/cuaderno.json');
const clave = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/['’]/g,'').replace(/-/g,' ').toUpperCase().split(/\s+/).filter(Boolean).join(' ');
const filas = (h,n) => c.hojas[h].slice(5).filter(f => f[0].trim()).map(f => f.slice(0,n));
const cli = new Set(filas('2 Clientes',11).map(f => clave(f[0])));
const pts = filas('3 Puntos de recoleccion',8);
const srv = filas('4 Servicio contratado',9).filter(f => f[0].trim().length < 80);
console.log('--- PUNTOS con empresa inexistente ---');
[...new Set(pts.filter(p => !cli.has(clave(p[0]))).map(p => p[0]))].sort().forEach(x => console.log(JSON.stringify(x)));
const llaves = new Set(pts.map(p => clave(p[0]) + ' :: ' + clave(p[1])));
console.log('--- SERVICIOS que no amarran ---');
srv.filter(s => !llaves.has(clave(s[0]) + ' :: ' + clave(s[1]))).forEach(s => console.log(JSON.stringify(s[0]), '|', JSON.stringify(s[1])));
console.log('--- PUNTOS de LLANTERA, CEMEX, CONCURRENT, CARNE MART, TPI, CARTA BLANCA ---');
pts.filter(p => /LLANTERA|CEMEX|CONCURRENT|CARNE|TPI|CARTA/.test(clave(p[0]))).forEach(p => console.log(JSON.stringify(p[0]), '|', JSON.stringify(p[1]), '|', JSON.stringify(p[3])));
"
```

Expected: los 21 nombres huérfanos, los 12 servicios sueltos, y el detalle de los puntos ambiguos. **Anotar la salida: es la materia prima del paso siguiente.**

- [ ] **Step 2: Escribir la tabla con lo que SÍ es deducible sin adivinar**

`Web/scripts/cuaderno/equivalencias.js`:

```js
/**
 * LOS NOMBRES ROTOS DEL CUADERNO, RESUELTOS A MANO.
 *
 * POR QUE ESTO NO SE HACE POR PARECIDO DE TEXTO
 * Amarrar un servicio a la empresa equivocada es facturarle a quien no era.
 * Un algoritmo de similitud acertaria en 19 de 21 casos y fallaria en 2, en
 * silencio, y nadie se enteraria hasta que llegara una factura ajena. Esta
 * tabla se escribe a mano, se revisa, y lo que no este aqui DETIENE el script.
 *
 * DE DONDE SALEN LOS ERRORES
 * En KARZO y en Nacionales, la empresa escribio el nombre de la SUCURSAL en
 * la columna de empresa. No son clientes nuevos: son puntos de un cliente que
 * si existe. Se ve claro porque el nombre de la sucursal empieza con el del
 * cliente ("KARZO SEXTA", "NACIONAL MAYOREO") y porque la hoja 2 no los
 * tiene.
 */

/**
 * Nombre tal como aparece en el cuaderno (ya pasado por `nombreClave`) →
 * empresa real de la hoja 2.
 *
 * ⚠️ Las llaves van EXACTAMENTE en la forma que produce `nombreClave()`:
 * MAYUSCULAS, sin acentos, sin comillas ni apostrofes, guiones como espacio,
 * espacios colapsados.
 *
 * 🔴 LA TRAMPA: la normalizacion NFD le quita la tilde a la Ñ. O sea que
 * `nombreClave("NACIONAL AV DEL NIÑO")` devuelve "NACIONAL AV DEL NINO", con N
 * pelada. Escribir la llave con Ñ hace que NUNCA case, en silencio. Lo mismo
 * con `Carne-Mart "Coliseo"`: las comillas dobles se quitan.
 *
 * Comprobarlo, no confiar en el ojo:
 *   node -e "import('./scripts/cuaderno/normalizar.mjs').then(m =>
 *     console.log(m.nombreClave('NACIONAL AV DEL NIÑO')))"
 */
export const EMPRESAS = {
  // Sucursales de KARZO escritas como si fueran empresas.
  "KARZO CONSTITUYENTES": "KARZO",
  "KARZO DIAGONAL": "KARZO",
  "KARZO MAGNOLIAS": "KARZO",
  "KARZO MARTE R GOMEZ": "KARZO",
  "KARZO MORELOS": "KARZO",
  "KARZO OFICINAS": "KARZO",
  "KARZO PIPAS": "KARZO",
  "KARZO SEXTA": "KARZO",
  "KARZO TOMATES": "KARZO",

  // Sucursales de Nacionales.
  "NACIONAL AV DEL NINO": "Nacionales",
  "NACIONAL CAMINO REAL": "Nacionales",
  "NACIONAL DIVISION DEL NORTE": "Nacionales",
  "NACIONAL MARINADOS": "Nacionales",
  "NACIONAL MAYOREO": "Nacionales",
  "NACIONAL PEDRO CARDENAS": "Nacionales",
  "NACIONAL PERIFERICO": "Nacionales",
  "NACIONAL SENDERO": "Nacionales",
  "NACIONAL VALLE ALTO": "Nacionales",

  // Una comilla y un guion de diferencia con el nombre de la hoja 2.
  "CARNE MART COLISEO": "CARNE MART",
};

/**
 * Servicios que cubren VARIOS puntos en un solo renglon, o que nombran el
 * punto distinto a como esta en la hoja 3.
 *
 * `null` significa: se reparte entre TODOS los puntos de esa empresa. El
 * cargador crea una suscripcion por punto y divide las recolecciones al mes
 * en partes iguales, dejando constancia en la nota interna del cliente de que
 * el reparto lo hizo el script y no la empresa.
 */
export const PUNTOS = {
  "CEMEX :: PLANTA 1 Y 2": null,
  "CONCURRENT :: PLANTA 1 Y 2": null,
  "CARNE MART :: SURCURSAL 01 02 03 Y 04": null,
  "CARTA BLANCA :: PLANTA": null,
  "TPI :: PLANTA": null,
  "NACIONAL AV DEL NINO :: AV DEL NINO": { empresa: "Nacionales", alias: "AV DEL NIÑO" },
};

/**
 * LO QUE EL SCRIPT NO PUEDE RESOLVER SOLO, Y LUIS TIENE QUE DECIDIR.
 *
 * Mientras algo este en esta lista, el cargador se DETIENE al encontrarlo. No
 * se le pone un valor "provisional": un amarre inventado se ve igual que uno
 * bueno y nadie vuelve a revisarlo.
 */
export const SIN_RESOLVER = [
  "LLANTERA: hay 4 servicios (SEXTA, CENTRO, LAURO, DIAGONAL) pero en la hoja " +
    "de clientes existen DOS llanteras distintas, LLANTERA LLANTAS y LLANTERA " +
    "JESUS. ¿Cual sucursal es de cual?",
  "KARZINI: hay 2 puntos (KARZINI DIAGONAL, KARZINI MARTE R GOMEZ) y en la " +
    "hoja de clientes no existe KARZINI. ¿Es el mismo cliente que KARZO o es " +
    "otra empresa?",
  "TPI: los 3 servicios dicen todos PLANTA y se distinguen solo por el equipo " +
    "(contenedor / compactador CE-30 / tolva T-30). Confirmar que van a los 2 " +
    "puntos de TPI que traen la columna empresa en blanco.",
];
```

- [ ] **Step 3: 🚪 PRESENTARLE LAS PREGUNTAS A LUIS**

**Detenerse aquí.** Presentarle los 3 casos de `SIN_RESOLVER` con el detalle que
salió del paso 1 (qué equipo, qué colonia, cuántas recolecciones trae cada uno),
y **esperar sus respuestas**. Al recibirlas: moverlas de `SIN_RESOLVER` a
`EMPRESAS`/`PUNTOS` y dejar en el comentario **quién lo decidió y cuándo**.

- [ ] **Step 4: Verificar que ya no queda nada sin mapear**

```bash
cd Web && node -e "
import('./scripts/cuaderno/equivalencias.js').then(e => {
  console.log('empresas mapeadas:', Object.keys(e.EMPRESAS).length);
  console.log('puntos mapeados:', Object.keys(e.PUNTOS).length);
  console.log('SIN RESOLVER:', e.SIN_RESOLVER.length);
  if (e.SIN_RESOLVER.length) { e.SIN_RESOLVER.forEach(x => console.log(' -', x)); }
});
"
```
Expected: `SIN RESOLVER: 0` una vez que Luis haya contestado.

- [ ] **Step 5: Commit**

```bash
git add Web/scripts/cuaderno/equivalencias.js
git commit -m "Equivalencias del cuaderno: los nombres rotos, resueltos a mano"
```

---

### Task 12: El respaldo

**Files:**
- Create: `Web/scripts/cuaderno/respaldar.mjs`

**Interfaces:**
- Consumes: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de `Web/.env.local`.
- Produces: un archivo `respaldo-AAAA-MM-DDTHH-mm.json` **fuera del repo**, con todas las tablas, la lista de usuarios de `auth` y la lista de archivos de la cubeta. La Task 14 no corre sin él.

- [ ] **Step 1: Escribir el respaldo**

`Web/scripts/cuaderno/respaldar.mjs`:

```js
/**
 * RESPALDO DE LA BASE ANTES DE BORRAR NADA.
 *
 * Va SEPARADO de `limpiar.mjs` y de `cargar.mjs` a proposito: tres comandos
 * distintos, para que nadie borre produccion creyendo que solo estaba
 * cargando.
 *
 * El archivo sale FUERA del repositorio: trae correos y telefonos de personas
 * reales y no tiene por que acabar en GitHub.
 *
 *   node scripts/cuaderno/respaldar.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TABLAS = [
  "clientes", "perfiles", "rutas", "domicilios", "suscripciones",
  "solicitudes_recoleccion", "recolecciones", "movimientos_saldo",
  "solicitudes_alta", "zonas_pedidas", "cotizaciones",
];

const sello = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const destino = resolve(
  process.env.USERPROFILE || process.env.HOME,
  "Downloads",
  `morcast-respaldo-${sello}.json`
);

const datos = { fecha: new Date().toISOString(), tablas: {} };

for (const tabla of TABLAS) {
  const { data, error } = await supabase.from(tabla).select("*");
  if (error) {
    console.error(`[respaldo] ${tabla}: ${error.message}`);
    process.exit(1); // Sin respaldo COMPLETO no hay respaldo.
  }
  datos.tablas[tabla] = data;
  console.log(`  ${tabla}: ${data.length} filas`);
}

const { data: usuarios, error: eUsuarios } =
  await supabase.auth.admin.listUsers({ perPage: 1000 });
if (eUsuarios) {
  console.error(`[respaldo] usuarios: ${eUsuarios.message}`);
  process.exit(1);
}
// Solo lo identificable: la contrasena no se puede respaldar y no hay que
// fingir que si. Ver la nota de reversion del spec.
datos.usuarios = usuarios.users.map((u) => ({
  id: u.id, email: u.email, rol: u.app_metadata?.rol, creado: u.created_at,
}));
console.log(`  auth.users: ${datos.usuarios.length} usuarios`);

for (const cubeta of ["comprobantes", "evidencias"]) {
  const { data } = await supabase.storage.from(cubeta).list("", { limit: 1000 });
  datos[`cubeta_${cubeta}`] = data || [];
  console.log(`  cubeta ${cubeta}: ${(data || []).length} entradas`);
}

writeFileSync(destino, JSON.stringify(datos, null, 1), "utf8");
console.log(`\nRespaldo escrito en:\n  ${destino}`);
```

- [ ] **Step 2: Correrlo**

Run: `cd Web && node scripts/cuaderno/respaldar.mjs`
Expected: cuenta las filas de las 11 tablas, los usuarios y las 2 cubetas, y escribe el JSON en `Downloads`.

- [ ] **Step 3: Verificar que el respaldo sirve de verdad**

```bash
node -e "
const d = require(require('os').homedir() + '/Downloads/' + require('fs')
  .readdirSync(require('os').homedir() + '/Downloads')
  .filter(f => f.startsWith('morcast-respaldo-')).sort().pop());
console.log('clientes respaldados:', d.tablas.clientes.length);
console.log('folios:', d.tablas.clientes.map(c => c.folio).join(', '));
console.log('recolecciones:', d.tablas.recolecciones.length);
console.log('usuarios:', d.usuarios.length);
"
```
Expected: 5 clientes con sus folios `MOR-2026-0001..0005`, 2 recolecciones, y la lista de usuarios. **Un respaldo que no se abre no es un respaldo.**

- [ ] **Step 4: Commit**

```bash
git add Web/scripts/cuaderno/respaldar.mjs
git commit -m "Respaldo de la base a JSON antes de tocar nada"
```

---

### Task 13: El cargador, en modo ensayo

**Files:**
- Create: `Web/scripts/cuaderno/cargar.mjs`

**Interfaces:**
- Consumes: `cuaderno.json` (Task 8), todo `normalizar.mjs` (Tasks 9-10), `equivalencias.js` (Task 11), `estadoPorCompletitud` y `loQueFalta` de `lib/estado-cliente.mjs` (Task 3).
- Produces: el informe del ensayo. En `--de-verdad` (Task 15) escribe en `clientes`, `rutas`, `domicilios` y `suscripciones`.

- [ ] **Step 1: Escribir el cargador**

`Web/scripts/cuaderno/cargar.mjs`:

```js
/**
 * LA OPERACION REAL DEL CUADERNO -> LA BASE.
 *
 *   node scripts/cuaderno/cargar.mjs              (ENSAYO: no escribe nada)
 *   node scripts/cuaderno/cargar.mjs --de-verdad  (escribe)
 *
 * EL ENSAYO ES EL MODO POR OMISION, y es a proposito: escribir en produccion
 * tiene que costar teclear una bandera, no olvidarla.
 *
 * ES IDEMPOTENTE. Busca por llave natural (empresa normalizada; punto por
 * cliente + alias) y actualiza si ya existe. Se puede volver a correr cuando
 * la empresa mande las correcciones sin duplicar nada.
 *
 * SE DETIENE ANTES DE ESCRIBIR si encuentra un nombre que no esta en
 * `equivalencias.js`. Vale mas que falle diez veces a que le cuelgue un
 * servicio a la empresa equivocada.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import {
  limpio, telefono, esRegimen, nombreClave, esRenglonDeInstrucciones,
  diasDesdeTexto, tipoDeRuta, frecuenciaPorMes, claveDeRuta,
} from "./normalizar.mjs";
import { EMPRESAS, PUNTOS, SIN_RESOLVER } from "./equivalencias.js";
import { estadoPorCompletitud, loQueFalta } from "../../lib/estado-cliente.mjs";

const DE_VERDAD = process.argv.includes("--de-verdad");

// Se lee con readFileSync y no con `import ... with { type: "json" }`: la
// sintaxis de atributos de importacion cambio entre versiones de Node (`assert`
// antes, `with` despues) y este script tiene que correr sin depender de cual
// esta instalada.
const cuaderno = JSON.parse(
  readFileSync(new URL("./cuaderno.json", import.meta.url), "utf8")
);

/* ---------- 1. LEER Y NORMALIZAR (sin tocar la base) ---------------- */

const filas = (hoja, n) =>
  cuaderno.hojas[hoja].slice(5).filter((f) => String(f[0]).trim()).map((f) => f.slice(0, n));

// CLIENTES. Los 2 renglones duplicados se quedan con el primero: son la misma
// empresa tecleada dos veces, no dos empresas.
const clientes = new Map();
for (const f of filas("2 Clientes", 11)) {
  const clave = nombreClave(f[0]);
  if (clientes.has(clave)) continue;
  const domicilio = limpio(f[6]);
  const cli = {
    clave,
    empresa: limpio(f[0]),
    contacto: limpio(f[1]),
    telefono: telefono(f[2]),
    correo: limpio(f[3]),
    rfc: limpio(f[5]),
    // El "domicilio fiscal" que en realidad es el regimen se MUDA a su
    // columna en vez de tirarse: es un dato bueno mal guardado.
    regimen: domicilio && esRegimen(domicilio) ? domicilio : null,
    domicilio_fiscal: domicilio && !esRegimen(domicilio) ? domicilio : null,
    codigo_postal: limpio(f[7]),
    uso_cfdi: limpio(f[8]),
    forma_pago: limpio(f[9]),
  };
  cli.estado = estadoPorCompletitud(cli);
  cli.falta = loQueFalta(cli);
  clientes.set(clave, cli);
}

// RUTAS.
//
// ⚠️ SE UNEN LOS DIAS DE **TODOS** LOS RENGLONES DE LA HOJA 1, no solo de los
// 46-62. Los renglones 46-62 son las rutas como se disenaron, dia por dia,
// pero VERIFICADO contra el cuaderno: ahi solo aparecen RUTA 1, RUTA 2 y
// RUTA 3. RUTA 10 y RUTA 11 —las de TPI, las UNICAS que trabajan domingo—
// existen unicamente en los renglones 6-45. Usar solo 46-62 las dejaria sin
// dias, sin tipo y sin chofer, y de paso volveria inutil el domingo que se le
// agrego a DIAS_SEMANA.
//
// La union ademas es correcta: si un punto de RUTA 3 se atiende el lunes,
// RUTA 3 pasa el lunes. El `cupo` sale del maximo, que lo aportan los
// renglones 46-62 (paradas por dia de la ruta), no los 6-45 (por punto).
const rutas = new Map();
for (const f of filas("1 Rutas", 8)) {
  const clave = claveDeRuta(f[0]);
  if (!clave) continue;
  const r = rutas.get(clave) || {
    clave, nombre: `Ruta ${clave.split("-")[1]}`, tipo: null,
    dias: new Set(), unidad: null, chofer: null, cupo: 0, colonias: new Set(),
  };
  r.tipo = r.tipo || tipoDeRuta(f[1]);
  for (const d of diasDesdeTexto(f[2]).dias) r.dias.add(d);
  r.unidad = r.unidad || limpio(f[3]);
  r.chofer = r.chofer || limpio(f[4]);
  r.cupo = Math.max(r.cupo, Number(f[5]) || 0);
  if (limpio(f[6])) r.colonias.add(limpio(f[6]));
  rutas.set(clave, r);
}

// EL CALENDARIO ESCONDIDO: los renglones 6-45 de la hoja 1 van en el MISMO
// orden que los renglones de la hoja 3. De ahi salen los dias de cada punto.
// Ver el comentario de `suscripciones.dias` en db/019.
const calendario = cuaderno.hojas["1 Rutas"].slice(5, 45).map((f) => diasDesdeTexto(f[2]));

// PUNTOS. Aqui se resuelven las empresas escritas como sucursal.
//
// ⚠️ EL INDICE DEL CALENDARIO ES EL DEL RENGLON EN LA HOJA, NO LA POSICION EN
// ESTE ARREGLO. Si un punto se salta por no estar mapeado, todos los que
// vienen despues se recorren un lugar y heredan los dias del punto anterior.
// Serian dias PLAUSIBLES pero de otro cliente — el peor tipo de error, porque
// no se ve raro al revisarlo.
const sinMapear = new Set();
const puntos = [];
const filasPuntos = filas("3 Puntos de recoleccion", 8);
for (let i = 0; i < filasPuntos.length; i++) {
  const f = filasPuntos[i];
  const bruto = nombreClave(f[0]);
  const empresa = clientes.has(bruto) ? bruto : nombreClave(EMPRESAS[bruto] || "");
  if (!empresa || !clientes.has(empresa)) { sinMapear.add(f[0]); continue; }
  puntos.push({
    empresa,
    alias: limpio(f[1]) || "SUCURSAL",
    calle: limpio(f[2]),
    colonia: limpio(f[3]),
    cp: limpio(f[4]),
    ruta: claveDeRuta(f[6]),
    // `i` es la posicion en la HOJA. Ese es el amarre con el calendario.
    dias: calendario[i]?.dias || [],
    porLlamada: calendario[i]?.porLlamada || false,
  });
}

// SERVICIOS.
const servicios = [];
for (const f of filas("4 Servicio contratado", 9)) {
  if (esRenglonDeInstrucciones(f)) continue;
  const bruto = nombreClave(f[0]);
  const empresa = clientes.has(bruto) ? bruto : nombreClave(EMPRESAS[bruto] || "");
  if (!empresa || !clientes.has(empresa)) { sinMapear.add(f[0]); continue; }

  const llave = `${bruto} :: ${nombreClave(f[1])}`;
  const propios = puntos.filter((p) => p.empresa === empresa);
  let destino = propios.filter((p) => nombreClave(p.alias) === nombreClave(f[1]));

  if (!destino.length) {
    if (!(llave in PUNTOS)) { sinMapear.add(llave); continue; }
    const mapa = PUNTOS[llave];
    destino = mapa === null
      ? propios                                   // se reparte entre todos
      : propios.filter((p) => nombreClave(p.alias) === nombreClave(mapa.alias));
  }
  if (!destino.length) { sinMapear.add(llave); continue; }

  const alMes = Number(String(f[2]).replace(/[^\d.]/g, "")) || 0;
  const porPunto = Math.round(alMes / destino.length);
  for (const p of destino) {
    servicios.push({
      empresa, alias: p.alias, ruta: p.ruta, dias: p.dias,
      servicios_por_mes: porPunto || null,
      frecuencia: frecuenciaPorMes(porPunto),
      repartido: destino.length > 1,
      equipo: [{
        tipo: limpio(f[4]), medida: limpio(f[5]),
        cantidad: Number(f[6]) || 1, residuo: limpio(f[3]),
      }],
    });
  }
}

/* ---------- 2. EL INFORME ------------------------------------------- */

const activos = [...clientes.values()].filter((c) => c.estado === "activo");
const pendientes = [...clientes.values()].filter((c) => c.estado === "pendiente-info");

console.log(`\n${DE_VERDAD ? "CARGA DE VERDAD" : "ENSAYO — no se escribe nada"}\n${"=".repeat(60)}`);
console.log(`Clientes:   ${clientes.size}  (${activos.length} activos, ${pendientes.length} pendientes)`);
console.log(`Rutas:      ${rutas.size}`);
console.log(`Puntos:     ${puntos.length}`);
console.log(`Servicios:  ${servicios.length}` +
  (servicios.some((s) => s.repartido) ? `  (${servicios.filter((s) => s.repartido).length} repartidos entre varios puntos)` : ""));

console.log(`\nPENDIENTES POR INFORMACION (${pendientes.length}):`);
for (const c of pendientes) console.log(`  ${c.empresa.padEnd(28)} falta: ${c.falta.join(", ")}`);

if (SIN_RESOLVER.length) {
  console.log(`\n🔴 PREGUNTAS SIN CONTESTAR (${SIN_RESOLVER.length}):`);
  for (const q of SIN_RESOLVER) console.log(`  - ${q}`);
}
if (sinMapear.size) {
  console.log(`\n🔴 NOMBRES QUE NO ESTAN EN equivalencias.js (${sinMapear.size}):`);
  for (const n of [...sinMapear].sort()) console.log(`  ${JSON.stringify(n)}`);
}

if (sinMapear.size || SIN_RESOLVER.length) {
  console.error(`\nEl script NO escribe con amarres sin resolver. Un servicio colgado de la\n` +
                `empresa equivocada es facturarle a quien no era.`);
  process.exit(1);
}

if (!DE_VERDAD) {
  console.log(`\nEnsayo terminado. Para escribir:  node scripts/cuaderno/cargar.mjs --de-verdad`);
  process.exit(0);
}

/* ---------- 3. ESCRIBIR (solo con --de-verdad) ---------------------- */
// (se completa en la Task 15)
console.error("La escritura se implementa en la Task 15 del plan.");
process.exit(1);
```

- [ ] **Step 2: Correr el ensayo**

Run: `cd Web && node scripts/cuaderno/cargar.mjs`
Expected: el informe con 42 clientes (26 activos / 16 pendientes), 5 rutas, ~68 puntos y ~64 servicios. Si `SIN_RESOLVER` sigue con casos, **sale con error 1**, que es lo correcto.

- [ ] **Step 3: Verificar los números contra el spec**

Confirmar contra la sección 3 del spec: **42 clientes, 26 activos, 16 pendientes, 5 rutas.** Si no cuadra, el error está en las reglas, no en el spec: revisar antes de seguir.

- [ ] **Step 4: Volver a comprobar el cruce por posición del calendario**

El dato más frágil de toda la carga son los días de cada punto, porque salen de
que la hoja 1 y la hoja 3 vayan en el mismo orden. Eso se verificó una vez, a
mano, en agosto. **Aquí se vuelve a verificar contra el código que realmente va
a cargar**, comparando la colonia de cada par:

```bash
cd Web && node -e "
const { readFileSync } = require('fs');
const c = JSON.parse(readFileSync('./scripts/cuaderno/cuaderno.json','utf8'));
const pelado = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').trim().toUpperCase();
const hoja1 = c.hojas['1 Rutas'].slice(5,45);
const hoja3 = c.hojas['3 Puntos de recoleccion'].slice(5);
let ok=0, mal=[];
for (let i=0; i<hoja1.length; i++) {
  const a = pelado(hoja1[i][6]);   // colonia que cubre, hoja 1
  const b = pelado(hoja3[i]?.[3]); // colonia del punto, hoja 3
  if (!a || !b) continue;
  if (a === b) ok++; else mal.push([i+6, a, b]);
}
console.log('coinciden:', ok, '| NO coinciden:', mal.length);
mal.forEach(m => console.log('  renglon', m[0], JSON.stringify(m[1]), '!=', JSON.stringify(m[2])));
"
```

Expected: **39 coinciden, 1 no** — el mismo resultado de agosto.

🔴 **Si no coinciden al menos 38 de 40, NO cargar los días.** Se pone
`suscripciones.dias` en vacío y se le pregunta a la empresa. Unos días
plausibles pero equivocados son peores que ninguno: nadie los revisaría, y el
chofer acabaría yendo el día que no era.

- [ ] **Step 5: Commit**

```bash
git add Web/scripts/cuaderno/cargar.mjs
git commit -m "Cargador del cuaderno en modo ensayo: informe y freno por amarres sin resolver"
```

---

### Task 14: 🚪 PUERTA — revisar el ensayo con Luis

**Files:** ninguno.

- [ ] **Step 1: Correr el ensayo y guardar la salida**

```bash
cd Web && node scripts/cuaderno/cargar.mjs > ../ensayo-carga.txt 2>&1; cat ../ensayo-carga.txt
```

- [ ] **Step 2: Presentárselo a Luis**

Enseñarle: los 26 activos, **la lista de los 16 pendientes con qué le falta a cada uno**, los servicios que el script repartió entre varios puntos, y cualquier nombre sin mapear.

- [ ] **Step 3: 🚪 ESPERAR SU APROBACIÓN EXPLÍCITA**

**No continuar sin ella.** Después de este punto se borra y se escribe en producción.

---

### Task 15: Borrar los datos de prueba y cargar la operación real

**Files:**
- Create: `Web/scripts/cuaderno/limpiar.mjs`
- Modify: `Web/scripts/cuaderno/cargar.mjs` (sección 3)

**Interfaces:**
- Consumes: el respaldo de la Task 12, el ensayo aprobado de la Task 14.
- Produces: la base con la operación real.

- [ ] **Step 1: Escribir el limpiador**

`Web/scripts/cuaderno/limpiar.mjs`:

```js
/**
 * BORRA LOS 5 CLIENTES DE PRUEBA Y LAS 3 RUTAS DEMO.
 *
 *   node scripts/cuaderno/limpiar.mjs              (ensayo)
 *   node scripts/cuaderno/limpiar.mjs --de-verdad  (borra)
 *
 * ⚠️ NO CORRE SIN RESPALDO. Comprueba que exista un
 * `morcast-respaldo-*.json` de hoy antes de tocar nada.
 *
 * ⚠️ EL PERFIL SE DESENGANCHA ANTES DE BORRAR LA EMPRESA.
 * `perfiles.cliente_id` es ON DELETE CASCADE hacia `clientes`: borrar la
 * empresa se lleva por delante el perfil de una persona real y la deja sin
 * poder entrar NUNCA MAS. Se pone en null, se cuentan las filas, y solo
 * entonces se borra la empresa.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DE_VERDAD = process.argv.includes("--de-verdad");
const FOLIOS = ["MOR-2026-0001", "MOR-2026-0002", "MOR-2026-0003", "MOR-2026-0004", "MOR-2026-0005"];
const RUTAS_DEMO = ["RT-CENTRO", "RT-INDUSTRIAL", "RT-NORTE"];

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

// Sin respaldo de HOY, no se borra.
const hoy = new Date().toISOString().slice(0, 10);
const respaldos = readdirSync(join(homedir(), "Downloads"))
  .filter((f) => f.startsWith(`morcast-respaldo-${hoy}`));
if (!respaldos.length) {
  console.error(`No hay respaldo de hoy en Downloads. Corre primero:\n  node scripts/cuaderno/respaldar.mjs`);
  process.exit(1);
}
console.log(`Respaldo encontrado: ${respaldos[respaldos.length - 1]}`);

const { data: cli } = await supabase.from("clientes").select("id, folio, empresa").in("folio", FOLIOS);
const ids = (cli || []).map((c) => c.id);
console.log(`\nClientes a borrar (${cli?.length ?? 0}):`);
for (const c of cli || []) console.log(`  ${c.folio}  ${c.empresa}`);

const { data: perfiles } = await supabase.from("perfiles").select("id, nombre").in("cliente_id", ids);
console.log(`Perfiles a desenganchar y borrar: ${perfiles?.length ?? 0}`);

// ⚠️ SOLO las fotos de los clientes de prueba. Antes esto leia TODAS las
// recolecciones sin filtro. Hoy no haria dano —las 2 que existen son de
// prueba— pero es una bomba de tiempo: si este script se vuelve a correr
// cuando ya haya evidencia real, borraria las fotos de clientes reales y
// dejaria sus filas apuntando a archivos que ya no estan.
const { data: solicitudesPrueba } = await supabase
  .from("solicitudes_recoleccion").select("id").in("cliente_id", ids);
const idsSolicitud = (solicitudesPrueba || []).map((s) => s.id);

const { data: recs } = idsSolicitud.length
  ? await supabase.from("recolecciones")
      .select("id, foto_antes, foto_despues").in("solicitud_id", idsSolicitud)
  : { data: [] };
const fotos = (recs || []).flatMap((r) => [r.foto_antes, r.foto_despues]).filter(Boolean);
console.log(`Fotos en la cubeta a borrar: ${fotos.length}`);

if (!DE_VERDAD) {
  console.log(`\nENSAYO. Para borrar de verdad:  node scripts/cuaderno/limpiar.mjs --de-verdad`);
  process.exit(0);
}

// El orden respeta las llaves foraneas. Las fotos ANTES que las filas: si se
// borran las filas primero, quedan archivos huerfanos que nadie podra
// relacionar con nada.
if (fotos.length) {
  const { error } = await supabase.storage.from("evidencias").remove(fotos);
  if (error) console.error(`[fotos] ${error.message}`);
  else console.log(`Borradas ${fotos.length} fotos`);
}

const borra = async (tabla, columna, valores) => {
  const { data, error } = await supabase.from(tabla).delete().in(columna, valores).select("id");
  if (error) { console.error(`[${tabla}] ${error.message}`); process.exit(1); }
  console.log(`  ${tabla}: ${data.length} filas`);
};

if (idsSolicitud.length) await borra("recolecciones", "solicitud_id", idsSolicitud);
await borra("solicitudes_recoleccion", "cliente_id", ids);
await borra("movimientos_saldo", "cliente_id", ids);
await borra("suscripciones", "cliente_id", ids);
await borra("domicilios", "cliente_id", ids);

// DESENGANCHAR antes de borrar la empresa. Se cuentan las filas: un UPDATE
// bloqueado por RLS responde 200 sin cambiar nada.
const { data: soltados, error: eSoltar } = await supabase
  .from("perfiles").update({ cliente_id: null }).in("cliente_id", ids).select("id");
if (eSoltar || soltados.length !== (perfiles?.length ?? 0)) {
  console.error(`No se desengancharon todos los perfiles ` +
    `(${soltados?.length ?? 0} de ${perfiles?.length ?? 0}). SE DETIENE: borrar la ` +
    `empresa ahora se llevaria el perfil por cascada.`);
  process.exit(1);
}
console.log(`  perfiles desenganchados: ${soltados.length}`);

for (const p of perfiles || []) {
  const { error } = await supabase.auth.admin.deleteUser(p.id);
  if (error) console.error(`[usuario ${p.id}] ${error.message}`);
}
console.log(`  usuarios de Supabase borrados: ${perfiles?.length ?? 0}`);

await borra("clientes", "id", ids);
await borra("rutas", "clave", RUTAS_DEMO);

const { count } = await supabase.from("clientes").select("id", { count: "exact", head: true });
console.log(`\nClientes que quedan en la base: ${count}`);
```

- [ ] **Step 2: Ensayo del borrado**

Run: `cd Web && node scripts/cuaderno/limpiar.mjs`
Expected: lista los 5 clientes, 5 perfiles, 4 fotos, y **no borra nada**.

- [ ] **Step 3: Respaldar y borrar de verdad**

```bash
cd Web
node scripts/cuaderno/respaldar.mjs
node scripts/cuaderno/limpiar.mjs --de-verdad
```
Expected: termina con `Clientes que quedan en la base: 0`.

- [ ] **Step 4: Completar la escritura del cargador**

En `Web/scripts/cuaderno/cargar.mjs`, sustituir el bloque "sección 3" por:

```js
/* ---------- 3. ESCRIBIR --------------------------------------------- */

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

/** Escribe y COMPRUEBA. Un insert bloqueado por RLS responde 200 sin escribir. */
async function guardar(tabla, fila, filtro) {
  const previa = await supabase.from(tabla).select("id").match(filtro).maybeSingle();
  const q = previa.data
    ? supabase.from(tabla).update(fila).eq("id", previa.data.id).select("id")
    : supabase.from(tabla).insert(fila).select("id");
  const { data, error } = await q;
  if (error) { console.error(`[${tabla}] ${error.message}`, filtro); process.exit(1); }
  if (!data?.length) { console.error(`[${tabla}] no se escribio nada (RLS)`, filtro); process.exit(1); }
  return data[0].id;
}

// RUTAS primero: los puntos se cuelgan de ellas.
const idRuta = new Map();
for (const r of rutas.values()) {
  const id = await guardar("rutas", {
    clave: r.clave, nombre: r.nombre, tipo: r.tipo || "manual",
    dias: [...r.dias], unidad: r.unidad, chofer: r.chofer,
    cupo: r.cupo || 10, activa: true, zona: [],
  }, { clave: r.clave });
  idRuta.set(r.clave, id);
}
console.log(`Rutas: ${idRuta.size}`);

// CLIENTES. El folio lo pone el trigger de db/014, no el script.
const idCliente = new Map();
for (const c of clientes.values()) {
  // La nota interna dice lo que el expediente no puede decir solo: que le
  // falta, y de donde salio. Lo que falta TAMBIEN se calcula al vuelo en la
  // pantalla (`loQueFalta`); esto es el rastro de como entro, no la fuente.
  const nota = c.falta.length
    ? `Cargado del cuaderno de la empresa (27-ago-2026). Falta: ${c.falta.join(", ")}.`
    : null;
  const id = await guardar("clientes", {
    empresa: c.empresa, contacto: c.contacto, telefono: c.telefono, correo: c.correo,
    rfc: c.rfc, regimen: c.regimen, domicilio_fiscal: c.domicilio_fiscal,
    codigo_postal: c.codigo_postal, uso_cfdi: c.uso_cfdi, forma_pago: c.forma_pago,
    estado: c.estado, nota_interna: nota,
  }, { empresa: c.empresa });
  idCliente.set(c.clave, id);
}
console.log(`Clientes: ${idCliente.size}`);

// PUNTOS.
const idPunto = new Map();
for (const p of puntos) {
  const id = await guardar("domicilios", {
    cliente_id: idCliente.get(p.empresa), alias: p.alias,
    calle: p.calle, colonia: p.colonia, cp: p.cp,
  }, { cliente_id: idCliente.get(p.empresa), alias: p.alias });
  idPunto.set(`${p.empresa} :: ${p.alias}`, id);
}
console.log(`Puntos: ${idPunto.size}`);

// SERVICIOS.
let n = 0;
for (const s of servicios) {
  const domicilio_id = idPunto.get(`${s.empresa} :: ${s.alias}`);
  if (!domicilio_id) { console.error(`Sin punto: ${s.empresa} / ${s.alias}`); process.exit(1); }
  await guardar("suscripciones", {
    cliente_id: idCliente.get(s.empresa), domicilio_id,
    ruta_id: idRuta.get(s.ruta) || null,
    frecuencia: s.frecuencia, servicios_por_mes: s.servicios_por_mes,
    dias: s.dias, equipo: s.equipo, estado: "activa",
  }, { cliente_id: idCliente.get(s.empresa), domicilio_id });
  n++;
}
console.log(`Servicios: ${n}`);
console.log(`\nCarga terminada.`);
```

- [ ] **Step 5: Cargar de verdad**

Run: `cd Web && node scripts/cuaderno/cargar.mjs --de-verdad`
Expected: `Rutas: 5`, `Clientes: 42`, `Puntos: 68`, `Servicios: 64`, `Carga terminada.`

- [ ] **Step 6: Correrlo otra vez para probar que es idempotente**

Run: `cd Web && node scripts/cuaderno/cargar.mjs --de-verdad`
Expected: **exactamente los mismos números**. Si algún conteo sube, la llave natural no está funcionando y hay filas duplicadas en producción: parar y revisar antes de seguir.

- [ ] **Step 7: Commit**

```bash
git add Web/scripts/cuaderno/limpiar.mjs Web/scripts/cuaderno/cargar.mjs
git commit -m "Limpiar los datos de prueba y cargar la operacion real"
```

---

### Task 16: Verificar la operación real en vivo

**Files:** ninguno.

- [ ] **Step 1: Contar contra la base**

```bash
cd Web && PGPASSWORD=$(cat .env.db-password | tr -d '\r\n') \
  "/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  "postgresql://postgres.mbdmulygpupahocpylze@aws-0-ca-central-1.pooler.supabase.com:5432/postgres" -c "
select estado, count(*) from clientes group by estado order by estado;
select 'rutas' t, count(*)::text from rutas;
select 'puntos' t, count(*)::text from domicilios;
select 'servicios' t, count(*)::text from suscripciones;
select 'perfiles huerfanos' t, count(*)::text from perfiles where rol='cliente' and cliente_id is null;
select clave, tipo, dias, chofer, cupo from rutas order by clave;
"
```
Expected: `activo 26`, `pendiente-info 16`, 5 rutas, 68 puntos, 64 servicios, **0 perfiles huérfanos**, y las 5 rutas con su chofer y sus días (RUTA-10 y RUTA-11 **con domingo**).

- [ ] **Step 2: Verificar tres clientes a mano en el panel**

Abrir `https://morcast.mx/admin/clientes` y revisar:
- **TPI** o **CEMEX** (grande, con varios puntos) → Activo
- Uno de los 16 pendientes → **"Pendiente por información"** en ámbar, y al pasar el ratón dice qué le falta
- **KARZO** → tiene sus 9 sucursales como puntos, **no** como 9 clientes sueltos

- [ ] **Step 3: Verificar el respaldo de cobertura**

Esta es la verificación que la Task 6 dejó pendiente: ya no existen las 3 rutas
demo, así que `zonasDeCobertura()` tiene que caer a la zona única.

Abrir `https://morcast.mx/portal/alta`.
Expected: el mapa dibuja **un** polígono sobre Matamoros. Un punto en el centro → **sí hay cobertura**. Un punto en Reynosa → **no**, y ofrece dejar el teléfono.

- [ ] **Step 4: Verificar que el Hold sigue puesto**

Abrir `https://morcast.mx/portal` y `https://morcast.mx/admin`.
Expected: banda ámbar en las dos, cotizador apagado, cifras visibles sólo del lado de Morcast.

- [ ] **Step 5: Actualizar la memoria**

Actualizar `morcast-cuaderno-captura.md` (ya no está "sin cargar"), `MEMORY.md`, y agregar una memoria nueva del modo Hold con **por qué está encendido y qué lo apaga**.

- [ ] **Step 6: Commit final y fusión**

```bash
git add -A
git commit -m "Operacion real cargada y verificada en produccion"
git checkout main && git merge --no-ff operacion-real -m "Cargar la operacion real del cuaderno"
```

> ⚠️ **`git push` sólo con autorización de Luis.** A esta altura el código ya se
> desplegó en la Task 7; lo que falta subir son los scripts y el JSON del
> cuaderno, que no cambian el sitio. Aun así, se le pregunta.

---

## Notas de orden

- **La Task 5 (migración) tiene que correr antes del paso 5 de la Task 3**, porque ese paso agrega `nota_interna` al `select` de `datos-clientes.js` y sin la columna Supabase devuelve error. Si se ejecutan las tareas en orden numérico, hacer la Task 5 completa antes de volver a la Task 3.
- **La Task 7 es una puerta con despliegue.** Nada de la Fase B empieza antes.
- **La Task 14 es la última salida antes de escribir en producción.**
