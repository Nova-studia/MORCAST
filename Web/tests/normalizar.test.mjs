import { test } from "node:test";
import assert from "node:assert/strict";
import {
  limpio,
  telefono,
  esRegimen,
  nombreClave,
  esRenglonDeInstrucciones,
} from "../scripts/cuaderno/normalizar.mjs";

// Cada prueba se llama por el renglon REAL del cuaderno que la obligo a
// existir. Asi, dentro de un año, se sabe contra que se escribio la regla.

test("los rellenos que tecleo la empresa se vuelven nulo de verdad", () => {
  // AEROPUERTO trae "N-A" literal en la columna de correo.
  for (const v of ["N-A", "NA", "N/A", "n.a.", "NO", "-", "--", "", "   "]) {
    assert.equal(limpio(v), null, `"${v}" debio quedar en null`);
  }
});

test("un dato de verdad se conserva recortado", () => {
  assert.equal(limpio("  ABRAHAM  "), "ABRAHAM");
  assert.equal(limpio("facturacion@agarlabels.com"), "facturacion@agarlabels.com");
});

test("el telefono de AGAR pierde los adornos", () => {
  // El cuaderno trae "(868)1490531".
  assert.equal(telefono("(868)1490531"), "8681490531");
  assert.equal(telefono("868 170 7754"), "8681707754");
  assert.equal(telefono("5612603034"), "5612603034");
});

test("un telefono vacio o de relleno es nulo, no una cadena de ceros", () => {
  assert.equal(telefono("N-A"), null);
  assert.equal(telefono(""), null);
});

test("el domicilio fiscal que en realidad es el REGIMEN se reconoce", () => {
  // 28 de los 42 clientes traen esto en la columna de domicilio.
  assert.equal(esRegimen("General de Ley Personas Morales"), true);
  assert.equal(esRegimen("GENERAL DE LEY PERSONAS MORALES"), true);
  assert.equal(esRegimen("Régimen Simplificado de Confianza"), true);
  assert.equal(esRegimen("Personas Físicas con Actividades Empresariales"), true);
});

test("un domicilio de verdad NO se confunde con un regimen", () => {
  assert.equal(esRegimen("CALLE GIUSEPPE VERDI #105, VILLA COAPA"), false);
  assert.equal(esRegimen("AVENIDA UNIONES, ZONA INDUSTRIAL"), false);
});

test("los nombres se comparan sin acentos, sin dobles espacios y sin guiones", () => {
  assert.equal(nombreClave("  Carne-Mart  "), "CARNE MART");
  // Verificado contra el cuaderno: estos dos son los que de verdad rompian.
  assert.equal(nombreClave('Carne-Mart "Coliseo"'), "CARNE MART COLISEO");
  assert.equal(nombreClave("NACIONAL AV DEL NIÑO"), "NACIONAL AV DEL NINO");
  assert.equal(nombreClave("RUTA10"), "RUTA10");
  assert.equal(nombreClave("Nacionales"), "NACIONALES");
  assert.equal(nombreClave("MCDONALD'S"), "MCDONALDS");
  assert.equal(nombreClave("CINÉPOLIS"), "CINEPOLIS");
});

test("el renglon de instrucciones NO es un servicio", () => {
  // Este texto de ayuda del cuaderno se colo entre los datos de la hoja 4 y
  // parecia un servicio con una empresa de 180 caracteres.
  const colado = [
    "RECOLECCIONES AL MES es el dato que más importa y el que más se olvida. " +
      "Es cuántas veces pasan en total durante el mes. Si un punto tiene dos " +
      "tipos de residuo con equipos distintos, anótelo en dos renglones.",
    "", "", "", "", "", "", "", "",
  ];
  assert.equal(esRenglonDeInstrucciones(colado), true);
});

test("un servicio de verdad NO se descarta como instruccion", () => {
  const real = ["AGAR", "SUCURSAL", "4", "Residuos Sólidos Urbanos (RSU)",
                "CONTENEDOR ", "3 M3", "1", "", ""];
  assert.equal(esRenglonDeInstrucciones(real), false);
});
