import { test } from "node:test";
import assert from "node:assert/strict";
import { casaDe, decidirDestino, DESTINOS } from "../lib/destino-sesion.mjs";

test("cada rol sellado va a su area", () => {
  assert.equal(casaDe("dueno"), DESTINOS.admin);
  assert.equal(casaDe("admin"), DESTINOS.admin);
  assert.equal(casaDe("operador"), DESTINOS.chofer);
  assert.equal(casaDe("cliente"), DESTINOS.portal);
});

// LA REGRESION QUE IMPORTA. proxy.js hacia `app_metadata?.rol ?? "cliente"`,
// asi que quien llegaba sin sello quedaba bautizado cliente y el guardia lo
// dejaba pasar a /portal. Si alguien vuelve a poner esa suposicion, aqui
// truena.
test("sin rol NO se supone cliente: la casa es la sala de espera", () => {
  assert.equal(casaDe(null), DESTINOS.pendiente);
  assert.equal(casaDe(undefined), DESTINOS.pendiente);
  assert.equal(casaDe(""), DESTINOS.pendiente);
  assert.notEqual(casaDe(null), DESTINOS.portal);
});

test("el rol pendiente y cualquier rol desconocido tampoco entran", () => {
  assert.equal(casaDe("pendiente"), DESTINOS.pendiente);
  assert.equal(casaDe("superadmin"), DESTINOS.pendiente);
  assert.equal(casaDe("Cliente"), DESTINOS.pendiente); // ojo: distingue mayusculas
});

test("decidirDestino parte al pendiente segun si ya capturo sus datos", () => {
  assert.equal(decidirDestino({ rol: null, tieneSolicitud: false }), DESTINOS.registro);
  assert.equal(decidirDestino({ rol: null, tieneSolicitud: true }), DESTINOS.pendiente);
  assert.equal(decidirDestino({ rol: "pendiente", tieneSolicitud: false }), DESTINOS.registro);
});

test("a quien ya tiene sello no le afecta si hay solicitud o no", () => {
  assert.equal(decidirDestino({ rol: "cliente", tieneSolicitud: false }), DESTINOS.portal);
  assert.equal(decidirDestino({ rol: "cliente", tieneSolicitud: true }), DESTINOS.portal);
  assert.equal(decidirDestino({ rol: "operador", tieneSolicitud: true }), DESTINOS.chofer);
});

test("sin argumentos no truena", () => {
  assert.equal(decidirDestino(), DESTINOS.registro);
  assert.equal(decidirDestino({}), DESTINOS.registro);
});
