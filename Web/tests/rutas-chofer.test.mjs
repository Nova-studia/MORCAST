import { test } from "node:test";
import assert from "node:assert/strict";
import { elegirChoferRuta, textoChoferPorOmision, avisoRutaSinChofer } from "../lib/rutas-chofer.mjs";

const CHOFERES = [{ id: "c1", nombre: "Juan Pérez" }, { id: "c2", nombre: "Ana Ruiz" }];

test("elegir un chofer llena chofer_id y el nombre que se enseña", () => {
  assert.deepEqual(elegirChoferRuta("c2", CHOFERES), { chofer_id: "c2", chofer: "Ana Ruiz" });
});

test("sin chofer: los dos vacíos (nunca un id que no existe)", () => {
  assert.deepEqual(elegirChoferRuta("", CHOFERES), { chofer_id: null, chofer: "" });
  assert.deepEqual(elegirChoferRuta("zz", CHOFERES), { chofer_id: null, chofer: "" });
});

test("la opción 'El de la ruta' dice quién es, o que nadie la verá", () => {
  assert.equal(textoChoferPorOmision({ choferId: "c1", chofer: "Juan Pérez" }), "El de la ruta: Juan Pérez");
  assert.equal(textoChoferPorOmision({ choferId: null, chofer: "Juan (texto viejo)" }), "La ruta no tiene chofer asignado");
  assert.equal(textoChoferPorOmision(null), "La ruta no tiene chofer asignado");
});

test("confirmar sin chofer en una ruta sin chofer: se avisa que ningún chofer la verá", () => {
  assert.match(avisoRutaSinChofer({ choferElegido: "", ruta: { choferId: null } }), /ningún chofer/);
  assert.equal(avisoRutaSinChofer({ choferElegido: "c1", ruta: { choferId: null } }), null);
  assert.equal(avisoRutaSinChofer({ choferElegido: "", ruta: { choferId: "c1" } }), null);
});

test("revisión: con chofer pero sin nombre guardado dice 'El de la ruta', no 'sin chofer'", () => {
  assert.equal(textoChoferPorOmision({ choferId: "c1", chofer: "" }), "El de la ruta");
});
