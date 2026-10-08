/**
 * Hallazgos de la revisión final de la 1.1.1 (8-oct-2026). Pruebas de
 * configuración: leen el código porque lo que se protege es CÓMO está armado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nombreDeCuenta } from "../lib/cuenta-apple.mjs";

const leer = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const lista = (texto, nombre) => {
  const desde = texto.indexOf(`${nombre} = [`);
  assert.ok(desde >= 0, `no encontré ${nombre}`);
  const bloque = texto.slice(desde, texto.indexOf("];", desde));
  return [...bloque.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
};

test("toda página abierta del portal también va SIN el shell (si no, el shell la manda al login)", () => {
  const abiertas = lista(leer("proxy.js"), "ABIERTAS").filter((r) => r.startsWith("/portal/"));
  const sinShell = lista(leer("app/(portal)/layout.js"), "SIN_SHELL");
  for (const r of abiertas) assert.ok(sinShell.includes(r), `${r} está en ABIERTAS pero no en SIN_SHELL`);
});

test("/portal/entrar cierra SOLO la sesión de ese navegador, y solo si trae token", () => {
  const p = leer("app/(portal)/portal/entrar/page.js");
  assert.match(p, /signOut\(\{\s*scope:\s*"local"\s*\}\)/);
  assert.doesNotMatch(p, /auth\.signOut\(\)/);
  assert.ok(p.indexOf("if (!th)") < p.indexOf("signOut("), "el signOut va después de revisar el token");
});

test("salir del portal web no tumba la sesión de la app (scope local)", () => {
  const p = leer("lib/portal-sesion.js");
  const salir = p.slice(p.indexOf("export async function cerrarSesion"));
  assert.match(salir.slice(0, 600), /signOut\(\{\s*scope:\s*"local"\s*\}\)/);
});

test("el nombre de la cuenta se toma de donde lo guarde Apple, Google o la app", () => {
  assert.equal(nombreDeCuenta({ full_name: "Ana Pérez" }), "Ana Pérez");
  assert.equal(nombreDeCuenta({ name: "Ana G" }), "Ana G");
  assert.equal(nombreDeCuenta({ nombre: "Ana App" }), "Ana App");
  assert.equal(nombreDeCuenta({}), "");
  assert.equal(nombreDeCuenta(null), "");
});
