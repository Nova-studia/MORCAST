import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACCIONES_APP, ROLES_ZONA, LIBRES_DE_SECCION } from "../lib/app-acciones-mapa.mjs";
import { PERMISOS_DE_ROL } from "../lib/permisos.mjs";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("toda acción de administración pide una sección que existe (salvo las libres, a propósito)", () => {
  for (const [nombre, d] of Object.entries(ACCIONES_APP)) {
    assert.ok(ROLES_ZONA[d.zona] || d.zona === "admin", `${nombre}: zona desconocida ${d.zona}`);
    if (d.zona !== "admin") continue;
    if (LIBRES_DE_SECCION.includes(nombre)) continue;
    assert.ok(PERMISOS_DE_ROL.includes(d.permiso), `${nombre}: sin sección válida (${d.permiso})`);
  }
  assert.deepEqual([...LIBRES_DE_SECCION].sort(), ["mis-permisos", "puente-admin"]);
});

test("toda acción tiene freno y su manejador en el servidor", () => {
  const servidor = fs.readFileSync(path.join(WEB, "lib/app-acciones.js"), "utf8");
  for (const [nombre, d] of Object.entries(ACCIONES_APP)) {
    assert.ok(d.freno && d.freno.maximo > 0 && d.freno.minutos > 0, `${nombre}: sin freno`);
    assert.ok(servidor.includes(`"${nombre}":`), `${nombre}: sin manejador en lib/app-acciones.js`);
  }
});

test("los nombres son seguros para la URL", () => {
  for (const nombre of Object.keys(ACCIONES_APP)) assert.match(nombre, /^[a-z][a-z-]+$/);
});

test("el pase del puente no sirve como pase normal ni dura más de 2 minutos", async () => {
  const { firmarPase, verificarPase } = await import("../lib/mfa.mjs");
  const ahora = Math.floor(Date.now() / 1000);
  const pp = await firmarPase({ uid: "u1", sesion: "puente", vence: ahora + 120 }, "secreto");
  assert.equal(await verificarPase(pp, { uid: "u1", sesion: "puente" }, "secreto"), true);
  assert.equal(await verificarPase(pp, { uid: "u1", sesion: "sesion-real-123" }, "secreto"), false, "no abre una sesión normal");
  assert.equal(await verificarPase(pp, { uid: "u2", sesion: "puente" }, "secreto"), false, "no sirve para otro usuario");
  assert.equal(await verificarPase(pp, { uid: "u1", sesion: "puente", ahora: ahora + 121 }, "secreto"), false, "caduca");
});

test("el puente solo abre pantallas del panel de una lista cerrada", async () => {
  const { destinoPanel } = await import("../lib/app-acciones-mapa.mjs");
  assert.equal(destinoPanel("/admin/rutas"), "/admin/rutas");
  assert.equal(destinoPanel("https://evil.com"), "/admin");
  assert.equal(destinoPanel("/admin/usuarios"), "/admin");
});

// ---- Revisión de la web (apps al 100%) ----
test("revisión: el personal necesita el segundo paso también para su contraseña", async () => {
  const { exigePase } = await import("../lib/app-acciones-mapa.mjs");
  assert.equal(exigePase({ zona: "cuenta", rol: "admin" }), true);
  assert.equal(exigePase({ zona: "cuenta", rol: "dueno" }), true);
  assert.equal(exigePase({ zona: "cuenta", rol: "operador" }), false);
  assert.equal(exigePase({ zona: "cuenta", rol: "cliente" }), false);
  assert.equal(exigePase({ zona: "cliente", rol: "cliente" }), false);
});

test("revisión: el pase del puente queda amarrado a SU enlace (otro enlace no lo canjea)", async () => {
  const { marcaPuente } = await import("../lib/app-acciones-mapa.mjs");
  const a = await marcaPuente("token-a");
  assert.match(a, /^puente:[0-9a-f]{32}$/);
  assert.notEqual(a, await marcaPuente("token-b"));
  assert.equal(a, await marcaPuente("token-a"));
});
