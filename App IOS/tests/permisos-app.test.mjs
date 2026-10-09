import { test } from "node:test";
import assert from "node:assert/strict";
import { SECCION_DE_PANTALLA, puedeVer, pantallasVisibles } from "../src/permisos-app.mjs";
import { PERMISOS_DE_ROL } from "../src/web/permisos.mjs";

test("toda pantalla de administración con sección pide una que existe", () => {
  for (const [p, s] of Object.entries(SECCION_DE_PANTALLA)) {
    for (const x of [].concat(s)) assert.ok(PERMISOS_DE_ROL.includes(x), `${p}: ${x}`);
  }
});

test("el dueño ve todo; un admin solo lo de su rol; el Panel y Mi cuenta, todos", () => {
  const dueno = { rol: "dueno", permisos: [] };
  const caja = { rol: "admin", permisos: ["saldos", "clientes"] };
  assert.equal(puedeVer(dueno, "Usuarios"), true);
  assert.equal(puedeVer(caja, "Saldos"), true);
  assert.equal(puedeVer(caja, "Usuarios"), false);
  assert.equal(puedeVer(caja, "Panel"), true);
  assert.equal(puedeVer(caja, "MiCuenta"), true);
  assert.equal(puedeVer({ rol: "admin", permisos: ["rutas"] }, "Puntos"), true, "Puntos: rutas o clientes");
  assert.deepEqual(pantallasVisibles(caja, ["Panel", "Saldos", "Usuarios", "Clientes"]), ["Panel", "Saldos", "Clientes"]);
});

test("sin permisos cargados (null) no se enseña nada que pida sección", () => {
  assert.equal(puedeVer(null, "Saldos"), false);
  assert.equal(puedeVer(null, "Panel"), true);
});
