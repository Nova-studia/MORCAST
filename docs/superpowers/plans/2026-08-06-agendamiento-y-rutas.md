# Agendamiento y rutas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el cliente de Morcast pida su recolección desde la web y la app, que la empresa arme rutas con zonas dibujadas en un mapa, y que la ruta del chofer salga de esas solicitudes confirmadas.

**Architecture:** Todo en memoria (demo), igual que el portal y el admin actuales. La cobertura se resuelve en el navegador con ray casting contra polígonos dibujados a mano; no hay servidor ni servicio externo. El mapa es Leaflet sobre teselas de OpenStreetMap: en la web directo, en la app dentro de un WebView.

**Tech Stack:** Next.js 16 (App Router, JS) · React 19 · Bootstrap 5 · Leaflet 1.9 · Expo SDK 54 · react-native-webview · `node --test` para la lógica pura.

**Spec:** `docs/superpowers/specs/2026-08-06-agendamiento-y-rutas-design.md`

## Global Constraints

- **Prohibido `git push` y prohibido desplegar.** El remoto tiene la URL de push saboteada a propósito. Solo commits locales.
- **Todo es demo, en memoria.** El estado vive en `useState`. Nada persiste al recargar. No conectar Supabase.
- **Nunca guardar datos bancarios del cliente** (banco, cuenta, CLABE, tarjeta). Solo RFC, razón social, domicilio fiscal, uso de CFDI y forma de pago preferida.
- **Las animaciones `Revelar` van con `desde="abajo"`.** Con `desde="izq"` o `desde="der"` el transform horizontal ensancha la página en móvil y provoca scroll lateral.
- **Todo cambio en `App IOS/src/` se copia igual a `App Android/src/`.** Los dos proyectos no comparten código.
- **Los 3 tipos de ruta son exactamente:** `"manual"` (Manual), `"roll-off"` (Industrial Roll Off), `"compactador"` (Compactador trasero).
- **Días de operación: lunes a sábado.** Nunca domingo.
- **El mapa lleva la atribución de OpenStreetMap visible.** Es requisito de uso de sus teselas.
- **Idioma del código:** nombres de variables, funciones y comentarios en español, como el resto del proyecto.
- Verificación de la web: `cd Web && npm run build`. De la app: `cd "App IOS" && npx expo export --platform android --output-dir dist-check` (borrar `dist-check` después).

---

### Task 1: Lógica de cobertura (punto en zona)

Es la única lógica pura del sistema y la única que se puede probar sola. Va primero porque todo lo demás depende de ella.

**Files:**
- Create: `Web/lib/punto-en-zona.mjs`
- Test: `Web/tests/punto-en-zona.test.mjs`

**Nota sobre la extensión `.mjs`:** el proyecto no declara `"type": "module"`, así que Node trataría un `.js` como CommonJS y reventaría al ver `export`. Con `.mjs` corre tanto en `node --test` como en Next (webpack resuelve la extensión sin problema).

**Interfaces:**
- Consumes: nada.
- Produces:
  - `puntoEnZona(punto, poligono) -> boolean` — `punto` es `[lat, lng]`, `poligono` es `[[lat, lng], ...]`
  - `rutasQueCubren(punto, rutas) -> Ruta[]` — filtra las rutas activas cuya `zona` contiene al punto

- [ ] **Step 1: Write the failing test**

Create `Web/tests/punto-en-zona.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { puntoEnZona, rutasQueCubren } from "../lib/punto-en-zona.mjs";

// Cuadrado simple alrededor del centro de Matamoros.
const CUADRO = [
  [25.90, -97.52],
  [25.90, -97.48],
  [25.86, -97.48],
  [25.86, -97.52],
];

test("un punto adentro devuelve true", () => {
  assert.equal(puntoEnZona([25.88, -97.50], CUADRO), true);
});

test("un punto afuera devuelve false", () => {
  assert.equal(puntoEnZona([25.95, -97.50], CUADRO), false);
});

test("un poligono sin suficientes vertices devuelve false", () => {
  assert.equal(puntoEnZona([25.88, -97.50], [[25.9, -97.5]]), false);
});

test("una zona vacia o ausente no truena", () => {
  assert.equal(puntoEnZona([25.88, -97.50], []), false);
  assert.equal(puntoEnZona([25.88, -97.50], null), false);
});

test("rutasQueCubren solo devuelve rutas activas que contienen el punto", () => {
  const rutas = [
    { id: "A", activa: true, zona: CUADRO },
    { id: "B", activa: false, zona: CUADRO },
    { id: "C", activa: true, zona: [[26.1, -97.6], [26.1, -97.5], [26.0, -97.5], [26.0, -97.6]] },
  ];
  const encontradas = rutasQueCubren([25.88, -97.50], rutas);
  assert.deepEqual(encontradas.map((r) => r.id), ["A"]);
});

test("rutasQueCubren devuelve vacio cuando nada cubre", () => {
  assert.deepEqual(rutasQueCubren([0, 0], [{ id: "A", activa: true, zona: CUADRO }]), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd Web && node --test tests/punto-en-zona.test.mjs
```

Expected: FAIL — `Cannot find module ... punto-en-zona.mjs`

- [ ] **Step 3: Write the implementation**

Create `Web/lib/punto-en-zona.mjs`:

```javascript
/**
 * Cobertura por zona: decide si un domicilio cae dentro del polígono de una ruta.
 *
 * Algoritmo de ray casting: se lanza un rayo horizontal desde el punto hacia el
 * infinito y se cuentan los lados del polígono que cruza. Impar = adentro.
 * No necesita librerías ni servicios externos.
 */

/**
 * @param {[number, number]} punto     [lat, lng]
 * @param {Array<[number, number]>} poligono
 * @returns {boolean}
 */
export function puntoEnZona(punto, poligono) {
  if (!Array.isArray(punto) || punto.length !== 2) return false;
  if (!Array.isArray(poligono) || poligono.length < 3) return false;

  const [lat, lng] = punto;
  let dentro = false;

  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [latI, lngI] = poligono[i];
    const [latJ, lngJ] = poligono[j];

    // ¿El lado cruza la horizontal que pasa por el punto?
    const cruza = latI > lat !== latJ > lat;
    if (!cruza) continue;

    // Longitud del lado a la altura del punto.
    const lngCorte = ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (lng < lngCorte) dentro = !dentro;
  }

  return dentro;
}

/**
 * Rutas activas cuya zona contiene al punto.
 * @param {[number, number]} punto
 * @param {Array<object>} rutas
 * @returns {Array<object>}
 */
export function rutasQueCubren(punto, rutas) {
  if (!Array.isArray(rutas)) return [];
  return rutas.filter((r) => r.activa && puntoEnZona(punto, r.zona));
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd Web && node --test tests/punto-en-zona.test.mjs
```

Expected: PASS — 6 tests, 0 fail

- [ ] **Step 5: Commit**

```bash
git add Web/lib/punto-en-zona.mjs Web/tests/punto-en-zona.test.mjs
git commit -m "Cobertura por zona: ray casting con pruebas"
```

---

### Task 2: Datos de rutas, suscripciones y solicitudes

**Files:**
- Create: `Web/lib/rutas-datos.js`

**Interfaces:**
- Consumes: `UNIDADES` y `EQUIPO_RENTA` de `Web/lib/cotizacion-datos.js`
- Produces:
  - `TIPOS_RUTA` — `[{id, nombre, detalle}]` con ids `"manual" | "roll-off" | "compactador"`
  - `DIAS_SEMANA` — `["lunes", ..., "sábado"]`
  - `RUTAS_SEED` — 3 rutas de ejemplo con zona dibujada
  - `SUSCRIPCIONES_SEED`, `SOLICITUDES_SEED`, `ZONAS_PEDIDAS_SEED`
  - `ESTADOS_SOLICITUD_REC` — `[{id, texto, clase}]`
  - `USOS_CFDI`, `FORMAS_PAGO`, `FRECUENCIAS_SUSCRIPCION`
  - `MATAMOROS_CENTRO` — `[25.8690, -97.5027]`
  - `folioRecoleccion(existentes) -> string`
  - `idZonaPedida(existentes) -> string`

- [ ] **Step 1: Create the data module**

Create `Web/lib/rutas-datos.js`:

```javascript
/**
 * Rutas de recolección, suscripciones y solicitudes.
 *
 * DEMO: todo vive en memoria. Al recargar se reinicia. Cuando se conecte
 * Supabase (Fase 4), estas constantes se sustituyen por consultas y las
 * pantallas no cambian.
 *
 * ⚠️ Espejo en `App IOS/src/rutas-datos.js` y `App Android/src/rutas-datos.js`.
 */

/** Centro de Matamoros, para encuadrar el mapa. */
export const MATAMOROS_CENTRO = [25.869, -97.5027];

/** Los 3 tipos que dio el cliente el 6-ago-2026. */
export const TIPOS_RUTA = [
  { id: "manual", nombre: "Manual", detalle: "Recolección a mano, para comercios y contenedores chicos." },
  { id: "roll-off", nombre: "Industrial (Roll Off)", detalle: "Movimiento de tolvas y compactadores con unidad roll off." },
  { id: "compactador", nombre: "Compactador trasero", detalle: "Carga trasera compactada, para alto volumen de RSU." },
];

/** Se opera de lunes a sábado. Nunca domingo. */
export const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const ESTADOS_SOLICITUD_REC = [
  { id: "solicitada", texto: "Solicitada", clase: "prog" },
  { id: "confirmada", texto: "Confirmada", clase: "ok" },
  { id: "en-ruta", texto: "En ruta", clase: "ruta" },
  { id: "completada", texto: "Completada", clase: "ok" },
  { id: "rechazada", texto: "Rechazada", clase: "mal" },
];

export const USOS_CFDI = [
  "G03 — Gastos en general",
  "G01 — Adquisición de mercancías",
  "P01 — Por definir",
];

export const FORMAS_PAGO = ["Transferencia", "Efectivo", "Cheque"];

/** Cada cuándo pasa la unidad por un cliente suscrito. */
export const FRECUENCIAS_SUSCRIPCION = ["semanal", "quincenal", "mensual"];

/**
 * Rutas de ejemplo con zonas dibujadas a ojo sobre Matamoros.
 * ⚠️ SON DE MUESTRA. Morcast tiene que dibujar las suyas desde el panel.
 */
export const RUTAS_SEED = [
  {
    id: "RT-NORTE",
    nombre: "Ruta Norte",
    tipo: "manual",
    dias: ["martes", "viernes"],
    unidad: "Camión de carga Chevrolet",
    chofer: "José Medina",
    cupo: 14,
    activa: true,
    zona: [
      [25.900, -97.540], [25.900, -97.480], [25.872, -97.470],
      [25.868, -97.520], [25.882, -97.545],
    ],
  },
  {
    id: "RT-INDUSTRIAL",
    nombre: "Ruta Industrial",
    tipo: "roll-off",
    dias: ["lunes", "miércoles", "viernes"],
    unidad: "Roll Off International",
    chofer: "Alberto Cruz",
    cupo: 8,
    activa: true,
    zona: [
      [25.870, -97.480], [25.872, -97.430], [25.840, -97.425],
      [25.836, -97.475],
    ],
  },
  {
    id: "RT-CENTRO",
    nombre: "Ruta Centro",
    tipo: "compactador",
    dias: ["lunes", "jueves", "sábado"],
    unidad: "Compactador",
    chofer: "José Medina",
    cupo: 20,
    activa: true,
    zona: [
      [25.882, -97.545], [25.868, -97.520], [25.845, -97.522],
      [25.844, -97.556], [25.868, -97.560],
    ],
  },
];

export const SUSCRIPCIONES_SEED = [
  {
    id: "SUS-001",
    cliente: "Industrias del Golfo, S.A. de C.V.",
    domicilio: { alias: "Planta 1", calle: "Av. Industrial 220", colonia: "Parque Industrial", cp: "87316", lat: 25.858, lng: -97.452 },
    rutaId: "RT-INDUSTRIAL",
    frecuencia: "semanal",
    equipo: [{ tipo: "Tolvas", medida: "30", cantidad: 1 }],
    estado: "activa",
    desde: "2024-03-01",
  },
];

export const SOLICITUDES_SEED = [
  { folio: "REC-2026-0142", cliente: "Industrias del Golfo, S.A. de C.V.", domicilio: "Planta 1 · Parque Industrial", rutaId: "RT-INDUSTRIAL", origen: "ruta", fechaPedida: "2026-08-10", fechaConfirmada: null, estado: "solicitada", nota: "" },
  { folio: "REC-2026-0141", cliente: "Centro Comercial Puerta Norte", domicilio: "Anexo · Zona Centro", rutaId: "RT-CENTRO", origen: "extra", fechaPedida: "2026-08-08", fechaConfirmada: null, estado: "solicitada", nota: "Se juntó residuo por evento de fin de semana." },
  { folio: "REC-2026-0138", cliente: "Vidriera Matamoros", domicilio: "Matriz · Zona Centro", rutaId: "RT-CENTRO", origen: "ruta", fechaPedida: "2026-08-06", fechaConfirmada: "2026-08-06", estado: "confirmada", nota: "" },
];

export const ZONAS_PEDIDAS_SEED = [
  { id: "ZP-004", nombreContacto: "Ramiro Elizondo", empresa: "Bodegas El Puente", telefono: "868 771 2204", correo: "reliz@bodegaselpuente.mx", colonia: "Lomas del Real", lat: 25.912, lng: -97.442, volumenEstimado: "2 tolvas mensuales", estado: "nueva", fecha: "2026-08-04" },
  { id: "ZP-003", nombreContacto: "Alma Treviño", empresa: "Abarrotes Treviño", telefono: "868 552 9013", correo: "almatrev@gmail.com", colonia: "Buenavista", lat: 25.826, lng: -97.498, volumenEstimado: "1 contenedor de 3 m³", estado: "en-evaluacion", fecha: "2026-07-29" },
];

/** Siguiente folio a partir de los que ya existen. Nunca por longitud del arreglo. */
export function folioRecoleccion(existentes) {
  const numeros = existentes
    .map((s) => Number(String(s.folio).split("-").pop()))
    .filter((n) => Number.isFinite(n));
  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `REC-${new Date().getFullYear()}-${String(siguiente).padStart(4, "0")}`;
}

/** Siguiente id de zona pedida. Mismo criterio que el folio: por el máximo, no por longitud. */
export function idZonaPedida(existentes) {
  const numeros = existentes
    .map((z) => Number(String(z.id).split("-").pop()))
    .filter((n) => Number.isFinite(n));
  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `ZP-${String(siguiente).padStart(3, "0")}`;
}

/** Nombre legible de un tipo de ruta. */
export function nombreTipoRuta(id) {
  return TIPOS_RUTA.find((t) => t.id === id)?.nombre || id;
}

/** Busca una ruta por id. */
export function rutaPorId(rutas, id) {
  return rutas.find((r) => r.id === id) || null;
}
```

- [ ] **Step 2: Verify the module parses and the folio logic is correct**

```bash
cd Web && node --input-type=module -e "
import('./lib/rutas-datos.js').catch(async () => {
  const m = await import('./lib/rutas-datos.js');
});
" 2>/dev/null || node --test tests/punto-en-zona.test.mjs
```

Si el import directo falla por ESM/CJS, basta con verificar en el build de la Task 4. Lo que sí se prueba ahora:

```bash
cd Web && node --input-type=module -e "
const numeros = ['REC-2026-0142','REC-2026-0141'].map(f => Number(f.split('-').pop()));
const siguiente = Math.max(...numeros) + 1;
console.log('siguiente folio:', 'REC-2026-' + String(siguiente).padStart(4,'0'));
if (siguiente !== 143) { console.error('MAL'); process.exit(1); }
console.log('OK');
"
```

Expected: `siguiente folio: REC-2026-0143` y `OK`

- [ ] **Step 3: Commit**

```bash
git add Web/lib/rutas-datos.js
git commit -m "Datos demo de rutas, suscripciones y solicitudes"
```

---

### Task 3: Componente de mapa con Leaflet

**Files:**
- Create: `Web/components/MapaZonas.js`
- Modify: `Web/package.json` (agregar `leaflet`)
- Modify: `Web/app/globals.css` (estilos del contenedor del mapa)
- Modify: `Web/app/(portal)/portal.css` (rejilla `.pt-grid-mapa`)

**Interfaces:**
- Consumes: `MATAMOROS_CENTRO` de `rutas-datos.js`
- Produces: componente por defecto `MapaZonas` con estas props:
  - `zonas` — `[{id, nombre, poligono, color}]`, se pintan como polígonos
  - `pin` — `[lat, lng] | null`, marcador del domicilio
  - `onPin(coords)` — callback al hacer clic en el mapa. Si no se pasa, el mapa no es clicable
  - `puntos` — `[{lat, lng, titulo}]`, marcadores extra (para zonas pedidas)
  - `alto` — string CSS, por defecto `"420px"`

- [ ] **Step 1: Install Leaflet**

```bash
cd Web && npm install leaflet@^1.9.4 --save
```

- [ ] **Step 2: Create the map component**

Create `Web/components/MapaZonas.js`:

```javascript
"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { MATAMOROS_CENTRO } from "@/lib/rutas-datos";

/**
 * Mapa de zonas con Leaflet sobre teselas de OpenStreetMap.
 *
 * Se carga solo en el navegador: Leaflet toca `window` y `document`, así que
 * revienta si Next intenta renderizarlo en el servidor. Por eso este archivo
 * es "use client" Y quien lo use debe importarlo con
 * `dynamic(() => import(...), { ssr: false })`.
 *
 * La atribución de OpenStreetMap es obligatoria por sus condiciones de uso.
 */
// Valores por defecto a nivel de módulo, NO literales en la firma: un `[]`
// escrito en los parámetros nace nuevo en cada render y dispararía el efecto
// que repinta el mapa con cada tecla que escriba el usuario en el formulario.
const SIN_ZONAS = [];
const SIN_PUNTOS = [];

export default function MapaZonas({
  zonas = SIN_ZONAS,
  pin = null,
  onPin = null,
  puntos = SIN_PUNTOS,
  alto = "420px",
}) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const capas = useRef([]);
  const marcadorPin = useRef(null);
  const alClic = useRef(onPin);

  // Se guarda en ref para que el listener siempre vea el callback más reciente
  // sin tener que recrear el mapa en cada render.
  useEffect(() => {
    alClic.current = onPin;
  }, [onPin]);

  // Crear el mapa una sola vez.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapa.current) return;

      mapa.current = L.map(contenedor.current).setView(MATAMOROS_CENTRO, 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa.current);

      mapa.current.on("click", (e) => {
        if (alClic.current) alClic.current([e.latlng.lat, e.latlng.lng]);
      });
    })();

    return () => {
      cancelado = true;
      if (mapa.current) {
        mapa.current.remove();
        mapa.current = null;
      }
    };
  }, []);

  // Repintar zonas y marcadores cuando cambien.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !mapa.current) return;

      capas.current.forEach((c) => c.remove());
      capas.current = [];

      zonas.forEach((z) => {
        if (!z.poligono || z.poligono.length < 3) return;
        const capa = L.polygon(z.poligono, {
          color: z.color || "#4EB34A",
          weight: 2,
          fillOpacity: 0.18,
        }).addTo(mapa.current);
        if (z.nombre) capa.bindTooltip(z.nombre);
        capas.current.push(capa);
      });

      puntos.forEach((p) => {
        const m = L.circleMarker([p.lat, p.lng], {
          radius: 7,
          color: "#DB652D",
          fillColor: "#DB652D",
          fillOpacity: 0.9,
        }).addTo(mapa.current);
        if (p.titulo) m.bindTooltip(p.titulo);
        capas.current.push(m);
      });
    })();

    return () => {
      cancelado = true;
    };
  }, [zonas, puntos]);

  // Mover el pin del domicilio.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !mapa.current) return;

      if (marcadorPin.current) {
        marcadorPin.current.remove();
        marcadorPin.current = null;
      }
      if (!pin) return;

      marcadorPin.current = L.circleMarker(pin, {
        radius: 10,
        color: "#144C4F",
        fillColor: "#7cc576",
        fillOpacity: 1,
        weight: 3,
      })
        .addTo(mapa.current)
        .bindTooltip("Tu domicilio");
    })();

    return () => {
      cancelado = true;
    };
  }, [pin]);

  return <div ref={contenedor} className="mc-mapa" style={{ height: alto }} />;
}
```

- [ ] **Step 3: Add the container styles**

Append to `Web/app/globals.css`:

```css
/* ---------- Mapa de zonas (Leaflet) ---------- */
.mc-mapa {
  width: 100%;
  border-radius: var(--mc-radio-sm);
  border: 1px solid var(--mc-linea);
  overflow: hidden;
  z-index: 0; /* debajo del navbar */
}
/* Las teselas de OSM son claras; se atenúan para que peguen con el tema oscuro. */
.mc-mapa .leaflet-tile-pane {
  filter: brightness(0.72) saturate(0.85) contrast(1.05);
}
.mc-mapa .leaflet-control-attribution {
  background: rgba(13, 21, 20, 0.82);
  color: var(--mc-gris);
  font-size: 0.66rem;
}
.mc-mapa .leaflet-control-attribution a {
  color: var(--mc-verde-claro);
}
.mc-mapa-nota {
  font-size: 0.78rem;
  color: var(--mc-gris);
  margin-top: 0.5rem;
}
```

Y append a `Web/app/(portal)/portal.css` (el panel de administración también importa
este archivo, así que sirve para las dos zonas):

```css
/* ---------- Rejilla de mapa + panel ---------- */
/* Mapa ancho a la izquierda y panel angosto a la derecha, que colapsa a una
   sola columna en tablet y teléfono.
   ⚠️ NO poner `style={{ gridTemplateColumns: ... }}` en línea: el estilo en
   línea le gana a la media query y la página nunca colapsa en el teléfono. */
.pt-grid-mapa {
  grid-template-columns: 1.5fr 1fr;
  align-items: start;
}
@media (max-width: 991.98px) {
  .pt-grid-mapa { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Verify the build compiles**

```bash
cd Web && npm run build
```

Expected: `✓ Compiled successfully`. Si aparece `window is not defined`, es que alguien importó `MapaZonas` sin `dynamic(..., { ssr: false })`.

- [ ] **Step 5: Commit**

```bash
git add Web/components/MapaZonas.js Web/app/globals.css "Web/app/(portal)/portal.css" Web/package.json Web/package-lock.json
git commit -m "Mapa de zonas con Leaflet y OpenStreetMap"
```

---

### Task 4: Pantalla de cobertura del cliente

**Files:**
- Create: `Web/app/(portal)/portal/cobertura/page.js`
- Modify: `Web/components/portal/PortalShell.js` (agregar al menú; localizar el arreglo de enlaces y añadir "Cobertura")

**Interfaces:**
- Consumes: `MapaZonas`, `rutasQueCubren` de `punto-en-zona.mjs`, `RUTAS_SEED`, `nombreTipoRuta`, `TIPOS_RUTA` de `rutas-datos.js`
- Produces: ruta `/portal/cobertura`

- [ ] **Step 1: Create the page**

Create `Web/app/(portal)/portal/cobertura/page.js`:

```javascript
"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FiMapPin, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { RUTAS_SEED, nombreTipoRuta } from "@/lib/rutas-datos";
import { rutasQueCubren } from "@/lib/punto-en-zona.mjs";

// Leaflet solo corre en el navegador.
const MapaZonas = dynamic(() => import("@/components/MapaZonas"), {
  ssr: false,
  loading: () => <div className="mc-mapa" style={{ height: 420 }} />,
});

export default function CoberturaPortal() {
  const [pin, setPin] = useState(null);

  const zonas = useMemo(
    () => RUTAS_SEED.filter((r) => r.activa).map((r) => ({
      id: r.id,
      nombre: `${r.nombre} · ${nombreTipoRuta(r.tipo)}`,
      poligono: r.zona,
    })),
    []
  );

  const cubren = useMemo(
    () => (pin ? rutasQueCubren(pin, RUTAS_SEED) : []),
    [pin]
  );

  return (
    <>
      <div className="pt-page-head">
        <h1>Cobertura</h1>
        <p>Marca dónde está tu domicilio y te decimos si ya pasamos por ahí.</p>
      </div>

      <div className="pt-grid pt-grid-mapa">
        <div className="pt-card">
          <div className="pt-card-head"><h2>Mapa de rutas</h2></div>
          <MapaZonas zonas={zonas} pin={pin} onPin={setPin} alto="460px" />
          <p className="mc-mapa-nota">
            <FiMapPin aria-hidden="true" /> Toca el mapa para colocar tu domicilio.
          </p>
        </div>

        <div className="pt-card" style={{ position: "sticky", top: 90 }}>
          <div className="pt-card-head"><h2>Tu zona</h2></div>

          {!pin && (
            <div className="pt-vacio">Coloca tu domicilio en el mapa para revisar la cobertura.</div>
          )}

          {pin && cubren.length > 0 && (
            <>
              <p style={{ color: "var(--mc-verde-claro)", fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
                <FiCheckCircle aria-hidden="true" /> Sí llegamos a tu zona
              </p>
              {cubren.map((r) => (
                <div key={r.id} style={{ borderTop: "1px solid var(--mc-linea)", paddingTop: "0.7rem", marginTop: "0.7rem" }}>
                  <div style={{ fontWeight: 700 }}>{r.nombre}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: 4 }}>
                    {nombreTipoRuta(r.tipo)}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: 4 }}>
                    Pasa: {r.dias.join(", ")}
                  </div>
                </div>
              ))}
              <a href="/portal/agendar" className="pt-btn pt-btn-verde" style={{ width: "100%", justifyContent: "center", marginTop: "1rem" }}>
                Agendar recolección
              </a>
            </>
          )}

          {pin && cubren.length === 0 && (
            <>
              <p style={{ color: "var(--mc-naranja, #DB652D)", fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
                <FiAlertCircle aria-hidden="true" /> Todavía no llegamos ahí
              </p>
              <p style={{ fontSize: "0.87rem", color: "var(--mc-gris)" }}>
                Tu domicilio queda fuera de las rutas actuales. Puedes pedir que se
                evalúe abrir una ruta nueva en tu zona.
              </p>
              <a
                href="/contacto"
                className="pt-btn"
                style={{ width: "100%", justifyContent: "center", marginTop: "0.6rem" }}
              >
                Solicitar apertura de zona
              </a>
            </>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add "Cobertura" to the portal menu**

Open `Web/components/portal/PortalShell.js`, find the array of menu links (the one holding `/portal`, `/portal/historial`, `/portal/reportes`, …) and add this entry right after `/portal`:

```javascript
{ href: "/portal/cobertura", texto: "Cobertura", icono: FiMap },
```

Import `FiMap` from `react-icons/fi` at the top of that file, next to the existing icon imports. Match the exact shape of the surrounding entries — if they use a different key name than `texto`/`icono`, copy theirs.

- [ ] **Step 3: Build and verify in the browser**

```bash
cd Web && npm run build && npx next start -p 3456
```

In another shell, with the browse tool:

```bash
B="$HOME/.claude/skills/gstack/browse/dist/browse"
$B goto http://localhost:3456/portal/login
$B fill "input[type=email]" "cliente@demo.com"
$B fill "input[type=password]" "morcast"
$B click "button[type=submit]"
$B goto http://localhost:3456/portal/cobertura
$B console --errors
$B screenshot /tmp/cobertura.png
```

Expected: no console errors, the map renders with 3 green polygons, and the OpenStreetMap attribution is visible in the corner.

- [ ] **Step 4: Verify both coverage paths**

Click inside a polygon and confirm the panel says "Sí llegamos a tu zona" naming a route. Then click far outside (e.g. the top-right corner of the map) and confirm it says "Todavía no llegamos ahí".

```bash
$B js "document.body.innerText.includes('Sí llegamos') || document.body.innerText.includes('Todavía no llegamos')"
```

Expected: `true`

- [ ] **Step 5: Commit**

```bash
git add "Web/app/(portal)/portal/cobertura/page.js" Web/components/portal/PortalShell.js
git commit -m "Portal: pantalla de cobertura con mapa de zonas"
```

---

### Task 5: Pantalla de agendar recolección

**Files:**
- Create: `Web/app/(portal)/portal/agendar/page.js`
- Modify: `Web/components/portal/PortalShell.js` (agregar "Agendar" al menú, después de "Cobertura")

**Interfaces:**
- Consumes: `RUTAS_SEED`, `SUSCRIPCIONES_SEED`, `SOLICITUDES_SEED`, `folioRecoleccion`, `ESTADOS_SOLICITUD_REC`, `nombreTipoRuta`, `rutaPorId`
- Produces: ruta `/portal/agendar`

- [ ] **Step 1: Create the page**

Create `Web/app/(portal)/portal/agendar/page.js`:

```javascript
"use client";

import { useMemo, useState } from "react";
import { FiCalendar, FiPlusCircle } from "react-icons/fi";
import {
  RUTAS_SEED,
  SUSCRIPCIONES_SEED,
  SOLICITUDES_SEED,
  ESTADOS_SOLICITUD_REC,
  folioRecoleccion,
  nombreTipoRuta,
  rutaPorId,
} from "@/lib/rutas-datos";

/**
 * Fecha en YYYY-MM-DD con la hora LOCAL.
 * No usar `toISOString()`: pasa a UTC y, según la zona horaria, devuelve el día
 * anterior. Aquí las fechas son de calendario, no instantes.
 */
function aISO(f) {
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return `${f.getFullYear()}-${mes}-${dia}`;
}

/** Próximas fechas (hasta 6) en que pasa la ruta, a partir de mañana. */
function proximasFechas(dias, cuantas = 6) {
  const nombres = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const fechas = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 60 && fechas.length < cuantas; i++) {
    const f = new Date(d);
    f.setDate(d.getDate() + i);
    if (dias.includes(nombres[f.getDay()])) fechas.push(aISO(f));
  }
  return fechas;
}

export default function AgendarPortal() {
  const suscripcion = SUSCRIPCIONES_SEED[0];
  const ruta = rutaPorId(RUTAS_SEED, suscripcion.rutaId);

  const [solicitudes, setSolicitudes] = useState(SOLICITUDES_SEED);
  const [modo, setModo] = useState("ruta"); // "ruta" | "extra"
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");
  const [enviado, setEnviado] = useState(null);

  const fechas = useMemo(() => (ruta ? proximasFechas(ruta.dias) : []), [ruta]);
  const mias = solicitudes.filter((s) => s.cliente === suscripcion.cliente);

  const enviar = () => {
    if (!fecha) return;
    const nueva = {
      folio: folioRecoleccion(solicitudes),
      cliente: suscripcion.cliente,
      domicilio: `${suscripcion.domicilio.alias} · ${suscripcion.domicilio.colonia}`,
      rutaId: suscripcion.rutaId,
      origen: modo,
      fechaPedida: fecha,
      fechaConfirmada: null,
      estado: "solicitada",
      nota,
    };
    setSolicitudes([nueva, ...solicitudes]);
    setEnviado(nueva.folio);
    setFecha("");
    setNota("");
  };

  const badge = (id) => ESTADOS_SOLICITUD_REC.find((e) => e.id === id) || { texto: id, clase: "prog" };

  return (
    <>
      <div className="pt-page-head">
        <h1>Agendar recolección</h1>
        <p>Pide tu servicio en el día de tu ruta, o una recolección extra si se te juntó de más.</p>
      </div>

      <div className="pt-grid pt-grid-2" style={{ alignItems: "start" }}>
        <div className="pt-card">
          <div className="pt-card-head"><h2>Nueva solicitud</h2></div>

          <div style={{ fontSize: "0.86rem", color: "var(--mc-gris)", marginBottom: "0.9rem" }}>
            {ruta ? (
              // Sin paréntesis alrededor del tipo: su nombre ya trae los suyos
              // ("Industrial (Roll Off)") y quedaban anidados.
              // OJO: aquí va comentario `//`, no `{/* */}`. Dentro de la rama de un
              // ternario estamos en JS, no en hijos de JSX: `{/* */}` no compila.
              <>Estás dado de alta en <strong style={{ color: "var(--mc-tinta)" }}>{ruta.nombre}</strong> · {nombreTipoRuta(ruta.tipo)}. Pasa {ruta.dias.join(", ")}.</>
            ) : (
              <>Aún no tienes una ruta asignada.</>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button className={`pt-btn ${modo === "ruta" ? "pt-btn-verde" : ""}`} onClick={() => { setModo("ruta"); setFecha(""); }}>
              <FiCalendar /> Día de mi ruta
            </button>
            <button className={`pt-btn ${modo === "extra" ? "pt-btn-verde" : ""}`} onClick={() => { setModo("extra"); setFecha(""); }}>
              <FiPlusCircle /> Recolección extra
            </button>
          </div>

          {modo === "ruta" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginBottom: "1rem" }}>
              {fechas.map((f) => (
                <button
                  key={f}
                  className={`pt-btn ${fecha === f ? "pt-btn-verde" : ""}`}
                  style={{ padding: "0.4rem 0.7rem", fontSize: "0.84rem" }}
                  onClick={() => setFecha(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="date"
              className="pt-input"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{ width: "100%", marginBottom: "1rem" }}
            />
          )}

          <textarea
            className="pt-input"
            placeholder="Nota para la cuadrilla (opcional)"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            style={{ width: "100%", marginBottom: "1rem" }}
          />

          <button className="pt-btn pt-btn-verde" style={{ width: "100%", justifyContent: "center" }} onClick={enviar} disabled={!fecha}>
            Enviar solicitud
          </button>

          {enviado && (
            <p style={{ marginTop: "0.9rem", fontSize: "0.86rem", color: "var(--mc-verde-claro)" }}>
              Solicitud <strong>{enviado}</strong> enviada. Morcast la confirma y te avisa.
            </p>
          )}
        </div>

        <div className="pt-card">
          <div className="pt-card-head"><h2>Mis solicitudes</h2></div>
          {mias.length === 0 ? (
            <div className="pt-vacio">Todavía no has pedido ninguna recolección.</div>
          ) : (
            mias.map((s) => {
              const b = badge(s.estado);
              return (
                <div key={s.folio} style={{ borderTop: "1px solid var(--mc-linea)", padding: "0.7rem 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{s.folio}</strong>
                    <span className={`pt-badge ${b.clase}`}>{b.texto}</span>
                  </div>
                  <div style={{ fontSize: "0.83rem", color: "var(--mc-gris)", marginTop: 3 }}>
                    {s.fechaPedida} · {s.origen === "extra" ? "Extra" : "De ruta"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add "Agendar" to the portal menu**

In `Web/components/portal/PortalShell.js`, add right after the "Cobertura" entry:

```javascript
{ href: "/portal/agendar", texto: "Agendar", icono: FiCalendar },
```

Import `FiCalendar` from `react-icons/fi`.

- [ ] **Step 3: Add the missing badge modifier**

`portal.css` tiene `.pt-badge.ok`, `.prog` y `.ruta`, pero **no `.mal`**, que es la que
usa el estado `rechazada`. Agrégala junto a las otras:

```css
/* Rechazada / cancelada. La usan las solicitudes de recolección. */
.pt-badge.mal { background: rgba(198, 63, 63, 0.18); color: #ef8080; }
```

- [ ] **Step 4: Check the rest of the CSS classes exist**

```bash
cd Web && grep -c "pt-badge\|pt-input\|pt-vacio" app/\(portal\)/portal.css
```

Expected: a number greater than 0. If `pt-input` or `pt-badge` do not exist, open `portal.css`, find what the existing forms and status chips actually use (search for `<input` in `agregar-saldo/page.js` and for the badge markup in `historial/page.js`) and use those class names instead.

- [ ] **Step 4: Build and verify the flow**

```bash
cd Web && npm run build && npx next start -p 3456
```

```bash
B="$HOME/.claude/skills/gstack/browse/dist/browse"
$B goto http://localhost:3456/portal/login
$B fill "input[type=email]" "cliente@demo.com"
$B fill "input[type=password]" "morcast"
$B click "button[type=submit]"
$B goto http://localhost:3456/portal/agendar
$B snapshot -i
```

Click a date chip, then "Enviar solicitud", then:

```bash
$B js "document.body.innerText.includes('enviada')"
```

Expected: `true`, and the new folio appears in "Mis solicitudes" with the "Solicitada" badge.

- [ ] **Step 5: Commit**

```bash
git add "Web/app/(portal)/portal/agendar/page.js" Web/components/portal/PortalShell.js
git commit -m "Portal: agendar recoleccion de ruta o extra"
```

---

### Task 6: Panel de rutas para la empresa

**Files:**
- Create: `Web/app/(admin)/admin/rutas/page.js`
- Modify: `Web/components/admin/AdminShell.js` (agregar "Rutas" al menú)

**Interfaces:**
- Consumes: `MapaZonas`, `RUTAS_SEED`, `TIPOS_RUTA`, `DIAS_SEMANA`, `nombreTipoRuta`; `UNIDADES` de `cotizacion-datos.js`
- Produces: ruta `/admin/rutas`

- [ ] **Step 1: Create the page**

Create `Web/app/(admin)/admin/rutas/page.js`:

```javascript
"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FiPlus, FiTrash2, FiSave } from "react-icons/fi";
import { RUTAS_SEED, TIPOS_RUTA, DIAS_SEMANA, nombreTipoRuta } from "@/lib/rutas-datos";
import { UNIDADES } from "@/lib/cotizacion-datos";

const MapaZonas = dynamic(() => import("@/components/MapaZonas"), {
  ssr: false,
  loading: () => <div className="mc-mapa" style={{ height: 420 }} />,
});

const COLORES = ["#4EB34A", "#DB652D", "#3FA9C9", "#B37ACB"];

export default function RutasAdmin() {
  const [rutas, setRutas] = useState(RUTAS_SEED);
  const [seleccion, setSeleccion] = useState(RUTAS_SEED[0].id);
  const [dibujando, setDibujando] = useState(false);
  const [trazo, setTrazo] = useState([]);

  const ruta = rutas.find((r) => r.id === seleccion);

  const zonas = useMemo(() => {
    const base = rutas.filter((r) => r.activa).map((r, i) => ({
      id: r.id,
      nombre: r.nombre,
      poligono: r.zona,
      color: r.id === seleccion ? "#7cc576" : COLORES[i % COLORES.length],
    }));
    if (dibujando && trazo.length >= 3) {
      base.push({ id: "__nueva", nombre: "Zona nueva", poligono: trazo, color: "#DB652D" });
    }
    return base;
  }, [rutas, seleccion, dibujando, trazo]);

  const puntosTrazo = dibujando
    ? trazo.map((p, i) => ({ lat: p[0], lng: p[1], titulo: `Punto ${i + 1}` }))
    : [];

  const cambia = (campo, valor) =>
    setRutas(rutas.map((r) => (r.id === seleccion ? { ...r, [campo]: valor } : r)));

  const alternaDia = (dia) => {
    if (!ruta) return;
    const dias = ruta.dias.includes(dia)
      ? ruta.dias.filter((d) => d !== dia)
      : [...ruta.dias, dia];
    // Se reordena según DIAS_SEMANA para que siempre salgan en orden natural.
    cambia("dias", DIAS_SEMANA.filter((d) => dias.includes(d)));
  };

  const guardarZona = () => {
    if (trazo.length < 3) return;
    cambia("zona", trazo);
    setTrazo([]);
    setDibujando(false);
  };

  return (
    <>
      <div className="pt-page-head">
        <h1>Rutas</h1>
        <p>Define los días, la unidad y la zona que cubre cada ruta.</p>
      </div>

      <div className="pt-grid pt-grid-mapa">
        <div className="pt-card">
          <div className="pt-card-head">
            <h2>Mapa de zonas</h2>
            {!dibujando ? (
              <button className="pt-btn" onClick={() => { setDibujando(true); setTrazo([]); }}>
                <FiPlus /> Dibujar zona
              </button>
            ) : (
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button className="pt-btn" onClick={() => setTrazo(trazo.slice(0, -1))} disabled={!trazo.length}>
                  Deshacer
                </button>
                <button className="pt-btn pt-btn-naranja" onClick={guardarZona} disabled={trazo.length < 3}>
                  <FiSave /> Guardar zona
                </button>
                <button className="pt-btn" onClick={() => { setDibujando(false); setTrazo([]); }}>
                  Cancelar
                </button>
              </div>
            )}
          </div>

          <MapaZonas
            zonas={zonas}
            puntos={puntosTrazo}
            onPin={dibujando ? (c) => setTrazo((t) => [...t, c]) : null}
            alto="480px"
          />
          <p className="mc-mapa-nota">
            {dibujando
              ? `Toca el mapa para ir marcando las esquinas de la zona. Llevas ${trazo.length} (mínimo 3).`
              : "Selecciona una ruta para resaltar su zona, o dibuja una nueva."}
          </p>
        </div>

        <div className="pt-card">
          <div className="pt-card-head"><h2>Rutas</h2></div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
            {rutas.map((r) => (
              <button
                key={r.id}
                className={`pt-btn ${r.id === seleccion ? "pt-btn-naranja" : ""}`}
                style={{ padding: "0.4rem 0.7rem", fontSize: "0.84rem" }}
                onClick={() => setSeleccion(r.id)}
              >
                {r.nombre}
              </button>
            ))}
          </div>

          {ruta && (
            <>
              <div className="pt-campo">
                <label>Nombre</label>
                <input className="pt-input" value={ruta.nombre} onChange={(e) => cambia("nombre", e.target.value)} style={{ width: "100%" }} />
              </div>

              <div className="pt-campo">
                <label>Tipo de ruta</label>
                <select className="pt-input" value={ruta.tipo} onChange={(e) => cambia("tipo", e.target.value)} style={{ width: "100%" }}>
                  {TIPOS_RUTA.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="pt-campo">
                <label>Unidad</label>
                <select className="pt-input" value={ruta.unidad} onChange={(e) => cambia("unidad", e.target.value)} style={{ width: "100%" }}>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div className="pt-campo">
                <label>Días</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {DIAS_SEMANA.map((d) => (
                    <button
                      key={d}
                      className={`pt-btn ${ruta.dias.includes(d) ? "pt-btn-naranja" : ""}`}
                      style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                      onClick={() => alternaDia(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-campo">
                <label>Cupo por día</label>
                <input
                  className="pt-input"
                  type="number"
                  min="1"
                  value={ruta.cupo}
                  onChange={(e) => cambia("cupo", Number(e.target.value) || 1)}
                  style={{ width: "100%" }}
                />
              </div>

              <p style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                {nombreTipoRuta(ruta.tipo)} · {ruta.zona.length} vértices en su zona · chofer {ruta.chofer}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
```

**Agregado al implementar (el plan se quedaba corto contra el spec):** el spec pide
**alta** y edición de rutas, y esta pantalla solo editaba las 3 existentes. Se añadió:

- Botón **Nueva ruta**, que crea una ruta con id `RT-00N` calculado por el máximo (no
  por la longitud del arreglo) y **sin zona**: hasta que se le dibuje una, no cubre a
  nadie, que es el comportamiento correcto.
- Campo **Chofer**, que faltaba pese a estar en el modelo de datos.
- Aviso en naranja cuando la ruta tiene menos de 3 vértices, explicando que así no le
  aparece a ningún cliente.

- [ ] **Step 2: Add "Rutas" to the admin menu**

In `Web/components/admin/AdminShell.js`, find the menu array and add after the panel entry:

```javascript
{ href: "/admin/rutas", texto: "Rutas", icono: FiMap },
```

Import `FiMap` from `react-icons/fi`. Match the exact key names used by the surrounding entries.

- [ ] **Step 3: Confirm the form pattern matches the codebase**

This project has **no `pt-label` class**. Form fields are always wrapped like this
(see `admin/clientes/page.js`), and `portal.css` styles the bare `label` inside:

```jsx
<div className="pt-campo">
  <label>Etiqueta</label>
  <input className="pt-input" ... />
</div>
```

```bash
cd Web && grep -c "pt-campo\|pt-btn-naranja" app/\(portal\)/portal.css
```

Expected: greater than 0.

- [ ] **Step 4: Build and verify drawing a zone**

```bash
cd Web && npm run build && npx next start -p 3456
```

```bash
B="$HOME/.claude/skills/gstack/browse/dist/browse"
$B goto http://localhost:3456/admin/login
$B fill "input[type=email]" "admin@morcast.mx"
$B fill "input[type=password]" "admin"
$B click "button[type=submit]"
$B goto http://localhost:3456/admin/rutas
$B console --errors
$B screenshot /tmp/rutas.png
```

Click "Dibujar zona", click 4 spots on the map, confirm the counter reads "Llevas 4", then click "Guardar zona" and confirm the polygon count in the footer text updates to 4 vertices.

- [ ] **Step 5: Commit**

```bash
git add "Web/app/(admin)/admin/rutas/page.js" Web/components/admin/AdminShell.js
git commit -m "Admin: panel de rutas con dibujo de zonas"
```

---

### Task 7: Bandeja de solicitudes de recolección

**Files:**
- Create: `Web/app/(admin)/admin/recolecciones/page.js`
- Modify: `Web/components/admin/AdminShell.js` (agregar "Recolecciones")

**Interfaces:**
- Consumes: `SOLICITUDES_SEED`, `ESTADOS_SOLICITUD_REC`, `RUTAS_SEED`, `rutaPorId`, `nombreTipoRuta`
- Produces: ruta `/admin/recolecciones`

- [ ] **Step 1: Create the page**

Create `Web/app/(admin)/admin/recolecciones/page.js`:

```javascript
"use client";

import { useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import {
  SOLICITUDES_SEED,
  ESTADOS_SOLICITUD_REC,
  RUTAS_SEED,
  rutaPorId,
  nombreTipoRuta,
} from "@/lib/rutas-datos";

export default function RecoleccionesAdmin() {
  const [solicitudes, setSolicitudes] = useState(SOLICITUDES_SEED);
  const [filtro, setFiltro] = useState("todas");
  const [motivo, setMotivo] = useState({});

  const badge = (id) => ESTADOS_SOLICITUD_REC.find((e) => e.id === id) || { texto: id, clase: "prog" };

  const cambiaEstado = (folio, estado, extra = {}) =>
    setSolicitudes(
      solicitudes.map((s) => (s.folio === folio ? { ...s, estado, ...extra } : s))
    );

  const confirmar = (s) =>
    cambiaEstado(s.folio, "confirmada", { fechaConfirmada: s.fechaPedida });

  const rechazar = (s) =>
    cambiaEstado(s.folio, "rechazada", { motivoRechazo: motivo[s.folio] || "Sin cupo en la ruta." });

  const lista = filtro === "todas" ? solicitudes : solicitudes.filter((s) => s.estado === filtro);
  const porConfirmar = solicitudes.filter((s) => s.estado === "solicitada").length;

  return (
    <>
      <div className="pt-page-head">
        <h1>Recolecciones</h1>
        <p>
          {porConfirmar === 0
            ? "No hay solicitudes por confirmar."
            : `${porConfirmar} solicitud${porConfirmar === 1 ? "" : "es"} por confirmar.`}
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        <button className={`pt-btn ${filtro === "todas" ? "pt-btn-naranja" : ""}`} onClick={() => setFiltro("todas")}>
          Todas
        </button>
        {ESTADOS_SOLICITUD_REC.map((e) => (
          <button
            key={e.id}
            className={`pt-btn ${filtro === e.id ? "pt-btn-naranja" : ""}`}
            onClick={() => setFiltro(e.id)}
          >
            {e.texto}
          </button>
        ))}
      </div>

      <div className="pt-card">
        {lista.length === 0 ? (
          <div className="pt-vacio">No hay solicitudes con ese estado.</div>
        ) : (
          lista.map((s) => {
            const b = badge(s.estado);
            const ruta = rutaPorId(RUTAS_SEED, s.rutaId);
            return (
              <div key={s.folio} style={{ borderTop: "1px solid var(--mc-linea)", padding: "0.9rem 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.7rem", flexWrap: "wrap" }}>
                  <div>
                    <strong>{s.folio}</strong>
                    <span style={{ color: "var(--mc-gris)", marginLeft: 8, fontSize: "0.88rem" }}>
                      {s.cliente}
                    </span>
                  </div>
                  <span className={`pt-badge ${b.clase}`}>{b.texto}</span>
                </div>

                <div style={{ fontSize: "0.84rem", color: "var(--mc-gris)", marginTop: 5 }}>
                  {s.domicilio} · {ruta ? `${ruta.nombre} (${nombreTipoRuta(ruta.tipo)})` : "Sin ruta"} ·
                  {" "}pedida para {s.fechaPedida} · {s.origen === "extra" ? "Extra" : "De ruta"}
                </div>

                {s.nota && (
                  <div style={{ fontSize: "0.84rem", color: "var(--mc-gris)", marginTop: 5, fontStyle: "italic" }}>
                    “{s.nota}”
                  </div>
                )}

                {s.motivoRechazo && (
                  <div style={{ fontSize: "0.84rem", color: "#DB652D", marginTop: 5 }}>
                    Rechazada: {s.motivoRechazo}
                  </div>
                )}

                {s.estado === "solicitada" && (
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem", flexWrap: "wrap" }}>
                    <button className="pt-btn pt-btn-verde" onClick={() => confirmar(s)}>
                      <FiCheck /> Confirmar
                    </button>
                    <input
                      className="pt-input"
                      placeholder="Motivo del rechazo"
                      value={motivo[s.folio] || ""}
                      onChange={(e) => setMotivo({ ...motivo, [s.folio]: e.target.value })}
                      style={{ flex: 1, minWidth: 180 }}
                    />
                    <button className="pt-btn" onClick={() => rechazar(s)}>
                      <FiX /> Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add "Recolecciones" to the admin menu**

In `Web/components/admin/AdminShell.js`, add after "Rutas":

```javascript
{ href: "/admin/recolecciones", texto: "Recolecciones", icono: FiTruck },
```

Import `FiTruck` from `react-icons/fi`.

- [ ] **Step 3: Build and verify confirm/reject**

```bash
cd Web && npm run build && npx next start -p 3456
```

Log into `/admin/login` with `admin@morcast.mx` / `admin`, go to `/admin/recolecciones`, click "Confirmar" on the first request, and verify its badge changes to "Confirmada" and the action buttons disappear. Then type a reason on another and click "Rechazar"; verify the reason shows in orange.

```bash
$B js "document.body.innerText.includes('Confirmada')"
```

Expected: `true`

- [ ] **Step 4: Commit**

```bash
git add "Web/app/(admin)/admin/recolecciones/page.js" Web/components/admin/AdminShell.js
git commit -m "Admin: bandeja de solicitudes de recoleccion"
```

---

### Task 8: Zonas pedidas (dónde piden servicio y no llegamos)

**Files:**
- Create: `Web/app/(admin)/admin/zonas-pedidas/page.js`
- Modify: `Web/components/admin/AdminShell.js` (agregar "Zonas pedidas")

**Interfaces:**
- Consumes: `MapaZonas`, `ZONAS_PEDIDAS_SEED`, `RUTAS_SEED`
- Produces: ruta `/admin/zonas-pedidas`

- [ ] **Step 1: Create the page**

Create `Web/app/(admin)/admin/zonas-pedidas/page.js`:

```javascript
"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ZONAS_PEDIDAS_SEED, RUTAS_SEED } from "@/lib/rutas-datos";

const MapaZonas = dynamic(() => import("@/components/MapaZonas"), {
  ssr: false,
  loading: () => <div className="mc-mapa" style={{ height: 420 }} />,
});

const ESTADOS_ZONA = [
  { id: "nueva", texto: "Nueva", clase: "prog" },
  { id: "en-evaluacion", texto: "En evaluación", clase: "ruta" },
  { id: "aprobada", texto: "Aprobada", clase: "ok" },
  { id: "descartada", texto: "Descartada", clase: "mal" },
];

export default function ZonasPedidasAdmin() {
  const [pedidas, setPedidas] = useState(ZONAS_PEDIDAS_SEED);

  const zonas = useMemo(
    () => RUTAS_SEED.filter((r) => r.activa).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      poligono: r.zona,
    })),
    []
  );

  const puntos = pedidas.map((z) => ({
    lat: z.lat,
    lng: z.lng,
    titulo: `${z.empresa} · ${z.colonia}`,
  }));

  const cambiaEstado = (id, estado) =>
    setPedidas(pedidas.map((z) => (z.id === id ? { ...z, estado } : z)));

  const badge = (id) => ESTADOS_ZONA.find((e) => e.id === id) || { texto: id, clase: "prog" };

  return (
    <>
      <div className="pt-page-head">
        <h1>Zonas pedidas</h1>
        <p>Dónde están pidiendo servicio y todavía no pasa ninguna ruta.</p>
      </div>

      <div className="pt-grid pt-grid-mapa">
        <div className="pt-card">
          <div className="pt-card-head"><h2>Mapa</h2></div>
          <MapaZonas zonas={zonas} puntos={puntos} alto="460px" />
          <p className="mc-mapa-nota">
            Los puntos naranjas son solicitudes fuera de cobertura. Donde se junten
            varios, conviene evaluar una ruta nueva.
          </p>
        </div>

        <div className="pt-card">
          <div className="pt-card-head"><h2>Solicitudes</h2></div>
          {pedidas.length === 0 ? (
            <div className="pt-vacio">No hay solicitudes fuera de cobertura.</div>
          ) : (
            pedidas.map((z) => {
              const b = badge(z.estado);
              return (
                <div key={z.id} style={{ borderTop: "1px solid var(--mc-linea)", padding: "0.85rem 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem" }}>
                    <strong style={{ fontSize: "0.92rem" }}>{z.empresa}</strong>
                    <span className={`pt-badge ${b.clase}`}>{b.texto}</span>
                  </div>
                  <div style={{ fontSize: "0.83rem", color: "var(--mc-gris)", marginTop: 4 }}>
                    {z.colonia} · {z.volumenEstimado}
                  </div>
                  <div style={{ fontSize: "0.83rem", color: "var(--mc-gris)", marginTop: 3 }}>
                    {z.nombreContacto} · {z.telefono}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
                    {ESTADOS_ZONA.map((e) => (
                      <button
                        key={e.id}
                        className={`pt-btn ${z.estado === e.id ? "pt-btn-naranja" : ""}`}
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}
                        onClick={() => cambiaEstado(z.id, e.id)}
                      >
                        {e.texto}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
```

**Corregido al implementar:** los 2 marcadores se dibujaban pero **quedaban fuera del
encuadre**, porque una zona pedida cae por definición fuera de las rutas y el mapa
arranca fijo en el centro de Matamoros. Se le agregó a `MapaZonas` la prop
`encuadrar`, que hace `fitBounds` sobre todo lo dibujado (con `maxZoom: 15` para que
no se acerque de más cuando hay un solo punto). Esta pantalla la usa; cobertura y
rutas no, ahí el encuadre fijo es el correcto.

- [ ] **Step 2: Add "Zonas pedidas" to the admin menu**

In `Web/components/admin/AdminShell.js`, add after "Recolecciones":

```javascript
{ href: "/admin/zonas-pedidas", texto: "Zonas pedidas", icono: FiMapPin },
```

Import `FiMapPin` from `react-icons/fi`.

- [ ] **Step 3: Build and verify**

```bash
cd Web && npm run build && npx next start -p 3456
```

Log into the admin, open `/admin/zonas-pedidas`, confirm two orange dots render outside the green polygons, and clicking "Aprobada" on a row changes its badge.

- [ ] **Step 4: Commit**

```bash
git add "Web/app/(admin)/admin/zonas-pedidas/page.js" Web/components/admin/AdminShell.js
git commit -m "Admin: mapa de zonas pedidas fuera de cobertura"
```

---

### Task 9: Conectar la agenda del admin y la ruta del chofer

Hasta aquí las solicitudes viven aisladas. Esta tarea las vuelve la fuente de la agenda del admin y de la ruta del chofer, que es el punto del spec.

**Files:**
- Modify: `Web/lib/admin-datos.js` (agregar `agendaDesdeSolicitudes`)
- Modify: `Web/app/(admin)/admin/servicios/page.js` (consumirla)
- Modify: `App IOS/src/datos-chofer.js` y `App Android/src/datos-chofer.js`

**Interfaces:**
- Consumes: `SOLICITUDES_SEED`, `RUTAS_SEED`, `rutaPorId` de `rutas-datos.js`
- Produces:
  - `agendaDesdeSolicitudes(solicitudes, rutas) -> [{folio, fecha, cliente, tipo, unidad, operador, estatus}]`
  - `rutaDelDia(solicitudes, rutas, chofer, fecha) -> [{folio, cliente, domicilio, estatus}]` (en la app)

- [ ] **Step 1: Add the adapter in `admin-datos.js`**

Append to `Web/lib/admin-datos.js`:

```javascript
import { rutaPorId } from "./rutas-datos";

/**
 * Convierte solicitudes de recolección al formato que ya usa la agenda del
 * admin (AGENDA_SERVICIOS), para que las dos vistas hablen el mismo idioma.
 * Solo entran las confirmadas, en ruta o completadas: una solicitud sin
 * confirmar no ocupa unidad.
 */
export function agendaDesdeSolicitudes(solicitudes, rutas) {
  const visibles = ["confirmada", "en-ruta", "completada"];
  return solicitudes
    .filter((s) => visibles.includes(s.estado))
    .map((s) => {
      const r = rutaPorId(rutas, s.rutaId);
      return {
        folio: s.folio,
        fecha: s.fechaConfirmada || s.fechaPedida,
        cliente: s.cliente,
        tipo: s.origen === "extra" ? "Recolección extra" : "Recolección de ruta",
        unidad: r?.unidad || "Sin asignar",
        operador: r?.chofer || "Sin asignar",
        estatus: s.estado === "confirmada" ? "programado" : s.estado,
      };
    })
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}
```

Nota: el `sort` compara con `<`/`>` y devuelve `0` en el empate. No usar resta de fechas ni un comparador que nunca devuelva `0`: eso produce orden inestable, y es un bug que ya se corrigió antes en este proyecto.

- [ ] **Step 2: Consume it in the admin agenda**

In `Web/app/(admin)/admin/servicios/page.js`, add these imports at the top:

```javascript
import { agendaDesdeSolicitudes } from "@/lib/admin-datos";
import { SOLICITUDES_SEED, RUTAS_SEED } from "@/lib/rutas-datos";
```

Then, where the component currently reads `AGENDA_SERVICIOS`, replace that value with:

```javascript
const agenda = [
  ...agendaDesdeSolicitudes(SOLICITUDES_SEED, RUTAS_SEED),
  ...AGENDA_SERVICIOS,
];
```

Keep `AGENDA_SERVICIOS` in the mix so the existing demo rows (with their before/after photo evidence) don't disappear from the screen.

- [ ] **Step 3: Verify the admin agenda shows the confirmed request**

```bash
cd Web && npm run build && npx next start -p 3456
```

Log into the admin and open `/admin/servicios`. `REC-2026-0138` (the seed request already in `confirmada`) must appear in the list with unit "Compactador" and operator "José Medina".

```bash
$B js "document.body.innerText.includes('REC-2026-0138')"
```

Expected: `true`

**Corregido al implementar:** el plan mapeaba solo `confirmada -> programado` y dejaba
pasar `s.estado` tal cual para el resto. Pero la agenda dice **"completado"** y las
solicitudes **"completada"**: con el estado sin traducir, esas filas se caían del filtro
"Completados" y el badge salía sin color. Se usa un mapa explícito `ESTATUS_AGENDA`.

**Los pasos 4 y 5 (chofer y espejo en la app) se hacen junto con la Task 10**, por
decisión de Luis el 7-ago: primero se cierra toda la web, luego las dos apps de un tirón.

- [ ] **Step 4: Wire the driver's route in the app**

Append to `App IOS/src/datos-chofer.js`:

```javascript
import { SOLICITUDES_SEED, RUTAS_SEED } from "./rutas-datos";

/**
 * Paradas del chofer para una fecha: las recolecciones confirmadas de las
 * rutas que trae asignadas.
 */
export function rutaDelDia(chofer, fecha) {
  const misRutas = RUTAS_SEED.filter((r) => r.chofer === chofer && r.activa).map((r) => r.id);
  return SOLICITUDES_SEED
    .filter(
      (s) =>
        misRutas.includes(s.rutaId) &&
        ["confirmada", "en-ruta"].includes(s.estado) &&
        (s.fechaConfirmada || s.fechaPedida) === fecha
    )
    .map((s) => ({
      folio: s.folio,
      cliente: s.cliente,
      domicilio: s.domicilio,
      estatus: s.estado,
    }));
}
```

Do NOT change the existing 5-step pickup flow (QR scan, before photo, collect, after photo, weight). This only adds a way to build the day's stop list.

- [ ] **Step 5: Mirror to Android and verify the bundle**

```bash
cp "App IOS/src/rutas-datos.js" "App Android/src/rutas-datos.js"
cp "App IOS/src/datos-chofer.js" "App Android/src/datos-chofer.js"
cd "App IOS" && npx expo export --platform android --output-dir dist-check && rm -rf dist-check
```

Expected: `Exported: dist-check` with no errors.

Note: Task 10 creates `App IOS/src/rutas-datos.js`. If running tasks in order, do that copy as part of Task 10 instead and only copy `datos-chofer.js` here.

- [ ] **Step 6: Commit**

```bash
git add Web/lib/admin-datos.js "Web/app/(admin)/admin/servicios/page.js" "App IOS/src/datos-chofer.js" "App Android/src/datos-chofer.js"
git commit -m "Conectar solicitudes con la agenda del admin y la ruta del chofer"
```

---

### Task 10: Espejo en la app móvil

**Files:**
- Create: `App IOS/src/rutas-datos.js` y `App Android/src/rutas-datos.js` (copia de `Web/lib/rutas-datos.js`)
- Create: `App IOS/src/punto-en-zona.js` y `App Android/src/punto-en-zona.js`
- Create: `App IOS/src/MapaWeb.js` y `App Android/src/MapaWeb.js`
- Create: `App IOS/src/pantallas/Cobertura.js` y `App Android/src/pantallas/Cobertura.js`
- Modify: `App IOS/App.js` y `App Android/App.js` (registrar la pantalla en el stack del cliente)
- Modify: `App IOS/src/pantallas/Mas.js` y `App Android/src/pantallas/Mas.js` (entrada en el menú hub)
- Modify: `App IOS/package.json` (agregar `react-native-webview`)

**Interfaces:**
- Consumes: `RUTAS_SEED`, `MATAMOROS_CENTRO`, `nombreTipoRuta` de `rutas-datos.js`; `rutasQueCubren` de `punto-en-zona.js`
- Produces: pantalla `Cobertura` navegable desde el menú "Más"

- [ ] **Step 1: Install the WebView**

```bash
cd "App IOS" && npx expo install react-native-webview
```

`expo install` (not `npm install`) picks the version that matches SDK 54. Copy the resulting `package.json` and `package-lock.json` to `App Android/` afterwards.

- [ ] **Step 2: Copy the shared logic**

```bash
cp Web/lib/rutas-datos.js "App IOS/src/rutas-datos.js"
cp Web/lib/punto-en-zona.mjs "App IOS/src/punto-en-zona.js"
```

Then open `App IOS/src/punto-en-zona.js` and confirm it has no Next-specific imports (it has none — it is plain ESM). Metro reads `.js` as ESM, so the extension change is safe here.

- [ ] **Step 3: Create the WebView map**

Create `App IOS/src/MapaWeb.js`:

```javascript
import { useMemo } from "react";
import { WebView } from "react-native-webview";
import { MATAMOROS_CENTRO } from "./rutas-datos";

/**
 * Mapa Leaflet dentro de un WebView.
 *
 * Se usa WebView y no react-native-maps porque en Android ese paquete usa
 * Google Maps y exige una API key con tarjeta registrada. Así el mapa es el
 * mismo en la web y en la app, y no depende de ninguna llave.
 *
 * Leaflet se carga desde su CDN: la app necesita internet para el mapa, igual
 * que para las teselas.
 */
export default function MapaWeb({ zonas = [], pin = null, onPin, alto = 300 }) {
  const html = useMemo(() => `
<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;height:100%;background:#0f1615}
.leaflet-tile-pane{filter:brightness(.72) saturate(.85)}
.leaflet-control-attribution{background:rgba(13,21,20,.82);color:#939d99;font-size:9px}</style>
</head><body><div id="m"></div><script>
var mapa = L.map('m').setView(${JSON.stringify(MATAMOROS_CENTRO)}, 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(mapa);
var zonas = ${JSON.stringify(zonas)};
zonas.forEach(function (z) {
  if (!z.poligono || z.poligono.length < 3) return;
  L.polygon(z.poligono, { color: '#4EB34A', weight: 2, fillOpacity: .18 })
    .addTo(mapa).bindTooltip(z.nombre || '');
});
var pin = ${JSON.stringify(pin)};
var marcador = null;
function ponPin(c) {
  if (marcador) marcador.remove();
  marcador = L.circleMarker(c, { radius: 10, color: '#144C4F',
    fillColor: '#7cc576', fillOpacity: 1, weight: 3 }).addTo(mapa);
}
if (pin) ponPin(pin);
mapa.on('click', function (e) {
  var c = [e.latlng.lat, e.latlng.lng];
  ponPin(c);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(c));
});
</script></body></html>`, [zonas, pin]);

  return (
    <WebView
      style={{ height: alto, borderRadius: 12, overflow: "hidden" }}
      originWhitelist={["*"]}
      source={{ html }}
      onMessage={(e) => {
        if (!onPin) return;
        try {
          onPin(JSON.parse(e.nativeEvent.data));
        } catch {
          // Mensaje que no era coordenadas: se ignora.
        }
      }}
    />
  );
}
```

- [ ] **Step 4: Create the coverage screen**

Create `App IOS/src/pantallas/Cobertura.js`:

```javascript
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta, EncabezadoPantalla } from "../ui";
import MapaWeb from "../MapaWeb";
import { RUTAS_SEED, nombreTipoRuta } from "../rutas-datos";
import { rutasQueCubren } from "../punto-en-zona";

export default function Cobertura() {
  const [pin, setPin] = useState(null);

  const zonas = useMemo(
    () => RUTAS_SEED.filter((r) => r.activa).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      poligono: r.zona,
    })),
    []
  );

  const cubren = useMemo(() => (pin ? rutasQueCubren(pin, RUTAS_SEED) : []), [pin]);

  return (
    <ScrollView style={{ backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16 }}>
      <EncabezadoPantalla
        titulo="Cobertura"
        sub="Toca el mapa donde está tu domicilio."
      />

      <Tarjeta>
        <MapaWeb zonas={zonas} pin={pin} onPin={setPin} alto={320} />
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Tu zona</TituloTarjeta>

        {!pin && <Text style={s.vacio}>Coloca tu domicilio en el mapa.</Text>}

        {pin && cubren.length > 0 && (
          <>
            <View style={s.fila}>
              <Feather name="check-circle" size={16} color={T.verde} />
              <Text style={s.ok}>  Sí llegamos a tu zona</Text>
            </View>
            {cubren.map((r) => (
              <View key={r.id} style={s.ruta}>
                <Text style={s.rutaNom}>{r.nombre}</Text>
                <Text style={s.rutaSub}>{nombreTipoRuta(r.tipo)}</Text>
                <Text style={s.rutaSub}>Pasa: {r.dias.join(", ")}</Text>
              </View>
            ))}
          </>
        )}

        {pin && cubren.length === 0 && (
          <>
            <View style={s.fila}>
              <Feather name="alert-circle" size={16} color="#DB652D" />
              <Text style={s.mal}>  Todavía no llegamos ahí</Text>
            </View>
            <Text style={s.vacio}>
              Tu domicilio queda fuera de las rutas actuales. Comunícate con
              nosotros para evaluar abrir una ruta en tu zona.
            </Text>
          </>
        )}
      </Tarjeta>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  vacio: { color: T.gris, fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  fila: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  ok: { color: T.verde, fontWeight: "700", fontSize: 14 },
  mal: { color: "#DB652D", fontWeight: "700", fontSize: 14 },
  ruta: { borderTopWidth: 1, borderTopColor: T.linea, paddingTop: 8, marginTop: 8 },
  rutaNom: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  rutaSub: { color: T.gris, fontSize: 12.5, marginTop: 2 },
});
```

`EncabezadoPantalla` is defined in `App IOS/src/ui.js:50` as `({ titulo, sub })` — the
second prop is `sub`, not `subtitulo`. Keep it that way.

- [ ] **Step 5: Register the screen and add the menu entry**

In `App IOS/App.js`, inside the client stack (`AppInterno`, the native-stack that wraps the tabs — the same one holding Reportes, Documentos and Cotizador), add:

```javascript
<Stack.Screen name="Cobertura" component={Cobertura} options={{ title: "Cobertura" }} />
```

Import it at the top: `import Cobertura from "./src/pantallas/Cobertura";`

In `App IOS/src/pantallas/Mas.js`, add an entry to the hub list that navigates to `"Cobertura"`, copying the exact shape of the existing Reportes/Documentos/Cotizador entries (same icon component, same row markup). Use the Feather icon `"map"`.

- [ ] **Step 6: Mirror everything to Android**

```bash
for f in rutas-datos.js punto-en-zona.js MapaWeb.js pantallas/Cobertura.js pantallas/Mas.js; do
  cp "App IOS/src/$f" "App Android/src/$f"
done
cp "App IOS/App.js" "App Android/App.js"
cp "App IOS/package.json" "App Android/package.json"
```

- [ ] **Step 7: Verify the bundle**

```bash
cd "App IOS" && npx expo export --platform android --output-dir dist-check
```

Expected: `Exported: dist-check` with no errors. Then `rm -rf dist-check`.

A bundle that builds does not prove the map renders — WebView content only shows on a real device. Tell Luis to open it in Expo Go and confirm the map draws and tapping it moves the pin.

- [ ] **Step 8: Commit**

```bash
git add "App IOS/src" "App IOS/App.js" "App IOS/package.json" "App IOS/package-lock.json" "App Android/src" "App Android/App.js" "App Android/package.json"
git commit -m "App: pantalla de cobertura con mapa Leaflet en WebView"
```

---

### Task 11: Alta de cliente con facturación

La puerta de entrada: un prospecto llena sus datos, pone su pin y el sistema le dice en
el momento si ya hay ruta por ahí. Si la hay, queda inscrito; si no, su solicitud cae en
la bandeja de zonas pedidas de la Task 8.

**Ojo con el guardián de sesión.** `Web/app/(portal)/layout.js` mete todo lo que cuelga
de `/portal` dentro de `PortalShell`, que **redirige a `/portal/login` si no hay sesión**.
La única excepción hoy es el propio login. Esta pantalla la usa quien **todavía no es
cliente**, así que hay que exentarla igual que al login o nadie podrá verla.

**Files:**
- Create: `Web/app/(portal)/portal/alta/page.js`
- Modify: `Web/app/(portal)/layout.js` (exentar `/portal/alta` del shell)
- Modify: `Web/app/(portal)/portal/login/page.js` (enlace "Date de alta")
- Modify: `Web/app/(portal)/portal.css` (estilos del alta)

**Interfaces:**
- Consumes: `MapaZonas`; `rutasQueCubren` de `punto-en-zona.mjs`; `RUTAS_SEED`,
  `ZONAS_PEDIDAS_SEED`, `USOS_CFDI`, `FORMAS_PAGO`, `FRECUENCIAS_SUSCRIPCION`,
  `nombreTipoRuta`, `idZonaPedida` de `rutas-datos.js`; `EQUIPO_RENTA` de
  `cotizacion-datos.js`; `TIPOS_SERVICIO` de `datos.js`
- Produces: ruta pública `/portal/alta`

**⚠️ Constraint que manda en esta tarea:** el formulario **no pide banco, cuenta, CLABE
ni tarjeta**. Solo RFC, razón social, domicilio fiscal, uso de CFDI y forma de pago
preferida. Si alguien agrega un campo bancario "para que esté completo", está
introduciendo una obligación de la LFPDPPP sin ningún beneficio: Morcast cobra a su
propia cuenta.

- [ ] **Step 1: Exempt the page from the session guard**

Open `Web/app/(portal)/layout.js` and widen the exception. Queda así:

```javascript
export default function PortalLayout({ children }) {
  const ruta = usePathname();
  // El login y el alta los usa gente SIN sesión: van fuera del shell protegido.
  if (ruta === "/portal/login" || ruta === "/portal/alta") {
    return <div className="pt-body">{children}</div>;
  }
  return <PortalShell>{children}</PortalShell>;
}
```

- [ ] **Step 2: Create the page**

Create `Web/app/(portal)/portal/alta/page.js`:

```javascript
"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { FiCheckCircle, FiAlertCircle, FiMapPin, FiArrowRight } from "react-icons/fi";
import {
  RUTAS_SEED,
  ZONAS_PEDIDAS_SEED,
  USOS_CFDI,
  FORMAS_PAGO,
  FRECUENCIAS_SUSCRIPCION,
  nombreTipoRuta,
  idZonaPedida,
} from "@/lib/rutas-datos";
import { rutasQueCubren } from "@/lib/punto-en-zona.mjs";
import { EQUIPO_RENTA } from "@/lib/cotizacion-datos";
import { TIPOS_SERVICIO } from "@/lib/datos";

// Leaflet solo corre en el navegador.
const MapaZonas = dynamic(() => import("@/components/MapaZonas"), {
  ssr: false,
  loading: () => <div className="mc-mapa" style={{ height: 420 }} />,
});

const VACIO = {
  empresa: "",
  contacto: "",
  telefono: "",
  correo: "",
  alias: "",
  calle: "",
  colonia: "",
  cp: "",
  referencias: "",
  frecuencia: FRECUENCIAS_SUSCRIPCION[0],
  rfc: "",
  razonSocial: "",
  domicilioFiscal: "",
  usoCFDI: USOS_CFDI[0],
  formaPago: FORMAS_PAGO[0],
};

/** Formato de RFC: 12 caracteres persona moral, 13 persona física. No valida ante el SAT. */
const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;

/**
 * Alta de cliente. Pantalla PÚBLICA: la usa quien todavía no tiene sesión, por eso
 * está exenta del shell protegido en `app/(portal)/layout.js`.
 *
 * DEMO: nada persiste. Al recargar se pierde el alta.
 *
 * ⚠️ No se piden datos bancarios del cliente. Ver el constraint del plan.
 */
export default function AltaCliente() {
  const [datos, setDatos] = useState(VACIO);
  const [pin, setPin] = useState(null);
  const [residuos, setResiduos] = useState([]);
  const [equipo, setEquipo] = useState({}); // "Tolvas|30" -> cantidad
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  const campo = (k) => (e) => setDatos({ ...datos, [k]: e.target.value });

  const zonas = useMemo(
    () =>
      RUTAS_SEED.filter((r) => r.activa).map((r) => ({
        id: r.id,
        nombre: `${r.nombre} · ${nombreTipoRuta(r.tipo)}`,
        poligono: r.zona,
      })),
    []
  );

  // Se recalcula mientras mueve el pin: la respuesta es inmediata, sin enviar nada.
  const cubren = useMemo(() => (pin ? rutasQueCubren(pin, RUTAS_SEED) : []), [pin]);

  const alternarResiduo = (t) =>
    setResiduos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const cantidadEquipo = (tipo, medida, valor) => {
    const n = Math.max(0, Number(valor) || 0);
    setEquipo((prev) => ({ ...prev, [`${tipo}|${medida}`]: n }));
  };

  const enviar = (e) => {
    e.preventDefault();
    setError("");

    if (!pin) {
      setError("Falta marcar el domicilio en el mapa.");
      return;
    }
    if (!residuos.length) {
      setError("Elige al menos un tipo de residuo.");
      return;
    }
    if (!RFC_RE.test(datos.rfc.trim())) {
      setError("El RFC no tiene el formato correcto (12 o 13 caracteres).");
      return;
    }

    const equipoElegido = Object.entries(equipo)
      .filter(([, n]) => n > 0)
      .map(([clave, cantidad]) => {
        const [tipo, medida] = clave.split("|");
        return { tipo, medida, cantidad };
      });

    if (cubren.length) {
      setResultado({ tipo: "suscripcion", rutas: cubren, equipo: equipoElegido });
    } else {
      setResultado({
        tipo: "zona-pedida",
        id: idZonaPedida(ZONAS_PEDIDAS_SEED),
        equipo: equipoElegido,
      });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="pt-alta">
      <header className="pt-alta-cab">
        <div>
          <Image
            src="/img/logo-h-blanco.png"
            alt="Morcast del Norte"
            width={688}
            height={200}
            style={{ height: 52, width: "auto" }}
            priority
          />
          <h1>Date de alta</h1>
          <p>
            Marca dónde recogemos y te decimos en el momento si ya pasamos por tu zona.
          </p>
        </div>
        <Link href="/portal/login" className="pt-btn">
          Ya soy cliente
        </Link>
      </header>

      {resultado ? (
        <div className="pt-card">
          {resultado.tipo === "suscripcion" ? (
            <>
              <div className="pt-exito">
                <FiCheckCircle aria-hidden="true" />
                <div>
                  <strong>Solicitud de alta recibida</strong>
                  <span>
                    Tu domicilio queda dentro de{" "}
                    {resultado.rutas.length === 1 ? "una ruta" : "varias rutas"}. Morcast
                    revisa el alta y te confirma el día de arranque.
                  </span>
                </div>
              </div>
              {resultado.rutas.map((r) => (
                <div
                  key={r.id}
                  style={{
                    borderTop: "1px solid var(--mc-linea)",
                    paddingTop: "0.7rem",
                    marginTop: "0.7rem",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{r.nombre}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: 4 }}>
                    {nombreTipoRuta(r.tipo)} · pasa {r.dias.join(", ")}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="pt-exito" style={{ background: "rgba(219,101,45,0.12)", borderColor: "rgba(219,101,45,0.35)" }}>
              <FiAlertCircle aria-hidden="true" />
              <div>
                <strong>Registramos tu zona ({resultado.id})</strong>
                <span>
                  Todavía no hay ruta por ahí. Tu solicitud entra a evaluación para abrir
                  una nueva y te buscamos con la respuesta.
                </span>
              </div>
            </div>
          )}

          <p className="pt-nota-demo" style={{ marginTop: "1.2rem" }}>
            Demostración: el alta no se guarda. Al recargar la página se reinicia.
          </p>
          <button
            type="button"
            className="pt-btn"
            onClick={() => {
              setResultado(null);
              setDatos(VACIO);
              setPin(null);
              setResiduos([]);
              setEquipo({});
            }}
          >
            Dar de alta otro domicilio
          </button>
        </div>
      ) : (
        <form onSubmit={enviar}>
          <div className="pt-grid pt-grid-mapa">
            {/* ---------- Columna del mapa ---------- */}
            <div className="pt-card">
              <div className="pt-card-head">
                <h2>¿Dónde recogemos?</h2>
              </div>
              <MapaZonas zonas={zonas} pin={pin} onPin={setPin} alto="440px" />
              <p className="mc-mapa-nota">
                <FiMapPin aria-hidden="true" /> Toca el mapa para colocar tu domicilio.
              </p>

              {pin && cubren.length > 0 && (
                <p
                  style={{
                    color: "var(--mc-verde-claro)",
                    fontWeight: 700,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginTop: "0.6rem",
                  }}
                >
                  <FiCheckCircle aria-hidden="true" /> Sí llegamos:{" "}
                  {cubren.map((r) => r.nombre).join(", ")}
                </p>
              )}
              {pin && cubren.length === 0 && (
                <p
                  style={{
                    color: "#f0895c",
                    fontWeight: 700,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginTop: "0.6rem",
                  }}
                >
                  <FiAlertCircle aria-hidden="true" /> Aún no hay ruta ahí. Puedes seguir:
                  tu alta entra como solicitud de zona nueva.
                </p>
              )}

              <div className="pt-card-head" style={{ marginTop: "1.4rem" }}>
                <h2>Domicilio</h2>
              </div>
              <div className="pt-campo">
                <label htmlFor="alias">Nombre del domicilio</label>
                <input id="alias" className="pt-input" value={datos.alias} onChange={campo("alias")} placeholder="Planta 1, Matriz, Sucursal centro…" required />
              </div>
              <div className="pt-campo">
                <label htmlFor="calle">Calle y número</label>
                <input id="calle" className="pt-input" value={datos.calle} onChange={campo("calle")} required />
              </div>
              <div className="pt-grid pt-grid-2">
                <div className="pt-campo">
                  <label htmlFor="colonia">Colonia</label>
                  <input id="colonia" className="pt-input" value={datos.colonia} onChange={campo("colonia")} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="cp">Código postal</label>
                  <input id="cp" className="pt-input" inputMode="numeric" maxLength={5} value={datos.cp} onChange={campo("cp")} required />
                </div>
              </div>
              <div className="pt-campo">
                <label htmlFor="referencias">Referencias para el chofer</label>
                <input id="referencias" className="pt-input" value={datos.referencias} onChange={campo("referencias")} placeholder="Portón azul, entrada por el andén…" />
              </div>
            </div>

            {/* ---------- Columna de datos ---------- */}
            <div>
              <div className="pt-card">
                <div className="pt-card-head">
                  <h2>Contacto</h2>
                </div>
                <div className="pt-campo">
                  <label htmlFor="empresa">Empresa o negocio</label>
                  <input id="empresa" className="pt-input" value={datos.empresa} onChange={campo("empresa")} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="contacto">Persona de contacto</label>
                  <input id="contacto" className="pt-input" value={datos.contacto} onChange={campo("contacto")} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="telefono">Teléfono</label>
                  <input id="telefono" className="pt-input" type="tel" value={datos.telefono} onChange={campo("telefono")} placeholder="868 000 0000" required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="correo">Correo</label>
                  <input id="correo" className="pt-input" type="email" value={datos.correo} onChange={campo("correo")} required />
                </div>
              </div>

              <div className="pt-card" style={{ marginTop: "1.1rem" }}>
                <div className="pt-card-head">
                  <h2>Qué generas</h2>
                </div>
                <div className="pt-checks">
                  {TIPOS_SERVICIO.map((t) => (
                    <label key={t}>
                      <input
                        type="checkbox"
                        checked={residuos.includes(t)}
                        onChange={() => alternarResiduo(t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>

                <div className="pt-campo" style={{ marginTop: "1.1rem" }}>
                  <label htmlFor="frecuencia">Frecuencia de recolección</label>
                  <select id="frecuencia" className="pt-input" value={datos.frecuencia} onChange={campo("frecuencia")}>
                    {FRECUENCIAS_SUSCRIPCION.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-card" style={{ marginTop: "1.1rem" }}>
                <div className="pt-card-head">
                  <h2>Equipo que necesitas</h2>
                </div>
                {EQUIPO_RENTA.map((e) => (
                  <div key={e.tipo} className="pt-equipo-fila">
                    <span>{e.tipo}</span>
                    {e.medidas.map((m) => (
                      <label key={m} className="pt-equipo-med">
                        {m}
                        <input
                          className="pt-input"
                          type="number"
                          min="0"
                          max="20"
                          value={equipo[`${e.tipo}|${m}`] ?? 0}
                          onChange={(ev) => cantidadEquipo(e.tipo, m, ev.target.value)}
                          aria-label={`${e.tipo} ${m}`}
                        />
                      </label>
                    ))}
                  </div>
                ))}
                <p className="mc-mapa-nota">Déjalo en cero si aún no lo sabes.</p>
              </div>

              <div className="pt-card" style={{ marginTop: "1.1rem" }}>
                <div className="pt-card-head">
                  <h2>Facturación</h2>
                </div>
                <div className="pt-campo">
                  <label htmlFor="razonSocial">Razón social</label>
                  <input id="razonSocial" className="pt-input" value={datos.razonSocial} onChange={campo("razonSocial")} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="rfc">RFC</label>
                  <input id="rfc" className="pt-input" value={datos.rfc} onChange={campo("rfc")} style={{ textTransform: "uppercase" }} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="domicilioFiscal">Domicilio fiscal</label>
                  <input id="domicilioFiscal" className="pt-input" value={datos.domicilioFiscal} onChange={campo("domicilioFiscal")} required />
                </div>
                <div className="pt-campo">
                  <label htmlFor="usoCFDI">Uso de CFDI</label>
                  <select id="usoCFDI" className="pt-input" value={datos.usoCFDI} onChange={campo("usoCFDI")}>
                    {USOS_CFDI.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-campo">
                  <label htmlFor="formaPago">Forma de pago preferida</label>
                  <select id="formaPago" className="pt-input" value={datos.formaPago} onChange={campo("formaPago")}>
                    {FORMAS_PAGO.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                {/* No se piden banco, cuenta ni CLABE del cliente: Morcast cobra a su
                    propia cuenta y guardarlos solo agrega riesgo. */}
                <p className="mc-mapa-nota">
                  No te pedimos banco, cuenta ni CLABE. El cobro se hace contra tu factura.
                </p>
              </div>

              {error && <div className="pt-login-error" style={{ marginTop: "1.1rem" }}>{error}</div>}

              <button
                type="submit"
                className="pt-btn pt-btn-verde"
                style={{ width: "100%", justifyContent: "center", padding: "0.85rem", marginTop: "1.1rem" }}
              >
                Enviar solicitud de alta <FiArrowRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the styles**

Append to `Web/app/(portal)/portal.css`:

```css
/* ---------- Alta de cliente (pantalla pública, sin shell) ---------- */
.pt-alta {
  max-width: 1120px;
  margin: 0 auto;
  padding: 2rem 1.2rem 3rem;
}
.pt-alta-cab {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.6rem;
}
.pt-alta-cab h1 { font-size: 1.7rem; margin: 0.9rem 0 0.25rem; }
.pt-alta-cab p { color: var(--mc-gris); margin: 0; font-size: 0.92rem; }

.pt-checks { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem 1rem; }
.pt-checks label {
  display: flex; gap: 0.5rem; align-items: flex-start;
  font-size: 0.86rem; color: var(--mc-tinta); cursor: pointer;
}
.pt-checks input { margin-top: 3px; flex-shrink: 0; }

.pt-equipo-fila {
  display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
  padding: 0.6rem 0; border-top: 1px solid var(--mc-linea);
}
.pt-equipo-fila:first-of-type { border-top: 0; padding-top: 0; }
.pt-equipo-fila > span { font-weight: 600; font-size: 0.88rem; min-width: 116px; }
.pt-equipo-med {
  display: flex; align-items: center; gap: 0.4rem;
  font-size: 0.82rem; color: var(--mc-gris);
}
/* Más específico que .pt-input, y va después: gana sin !important. */
.pt-equipo-med input { width: 62px; padding: 0.35rem 0.4rem; text-align: center; }

@media (max-width: 575.98px) {
  .pt-checks { grid-template-columns: 1fr; }
  .pt-equipo-fila > span { min-width: 100%; }
}
```

- [ ] **Step 4: Link it from the login screen**

Open `Web/app/(portal)/portal/login/page.js`. Justo después de la etiqueta de cierre
`</form>` y antes del `<Link href="/admin/login" …>`, agrega:

```jsx
<p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: "1.1rem" }}>
  ¿Aún no eres cliente? <Link href="/portal/alta" style={{ color: "var(--mc-verde-claro)", fontWeight: 600 }}>Date de alta</Link>
</p>
```

`Link` ya está importado en ese archivo; no agregues el import otra vez.

- [ ] **Step 5: Build and open the page without a session**

```bash
cd Web && npm run build && npx next start -p 3456
```

En otra terminal:

```bash
B="$HOME/.claude/skills/gstack/browse/dist/browse"
$B goto http://localhost:3456/portal/alta
$B js "location.pathname"
```

Expected: `/portal/alta`. **Si devuelve `/portal/login`, el Step 1 no quedó**: el shell
sigue interceptando la ruta.

```bash
$B console --errors
$B screenshot /tmp/alta.png
```

Expected: sin errores en consola y el mapa dibujado con sus 3 polígonos.

- [ ] **Step 6: Verify both outcomes**

Con cobertura — clic dentro de un polígono, llenar y enviar:

```bash
$B fill "#empresa" "Maquilas del Bravo"
$B fill "#contacto" "Norma Cantú"
$B fill "#telefono" "868 111 2233"
$B fill "#correo" "ncantu@maquilasdelbravo.mx"
$B fill "#alias" "Planta 1"
$B fill "#calle" "Av. Industrial 45"
$B fill "#colonia" "Parque Industrial"
$B fill "#cp" "87316"
$B fill "#razonSocial" "Maquilas del Bravo, S.A. de C.V."
$B fill "#rfc" "MBR190320AB4"
$B fill "#domicilioFiscal" "Av. Industrial 45, Matamoros"
$B js "document.querySelector('.pt-checks input').click()"
```

Coloca el pin haciendo clic dentro de la Ruta Centro y envía. Luego:

```bash
$B js "document.body.innerText.includes('Solicitud de alta recibida')"
```

Expected: `true`, y abajo el nombre de la ruta con sus días.

Sin cobertura — repetir con el pin lejos (esquina superior derecha del mapa):

```bash
$B js "document.body.innerText.includes('Registramos tu zona')"
```

Expected: `true`, con un id tipo `ZP-005`.

- [ ] **Step 7: Verify the validations and that nothing bank-related leaked in**

```bash
$B goto http://localhost:3456/portal/alta
$B js "document.body.innerText.match(/CLABE|banco|Banco|cuenta bancaria|tarjeta/g)"
```

Expected: solo la leyenda "No te pedimos banco, cuenta ni CLABE…". **Ningún `<input>`
puede pedir esos datos** — si aparece uno, se violó el constraint.

Envía el formulario con un RFC mal formado (`ABC`) y confirma que sale
"El RFC no tiene el formato correcto". Envía sin pin y confirma "Falta marcar el
domicilio en el mapa".

- [ ] **Step 8: Check it on a phone-sized viewport**

```bash
$B viewport 390x844
$B goto http://localhost:3456/portal/alta
$B js "document.documentElement.scrollWidth"
```

Expected: **404 o menos** (404 es el desborde base del sitio). Si sale más, lo introdujo
esta pantalla — casi siempre es el mapa o un `gridTemplateColumns` en línea.

- [ ] **Step 9: Commit**

```bash
git add "Web/app/(portal)/portal/alta/page.js" "Web/app/(portal)/layout.js" \
        "Web/app/(portal)/portal/login/page.js" "Web/app/(portal)/portal.css"
git commit -m "Portal: alta de cliente con pin en el mapa y datos de facturacion"
```

---

## Verificación final

- [ ] `cd Web && node --test tests/punto-en-zona.test.mjs` — 6 pruebas en verde
- [ ] `cd Web && npm run build` — sin errores, con las 6 rutas nuevas (`/portal/alta`, `/portal/cobertura`, `/portal/agendar`, `/admin/rutas`, `/admin/recolecciones`, `/admin/zonas-pedidas`)
- [ ] `cd "App IOS" && npx expo export --platform android --output-dir dist-check` — sin errores
- [ ] `/portal/alta` abre **sin sesión** y `/portal/cobertura` **sigue redirigiendo** a login sin sesión
- [ ] Recorrido completo en el navegador: alta fuera de zona → aparece en `/admin/zonas-pedidas`; alta dentro de zona → cliente ve cobertura → agenda → admin confirma → aparece en `/admin/servicios`
- [ ] Ningún formulario pide banco, cuenta, CLABE ni tarjeta del cliente
- [ ] A 390px de ancho, `document.documentElement.scrollWidth` no debe pasar de 404 en las páginas nuevas (404 es el desborde base del sitio; más que eso lo introdujo el código nuevo)
- [ ] `git log --oneline origin/main..HEAD` muestra los commits, y `git remote -v` sigue con la URL de push saboteada

## Entregable extra pedido el 7-ago-2026: Manual de usuario en PDF

Luis pidió un **manual de usuario para la empresa** que cubra TODAS las funciones del
panel: cómo dibujar las rutas en el mapa, cómo dar de alta una ruta nueva, y todo lo
demás, para que Morcast tenga a quién preguntarle cuando les surja una duda.

- Se va escribiendo sobre la marcha en `docs/manual-empresa.md`, **una sección por
  pantalla, al terminar cada tarea** (así se redacta con la pantalla fresca).
- Al final se convierte a PDF con la skill `/make-pdf`.
- Está redactado para alguien que NO es técnico: nada de "polígono", "estado" ni
  "componente".

## Lo que queda pendiente de terceros

- **Morcast debe dibujar sus zonas reales.** Las tres del plan son de muestra.
- Lista de precios, RFC y CLABE siguen sin llegar.
- Al ser demo, nada persiste. Conectar Supabase es la Fase 4.
