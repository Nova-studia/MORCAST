// Apps al 100% (9-oct-2026), chofer: el cierre que ya estaba hecho, la
// parada que cerró otro y "el cliente ya fue avisado" solo cuando es verdad.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estatusDeFila, cierreYaHecho, avisadoDeRespuesta } from "../src/chofer-app.mjs";
import { textoEnCamino } from "../src/web/chofer-cierre.mjs";

test("una parada completada es «completado» aunque la evidencia sea de otro chofer", () => {
  assert.equal(estatusDeFila({ estado: "completada", recolecciones: [] }), "completado");
  assert.equal(estatusDeFila({ estado: "completada" }), "completado");
  assert.equal(estatusDeFila({ estado: "no-procedio" }), "no-procedio");
  assert.equal(estatusDeFila({ estado: "confirmada" }), "pendiente");
  assert.equal(estatusDeFila({ estado: "en-ruta" }), "pendiente");
});

test("si cerrar falló en el paso del estado, releer: ya completada = éxito", () => {
  assert.equal(cierreYaHecho("completada"), true);
  assert.equal(cierreYaHecho("en-ruta"), false);
  assert.equal(cierreYaHecho(null), false);
});

test("«el cliente ya fue avisado» solo si el servidor lo dice", () => {
  assert.equal(avisadoDeRespuesta({ ok: true, estado: "en-ruta", avisado: true }), true);
  assert.equal(avisadoDeRespuesta({ ok: true, estado: "en-ruta", avisado: false }), false);
  assert.equal(avisadoDeRespuesta({ ok: true, estado: "en-ruta" }), undefined, "ya estaba en camino: no se sabe");
  assert.equal(avisadoDeRespuesta({ ok: true, demo: true, avisado: false }), undefined);
  assert.equal(avisadoDeRespuesta(null), undefined);
  assert.match(textoEnCamino(avisadoDeRespuesta({ ok: true, avisado: false })), /no se pudo avisar/);
  assert.equal(textoEnCamino(avisadoDeRespuesta({ ok: true })), "En camino");
});
