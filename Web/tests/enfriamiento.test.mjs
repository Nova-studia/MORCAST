import { test } from "node:test";
import assert from "node:assert/strict";
import { puedePedirEnlace, ESPERA_MS } from "../lib/enfriamiento.mjs";

// Reloj fijo: nada de esperar un minuto de verdad para probar un minuto.
const AHORA = new Date("2026-08-28T18:00:00.000Z");
const haceSegundos = (s) => new Date(AHORA.getTime() - s * 1000);

test("quien nunca ha pedido uno, puede", () => {
  assert.deepEqual(puedePedirEnlace(null, AHORA), { puede: true, faltanSegundos: 0 });
  assert.deepEqual(puedePedirEnlace(undefined, AHORA), { puede: true, faltanSegundos: 0 });
});

test("recien pedido: NO puede, y dice cuanto falta", () => {
  const r = puedePedirEnlace(haceSegundos(0), AHORA);
  assert.equal(r.puede, false);
  assert.equal(r.faltanSegundos, 60);
});

test("a la mitad de la espera: NO puede, y la cuenta baja", () => {
  const r = puedePedirEnlace(haceSegundos(25), AHORA);
  assert.equal(r.puede, false);
  assert.equal(r.faltanSegundos, 35);
});

test("justo al cumplirse la espera: SI puede", () => {
  assert.equal(puedePedirEnlace(new Date(AHORA.getTime() - ESPERA_MS), AHORA).puede, true);
});

test("pasada la espera: SI puede", () => {
  assert.equal(puedePedirEnlace(haceSegundos(300), AHORA).puede, true);
});

test("acepta la fecha como TEXTO, que es como llega de la base", () => {
  const r = puedePedirEnlace("2026-08-28T17:59:30.000Z", AHORA);
  assert.equal(r.puede, false);
  assert.equal(r.faltanSegundos, 30);
});

// Los dos casos raros. La regla es la misma en ambos: ante un dato que no se
// entiende, NO se bloquea. Es peor dejar a alguien sin poder recuperar su
// cuenta que mandarle un correo de mas.
test("una fecha ilegible no bloquea", () => {
  assert.equal(puedePedirEnlace("no soy una fecha", AHORA).puede, true);
  assert.equal(puedePedirEnlace("", AHORA).puede, true);
});

test("una fecha en el FUTURO no bloquea para siempre", () => {
  const futuro = new Date(AHORA.getTime() + 3600 * 1000);
  assert.equal(puedePedirEnlace(futuro, AHORA).puede, true);
});

test("nunca devuelve faltanSegundos 0 cuando todavia hay que esperar", () => {
  // 59.5 s de espera cumplida: quedan 500 ms, que redondean a 1, no a 0.
  const r = puedePedirEnlace(new Date(AHORA.getTime() - (ESPERA_MS - 500)), AHORA);
  assert.equal(r.puede, false);
  assert.ok(r.faltanSegundos >= 1, `esperaba >=1, salio ${r.faltanSegundos}`);
});
