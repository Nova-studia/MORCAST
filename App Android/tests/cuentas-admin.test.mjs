// Cuentas y catálogo de la administración (6-oct-2026). Las reglas de la app
// son ESPEJOS de la web: aquí se comparan contra las de `Web/lib/` para que,
// si alguien cambia una allá, esta prueba truene y avise que falta copiarla
// aquí (y en la otra app, donde `src/cuentas-admin` es idéntico).
import { test } from "node:test";
import assert from "node:assert/strict";

import * as app from "../src/cuentas-admin.js";
import * as webAdmin from "../../Web/lib/admin-app.mjs";
import * as webCliente from "../../Web/lib/estado-cliente.mjs";
import * as webEquipo from "../../Web/lib/equipo.mjs";
import * as webSectores from "../../Web/lib/sectores.mjs";
import * as webUnidades from "../../Web/lib/unidades.mjs";
import * as webMapas from "../../Web/lib/mapas.mjs";

test("los estados son los de la web", () => {
  assert.deepEqual(app.ESTADOS_ALTA, webAdmin.ESTADOS_ALTA);
  assert.deepEqual(app.ESTADOS_ZONA, webAdmin.ESTADOS_ZONA);
  assert.deepEqual(app.ESTADOS_UNIDAD, webUnidades.ESTADOS_UNIDAD);
  assert.deepEqual(app.TIPOS_UNIDAD, webUnidades.TIPOS_UNIDAD);
  assert.deepEqual(app.PLANES_CLIENTE, webAdmin.PLANES_CLIENTE);
  assert.deepEqual(app.ROLES_INVITABLES, webEquipo.ROLES_INVITABLES);
  assert.deepEqual(app.LIMITES_MATAMOROS, webSectores.LIMITES_MATAMOROS);
});

test("puedeRecibirAcceso dice lo mismo que la web", () => {
  const casos = [
    { tieneAcceso: true, correo: "" },
    { tieneAcceso: false, correo: "" },
    { tieneAcceso: false, correo: "N-A" },
    { tieneAcceso: false, correo: "—" },
    { tieneAcceso: false, correo: "ana@golfo.mx" },
    {},
  ];
  for (const c of casos) assert.deepEqual(app.puedeRecibirAcceso(c), webCliente.puedeRecibirAcceso(c), JSON.stringify(c));
  for (const c of [{ contacto: "Ana", telefono: "", correo: "n/a" }, {}]) {
    assert.deepEqual(app.loQueFalta(c), webCliente.loQueFalta(c));
  }
});

test("las reglas del equipo son las de la web", () => {
  const dueno = { id: "d", rol: "dueno" };
  const admin = { id: "a", rol: "admin" };
  const chofer = { id: "o", rol: "operador" };
  for (const quien of [dueno, admin, chofer, null]) {
    for (const rol of ["admin", "operador", "dueno", "x"]) {
      assert.equal(app.puedeDarRol(quien, rol), webEquipo.puedeDarRol(quien, rol));
    }
    for (const objetivo of [dueno, admin, chofer, { id: "c", rol: "cliente" }, { id: "a2", rol: "admin" }, null]) {
      assert.deepEqual(app.puedeCambiarActivo({ quien, objetivo }), webEquipo.puedeCambiarActivo({ quien, objetivo }));
    }
  }
});

test("estadoUbicacion es el de la web", () => {
  const puntos = [
    { lat: null, lng: null },
    { lat: 25.87, lng: -97.5, origen: "chofer", fecha: "2026-10-01" },
    { lat: 25.87, lng: -97.5, origen: null, fecha: "2026-10-06" },
    { lat: 25.87, lng: -97.5, origen: "panel", fecha: "2026-10-06" },
    { lat: 25.87, lng: -97.5 },
  ];
  for (const p of puntos) assert.deepEqual(app.estadoUbicacion(p), webSectores.estadoUbicacion(p));
});

test("dentroDeMatamoros, dirección y enlace al mapa como la web", () => {
  for (const [la, ln] of [[25.87, -97.5], [-97.5, 25.87], [19.4, -99.1], ["x", 1]]) {
    assert.equal(app.dentroDeMatamoros(la, ln), webSectores.dentroDeMatamoros(la, ln));
  }
  for (const p of [{ lat: 25.87, lng: -97.5 }, { calle: "Av. 1", colonia: "Centro", cp: "87300" }]) {
    assert.equal(app.direccionPunto(p), webMapas.direccionDe(p));
    assert.equal(app.enlaceVerPunto(p), webMapas.enlaceVerEnMapa(p));
  }
});

test("filtrarPuntos: por revisar, sin ruta, sector y texto", () => {
  const puntos = [
    { id: "1", empresa: "Golfo", alias: "Planta", lat: 25.87, lng: -97.5, origen: null, fecha: "2026-10-06", sectorId: "A", ruta: { clave: "RT-1" } },
    { id: "2", empresa: "Río Bravo", alias: "Nave", lat: null, lng: null, sectorId: null, ruta: null },
    { id: "3", empresa: "Hernández", alias: "Matriz", lat: 25.8, lng: -97.4, origen: "panel", sectorId: "B", ruta: { clave: null } },
  ];
  assert.deepEqual(app.filtrarPuntos(puntos, { filtro: "cliente" }).map((p) => p.id), ["1"]);
  assert.deepEqual(app.filtrarPuntos(puntos, { filtro: "sin" }).map((p) => p.id), ["2"]);
  assert.deepEqual(app.filtrarPuntos(puntos, { filtro: "sin-ruta" }).map((p) => p.id), ["2", "3"]);
  assert.deepEqual(app.filtrarPuntos(puntos, { sector: "ninguno" }).map((p) => p.id), ["2"]);
  assert.deepEqual(app.filtrarPuntos(puntos, { sector: "B" }).map((p) => p.id), ["3"]);
  assert.deepEqual(app.filtrarPuntos(puntos, { texto: "rio" }).map((p) => p.id), ["2"]);
});

test("revisarLecturaPin: en Matamoros, con aviso si la precisión es mala", () => {
  assert.equal(app.revisarLecturaPin(null).ok, false);
  assert.equal(app.revisarLecturaPin({ lat: 19.43, lng: -99.13, precision_m: 5 }).ok, false);
  const bien = app.revisarLecturaPin({ lat: 25.871234567, lng: -97.501234567, precision_m: 8 });
  assert.deepEqual(bien, { ok: true, pin: [25.871235, -97.501235], imprecisa: false, precision: 8 });
  assert.equal(app.revisarLecturaPin({ lat: 25.87, lng: -97.5, precision_m: 400 }).imprecisa, true);
});

test("recolecciones al mes: la misma regla que el servidor", () => {
  assert.equal(app.revisarServiciosPorMes("0").ok, false);
  assert.equal(app.revisarServiciosPorMes("201").ok, false);
  assert.equal(app.revisarServiciosPorMes("").ok, false);
  assert.deepEqual(app.revisarServiciosPorMes("8"), { ok: true, n: 8 });
});

test("el teléfono de WhatsApp no repite el 52", () => {
  assert.equal(app.telefonoWhatsApp("+52 868 384 9478"), "8683849478");
  assert.equal(app.telefonoWhatsApp("521 868 384 9478"), "8683849478");
  assert.equal(app.telefonoWhatsApp("868 384 9478"), "8683849478");
  // Un número local que empieza con 52 no se mocha.
  assert.equal(app.telefonoWhatsApp("5212345678"), "5212345678");
});

test("filtro de clientes por sector", () => {
  const c = [{ id: 1, sectores: [{ clave: "A" }] }, { id: 2, sectores: [] }, { id: 3, sectores: [{ clave: "A" }, { clave: "B" }] }];
  assert.deepEqual(app.filtrarClientesPorSector(c, "").map((x) => x.id), [1, 2, 3]);
  assert.deepEqual(app.filtrarClientesPorSector(c, "B").map((x) => x.id), [3]);
  assert.deepEqual(app.filtrarClientesPorSector(c, "ninguno").map((x) => x.id), [2]);
});

test("clases de insignia: las que no existen en la app caen a una que sí", () => {
  assert.equal(app.claseBadge("alerta"), "ruta");
  assert.equal(app.claseBadge(""), "none");
  assert.equal(app.claseBadge("ok"), "ok");
});

import { mensajeCuentaActivadaApple } from "../src/cuentas-admin.js";
test("cuenta de Apple activada: el WhatsApp no lleva contraseña y dice cómo entrar", () => {
  const m = mensajeCuentaActivadaApple();
  assert.match(m, /Ya me activaron/);
  assert.match(m, /Apple/);
  assert.doesNotMatch(m, /contraseña:|\/ /);
});
