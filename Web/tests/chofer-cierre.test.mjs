import { test } from "node:test";
import assert from "node:assert/strict";
import { selloFoto, horasDeCierre, estatusDeParada, textoEnCamino, avisoEnviado } from "../lib/chofer-cierre.mjs";

test("cada foto guarda su hora REAL (ISO) además del HH:MM que se enseña", () => {
  const f = new Date(2026, 9, 9, 8, 5, 30);
  const s = selloFoto(f);
  assert.equal(s.hora, "08:05");
  assert.equal(s.en, f.toISOString());
});

test("al cerrar viajan las horas de las fotos, no la de 'Finalizar'", () => {
  const antes = { en: "2026-10-09T14:05:00.000Z" };
  const despues = { en: "2026-10-09T14:20:00.000Z" };
  assert.deepEqual(horasDeCierre({ antes, despues }), { horaAntes: antes.en, horaDespues: despues.en });
});

test("una foto guardada antes de este cambio (sin hora ISO) no inventa hora", () => {
  assert.deepEqual(horasDeCierre({ antes: { hora: "08:05" }, despues: null }), { horaAntes: null, horaDespues: null });
});

test("una parada completada es 'completado' aunque la evidencia sea de otro chofer (no la puede leer)", () => {
  assert.equal(estatusDeParada("completada"), "completado");
  assert.equal(estatusDeParada("no-procedio"), "no-procedio");
  assert.equal(estatusDeParada("en-ruta"), "pendiente");
  assert.equal(estatusDeParada("confirmada"), "pendiente");
});

test("'el cliente ya fue avisado' solo si de verdad se avisó", () => {
  assert.equal(textoEnCamino(true), "En camino · el cliente ya fue avisado");
  assert.match(textoEnCamino(false), /no se pudo avisar/);
  assert.equal(textoEnCamino(undefined), "En camino");
});

test("avisoEnviado: correo, notificación o ya avisado antes cuentan; nada más no", () => {
  assert.equal(avisoEnviado({ correo: true, notificaciones: 0 }), true);
  assert.equal(avisoEnviado({ correo: false, notificaciones: 2 }), true);
  assert.equal(avisoEnviado({ yaAvisado: true, correo: false, notificaciones: 0 }), true);
  assert.equal(avisoEnviado({ ok: true, correo: false, notificaciones: 0 }), false);
  assert.equal(avisoEnviado(null), false);
});
