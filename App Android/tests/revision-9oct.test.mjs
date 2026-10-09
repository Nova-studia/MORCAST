import { test } from "node:test";
import assert from "node:assert/strict";
import { crearCandado } from "../src/candado.mjs";
import { estadoChoferes } from "../src/rutas-admin.mjs";

// Revisión 9-oct: dos toques en el mismo cuadro pasaban la guarda del estado
// de React y creaban dos recolecciones. El candado vive fuera del render.
test("el candado deja correr una sola vez a la vez", async () => {
  const candado = crearCandado();
  let veces = 0;
  let soltar;
  const hacer = () => { veces++; return new Promise((r) => { soltar = r; }); };
  const a = candado(hacer);
  const b = candado(hacer);
  assert.equal(await b, null);
  soltar("listo");
  assert.equal(await a, "listo");
  assert.equal(veces, 1);
  // Ya suelto, vuelve a dejar.
  const c = candado(async () => "otra");
  assert.equal(await c, "otra");
});

test("el candado se suelta aunque la acción truene", async () => {
  const candado = crearCandado();
  await assert.rejects(candado(async () => { throw new Error("x"); }));
  assert.equal(await candado(async () => 7), 7);
});

// Revisión 9-oct: si la lista de choferes no se pudo leer, la hoja decía
// "No hay choferes activos" y a un toque dejaba la ruta sin chofer.
test("la lista de choferes distingue 'no se pudo leer' de 'no hay'", () => {
  assert.equal(estadoChoferes(null), "fallo");
  assert.equal(estadoChoferes(undefined), "fallo");
  assert.equal(estadoChoferes([]), "vacia");
  assert.equal(estadoChoferes([{ id: "c1", nombre: "Ana" }]), "lista");
});

// Revisión iOS 9-oct (también aquí): en React Navigation 7, navigate() ya no
// regresa: apilaba otra "Recolecciones" y "Atrás" volvía al formulario lleno.
test("al crear una recolección se regresa a la lista, no se apila", async () => {
  const { readFileSync } = await import("node:fs");
  const s = readFileSync(new URL("../src/pantallas/admin/NuevaRecoleccion.js", import.meta.url), "utf8");
  assert.ok(!/navigation\.navigate\("Recolecciones"/.test(s));
  assert.ok(/navigation\.popTo\("Recolecciones"/.test(s));
});
