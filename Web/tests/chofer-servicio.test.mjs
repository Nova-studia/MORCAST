// Quién es el chofer de cada servicio del cliente (6-oct-2026): el que hizo
// la recolección manda sobre el texto libre de la ruta, que mentía.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  elegirChofer, etiquetaChofer, mapaDeChoferes, idsDeChoferes, mezclarChoferes,
} from "../lib/chofer-servicio.mjs";

test("completada: manda quien levantó la evidencia, no el texto de la ruta", () => {
  const r = elegirChofer({ estado: "completada", operador: "José Medina", asignado: "Ana", textoRuta: "Marco Antonio" });
  assert.deepEqual(r, { nombre: "José Medina", etiqueta: "Chofer" });
});

test("programada: el asignado a la parada, luego el de la ruta, luego el texto", () => {
  assert.deepEqual(
    elegirChofer({ estado: "confirmada", operador: "Nadie", asignado: "Ana López", deRuta: "Luis", textoRuta: "Marco" }),
    { nombre: "Ana López", etiqueta: "Chofer asignado" }
  );
  assert.equal(elegirChofer({ estado: "en-ruta", deRuta: "Luis R.", textoRuta: "Marco" }).nombre, "Luis R.");
  assert.equal(elegirChofer({ estado: "solicitada", textoRuta: "  Marco  " }).nombre, "Marco");
  assert.equal(elegirChofer({ estado: "solicitada" }).nombre, "—");
});

test("lo que no ha pasado nunca usa el operador (todavía no existe)", () => {
  assert.equal(elegirChofer({ estado: "confirmada", operador: "José" }).nombre, "—");
});

test("etiqueta según el estado, de la base o de pantalla", () => {
  assert.equal(etiquetaChofer("completada"), "Chofer");
  assert.equal(etiquetaChofer("completado"), "Chofer");
  assert.equal(etiquetaChofer("no-procedio"), "Chofer");
  assert.equal(etiquetaChofer("programado"), "Chofer asignado");
  assert.equal(etiquetaChofer(undefined), "Chofer asignado");
});

test("filas de la base → mapa por folio, con ids traducidos", () => {
  const filas = [
    { folio: "REC-1", estado: "completada", chofer_id: "a", rutas: { chofer: "Marco Antonio", chofer_id: "m" }, recolecciones: [{ operador_id: "j" }] },
    { folio: "REC-2", estado: "confirmada", chofer_id: null, rutas: { chofer: "Marco Antonio", chofer_id: "m" }, recolecciones: [] },
    { folio: "REC-3", estado: "en-ruta", chofer_id: "x", rutas: null, recolecciones: [] },
    { estado: "completada" },
  ];
  assert.deepEqual(idsDeChoferes(filas).sort(), ["a", "j", "m", "x"]);
  const mapa = mapaDeChoferes(filas, { j: "José Medina", a: "Ana", m: "Marco A. (usuario)" });
  assert.deepEqual(mapa["REC-1"], { nombre: "José Medina", etiqueta: "Chofer" });
  assert.deepEqual(mapa["REC-2"], { nombre: "Marco A. (usuario)", etiqueta: "Chofer asignado" });
  // Perfil sin nombre (o borrado): no se inventa.
  assert.deepEqual(mapa["REC-3"], { nombre: "—", etiqueta: "Chofer asignado" });
  assert.equal(Object.keys(mapa).length, 3);
});

test("mezclar: pone el nombre y la firma; si el servidor no contestó, «—»", () => {
  const lista = [
    { folio: "REC-1", estatus: "completado", operador: "Marco Antonio", evidencia: { antes: {}, despues: { firma: "Marco Antonio" } } },
    { folio: "REC-2", estatus: "programado", operador: "Marco Antonio", evidencia: null },
  ];
  const bien = mezclarChoferes(lista, { "REC-1": { nombre: "José Medina", etiqueta: "Chofer" } });
  assert.equal(bien[0].operador, "José Medina");
  assert.equal(bien[0].etiquetaOperador, "Chofer");
  assert.equal(bien[0].evidencia.despues.firma, "José Medina");
  assert.equal(bien[1].operador, "—");
  assert.equal(bien[1].etiquetaOperador, "Chofer asignado");
  // La lista original no se toca.
  assert.equal(lista[0].evidencia.despues.firma, "Marco Antonio");

  const sinServidor = mezclarChoferes(lista, null);
  assert.deepEqual(sinServidor.map((s) => s.operador), ["—", "—"]);
  assert.equal(sinServidor[0].etiquetaOperador, "Chofer");
  assert.deepEqual(mezclarChoferes(null, null), []);
});
