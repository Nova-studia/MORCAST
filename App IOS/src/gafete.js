import { Platform, Alert } from "react-native";
import NfcManager, { NfcTech, NfcError } from "react-native-nfc-manager";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { supabase, haySupabase } from "./supabase";
import { paseActual } from "./pase-admin";
import { WEB, postWeb } from "./api-web";
import { llaveroApp as almacenSecreto } from "./almacen-seguro";
import {
  LLAVE_TELEFONO, LLAVE_BLOQUEO, TEXTOS_GAFETE, datosDelTag, nuevoSecreto, secretoDe, conSecretoNuevo,
} from "./gafete-login.mjs";

/**
 * ENTRAR CON EL GAFETE — lo que toca el NFC, el almacén seguro y la red.
 * Diseño: docs/superpowers/specs/2026-11-27-entrar-con-gafete-design.md
 * Las reglas puras están en gafete-login.mjs (con pruebas).
 *
 * La identidad del teléfono (`LLAVE_TELEFONO`) se crea la primera vez que se
 * vincula y NO se borra al cerrar sesión: es lo que deja volver a entrar
 * acercando el gafete. Vive en el llavero del iPhone (solo de este aparato).
 *
 * Igual a App Android/src/gafete.js salvo el almacén (llavero), las
 * llamadas (`postWeb`) y el nombre del aparato.
 */

/** Mismo contrato que `postApp` de Android: `{ ok, ... }` y nunca lanza. */
const postApp = (ruta, cuerpo, opciones) => postWeb(`/api/app/${ruta}`, cuerpo, opciones);

const SIN_RED = "No hay conexión con Morcast. Revisa tu señal e inténtalo otra vez.";

let arranque = null;
function arrancar() {
  if (!arranque) arranque = NfcManager.start().catch((e) => { arranque = null; throw e; });
  return arranque;
}

/** ¿Hay NFC y está encendido? Nunca lanza. */
export async function nfcDisponible() {
  try {
    const hayNfc = await NfcManager.isSupported();
    if (!hayNfc) return { hayNfc: false, nfcEncendido: false };
    await arrancar();
    return { hayNfc: true, nfcEncendido: await NfcManager.isEnabled() };
  } catch {
    return { hayNfc: false, nfcEncendido: false };
  }
}

/*
 * Las operaciones del NFC van EN FILA (revisión final, 27-nov). En Android
 * `cancelTechnologyRequest` tarda ~1 s y al final desregistra la lectura: si
 * otra lectura empezaba en ese segundo, se quedaba colgada y el teléfono le
 * pasaba el gafete al navegador. Ninguna lectura arranca hasta que terminó
 * la cancelación anterior.
 */
let fila = Promise.resolve();
let cancelando = Promise.resolve();
const enFila = (tarea) => {
  const turno = fila.then(() => cancelando).then(tarea);
  fila = turno.catch(() => {});
  return turno;
};

/** Tope para esperar un gafete (Android no enseña hoja propia que se pueda cerrar). */
const ESPERA_LECTURA_MS = 45000;

/**
 * Espera un gafete y devuelve `{ codigo, serie }`.
 * Lanza `{ cancelado: true }` si se cancela, `{ tiempo: true }` si nadie lo
 * acercó a tiempo (con `conTope`), o `{ mensaje }` si el chip no es un gafete.
 */
export function leerGafete({ conTope = false } = {}) {
  return enFila(async () => {
    await arrancar();
    let reloj = null;
    let seAcabo = false;
    try {
      if (conTope) {
        reloj = setTimeout(() => { seAcabo = true; dejarDeLeer(); }, ESPERA_LECTURA_MS);
      }
      await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage: "Acerca tu gafete a la parte de arriba del iPhone." });
      const datos = datosDelTag(await NfcManager.getTag());
      if (!datos) throw { mensaje: "Ese chip no es un gafete de Morcast." };
      return datos;
    } catch (e) {
      if (e?.mensaje) throw e;
      if (seAcabo) throw { tiempo: true, mensaje: "No se acercó ningún gafete. Inténtalo otra vez." };
      if (e instanceof NfcError.UserCancel) throw { cancelado: true };
      throw { mensaje: "No se pudo leer el gafete. Déjalo quieto junto al teléfono e inténtalo otra vez." };
    } finally {
      if (reloj) clearTimeout(reloj);
      await cancelar();
    }
  });
}

/** Cancela y deja anotado cuándo termina, para que la siguiente lectura lo espere. */
function cancelar() {
  cancelando = cancelando.then(() => NfcManager.cancelTechnologyRequest().catch(() => {}));
  return cancelando;
}

/** Deja de esperar un gafete (al salir de la pantalla o con "Cancelar"). */
export function dejarDeLeer() {
  return cancelar();
}

/*
 * La identidad va directo a SecureStore con `WHEN_UNLOCKED_THIS_DEVICE_ONLY`:
 * NO entra en los respaldos de iCloud ni de la computadora. Si se restaurara
 * en otro teléfono, ese teléfono entraría con el gafete sin haberse vinculado
 * (revisión final). En Android el Keystore ya es de este aparato.
 */
const OPCIONES_LLAVERO = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

async function leerIdentidad() {
  try {
    const crudo = await SecureStore.getItemAsync(LLAVE_TELEFONO, OPCIONES_LLAVERO);
    const id = crudo ? JSON.parse(crudo) : null;
    return id?.dispositivoId && id?.secretos ? id : null;
  } catch {
    return null;
  }
}

/** Secreto NUEVO para este gafete en este teléfono (crea el teléfono si no había). */
async function nuevaIdentidadPara(codigo) {
  const id = conSecretoNuevo(await leerIdentidad(), codigo, nuevoSecreto(Crypto.getRandomBytes(32)), Crypto.randomUUID());
  await SecureStore.setItemAsync(LLAVE_TELEFONO, JSON.stringify(id), OPCIONES_LLAVERO);
  return id;
}

const nombreAparato = () => (Platform.OS === "ios" ? "iPhone" : "Teléfono");

async function postSinSesion(ruta, cuerpo) {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), 20000);
  try {
    const r = await fetch(`${WEB}/api/app/${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: corte.signal,
    });
    let datos = {};
    try { datos = await r.json(); } catch { /* sin JSON */ }
    return { status: r.status, ...datos, ok: Boolean(r.ok && datos.ok) };
  } catch {
    return { ok: false, red: true, motivo: SIN_RED };
  } finally {
    clearTimeout(reloj);
  }
}

/** ¿Este teléfono ya pidió entrar con correo por los intentos fallidos? */
export async function bloqueadoLocal() {
  try { return (await almacenSecreto.getItem(LLAVE_BLOQUEO)) === "1"; } catch { return false; }
}

/**
 * Lee el gafete y le pregunta al servidor si entra en este teléfono.
 * → `{ ok:true, tokenHash, prueba }` (la prueba sirve para pedir el pase del admin)
 * → `{ ok:false, mensaje, usaCorreo?, cancelado? }`
 */
export async function probarGafete() {
  let datos;
  try { datos = await leerGafete(); } catch (e) { return { ok: false, cancelado: Boolean(e?.cancelado), mensaje: e?.mensaje || "" }; }
  const id = await leerIdentidad();
  const secreto = secretoDe(id, datos.codigo);
  // Este gafete nunca se vinculó aquí: se dice lo mismo que el servidor.
  if (!secreto) return { ok: false, mensaje: TEXTOS_GAFETE.noEntra };
  const prueba = { codigo: datos.codigo, serie: datos.serie, dispositivoId: id.dispositivoId, secreto };
  const r = await postSinSesion("gafete/entrar", prueba);
  if (r.ok && r.tokenHash) return { ok: true, tokenHash: r.tokenHash, prueba };
  if (r.usaCorreo) await almacenSecreto.setItem(LLAVE_BLOQUEO, "1").catch(() => {});
  return { ok: false, usaCorreo: Boolean(r.usaCorreo), mensaje: r.motivo || TEXTOS_GAFETE.noEntra };
}

/** Pide el pase del segundo paso con la misma prueba (dueño y administradores). */
export function pedirPase(prueba) {
  return postApp("gafete/pase", prueba);
}

/** Con sesión: lee el gafete y lo vincula a este teléfono. → `{ ok, nombre }` o `{ ok:false, mensaje, cancelado? }` */
export async function vincularGafete() {
  let datos;
  try { datos = await leerGafete({ conTope: true }); } catch (e) { return { ok: false, cancelado: Boolean(e?.cancelado), mensaje: e?.mensaje || "" }; }
  let id;
  try { id = await nuevaIdentidadPara(datos.codigo); } catch { return { ok: false, mensaje: "Este teléfono no pudo guardar la llave del gafete." }; }
  const pase = (await paseActual().catch(() => null)) || undefined; // dueño y admins (el servidor lo exige)
  const r = await postApp("gafete/vincular", {
    ...datos, dispositivoId: id.dispositivoId, secreto: secretoDe(id, datos.codigo), aparato: nombreAparato(), pase,
  });
  if (!r.ok) return { ok: false, mensaje: r.motivo || "No se pudo vincular. Inténtalo otra vez." };
  await almacenSecreto.removeItem(LLAVE_BLOQUEO).catch(() => {});
  await yaPreguntado(await uidActual(), true);
  return { ok: true, nombre: r.nombre || "" };
}

/**
 * Tras entrar con correo, Google o Apple: este teléfono vuelve a aceptar el
 * gafete. Nunca lanza ni detiene el inicio de sesión.
 */
export async function reiniciarIntentos() {
  try {
    await almacenSecreto.removeItem(LLAVE_BLOQUEO);
    const id = await leerIdentidad();
    if (id) await postApp("gafete/telefono", { dispositivoId: id.dispositivoId, accion: "reiniciar" }, { espera: 8000 });
  } catch { /* se reintenta en el siguiente inicio de sesión */ }
}

/** ¿Este teléfono tiene vinculado algún gafete? (no pregunta al servidor) */
export async function telefonoConIdentidad() {
  return Boolean(await leerIdentidad());
}

/** Quita los vínculos de ESTA cuenta en este teléfono. */
export async function desvincularEsteTelefono() {
  const id = await leerIdentidad();
  if (!id) return { ok: true };
  const r = await postApp("gafete/telefono", { dispositivoId: id.dispositivoId, accion: "desvincular" });
  return r.ok ? { ok: true } : { ok: false, mensaje: r.motivo || "No se pudo desvincular." };
}

/* ---------------------------------------------------------------- *
 * "¿Vincular tu gafete a este teléfono?" tras entrar con correo     *
 * ---------------------------------------------------------------- */

const LLAVE_PREGUNTADOS = "morcast_gafete_preguntados";

async function uidActual() {
  if (!haySupabase()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch {
    return null;
  }
}

/** Lee (o anota, con `marcar`) que a esta cuenta ya se le preguntó en este teléfono. */
async function yaPreguntado(uid, marcar = false) {
  if (!uid) return true;
  let lista = [];
  try { lista = JSON.parse((await almacenSecreto.getItem(LLAVE_PREGUNTADOS)) || "[]"); } catch { lista = []; }
  if (!marcar) return lista.includes(uid);
  if (!lista.includes(uid)) {
    lista.push(uid);
    await almacenSecreto.setItem(LLAVE_PREGUNTADOS, JSON.stringify(lista.slice(-20))).catch(() => {});
  }
  return true;
}

/** Entró con el gafete: ya está vinculado, no se le vuelve a preguntar. */
export async function anotarEntradaConGafete() {
  await yaPreguntado(await uidActual(), true);
}

/**
 * Le ofrece una sola vez por cuenta y teléfono vincular su gafete. Se llama
 * cuando ya entró del todo (chofer: al entrar; dueño y admins: tras su código
 * por correo, porque vincular lo exige). "Ahora no" no vuelve a preguntar;
 * queda el botón en Mi cuenta. Nunca lanza.
 */
export async function ofrecerVincular() {
  try {
    const uid = await uidActual();
    if (!uid || (await yaPreguntado(uid))) return;
    const { hayNfc } = await nfcDisponible();
    if (!hayNfc) return;
    await yaPreguntado(uid, true);
    Alert.alert(
      "¿Vincular tu gafete a este teléfono?",
      Platform.OS === "android"
        ? "La próxima vez entras con solo acercarlo. Toca Vincular y acerca tu gafete a la parte de atrás del teléfono."
        : "La próxima vez entras con solo acercarlo, sin escribir tu contraseña.",
      [
        { text: "Ahora no", style: "cancel" },
        {
          text: "Vincular",
          onPress: async () => {
            const r = await vincularGafete();
            if (r.cancelado) return;
            Alert.alert(r.ok ? "Gafete vinculado" : "No se pudo vincular",
              r.ok ? "Ya puedes entrar acercando tu gafete." : r.mensaje || "Inténtalo desde Mi cuenta.");
          },
        },
      ],
    );
  } catch { /* nunca estorba la entrada */ }
}
