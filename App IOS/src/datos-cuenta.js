import { supabase, haySupabase } from "./supabase";
import { accionAdmin, accionApp } from "./accion";
import { resultado, DEMO, SIN_CONEXION } from "./resultado";
import { esCuentaDeMuestra } from "./cuenta-muestra";
import { CLIENTE } from "./datos";
import { queHacerConSesionGuardada } from "./apps-sesion.mjs";
import { tieneContrasena, validarMisDatos, aplicarCambioLocal } from "./apps-cliente.mjs";
import { quePasaConLaSesion } from "./apps-sesion.mjs";
import { puntosAgendables } from "./web/puntos-cliente.mjs";
import { validarDatosCliente } from "./web/cuenta-cliente.mjs";

/**
 * MI CUENTA Y LO QUE EL CLIENTE YA PODÍA HACER EN EL PORTAL (9-oct-2026,
 * apps al 100%).
 *
 * Igual que el resto de la app:
 *  · LEER y lo que el RLS deja (su perfil, el estado de su empresa, sus
 *    puntos) va directo a Supabase con la sesión;
 *  · lo que pide reglas del servidor, correo o bitácora (contraseña, datos de
 *    contacto de la empresa, cancelar o reagendar) va por la puerta única
 *    `/api/app/accion/<nombre>` (src/accion.js).
 *
 * Sin base (demostración) todo contesta algo sensato y nada truena. La
 * cuenta de muestra del revisor de Apple NO cambia su contraseña ni toca
 * sus solicitudes sembradas: el siguiente revisor tiene que encontrarlas
 * igual (ver cuenta-muestra.js).
 */

/* ==================================================================== */
/* LA SESIÓN, PREGUNTADA AL SERVIDOR                                    */
/* ==================================================================== */

/**
 * ¿La sesión guardada sigue valiendo? "ok" | "baja" | "sesion" | "red"
 * (ver apps-sesion.mjs). Nunca lanza: un tropiezo raro cuenta como "red",
 * que es "no se toca nada".
 */
export async function comprobarSesionServidor() {
  if (!haySupabase()) return "ok";
  try {
    // Si al renovar el servidor dijo "ya no", auth-js borra la sesión y deja
    // el error: ese también cuenta (revisión 9-oct).
    const { data: { session } = {}, error: errSesion } = await supabase.auth.getSession();
    const antes = queHacerConSesionGuardada({ session, error: errSesion });
    if (antes) return antes;
    const { error } = await supabase.auth.getUser();
    return quePasaConLaSesion(error);
  } catch (e) {
    return quePasaConLaSesion(e) === "baja" ? "baja" : "red";
  }
}

/* ==================================================================== */
/* MI PERFIL (todos: cliente, personal y chofer)                        */
/* ==================================================================== */

/** `{ ok, nombre, telefono, correo, tieneContrasena }` o `{ ok:false, sinRed?, motivo }`. */
export async function miPerfilPropio() {
  if (!haySupabase()) {
    return { ok: true, demo: true, nombre: CLIENTE.contacto, telefono: "", correo: CLIENTE.correo, tieneContrasena: true };
  }
  try {
    const { data: { user }, error: e1 } = await supabase.auth.getUser();
    if (e1 || !user) {
      return quePasaConLaSesion(e1) === "red"
        ? { ok: false, sinRed: true, motivo: SIN_CONEXION }
        : { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
    }
    const { data, error } = await supabase.from("perfiles").select("nombre, telefono").eq("id", user.id).maybeSingle();
    if (error) return { ok: false, sinRed: true, motivo: SIN_CONEXION };
    return {
      ok: true,
      id: user.id,
      nombre: data?.nombre || user.user_metadata?.nombre || "",
      telefono: data?.telefono || "",
      correo: user.email || "",
      tieneContrasena: tieneContrasena(user),
    };
  } catch {
    return { ok: false, sinRed: true, motivo: SIN_CONEXION };
  }
}

/**
 * Guarda MI nombre y teléfono. Directo a la base: `perfiles_edita_el_suyo`
 * (db/002) deja a cada quien su fila, y el disparador de la 022 impide tocar
 * rol, empresa o estado aunque alguien lo intente. Se cuentan las filas: un
 * UPDATE bloqueado por RLS no da error, cambia cero.
 */
export async function guardarMiPerfil({ nombre, telefono }) {
  const v = validarMisDatos({ nombre, telefono });
  if (!v.ok) return v;
  if (!haySupabase()) return DEMO;
  // La cuenta de muestra no escribe en la base (ver cuenta-muestra.js).
  if (esCuentaDeMuestra()) return { ok: true, demo: true, limpio: v.limpio };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
    const { data, error } = await supabase
      .from("perfiles")
      .update({ nombre: v.limpio.nombre, telefono: v.limpio.telefono })
      .eq("id", user.id)
      .select("id");
    if (error) return { ok: false, motivo: `No se guardó: ${error.message}` };
    if (!data?.length) return { ok: false, motivo: "No se guardó: la base no dejó cambiar tu perfil." };
    // El nombre del saludo sale de la sesión (como en la web). Si esto falla
    // no pasa nada grave: el perfil ya quedó.
    supabase.auth.updateUser({ data: { nombre: v.limpio.nombre } }).catch(() => {});
    return { ok: true, limpio: v.limpio };
  } catch {
    return { ok: false, sinRed: true, motivo: SIN_CONEXION };
  }
}

/**
 * Cambiar MI contraseña con la actual. El servidor la comprueba, avisa por
 * correo y cierra las sesiones de OTROS aparatos (esta sigue).
 *
 * 🔑 El PERSONAL (dueño y admin) la cambia con el pase del segundo paso
 * (`accionAdmin`): con una sesión robada sin el código no se puede dejar
 * fuera al dueño de la cuenta. Chofer y cliente, con su sesión (`accionApp`).
 */
export async function cambiarMiContrasena({ actual, nueva, repetir }, { personal = false } = {}) {
  if (!haySupabase()) return DEMO;
  if (esCuentaDeMuestra()) {
    return { ok: false, motivo: "La cuenta de muestra no cambia su contraseña: la usan otros revisores." };
  }
  const r = personal
    ? await accionAdmin("cuenta-contrasena", { actual, nueva, repetir })
    : await accionApp("cuenta-contrasena", { actual, nueva, repetir });
  return resultado(r, "No se pudo cambiar la contraseña.");
}

/* ==================================================================== */
/* EL ESTADO DE MI EMPRESA (cliente)                                    */
/* ==================================================================== */

/**
 * `{ ok, estado, empresa, folio }`. El estado decide el aviso rojo de
 * "suspendida" y si se puede agendar (db/028; la base también lo exige).
 * Sin base: activo. Sin red: `{ ok:false, sinRed }` (no se adivina).
 */
export async function leerEstadoCliente() {
  if (!haySupabase()) return { ok: true, estado: "activo", empresa: CLIENTE.empresa, folio: CLIENTE.id };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return { ok: false, motivo: "sin_sesion" };
    const { data, error } = await supabase
      .from("perfiles")
      .select("cliente_id, clientes ( estado, estado_motivo, empresa, folio )")
      .eq("id", uid)
      .maybeSingle();
    if (error) {
      // Sin la columna `estado_motivo` (base vieja) se pide lo indispensable.
      const r2 = await supabase.from("perfiles").select("cliente_id, clientes ( estado, empresa, folio )").eq("id", uid).maybeSingle();
      if (r2.error) return { ok: false, sinRed: true, motivo: SIN_CONEXION };
      const c2 = r2.data?.clientes;
      return { ok: true, estado: c2?.estado || "activo", empresa: c2?.empresa || "", folio: c2?.folio || "", motivoEstado: "" };
    }
    const c = data?.clientes;
    return { ok: true, estado: c?.estado || "activo", empresa: c?.empresa || "", folio: c?.folio || "", motivoEstado: c?.estado_motivo || "" };
  } catch {
    return { ok: false, sinRed: true, motivo: SIN_CONEXION };
  }
}

/* ==================================================================== */
/* MIS PUNTOS (para agendar)                                            */
/* ==================================================================== */

/**
 * Los puntos con servicio ACTIVO, cada uno con SU ruta (como `misPuntos` de
 * la web). `null` = no se pudo leer (no es lo mismo que "no tienes").
 */
export async function misPuntos() {
  if (!haySupabase()) return [];
  try {
    const { data, error } = await supabase
      .from("suscripciones")
      .select("estado, domicilio_id, domicilios ( alias, colonia ), rutas ( id, clave, nombre, tipo, dias )")
      .eq("estado", "activa");
    if (error) return null;
    return puntosAgendables(data || []);
  } catch {
    return null;
  }
}

/* ==================================================================== */
/* CANCELAR O CAMBIAR LA FECHA (cliente)                                */
/* ==================================================================== */

// Lo que la cuenta de muestra cambió en esta sesión: { [id]: { accion, fecha, motivo } }.
let cambiosDeMuestra = {};
export const olvidarCambiosDeMuestra = () => { cambiosDeMuestra = {}; };

/** Aplica a una lista leída lo que la cuenta de muestra cambió aquí. */
export function conCambiosDeMuestra(lista) {
  if (!esCuentaDeMuestra()) return lista;
  let l = lista;
  for (const [id, c] of Object.entries(cambiosDeMuestra)) l = aplicarCambioLocal(l, { id, ...c });
  return l;
}

/**
 * `solicitud-cambiar`: el servidor revisa que sea suya, que siga en un
 * estado que se pueda cambiar y que su cuenta no esté suspendida; avisa a la
 * oficina y, si ya tenía chofer, al chofer.
 */
export async function cambiarMiSolicitud({ id, accion, fecha, motivo }) {
  if (!haySupabase()) return { ok: true, demo: true, fecha };
  if (esCuentaDeMuestra()) {
    const previo = cambiosDeMuestra[id] || {};
    cambiosDeMuestra[id] = accion === "cancelar" ? { accion, motivo } : { ...previo, accion, fecha };
    return { ok: true, fecha };
  }
  const r = await accionApp("solicitud-cambiar", { id, accion, fecha: fecha || undefined, motivo: motivo || undefined });
  return resultado(r, "No se pudo cambiar la solicitud.");
}

/* ==================================================================== */
/* DATOS DE CONTACTO DE LA EMPRESA (cliente)                            */
/* ==================================================================== */

/** `{ ok, empresa {folio, empresa, contacto, telefono, correo, rfc, estado}, puntos [] }`. */
export async function cuentaCliente() {
  if (!haySupabase()) {
    return {
      ok: true,
      demo: true,
      empresa: { folio: CLIENTE.id, empresa: CLIENTE.empresa, contacto: CLIENTE.contacto, telefono: CLIENTE.telefono, correo: CLIENTE.correo, rfc: CLIENTE.rfc, estado: "activo" },
      puntos: [],
    };
  }
  return resultado(await accionApp("cliente-cuenta"), "No se pudieron leer los datos de tu empresa.");
}

/** Contacto, teléfono y correo de avisos. La razón social y el RFC se PIDEN (son fiscales). */
export async function guardarCuentaCliente({ contacto, telefono, correo }) {
  const v = validarDatosCliente({ contacto, telefono, correo });
  if (!v.ok) return v;
  if (!haySupabase() || esCuentaDeMuestra()) return DEMO;
  return resultado(await accionApp("cliente-guardar", v.limpio), "No se guardaron tus datos.");
}
