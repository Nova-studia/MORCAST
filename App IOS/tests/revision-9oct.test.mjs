import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { queHacerConSesionGuardada } from "../src/apps-sesion.mjs";
import { textoFallo, falloDePermisos } from "../src/resultado.js";

// Revisión 9-oct (I2): tras una hora en segundo plano, getSession() intenta
// renovar; si la cuenta la revocaron, borra la sesión y devuelve el error.
// Antes se contestaba "ok" y la app se quedaba "zombi".
test("sesión guardada que se perdió al renovar → se dice por qué", () => {
  assert.equal(queHacerConSesionGuardada({ session: null, error: null }), "ok");
  assert.equal(queHacerConSesionGuardada({ session: null, error: { name: "AuthApiError", status: 400, code: "refresh_token_not_found" } }), "sesion");
  assert.equal(queHacerConSesionGuardada({ session: null, error: { name: "AuthApiError", status: 400, code: "user_banned", message: "User is banned" } }), "baja");
  assert.equal(queHacerConSesionGuardada({ session: null, error: { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" } }), "red");
  // Con sesión, se sigue a preguntarle al servidor.
  assert.equal(queHacerConSesionGuardada({ session: { access_token: "x" }, error: null }), null);
});

// I3: un 500, un 429 o "sin_sesion" dejaban al dueño sin secciones hasta
// reiniciar la app. Solo el segundo paso se queda dicho.
test("mis-permisos: todo fallo se reintenta salvo el segundo paso", () => {
  assert.equal(falloDePermisos({ ok: false, sinRed: true }).reintentar, true);
  assert.equal(falloDePermisos({ ok: false, motivo: "Algo falló en el servidor. Inténtalo otra vez." }).reintentar, true);
  assert.equal(falloDePermisos({ ok: false, motivo: "Demasiados intentos." }).reintentar, true);
  const s = falloDePermisos({ ok: false, motivo: "sin_sesion" });
  assert.equal(s.reintentar, true);
  assert.ok(!s.fallo.motivo.includes("sin_sesion"));
  assert.equal(falloDePermisos({ ok: false, segundoPaso: true }).reintentar, false);
  assert.equal(falloDePermisos(null).reintentar, true);
});

// Menor 1: "Sin conexión. Sin conexión con Morcast…".
test("el aviso sin red no repite 'Sin conexión'", () => {
  assert.equal(textoFallo({ sinRed: true, motivo: "Sin conexión con Morcast. Revisa tu señal e inténtalo otra vez." }), "Sin conexión con Morcast. Revisa tu señal e inténtalo otra vez.");
  assert.equal(textoFallo({ sinRed: true, motivo: "No se leyó la ficha." }), "Sin conexión. No se leyó la ficha.");
  assert.equal(textoFallo({ sinRed: false, motivo: "Ese chofer no está activo." }), "Ese chofer no está activo.");
});

// I1: en React Navigation 7, navigate() ya no regresa: apilaba otra
// "Recolecciones" y "Atrás" volvía al formulario lleno (dos recolecciones).
test("al crear una recolección se regresa a la lista, no se apila", () => {
  const s = readFileSync(new URL("../src/pantallas/admin/NuevaRecoleccion.js", import.meta.url), "utf8");
  assert.ok(!/navigation\.navigate\("Recolecciones"/.test(s));
  assert.ok(/navigation\.popTo\("Recolecciones"/.test(s));
});
