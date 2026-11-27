/**
 * ENTRAR A LA APP CON EL GAFETE — las reglas, sin Next ni Supabase.
 * Diseño: docs/superpowers/specs/2026-11-27-entrar-con-gafete-design.md
 *
 * El gafete solo abre sesión en el teléfono donde se vinculó. Por cada par
 * gafete–teléfono el servidor guarda el HASH de un secreto que vive en el
 * almacén seguro del teléfono (db/033, `gafete_telefonos`). Para entrar hay
 * que traer las tres cosas: el código (va en el QR, es público), la serie
 * del chip (no va en el QR) y el secreto de ese teléfono.
 *
 * El gafete NUNCA se bloquea por fallos: su código está impreso, así que
 * cualquiera con una foto del QR podría dejar fuera a su dueño. Lo que se
 * frena es el TELÉFONO: al 4.º fallo seguido pide entrar con correo.
 *
 * Se prueba en tests/gafete-acceso.test.mjs. Las apps llevan copia de
 * `TEXTOS_GAFETE` (tests/espejos-web.test.mjs de cada app).
 */

import { normalizarCodigo, codigoDeEnlace } from "./gafetes.mjs";
import { esUuid } from "./app-auth.mjs";

export const MAX_FALLOS_TELEFONO = 4;

/** Quiénes pueden entrar con gafete: el personal. Los clientes no tienen. */
export const ROLES_GAFETE = ["dueno", "admin", "operador"];

export const TEXTOS_GAFETE = {
  noEntra: "Este gafete no puede entrar en este teléfono.",
  usaCorreo: "Demasiados intentos con el gafete. Entra con tu correo.",
  sinCuenta: "Este gafete no está ligado a tu cuenta. Pídele a un administrador que lo ligue.",
  serieOtra: "Este no es el chip de tu gafete.",
};

const SECRETO_RE = /^[A-Za-z0-9_-]{43,128}$/;

/** La serie del chip ("04:a1:…") → "04A1…", o null si no parece serie. */
export function normalizarSerie(texto) {
  if (texto == null) return null;
  const limpio = String(texto).toUpperCase().replace(/[\s:-]/g, "");
  return /^[0-9A-F]{8,20}$/.test(limpio) ? limpio : null;
}

/** SHA-256 en hexadecimal. Es lo único que se guarda del secreto del teléfono. */
export async function hashSecreto(secreto) {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(secreto)));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Lo que manda la app. El código puede venir solo o como el enlace completo
 * que trae el chip. La serie puede faltar (iPhone que no la lee).
 */
export function validarPeticion({ codigo, serie, dispositivoId, secreto } = {}) {
  const c = normalizarCodigo(codigo) || codigoDeEnlace(codigo);
  if (!c || !esUuid(dispositivoId) || typeof secreto !== "string" || !SECRETO_RE.test(secreto)) return { ok: false };
  return { ok: true, codigo: c, serie: normalizarSerie(serie), dispositivoId, secreto };
}

/**
 * ¿Entra? `par` es el vínculo vigente de ESE gafete con ESE teléfono, o null.
 *
 * Sin vínculo no se cuenta el fallo: no hay teléfono al que frenar, y contar
 * por gafete dejaría bloquear a alguien con la foto de su QR. Con vínculo,
 * cualquier otra falla suma al teléfono.
 */
export function decidirEntrada({ gafete, empleado, perfil, par, serie, hashRecibido } = {}) {
  if (!par || par.desvinculado_en) return { ok: false, motivo: "noEntra", contarFallo: false };
  if (par.fallos >= MAX_FALLOS_TELEFONO) return { ok: false, motivo: "usaCorreo", contarFallo: false };
  const falla = { ok: false, motivo: "noEntra", contarFallo: true };
  if (gafete?.estado !== "vigente" || empleado?.estado !== "activo") return falla;
  if (!empleado.perfil_id || empleado.perfil_id !== par.perfil_id) return falla;
  if (!perfil || perfil.id !== par.perfil_id || perfil.activo === false || !ROLES_GAFETE.includes(perfil.rol)) return falla;
  if (par.exige_serie && (!serie || serie !== gafete.chip_serie)) return falla;
  if (!hashRecibido || hashRecibido !== par.secreto_hash) return falla;
  return { ok: true };
}

/** ¿Se puede vincular este gafete a la cuenta `uid` en este teléfono? */
export function decidirVinculo({ gafete, empleado, uid, serie } = {}) {
  if (gafete?.estado !== "vigente" || empleado?.estado !== "activo") return { ok: false, motivo: "noEntra" };
  if (!uid || empleado.perfil_id !== uid) return { ok: false, motivo: "sinCuenta" };
  if (gafete.chip_serie && serie && serie !== gafete.chip_serie) return { ok: false, motivo: "serieOtra" };
  return { ok: true, guardarSerie: !gafete.chip_serie && Boolean(serie), exigeSerie: Boolean(serie) };
}

/**
 * Las claves del freno de POST /gafete/entrar (además del freno por IP).
 *
 * El código es PÚBLICO (va en el QR): un freno solo por código dejaría que
 * cualquiera con la foto lo gastara cada 15 minutos y el dueño se quedara sin
 * entrar con su gafete (revisión final, 27-nov). Va junto con el teléfono:
 * los teléfonos inventados no tocan la clave del dueño. Contra adivinar no
 * hace falta más: el secreto es de 256 bits.
 */
export function clavesFreno({ codigo, dispositivoId }) {
  return [`app-gafete:${codigo}:${dispositivoId}`];
}

/**
 * ¿/gafete/pase puede dar el pase del segundo paso? Solo si el vínculo es de
 * esa cuenta y se hizo CON segundo paso (`con_pase`): un chofer que vinculó
 * sin código y luego lo hacen administrador no se lo salta así.
 */
export function puedeDarPase({ par, uid } = {}) {
  return Boolean(par && uid && par.perfil_id === uid && par.con_pase === true);
}

/**
 * ¿Vincular pide el segundo paso? Sí al dueño y a los administradores: el
 * gafete vinculado después les SALTA el código por correo, así que vincular
 * solo con la contraseña dejaría que quien la robe (y tenga el gafete un
 * momento) se quede sin código para siempre.
 */
export function vinculoExigePase(rol) {
  return rol === "dueno" || rol === "admin";
}

/**
 * ¿Se puede ligar esta cuenta al empleado `empleadoId`? Solo personal activo
 * (dueño, admin, chofer) y que no esté ligada ya a OTRO empleado activo: una
 * cuenta con dos gafetes sería un gafete prestado.
 */
export function puedeLigarse({ perfil, ligadoA, empleadoId } = {}) {
  if (!perfil || perfil.activo === false || !ROLES_GAFETE.includes(perfil.rol)) return false;
  return !ligadoA || ligadoA === empleadoId;
}

/** "OSCAR CLEMENTE" → "Oscar": el primer nombre, con mayúscula inicial. */
export function primerNombre(nombre) {
  const primero = String(nombre || "").trim().split(/\s+/)[0] || "";
  return primero ? primero.charAt(0).toLocaleUpperCase("es-MX") + primero.slice(1).toLocaleLowerCase("es-MX") : "";
}

/**
 * Lo que enseña la animación de bienvenida al entrar con el gafete. "¡Hola!"
 * y no "Bienvenido": en el sistema no está si es hombre o mujer (Andrei, 27-nov).
 */
export function bienvenidaDe(empleado) {
  const nombre = primerNombre(empleado?.nombre);
  return { nombre, saludo: nombre ? `¡Hola, ${nombre}!` : "¡Hola!", puesto: String(empleado?.puesto || "") };
}

/** Lo que contesta POST /api/app/gafete/entrar según la decisión (sin el tokenHash). */
export function respuestaEntrar(decision) {
  if (decision?.ok) return { status: 200, cuerpo: { ok: true } };
  if (decision?.motivo === "usaCorreo") {
    return { status: 423, cuerpo: { ok: false, motivo: TEXTOS_GAFETE.usaCorreo, usaCorreo: true } };
  }
  return { status: 401, cuerpo: { ok: false, motivo: TEXTOS_GAFETE.noEntra } };
}
