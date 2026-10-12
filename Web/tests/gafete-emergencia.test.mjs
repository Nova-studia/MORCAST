import { test } from "node:test";
import assert from "node:assert/strict";
import { cifrarPin } from "../lib/pin-gafete.mjs";
import {
  resolverEmergencia,
  PIN_INCORRECTO,
  ESPERA,
  ESPERA_LARGA,
  SIN_RESPUESTA,
  TOPE_POR_IP,
  TOPE_POR_GAFETE,
} from "../lib/gafete-emergencia.mjs";

const LLAVE = "una-llave-de-prueba-de-mas-de-32-caracteres";
const CODIGO = "K7M2X9FDQ4";
const PIN = "482913";

const JUAN = {
  id: "e1", numero: "0024", nombre: "Juan Carlos", apellido_paterno: "Pérez", apellido_materno: "López",
  puesto: "Operador", area: "Ruta Norte", estado: "activo", tipo_sangre: "O+", alergias: "Penicilina",
  contacto_emergencia: "María López (esposa)", telefono_emergencia: "8681234567", permiso_emergencia: true,
};

/** Un freno de mentiras que cuenta de verdad, y un directorio con un gafete. */
async function armar({ empleado = JUAN, gafete = {}, llave = LLAVE } = {}) {
  const cuenta = new Map();
  const claves = [];
  const fila = { id: "g1", codigo: CODIGO, estado: "vigente", pin_cifrado: await cifrarPin(PIN, CODIGO, LLAVE), ...gafete };
  const buscados = [];
  const pedir = (codigo, pin, ip = "1.1.1.1") => resolverEmergencia({
    codigo, pin, ip, llave,
    cabe: async (clave, tope) => {
      claves.push(clave);
      const n = (cuenta.get(clave) || 0) + 1;
      cuenta.set(clave, n);
      return n <= tope.maximo;
    },
    buscar: async (c) => {
      buscados.push(c);
      return c === CODIGO ? { gafete: fila, empleado } : { gafete: null, empleado: null };
    },
  });
  return { pedir, claves, cuenta, buscados };
}

test("con el PIN correcto se abre la ficha, y solo trae lo de emergencia", async () => {
  const t = await armar();
  const r = await t.pedir(CODIGO, "482 913");
  assert.deepEqual(r, {
    ok: true,
    gafeteId: "g1",
    ficha: {
      nombre: "Juan Carlos Pérez López", tipo_sangre: "O+", alergias: "Penicilina",
      contacto: "María López (esposa)", telefono: "8681234567",
    },
  });
  assert.deepEqual(t.claves, ["gafete-pin-ip:1.1.1.1", `gafete-pin:${CODIGO}`]);
  // El código se acepta como va impreso o tecleado.
  assert.equal((await t.pedir("k7m2 x9fd-q4", PIN)).ok, true);
});

test("un PIN malo responde SIEMPRE lo mismo: no dice si el gafete existe, vale o tiene permiso", async () => {
  const casos = [
    await armar(),                                                       // PIN equivocado
    await armar({ empleado: { ...JUAN, permiso_emergencia: false } }),   // no firmó el permiso
    await armar({ empleado: { ...JUAN, telefono_emergencia: null } }),   // sin teléfono no hay ficha
    await armar({ empleado: { ...JUAN, estado: "baja" } }),              // de baja
    await armar({ gafete: { estado: "repuesto" } }),                     // tarjeta repuesta
    await armar({ gafete: { estado: "anulado" } }),
    await armar({ llave: null }),                                        // el servidor sin llave
    await armar({ gafete: { pin_cifrado: "roto" } }),
  ];
  // En el primero se teclea un PIN equivocado; en los demás, el PIN correcto.
  assert.equal(await casos[0].pedir(CODIGO, "000000"), PIN_INCORRECTO);
  for (const t of casos.slice(1)) assert.equal(await t.pedir(CODIGO, PIN), PIN_INCORRECTO);
  // Y un código que no existe, igual.
  assert.equal(await casos[0].pedir("ZZZZZZZZZZ", PIN), PIN_INCORRECTO);
  assert.ok(!/existe|vigente|permiso|baja/i.test(PIN_INCORRECTO.motivo));
});

test("lo que no tiene forma de código o de PIN ni se busca ni gasta intentos del gafete", async () => {
  const t = await armar();
  for (const [codigo, pin] of [["corto", PIN], [CODIGO, "12345"], [CODIGO, "abcdef"], ["K7M2X9FDO4", PIN], [null, null]]) {
    assert.equal(await t.pedir(codigo, pin), PIN_INCORRECTO);
  }
  assert.deepEqual(t.buscados, []);
  assert.ok(t.claves.every((c) => c.startsWith("gafete-pin-ip:")), "solo se cobró el freno por IP");
});

test("freno por gafete: 5 intentos, y al sexto ni el PIN correcto abre", async () => {
  const t = await armar();
  for (let i = 0; i < TOPE_POR_GAFETE.maximo; i++) assert.equal(await t.pedir(CODIGO, "000000", `10.0.0.${i}`), PIN_INCORRECTO);
  // Desde otra IP: el tope es del gafete, no de quien pregunta.
  assert.equal(await t.pedir(CODIGO, PIN, "10.0.0.99"), ESPERA);
  assert.equal(t.buscados.length, TOPE_POR_GAFETE.maximo, "con el freno puesto ya no se consulta el gafete");
  assert.equal(TOPE_POR_GAFETE.maximo, 5);
  assert.equal(TOPE_POR_GAFETE.minutos, 15);
});

test("los intentos acertados también cuentan: nadie abre la ficha sin tope", async () => {
  const t = await armar();
  for (let i = 0; i < 5; i++) assert.equal((await t.pedir(CODIGO, PIN, `10.0.0.${i}`)).ok, true);
  assert.equal(await t.pedir(CODIGO, PIN, "10.0.0.9"), ESPERA);
});

test("freno por IP: 20 intentos por hora, repartidos entre los gafetes que sea", async () => {
  const t = await armar();
  const codigos = ["2222222222", "3333333333", "4444444444", "5555555555", "6666666666"];
  for (let i = 0; i < TOPE_POR_IP.maximo; i++) {
    assert.equal(await t.pedir(codigos[i % codigos.length], "000000", "9.9.9.9"), PIN_INCORRECTO);
  }
  assert.equal(await t.pedir(CODIGO, PIN, "9.9.9.9"), ESPERA_LARGA, "la IP se frena antes de mirar el gafete");
  assert.match(ESPERA_LARGA.motivo, /una hora/, "y no promete 15 minutos");
  assert.ok(!t.claves.slice(-1)[0].startsWith("gafete-pin:"), "y ese intento no se le cobra al gafete");
  assert.equal((await t.pedir(CODIGO, PIN, "8.8.8.8")).ok, true, "otra IP sigue pudiendo");
  assert.equal(TOPE_POR_IP.maximo, 20);
  assert.equal(TOPE_POR_IP.minutos, 60);
});

test("si el freno no puede contar, no se abre nada", async () => {
  const r = await resolverEmergencia({
    codigo: CODIGO, pin: PIN, ip: "1.1.1.1", llave: LLAVE,
    cabe: async () => false, // así contesta la acción cuando la base falla
    buscar: async () => { throw new Error("no debería buscar"); },
  });
  assert.equal(r.ok, false);
  assert.equal(r.espera, true);
});

test("si la base no contesta al buscar, se dice que no se pudo (no que el PIN está mal)", async () => {
  const r = await resolverEmergencia({
    codigo: CODIGO, pin: PIN, ip: "", llave: LLAVE,
    cabe: async () => true,
    buscar: async () => { throw new Error("se cayó"); },
  });
  assert.equal(r, SIN_RESPUESTA);
  assert.ok(ESPERA.espera && !PIN_INCORRECTO.espera && !SIN_RESPUESTA.espera);
});
