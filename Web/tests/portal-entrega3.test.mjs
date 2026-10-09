import { test } from "node:test";
import assert from "node:assert/strict";
import { puntosAgendables, puntoInicial } from "../lib/puntos-cliente.mjs";
import { residuoDeclarado, pesoManifiesto, horaManifiesto, PENDIENTE_EMPRESA } from "../lib/manifiesto.mjs";

const SUS = [
  { estado: "activa", domicilio_id: "d2", domicilios: { alias: "Planta 2", colonia: "Sur" }, rutas: { id: "r2", clave: "R2", nombre: "Ruta Sur", tipo: "manual", dias: ["lunes"] } },
  { estado: "activa", domicilio_id: "d1", domicilios: { alias: "Planta 1", colonia: "Centro" }, rutas: { id: "r1", clave: "R1", nombre: "Ruta Centro", tipo: "manual", dias: ["martes"] } },
  { estado: "pausada", domicilio_id: "d3", domicilios: { alias: "Bodega", colonia: "" }, rutas: { id: "r3", clave: "R3", nombre: "Ruta 3", tipo: "manual", dias: [] } },
];

test("puntos agendables: solo servicios activos, ordenados por nombre, con SU ruta", () => {
  const p = puntosAgendables(SUS);
  assert.deepEqual(p.map((x) => x.domicilioId), ["d1", "d2"]);
  assert.equal(p[0].ruta.id, "r1");
  assert.equal(p[0].texto, "Planta 1 · Centro");
});

test("con un solo punto se escoge solo; con varios, el cliente elige", () => {
  assert.equal(puntoInicial(puntosAgendables([SUS[0]])), "d2");
  assert.equal(puntoInicial(puntosAgendables(SUS)), "");
  assert.equal(puntoInicial([]), "");
});

test("manifiesto: el residuo es el que declaró el cliente", () => {
  assert.equal(residuoDeclarado({ tipo_residuo: "Cartón", origen: "ruta" }), "Cartón");
  assert.equal(residuoDeclarado({ tipo_residuo: null, origen: "extra" }), "Recolección extra (sin tipo declarado)");
});

test("manifiesto: peso real si lo hay; si no, el del chofer marcado como estimado", () => {
  assert.equal(pesoManifiesto({ peso_real_kg: 480, peso_kg: 500 }), "480 kg");
  assert.equal(pesoManifiesto({ peso_kg: 500 }), "500 kg (estimado por el chofer)");
  assert.equal(pesoManifiesto(null), PENDIENTE_EMPRESA);
});

test("manifiesto: la hora real de la recolección (Matamoros)", () => {
  assert.equal(horaManifiesto({ hora_despues: "2026-10-09T16:20:00.000Z" }), "11:20");
  assert.equal(horaManifiesto({ hora_despues: null, hora_antes: null }), "");
});
