import { test } from "node:test";
import assert from "node:assert/strict";
import { ponerPrecio, quitarEspecial, cambiarFactura } from "../lib/precios-servidor.js";

/** Un supabase falso que guarda lo insertado y devuelve `filas` filas. */
function falso({ filas = 1, error = null } = {}) {
  const hecho = [];
  const cadena = (tabla, op, valor) => ({
    eq() { return this; },
    select: async () => ({ data: error ? null : Array.from({ length: filas }, () => ({ id: "x" })), error }),
    then: undefined,
    _: hecho.push({ tabla, op, valor }),
  });
  return {
    hecho,
    from: (tabla) => ({
      insert: (valor) => cadena(tabla, "insert", valor),
      update: (valor) => cadena(tabla, "update", valor),
    }),
  };
}

test("ponerPrecio rechaza un monto mal escrito sin tocar la base", async () => {
  const sb = falso();
  const r = await ponerPrecio(sb, { actorId: "u", conceptoId: "c", texto: "abc" });
  assert.equal(r.ok, false);
  assert.equal(sb.hecho.length, 0);
});

test("ponerPrecio inserta el renglón firmado y sin IVA", async () => {
  const sb = falso();
  const r = await ponerPrecio(sb, { actorId: "u", conceptoId: "c", clienteId: "A", texto: "$1,250.50" });
  assert.equal(r.ok, true);
  assert.deepEqual(sb.hecho[0], { tabla: "precios", op: "insert", valor: { concepto_id: "c", cliente_id: "A", precio: 1250.5, creado_por: "u" } });
});

test("si el RLS no deja (0 filas) se dice que NO se guardó", async () => {
  const r = await ponerPrecio(falso({ filas: 0 }), { actorId: "u", conceptoId: "c", texto: "10" });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /No se guardó/);
});

test("quitarEspecial exige cliente", async () => {
  const r = await quitarEspecial(falso(), { actorId: "u", conceptoId: "c", clienteId: null });
  assert.equal(r.ok, false);
});

test("cambiarFactura solo acepta sí o no", async () => {
  assert.equal((await cambiarFactura(falso(), { clienteId: "A", requiereFactura: "quizá" })).ok, false);
  assert.equal((await cambiarFactura(falso(), { clienteId: "A", requiereFactura: true })).ok, true);
});
