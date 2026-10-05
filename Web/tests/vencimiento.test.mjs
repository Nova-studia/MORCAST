import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoVencimiento, ordenarPorUrgencia } from "../lib/vencimiento.js";

const HOY = "2026-10-05";

test("una confirmada de ayer sí es incumplida", () => {
  const v = estadoVencimiento({ estado: "confirmada", fechaConfirmada: "2026-10-04" }, HOY);
  assert.equal(v.vencida, true);
  assert.equal(v.tipo, "incumplida");
});

test("'No procedió' es final: nunca vence ni cuenta como incumplida", () => {
  const v = estadoVencimiento(
    { estado: "no-procedio", fechaPedida: "2026-09-20", fechaConfirmada: "2026-09-21" },
    HOY
  );
  assert.deepEqual(v, { vencida: false });
});

test("completada y rechazada siguen siendo finales", () => {
  assert.equal(estadoVencimiento({ estado: "completada", fechaPedida: "2026-09-01" }, HOY).vencida, false);
  assert.equal(estadoVencimiento({ estado: "rechazada", fechaPedida: "2026-09-01" }, HOY).vencida, false);
});

test("al ordenar, 'No procedió' va con las cerradas, no arriba con las vencidas", () => {
  const lista = [
    { folio: "NP", estado: "no-procedio", fechaConfirmada: "2026-10-01" },
    { folio: "VEN", estado: "confirmada", fechaConfirmada: "2026-10-02" },
    { folio: "PROX", estado: "solicitada", fechaPedida: "2026-10-08" },
    { folio: "COMP", estado: "completada", fechaConfirmada: "2026-10-03" },
  ];
  assert.deepEqual(ordenarPorUrgencia(lista, HOY).map((s) => s.folio), ["VEN", "PROX", "COMP", "NP"]);
});
