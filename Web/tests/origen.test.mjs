import { test } from "node:test";
import assert from "node:assert/strict";
import { origenPermitido, hostPermitido, partirHost, ORIGEN_FIJO } from "../lib/origen.mjs";

/** Imita los `headers()` de Next: sólo hace falta `.get()`. */
const cab = (o) => ({ get: (k) => o[k.toLowerCase()] ?? null });

test("el host normal sale bien", () => {
  assert.equal(origenPermitido(cab({ "x-forwarded-host": "morcast.mx" })), "https://morcast.mx");
  assert.equal(origenPermitido(cab({ host: "morcast.mx" })), "https://morcast.mx");
  assert.equal(origenPermitido(cab({ "x-forwarded-host": "www.morcast.mx" })), "https://www.morcast.mx");
});

test("sin cabeceras cae al fijo", () => {
  assert.equal(origenPermitido(cab({})), ORIGEN_FIJO);
});

// ─────────────────────────────────────────────────────────────────────
// LOS CUATRO AGUJEROS DE LA PRIMERA VERSION. Si alguien los reabre, aqui
// truena. El enlace que sale por aqui lleva un token que da acceso a la
// cuenta: acabar en otro dominio es lo peor que puede pasar.
// ─────────────────────────────────────────────────────────────────────

test("AGUJERO 1: el respaldo tambien valida — un Host mentido NO pasa", () => {
  // Sin x-forwarded-host y con Host ajeno: antes se usaba tal cual.
  assert.equal(origenPermitido(cab({ host: "evil.com" })), ORIGEN_FIJO);
});

test("AGUJERO 2: el truco de las credenciales NO pasa", () => {
  // `morcast.mx:@evil.com` -> antes el filtro veia "morcast.mx" y la URL
  // terminaba apuntando a evil.com.
  for (const malo of ["morcast.mx:@evil.com", "morcast.mx:8080@evil.com", "user@evil.com"]) {
    const r = origenPermitido(cab({ "x-forwarded-host": malo }));
    assert.equal(r, ORIGEN_FIJO, `deberia rechazar ${malo}, salio ${r}`);
    assert.ok(!r.includes("evil.com"), `evil.com se colo con ${malo}`);
  }
});

test("AGUJERO 3: las mayusculas son el mismo host, no un desconocido", () => {
  assert.equal(origenPermitido(cab({ "x-forwarded-host": "Morcast.MX" })), "https://morcast.mx");
  assert.equal(origenPermitido(cab({ "x-forwarded-host": "MORCAST.MX." })), "https://morcast.mx");
});

test("AGUJERO 4: en produccion el enlace NUNCA sale por http", () => {
  const r = origenPermitido(cab({ "x-forwarded-host": "morcast.mx", "x-forwarded-proto": "http" }));
  assert.equal(r, "https://morcast.mx");
  assert.ok(r.startsWith("https://"), "el token no puede viajar en claro");
});

// ─────────────────────────────────────────────────────────────────────

test("cabeceras acumuladas por comas: manda la primera, y se valida", () => {
  assert.equal(origenPermitido(cab({ "x-forwarded-host": "morcast.mx, interno" })), "https://morcast.mx");
  assert.equal(origenPermitido(cab({ "x-forwarded-host": "evil.com, morcast.mx" })), ORIGEN_FIJO);
  assert.equal(
    origenPermitido(cab({ "x-forwarded-host": "morcast.mx", "x-forwarded-proto": "https,http" })),
    "https://morcast.mx"
  );
});

test("las vistas previas de Vercel valen; un dominio que solo las imita, no", () => {
  assert.equal(
    origenPermitido(cab({ "x-forwarded-host": "morcast-abc-studias.vercel.app" })),
    "https://morcast-abc-studias.vercel.app"
  );
  assert.equal(origenPermitido(cab({ "x-forwarded-host": "vercel.app.evil.com" })), ORIGEN_FIJO);
  assert.equal(origenPermitido(cab({ "x-forwarded-host": "novercel.app" })), ORIGEN_FIJO);
});

test("localhost es el UNICO que puede ir por http, y ahi es lo normal", () => {
  // Sin esto `npm run dev` armaria enlaces https://localhost:3000, que no abren.
  assert.equal(origenPermitido(cab({ host: "localhost:3000" })), "http://localhost:3000");
  assert.equal(
    origenPermitido(cab({ "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "http" })),
    "http://localhost:3000"
  );
  // Si el proxy local dice https, se respeta.
  assert.equal(
    origenPermitido(cab({ "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "https" })),
    "https://localhost:3000"
  );
  // Pero morcast.mx JAMAS baja a http, diga lo que diga la cabecera.
  assert.equal(
    origenPermitido(cab({ "x-forwarded-host": "morcast.mx", "x-forwarded-proto": "http" })),
    "https://morcast.mx"
  );
});

test("si el primer candidato no sirve, se prueba el segundo", () => {
  assert.equal(
    origenPermitido(cab({ "x-forwarded-host": "evil.com", host: "morcast.mx" })),
    "https://morcast.mx"
  );
});

test("partirHost rechaza lo que no tiene forma de host", () => {
  for (const malo of ["a/b", "a?b", "a#b", "con espacio", "a:b:c", "morcast.mx:abc", "a\\b", ""]) {
    assert.equal(partirHost(malo), null, `deberia rechazar ${JSON.stringify(malo)}`);
  }
  assert.deepEqual(partirHost("morcast.mx:443"), { host: "morcast.mx", puerto: "443" });
});

test("hostPermitido dice que si solo a los nuestros", () => {
  ["morcast.mx", "WWW.MORCAST.MX", "x.vercel.app", "localhost", "127.0.0.1"].forEach((h) =>
    assert.equal(hostPermitido(h), true, h)
  );
  ["evil.com", "morcast.mx.evil.com", "vercel.app.evil.com", "", null].forEach((h) =>
    assert.equal(hostPermitido(h), false, String(h))
  );
});
