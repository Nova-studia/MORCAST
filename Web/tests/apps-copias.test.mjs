import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Las apps usan COPIAS de la lógica pura de la web (src/web/*.mjs), para que
 * las reglas sean las mismas en los dos lados (9-oct-2026, apps al 100%). Si
 * alguien cambia la web y no vuelve a copiar, esto truena.
 */
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sinCabecera = (s) => s.replace(/\r\n/g, "\n").split("\n").slice(2).join("\n");

test("las copias de las apps son iguales a la web", () => {
  for (const app of ["App IOS", "App Android"]) {
    const dir = path.join(RAIZ, app, "src", "web");
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".mjs"))) {
      const web = fs.readFileSync(path.join(RAIZ, "Web", "lib", f), "utf8").replace(/\r\n/g, "\n");
      const copia = sinCabecera(fs.readFileSync(path.join(dir, f), "utf8"));
      assert.equal(copia, web, `${app}/src/web/${f} se quedó atrás de Web/lib/${f}: vuelve a copiarla`);
    }
  }
});
