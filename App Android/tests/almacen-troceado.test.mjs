import { test } from "node:test";
import assert from "node:assert/strict";
import { crearAlmacenTroceado, trocear, bytesUtf8, BYTES_POR_TROZO } from "../src/almacen-troceado.js";

/** Un almacén de mentira, con tope de bytes como SecureStore. */
function almacenFalso({ tope = Infinity, roto = false } = {}) {
  const datos = new Map();
  return {
    datos,
    async getItem(k) {
      if (roto) throw new Error("keystore roto");
      return datos.has(k) ? datos.get(k) : null;
    },
    async setItem(k, v) {
      if (roto) throw new Error("keystore roto");
      if (bytesUtf8(v) > tope) throw new Error(`valor de ${bytesUtf8(v)} bytes`);
      datos.set(k, v);
    },
    async removeItem(k) {
      if (roto) throw new Error("keystore roto");
      datos.delete(k);
    },
  };
}

// Una sesión de Supabase de tamaño real (~4 KB), con acentos y un emoji.
const SESION = JSON.stringify({
  access_token: "a".repeat(1400),
  refresh_token: "r".repeat(40),
  user: { id: "u1", user_metadata: { nombre: "Ramón Cázares Peña 🚛" }, app_metadata: { rol: "cliente" } },
  relleno: "ñ".repeat(800),
});

test("trocear no corta letras y respeta el tope en bytes", () => {
  const partes = trocear(SESION, 100);
  assert.equal(partes.join(""), SESION);
  for (const p of partes) assert.ok(bytesUtf8(p) <= 100);
  assert.deepEqual(trocear(""), [""]);
  assert.deepEqual(trocear("🚛🚛", 4), ["🚛", "🚛"]);
});

test("una sesión grande se guarda en trozos y se lee completa", async () => {
  const seguro = almacenFalso({ tope: 2048 });
  const a = crearAlmacenTroceado({ seguro });
  await a.setItem("sb-x-auth-token", SESION);
  assert.ok(bytesUtf8(SESION) > BYTES_POR_TROZO);
  assert.match(seguro.datos.get("sb-x-auth-token"), /^trozos:\d+$/);
  assert.equal(await a.getItem("sb-x-auth-token"), SESION);
});

test("al achicarse no quedan trozos huérfanos; borrar limpia todo", async () => {
  const seguro = almacenFalso({ tope: 2048 });
  const a = crearAlmacenTroceado({ seguro });
  await a.setItem("k", SESION);
  await a.setItem("k", "corto");
  assert.equal(await a.getItem("k"), "corto");
  assert.deepEqual([...seguro.datos.keys()], ["k"]);
  await a.setItem("k", SESION);
  await a.removeItem("k");
  assert.equal(seguro.datos.size, 0);
  assert.equal(await a.getItem("k"), null);
});

test("migración: la sesión de AsyncStorage se muda y se borra del viejo", async () => {
  const seguro = almacenFalso({ tope: 2048 });
  const viejo = almacenFalso();
  viejo.datos.set("sb-x-auth-token", SESION);
  const a = crearAlmacenTroceado({ seguro, viejo });
  assert.equal(await a.getItem("sb-x-auth-token"), SESION);
  assert.equal(viejo.datos.has("sb-x-auth-token"), false);
  assert.equal(await crearAlmacenTroceado({ seguro }).getItem("sb-x-auth-token"), SESION);
});

test("un trozo perdido se trata como 'no hay sesión', no como JSON roto", async () => {
  const seguro = almacenFalso({ tope: 2048 });
  const a = crearAlmacenTroceado({ seguro });
  await a.setItem("k", SESION);
  seguro.datos.delete("k__1");
  assert.equal(await a.getItem("k"), null);
});

test("con el Keystore roto la sesión se guarda en el viejo y la app sigue", async () => {
  const avisos = [];
  const viejo = almacenFalso();
  const a = crearAlmacenTroceado({ seguro: almacenFalso({ roto: true }), viejo, aviso: (m) => avisos.push(m) });
  await a.setItem("k", SESION);
  assert.equal(viejo.datos.get("k"), SESION);
  assert.equal(await a.getItem("k"), SESION);
  assert.ok(avisos.length > 0);
});

test("un valor que empieza como índice no se confunde con uno", async () => {
  const seguro = almacenFalso({ tope: 2048 });
  const a = crearAlmacenTroceado({ seguro });
  await a.setItem("k", "trozos:2");
  assert.equal(await a.getItem("k"), "trozos:2");
});
