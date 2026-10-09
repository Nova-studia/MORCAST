import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PERMISOS_DE_ROL } from "../lib/permisos.mjs";

/**
 * Las acciones del panel y las rutas de la app usan la llave de servicio, que
 * salta la base: si una se queda sin sección, cualquier admin la puede usar
 * aunque su rol no la incluya. Esta prueba lee el código y lo exige.
 */
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const leer = (p) => fs.readFileSync(path.join(WEB, p), "utf8");
const secciones = (texto) => [...texto.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

test("ninguna acción del panel pide 'personal' a secas", () => {
  // Las de app/ y las que viven junto a su pantalla (app/(admin)/admin/*/acciones.js).
  const admin = path.join(WEB, "app/(admin)/admin");
  const archivos = [
    ...fs.readdirSync(path.join(WEB, "app")).filter((x) => /^acciones-.*\.js$/.test(x)).map((x) => `app/${x}`),
    ...fs.readdirSync(admin, { withFileTypes: true }).filter((d) => d.isDirectory())
      .map((d) => `app/(admin)/admin/${d.name}/acciones.js`).filter((f) => fs.existsSync(path.join(WEB, f))),
  ];
  for (const f of archivos) {
    const s = leer(f);
    assert.ok(!/const PERSONAL = \["dueno", "admin"\]/.test(s), `${f}: todavía usa PERSONAL a secas`);
    assert.ok(!/await exigirPersonal\(\)/.test(s), `${f}: exigirPersonal() sin sección`);
    for (const m of s.matchAll(/exigir(?:Personal|Seccion)\(([^)]+)\)/g)) {
      if (m[1] === "seccion") continue;
      for (const sec of secciones(m[1])) assert.ok(PERMISOS_DE_ROL.includes(sec), `${f}: sección "${sec}" no existe`);
    }
  }
});

test("toda ruta de administración de la app pide su sección", () => {
  const raiz = path.join(WEB, "app/api/app");
  const rutas = [];
  const andar = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) =>
    e.isDirectory() ? andar(path.join(d, e.name)) : e.name === "route.js" && rutas.push(path.join(d, e.name)));
  andar(raiz);
  let vistas = 0;
  for (const r of rutas) {
    const s = fs.readFileSync(r, "utf8");
    if (!s.includes("entrarAppAdmin(")) continue;
    vistas++;
    const m = s.match(/entrarAppAdmin\(peticion,\s*\{([\s\S]*?)\n\s*\}\)/);
    const ok = m && (/permiso:\s*(\[[^\]]+\]|"[a-z_]+")/.test(m[1]) || /soloDueno:\s*true/.test(m[1]));
    assert.ok(ok, `${path.relative(WEB, r)}: entrarAppAdmin sin permiso`);
  }
  assert.ok(vistas >= 19, `solo vi ${vistas} rutas de administración`);
});
