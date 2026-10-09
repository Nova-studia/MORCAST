import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Un componente usado en JSX y nunca importado no truena al compilar: truena
 * cuando el cliente llega a esa rama (p. ej. <ErrorCarga/> solo cuando falla
 * la red). Esta prueba lo busca en las páginas y componentes del portal y del
 * panel (revisión final de la Entrega 4).
 */
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archivos = [];
const andar = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) andar(p);
  else if (/\.(js|jsx)$/.test(e.name)) archivos.push(p);
});
for (const d of ["app/(portal)", "app/(admin)", "app/(chofer)", "components/portal", "components/admin", "components/cuenta"]) andar(path.join(WEB, d));

test("todo componente que se usa en JSX está importado o definido en su archivo", () => {
  const faltan = [];
  for (const f of archivos) {
    // Sin comentarios: ahí se nombra "<Componente>" para explicar, no se usa.
    const s = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const usados = new Set([...s.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)].map((m) => m[1]));
    for (const nombre of usados) {
      const enImport = [...s.matchAll(/import\s[^;]*?from\s*["'][^"']+["']/g)].some((m) => new RegExp(`\\b${nombre}\\b`).test(m[0]));
      const declarado = enImport || new RegExp(`(function ${nombre}\\b|const ${nombre}\\b|class ${nombre}\\b|let ${nombre}\\b)`).test(s);
      if (!declarado) faltan.push(`${path.relative(WEB, f)}: <${nombre}>`);
    }
  }
  assert.deepEqual(faltan, []);
});
