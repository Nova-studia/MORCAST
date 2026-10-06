import { test } from "node:test";
import assert from "node:assert/strict";

import {
  modoDeRol, esquemaIosDe, esquemasDelPlugin, configGoogle, esErrorDeRed, mensajeDeError,
  nombreDeApple, nombreParaGuardar, resultadoDeRevision, textoPendiente,
} from "../src/entrada-social.js";

/* ---------------- A dónde va cada quien ---------------- */

test("cada rol va a su modo, igual que casaDe() de la web", () => {
  assert.equal(modoDeRol("cliente"), "cliente");
  assert.equal(modoDeRol("dueno"), "admin");
  assert.equal(modoDeRol("admin"), "admin");
  assert.equal(modoDeRol("operador"), "chofer");
});

test("sin rol conocido es pendiente (nunca se bautiza cliente a nadie)", () => {
  assert.equal(modoDeRol(undefined), "pendiente");
  assert.equal(modoDeRol(null), "pendiente");
  assert.equal(modoDeRol(""), "pendiente");
  assert.equal(modoDeRol("Cliente"), "pendiente");
  assert.equal(modoDeRol("pendiente"), "pendiente");
});

/* ---------------- Cuándo se ofrece Google ---------------- */

const ID_IOS = "731912259235-abc123.apps.googleusercontent.com";
const ESQUEMA = "com.googleusercontent.apps.731912259235-abc123";
const WEB = "731912259235-web.apps.googleusercontent.com";

test("el esquema de iOS sale del ID del cliente de iOS", () => {
  assert.equal(esquemaIosDe(ID_IOS), ESQUEMA);
  assert.equal(esquemaIosDe(""), null);
  assert.equal(esquemaIosDe("cualquier-cosa"), null);
});

test("lee el iosUrlScheme del plugin de Google en app.json", () => {
  const plugins = ["expo-font", ["@react-native-google-signin/google-signin", { iosUrlScheme: ESQUEMA }], ["expo-camera", {}]];
  assert.deepEqual(esquemasDelPlugin(plugins), [ESQUEMA]);
  assert.deepEqual(esquemasDelPlugin(["expo-font"]), []);
  assert.equal(esquemasDelPlugin(undefined), null);
});

test("Android: basta el ID web", () => {
  assert.equal(configGoogle({ plataforma: "android", webClientId: WEB }).ok, true);
  assert.equal(configGoogle({ plataforma: "android", webClientId: "" }).ok, false);
});

test("Expo Go nunca ofrece Google (no trae el módulo nativo)", () => {
  assert.equal(configGoogle({ plataforma: "android", enExpoGo: true, webClientId: WEB }).ok, false);
  assert.equal(configGoogle({ plataforma: "ios", enExpoGo: true, webClientId: WEB, iosClientId: ID_IOS }).ok, false);
});

test("iPhone: hacen falta el ID web y el de iOS", () => {
  assert.equal(configGoogle({ plataforma: "ios", webClientId: WEB, iosClientId: ID_IOS }).ok, true);
  assert.equal(configGoogle({ plataforma: "ios", webClientId: WEB }).ok, false);
  assert.equal(configGoogle({ plataforma: "ios", iosClientId: ID_IOS }).ok, false);
});

test("iPhone: con el PENDIENTE-IOS en app.json no sale el botón (Google cerraría la app)", () => {
  const pendiente = ["com.googleusercontent.apps.PENDIENTE-IOS"];
  const r = configGoogle({ plataforma: "ios", webClientId: WEB, iosClientId: ID_IOS, esquemasIos: pendiente });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /PENDIENTE-IOS/);
  assert.equal(configGoogle({ plataforma: "ios", webClientId: WEB, iosClientId: ID_IOS, esquemasIos: [ESQUEMA] }).ok, true);
  // Sin la configuración a la mano no se puede saber: se confía.
  assert.equal(configGoogle({ plataforma: "ios", webClientId: WEB, iosClientId: ID_IOS, esquemasIos: null }).ok, true);
});

test("en la web de Expo no hay Google nativo", () => {
  assert.equal(configGoogle({ plataforma: "web", webClientId: WEB }).ok, false);
});

/* ---------------- Mensajes de error ---------------- */

const CODIGOS_ANDROID = { SIGN_IN_CANCELLED: "12501", IN_PROGRESS: "ASYNC_OP_IN_PROGRESS", PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE" };

test("cancelar no es un error: no se avisa nada", () => {
  assert.equal(mensajeDeError({ code: "12501" }, { codigos: CODIGOS_ANDROID }), null);
  assert.equal(mensajeDeError({ code: "ERR_REQUEST_CANCELED" }, { proveedor: "Apple" }), null);
});

test("sin servicios de Google Play, sin red y en curso tienen su propio mensaje", () => {
  assert.match(mensajeDeError({ code: "PLAY_SERVICES_NOT_AVAILABLE" }, { codigos: CODIGOS_ANDROID }), /Google Play/);
  assert.match(mensajeDeError({ code: "7", message: "NETWORK_ERROR" }, { codigos: CODIGOS_ANDROID }), /conexión/);
  assert.match(mensajeDeError({ name: "AuthRetryableFetchError", message: "Network request failed" }), /conexión/);
  assert.match(mensajeDeError({ code: "ASYNC_OP_IN_PROGRESS" }, { codigos: CODIGOS_ANDROID }), /Espera/);
});

test("cualquier otro error da un mensaje en español con el proveedor", () => {
  assert.match(mensajeDeError(new Error("Invalid nonce"), { proveedor: "Apple" }), /No se pudo entrar con Apple/);
  assert.match(mensajeDeError(undefined), /No se pudo entrar con Google/);
});

test("esErrorDeRed no confunde un error de la cuenta con uno de señal", () => {
  assert.equal(esErrorDeRed({ message: "Invalid Refresh Token: Refresh Token Not Found" }), false);
  assert.equal(esErrorDeRed(null), false);
  assert.equal(esErrorDeRed({ message: "Failed to fetch" }), true);
});

/* ---------------- El nombre que da Apple ---------------- */

test("arma el nombre de Apple y lo deja vacío si no vino", () => {
  assert.equal(nombreDeApple({ givenName: "Guillermo", familyName: "Cortez", middleName: null }), "Guillermo Cortez");
  assert.equal(nombreDeApple({ givenName: null, familyName: null }), "");
  assert.equal(nombreDeApple(null), "");
});

test("guarda el nombre sólo si no había uno", () => {
  assert.deepEqual(nombreParaGuardar({ user_metadata: {} }, "Ana López"), { nombre: "Ana López", full_name: "Ana López" });
  assert.equal(nombreParaGuardar({ user_metadata: { nombre: "Ya" } }, "Ana"), null);
  assert.equal(nombreParaGuardar({ user_metadata: { full_name: "Ya" } }, "Ana"), null);
  assert.equal(nombreParaGuardar({ user_metadata: {} }, "  "), null);
});

/* ---------------- "Ya me activaron — revisar" ---------------- */

const SESION = { access_token: "x" };

test("con sello nuevo entra al modo de su rol", () => {
  assert.deepEqual(resultadoDeRevision({ usuario: { app_metadata: { rol: "cliente" } }, sesion: SESION }), { tipo: "activo", modo: "cliente" });
  assert.deepEqual(resultadoDeRevision({ usuario: { app_metadata: { rol: "dueno" } }, sesion: SESION }), { tipo: "activo", modo: "admin" });
});

test("sin sello todavía: sin novedad", () => {
  assert.deepEqual(resultadoDeRevision({ usuario: { app_metadata: {} }, sesion: SESION }), { tipo: "sin-novedad" });
});

test("sesión revocada (al activar le pusieron contraseña) no es 'todavía no'", () => {
  assert.deepEqual(resultadoDeRevision({ error: { message: "Invalid Refresh Token" } }), { tipo: "sesion-cerrada" });
  assert.deepEqual(resultadoDeRevision({}), { tipo: "sesion-cerrada" });
});

test("sin señal tampoco es 'todavía no'", () => {
  assert.deepEqual(resultadoDeRevision({ error: { name: "AuthRetryableFetchError", message: "x" } }), { tipo: "sin-red" });
});

/* ---------------- Textos de la sala de espera ---------------- */

test("sin solicitud pide completar el alta en morcast.mx", () => {
  const t = textoPendiente(null);
  assert.equal(t.pedirAlta, true);
  assert.match(t.cuerpo, /complétala en morcast\.mx con esta misma cuenta/);
});

test("con solicitud dice que está en revisión y da el folio", () => {
  const t = textoPendiente({ folio: "MOR-2026-0042" });
  assert.equal(t.titulo, "Tu alta está en revisión");
  assert.equal(t.folio, "MOR-2026-0042");
  assert.equal(t.pedirAlta, false);
});
