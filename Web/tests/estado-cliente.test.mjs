import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loQueFalta,
  estadoPorCompletitud,
  etiquetaEstado,
} from "../lib/estado-cliente.mjs";

const completo = {
  empresa: "Industrias del Golfo",
  contacto: "Ana Ruiz",
  telefono: "8681234567",
  correo: "compras@golfo.mx",
};

test("un cliente con contacto, telefono y correo esta completo", () => {
  assert.deepEqual(loQueFalta(completo), []);
  assert.equal(estadoPorCompletitud(completo), "activo");
});

// ESTA es la prueba que impide que un cambio futuro deje entrar a los 16
// pendientes por descuido. 13 de los 42 clientes del cuaderno llegaron sin
// correo, y el correo es por donde llega el acceso al portal.
test("sin correo NO esta completo, aunque tenga todo lo demas", () => {
  const sinCorreo = { ...completo, correo: "" };
  assert.deepEqual(loQueFalta(sinCorreo), ["correo"]);
  assert.equal(estadoPorCompletitud(sinCorreo), "pendiente-info");
});

test("sin telefono ni contacto reporta los dos, en orden", () => {
  const pelado = { ...completo, contacto: "", telefono: null };
  assert.deepEqual(loQueFalta(pelado), ["persona de contacto", "teléfono"]);
  assert.equal(estadoPorCompletitud(pelado), "pendiente-info");
});

// El cuaderno trae "N-A" tecleado a mano en la columna de correo. Si llegara
// asi a la base, un cliente sin correo se veria completo.
// El guion largo NO viene del cuaderno: lo pone `datos-clientes.js` al mapear
// `contacto: c.contacto || "—"`. Es el relleno mas peligroso de todos porque
// nos lo hacemos solos.
test("el guion largo de nuestra propia capa de datos no cuenta como dato", () => {
  assert.equal(estadoPorCompletitud({ ...completo, contacto: "—" }), "pendiente-info");
  assert.deepEqual(loQueFalta({ ...completo, contacto: "—" }), ["persona de contacto"]);
});

test("los rellenos vacios no cuentan como dato", () => {
  for (const relleno of ["N-A", "n/a", "NA", "-", "  ", "NO", ".", "—"]) {
    assert.equal(
      estadoPorCompletitud({ ...completo, correo: relleno }),
      "pendiente-info",
      `"${relleno}" se colo como correo valido`
    );
  }
});

test("lo fiscal NO entra en la vara", () => {
  // Exigir domicilio fiscal dejaria 2 clientes activos de 42: la empresa
  // lleno esa columna con el REGIMEN en 28 de ellos.
  const sinFiscal = { ...completo, rfc: null, domicilio_fiscal: null };
  assert.equal(estadoPorCompletitud(sinFiscal), "activo");
});

test("cada estado tiene su etiqueta y su clase de badge", () => {
  assert.deepEqual(etiquetaEstado("activo"), { texto: "Activo", clase: "ok" });
  assert.deepEqual(etiquetaEstado("pendiente-info"), {
    texto: "Pendiente por información",
    clase: "prog",
  });
  assert.deepEqual(etiquetaEstado("suspendido"), { texto: "Suspendido", clase: "mal" });
  assert.deepEqual(etiquetaEstado("baja"), { texto: "Baja", clase: "" });
});

test("un estado desconocido no truena la tabla", () => {
  assert.deepEqual(etiquetaEstado("inventado"), { texto: "inventado", clase: "" });
});
