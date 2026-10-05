import { test } from "node:test";
import assert from "node:assert/strict";
import {
  partir,
  llaveSegura,
  cuantosTrozos,
  crearAlmacenTrozado,
  ENCABEZADO,
} from "../src/almacen-trozos.mjs";

/** Un llavero de mentira que además se queja como el de verdad. */
function llaveroFalso({ maxBytes = 2048 } = {}) {
  const m = new Map();
  return {
    m,
    async getItem(k) { return m.has(k) ? m.get(k) : null; },
    async setItem(k, v) {
      assert.match(k, /^[A-Za-z0-9._-]+$/, `llave inválida para SecureStore: ${k}`);
      assert.ok(Buffer.byteLength(v, "utf8") <= maxBytes, `valor de ${Buffer.byteLength(v)} bytes en ${k}`);
      assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(v), "medio emoji guardado");
      m.set(k, v);
    },
    async removeItem(k) { m.delete(k); },
  };
}

function almacenViejo(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    m,
    async getItem(k) { return m.has(k) ? m.get(k) : null; },
    async removeItem(k) { m.delete(k); },
  };
}

const sesionGrande = JSON.stringify({
  access_token: "a".repeat(1200),
  refresh_token: "r".repeat(40),
  user: { id: "u1", user_metadata: { nombre: "Panadería Martínez 🥖🥖🥖 ñandú", nota: "…€".repeat(700) }, extra: "x".repeat(2500) },
});

test("partir y volver a unir da el mismo texto", () => {
  const t = "abc".repeat(1000);
  const p = partir(t, 900);
  assert.equal(p.join(""), t);
  assert.ok(p.every((x) => x.length <= 900));
  assert.equal(p.length, 4);
  assert.equal(partir(t).length, 5, "con el tamaño por omisión (600)");
});

test("partir nunca corta un emoji por la mitad", () => {
  // 'x' + emoji: el corte natural (tam=2) caería entre las dos mitades.
  const t = "x🥖y🥖🥖z";
  for (let tam = 2; tam <= 6; tam++) {
    const p = partir(t, tam);
    assert.equal(p.join(""), t);
    for (const trozo of p) {
      assert.ok(!/[\ud800-\udbff]$/.test(trozo), `tam ${tam}: trozo termina en mitad alta`);
      assert.ok(!/^[\udc00-\udfff]/.test(trozo), `tam ${tam}: trozo empieza en mitad baja`);
    }
  }
});

test("partir de texto vacío no deja trozos", () => {
  assert.deepEqual(partir(""), []);
});

test("llaveSegura deja solo lo que acepta SecureStore", () => {
  assert.equal(llaveSegura("sb-abc123-auth-token"), "sb-abc123-auth-token");
  assert.equal(llaveSegura("sb:abc/123 auth"), "sb_abc_123_auth");
});

test("cuantosTrozos entiende solo encabezados bien formados", () => {
  assert.equal(cuantosTrozos(`${ENCABEZADO}3`), 3);
  assert.equal(cuantosTrozos(`${ENCABEZADO}0`), 0);
  assert.equal(cuantosTrozos(`${ENCABEZADO}x`), 0);
  assert.equal(cuantosTrozos('{"a":1}'), 0);
  assert.equal(cuantosTrozos(null), 0);
});

test("una sesión grande se guarda en trozos que caben y se lee completa", async () => {
  const seguro = llaveroFalso();
  const a = crearAlmacenTrozado({ seguro });
  await a.setItem("sb-x-auth-token", sesionGrande);
  assert.ok(seguro.m.get("sb-x-auth-token").startsWith(ENCABEZADO));
  assert.equal(await a.getItem("sb-x-auth-token"), sesionGrande);
});

test("un valor chico se guarda entero, sin encabezado", async () => {
  const seguro = llaveroFalso();
  const a = crearAlmacenTrozado({ seguro });
  await a.setItem("k", "hola");
  assert.equal(seguro.m.get("k"), "hola");
  assert.equal(await a.getItem("k"), "hola");
});

test("al reescribir más corto no quedan trozos huérfanos", async () => {
  const seguro = llaveroFalso();
  const a = crearAlmacenTrozado({ seguro });
  await a.setItem("k", "z".repeat(5000));
  const antes = [...seguro.m.keys()].length;
  await a.setItem("k", "y".repeat(1000));
  assert.ok([...seguro.m.keys()].length < antes);
  assert.equal(await a.getItem("k"), "y".repeat(1000));
  await a.setItem("k", "corto");
  assert.deepEqual([...seguro.m.keys()], ["k"]);
});

test("removeItem borra el encabezado y todos los trozos", async () => {
  const seguro = llaveroFalso();
  const a = crearAlmacenTrozado({ seguro });
  await a.setItem("k", sesionGrande);
  await a.removeItem("k");
  assert.equal(seguro.m.size, 0);
  assert.equal(await a.getItem("k"), null);
});

test("si falta un trozo se contesta null (nunca media sesión)", async () => {
  const seguro = llaveroFalso();
  const a = crearAlmacenTrozado({ seguro });
  await a.setItem("k", sesionGrande);
  seguro.m.delete("k.1");
  assert.equal(await a.getItem("k"), null);
});

test("MUDANZA: la sesión de la 1.0 en AsyncStorage pasa al llavero y se borra de allá", async () => {
  const seguro = llaveroFalso();
  const viejo = almacenViejo({ "sb-x-auth-token": sesionGrande });
  const a = crearAlmacenTrozado({ seguro, viejo });
  assert.equal(await a.getItem("sb-x-auth-token"), sesionGrande);
  assert.equal(viejo.m.has("sb-x-auth-token"), false, "debió borrarse del almacén viejo");
  // La siguiente lectura ya sale del llavero.
  const sinViejo = crearAlmacenTrozado({ seguro });
  assert.equal(await sinViejo.getItem("sb-x-auth-token"), sesionGrande);
});

test("MUDANZA: si el llavero falla, se devuelve la sesión y NO se borra la original", async () => {
  const seguro = llaveroFalso();
  seguro.setItem = async () => { throw new Error("llavero bloqueado"); };
  const viejo = almacenViejo({ k: "valor" });
  const a = crearAlmacenTrozado({ seguro, viejo });
  assert.equal(await a.getItem("k"), "valor");
  assert.equal(viejo.m.get("k"), "valor");
});

test("sin sesión en ningún lado contesta null", async () => {
  const a = crearAlmacenTrozado({ seguro: llaveroFalso(), viejo: almacenViejo() });
  assert.equal(await a.getItem("k"), null);
});

test("cerrar sesión limpia también la copia vieja (no resucita)", async () => {
  const seguro = llaveroFalso();
  const viejo = almacenViejo({ k: "valor" });
  const a = crearAlmacenTrozado({ seguro, viejo });
  await a.removeItem("k");
  assert.equal(viejo.m.has("k"), false);
  assert.equal(await a.getItem("k"), null);
});
