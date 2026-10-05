import { test } from "node:test";
import assert from "node:assert/strict";
import {
  infoTipo,
  fechaHora,
  filtrarIncidentes,
  ordenarBandeja,
  contarIncidentes,
  validarAtencion,
} from "../app/(admin)/admin/incidentes/bandeja.mjs";

const lista = [
  { id: "a", tipo: "retraso", estado: "abierto", creado: "2026-10-05T15:00:00Z" },
  { id: "b", tipo: "accidente", estado: "abierto", creado: "2026-10-04T15:00:00Z" },
  { id: "c", tipo: "contenedor-movido", estado: "atendido", creado: "2026-10-05T16:00:00Z" },
  // 4-oct a las 22:30 en Matamoros (ya es 5 en UTC).
  { id: "d", tipo: "falla-mecanica", estado: "abierto", creado: "2026-10-05T03:30:00Z" },
];

test("los abiertos van primero, y de ellos el accidente aunque sea más viejo", () => {
  assert.deepEqual(ordenarBandeja(lista).map((i) => i.id), ["b", "a", "d", "c"]);
});

test("ordenar no toca la lista original", () => {
  const copia = [...lista];
  ordenarBandeja(lista);
  assert.deepEqual(lista, copia);
});

test("filtro por estado y por tipo", () => {
  assert.deepEqual(filtrarIncidentes(lista, { estado: "abiertos" }).map((i) => i.id), ["a", "b", "d"]);
  assert.deepEqual(filtrarIncidentes(lista, { estado: "atendidos" }).map((i) => i.id), ["c"]);
  assert.equal(filtrarIncidentes(lista, { estado: "todos", tipo: "accidente" }).length, 1);
});

test("las fechas del filtro son días de Matamoros, no de UTC", () => {
  const del4 = filtrarIncidentes(lista, { estado: "todos", desde: "2026-10-04", hasta: "2026-10-04" });
  assert.deepEqual(del4.map((i) => i.id).sort(), ["b", "d"]);
  const desde5 = filtrarIncidentes(lista, { estado: "todos", desde: "2026-10-05" });
  assert.deepEqual(desde5.map((i) => i.id).sort(), ["a", "c"]);
});

test("las cifras de los filtros", () => {
  assert.deepEqual(contarIncidentes(lista), { todos: 4, abiertos: 3, atendidos: 1, urgentes: 1 });
  assert.deepEqual(contarIncidentes(null), { todos: 0, abiertos: 0, atendidos: 0, urgentes: 0 });
});

test("el accidente es el único urgente; un tipo desconocido no truena", () => {
  assert.equal(infoTipo("accidente").tono, "urgente");
  assert.equal(infoTipo("retraso").tono, "alerta");
  assert.equal(infoTipo("contenedor-danado").texto, "Contenedor dañado");
  assert.deepEqual(infoTipo("raro"), { id: "raro", texto: "raro", tono: "neutro" });
});

test("la fecha y hora se leen en Matamoros", () => {
  assert.equal(fechaHora("2026-10-05T03:30:00Z"), "4 oct 2026 · 22:30");
  assert.equal(fechaHora(null), "—");
  assert.equal(fechaHora("no-es-fecha"), "—");
});

test("atender sin nota no se puede", () => {
  assert.equal(validarAtencion("  ").ok, false);
  assert.equal(validarAtencion("x".repeat(1001)).ok, false);
  assert.deepEqual(validarAtencion("  Se mandó grúa  "), { ok: true, nota: "Se mandó grúa" });
});
