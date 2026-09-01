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

import {
  diasDesdeTexto,
  tipoDeRuta,
  frecuenciaPorMes,
  claveDeRuta,
  aNumero,
} from "../scripts/cuaderno/normalizar.mjs";

test("un dia suelto", () => {
  assert.deepEqual(diasDesdeTexto("LUNES"), { dias: ["lunes"], porLlamada: false });
  assert.deepEqual(diasDesdeTexto("miercoles"), { dias: ["miércoles"], porLlamada: false });
  assert.deepEqual(diasDesdeTexto("SABADO"), { dias: ["sábado"], porLlamada: false });
});

test("dos dias unidos por Y", () => {
  assert.deepEqual(diasDesdeTexto("LUNES Y JUEVES"),
    { dias: ["lunes", "jueves"], porLlamada: false });
  assert.deepEqual(diasDesdeTexto("MIERCOLES Y SABADO"),
    { dias: ["miércoles", "sábado"], porLlamada: false });
});

test("un rango con A", () => {
  assert.deepEqual(diasDesdeTexto("LUNES A SABADO"), {
    dias: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    porLlamada: false,
  });
});

// RUTA 10 y RUTA 11, las de TPI. Es la razon por la que DIAS_SEMANA gano el
// domingo: sin el, este dia se borraba solo al editar la ruta en el panel.
test("LUNES A DOMINGO son los siete dias", () => {
  const r = diasDesdeTexto("LUNES A DOMINGO");
  assert.equal(r.dias.length, 7);
  assert.ok(r.dias.includes("domingo"));
});

test("POR LLAMADA no es un dia", () => {
  // 8 puntos del cuaderno dicen esto. Meterlos en un dia fijo inventaria una
  // visita que nadie acordo; dejarlos sin marca los volveria invisibles.
  assert.deepEqual(diasDesdeTexto("POR LLAMADA"), { dias: [], porLlamada: true });
});

test("un texto que no dice nada no inventa dias", () => {
  assert.deepEqual(diasDesdeTexto(""), { dias: [], porLlamada: false });
  assert.deepEqual(diasDesdeTexto("N-A"), { dias: [], porLlamada: false });
});

test("los tipos de ruta como los escribio la empresa", () => {
  assert.equal(tipoDeRuta("roll off"), "roll-off");
  assert.equal(tipoDeRuta("ROLL -OFF"), "roll-off");
  assert.equal(tipoDeRuta("compactador"), "compactador");
  assert.equal(tipoDeRuta("manual"), "manual");
  assert.equal(tipoDeRuta("lo que sea"), null);
});

test("la clave de ruta se empareja aunque falte el espacio", () => {
  // El cuaderno escribe "RUTA 10" en una hoja y "RUTA10" en otra.
  assert.equal(claveDeRuta("RUTA 3"), "RUTA-3");
  assert.equal(claveDeRuta("RUTA10"), "RUTA-10");
  assert.equal(claveDeRuta("ruta 11"), "RUTA-11");
  assert.equal(claveDeRuta("N-A"), null);
});

test("la frecuencia sale de las recolecciones al mes", () => {
  assert.equal(frecuenciaPorMes(30), "semanal");
  assert.equal(frecuenciaPorMes(4), "semanal");
  assert.equal(frecuenciaPorMes(3), "quincenal");
  assert.equal(frecuenciaPorMes(2), "quincenal");
  assert.equal(frecuenciaPorMes(1), "mensual");
  // Sin dato: la frecuencia mas conservadora. El numero exacto se guarda
  // aparte en `servicios_por_mes`, asi que no se pierde nada.
  assert.equal(frecuenciaPorMes(""), "mensual");
  assert.equal(frecuenciaPorMes(0), "mensual");
});

test("un negativo NO se convierte en su valor absoluto", () => {
  // El saneo borraba el signo junto con la basura, asi que -5 acababa
  // siendo "semanal": la frecuencia MAS agresiva, justo lo contrario de
  // lo conservador que promete la funcion.
  assert.equal(frecuenciaPorMes(-5), "mensual");
  assert.equal(frecuenciaPorMes("-5"), "mensual");
  assert.equal(frecuenciaPorMes(-1), "mensual");
});

test("la basura con varios puntos no se lee como numero", () => {
  assert.equal(frecuenciaPorMes("4.5.6"), "mensual");
});

test("un numero con decimales cae en el escalon que le toca", () => {
  assert.equal(frecuenciaPorMes(2.5), "quincenal");
});

test("aNumero conserva el signo, la misma regla que antes solo tenia frecuenciaPorMes", () => {
  // La copia de cargar.mjs (linea ~251) tiraba el "-" junto con la basura:
  // un "-8" en recolecciones al mes se leia como 8. `aNumero` es la unica
  // fuente ahora, y la usan cargar.mjs y frecuenciaPorMes por igual.
  assert.equal(aNumero("-8"), -8);
  assert.equal(aNumero("8"), 8);
  assert.equal(aNumero("-8.5"), -8.5);
  assert.equal(aNumero(""), 0);
  // "abc" no deja ni un digito: como con "" el saneo se queda vacio y da 0.
  assert.equal(aNumero("abc"), 0);
  // Varios puntos SI dan basura no numerica de verdad (ya cubierto tambien
  // por "la basura con varios puntos no se lee como numero", arriba).
  assert.equal(Number.isNaN(aNumero("4.5.6")), true);
});
