import { supabase, haySupabase } from "./supabase";
import { accionApp, accionAdmin } from "./accion";
import { CLIENTE } from "./datos";
import { esCuentaDeMuestra, cambiarSolicitudDeMuestra } from "./cuenta-muestra";
import { puntosAgendables } from "./web/puntos-cliente.mjs";
import { validarDatosCliente } from "./web/cuenta-cliente.mjs";
import { motivoCancelacion } from "./web/solicitud-cliente.mjs";
import { validarMisDatos, tieneContrasena } from "./mi-cuenta-app.mjs";

/**
 * EL CLIENTE AL 100% Y "MI CUENTA" DE TODOS (apps al 100%, 9-oct-2026).
 *
 * Como en el resto de la app: LEER va directo con la sesión (RLS) y lo que
 * necesita la llave de servicio o la bitácora va por la web
 * (`/api/app/accion/<nombre>`, src/accion.js). Todo devuelve
 * `{ ok, motivo?, sinRed? }` y nunca lanza.
 *
 * Sin base (demostración) se contesta con datos de ejemplo. La cuenta de
 * muestra del revisor de Apple NO escribe: lo que cambie se queda en la
 * memoria del teléfono (ver cuenta-muestra.js), y su contraseña no se cambia
 * para que la revisión pueda volver a entrar.
 */

const DEMO = { ok: true, demo: true };
const FALLO_LECTURA = "No se pudo cargar. Revisa tu conexión e inténtalo otra vez.";

/** Los puntos donde puede agendar (suscripciones activas), como `misPuntos` de la web. */
export async function misPuntos() {
  if (!haySupabase()) return { ok: true, puntos: [] };
  try {
    const { data, error } = await supabase
      .from("suscripciones")
      .select("estado, domicilio_id, domicilios ( alias, colonia ), rutas ( id, clave, nombre, tipo, dias )")
      .eq("estado", "activa");
    if (error) return { ok: false, motivo: FALLO_LECTURA };
    return { ok: true, puntos: puntosAgendables(data || []) };
  } catch {
    return { ok: false, sinRed: true, motivo: FALLO_LECTURA };
  }
}

/** Los datos de su empresa y sus puntos (`cliente-cuenta`). */
export async function cuentaCliente() {
  if (!haySupabase()) {
    return {
      ok: true,
      demo: true,
      empresa: { folio: CLIENTE.id, empresa: CLIENTE.empresa, contacto: CLIENTE.contacto, telefono: CLIENTE.telefono, correo: CLIENTE.correo, rfc: CLIENTE.rfc || "", estado: "activo" },
      puntos: [],
    };
  }
  return accionApp("cliente-cuenta");
}

/** Contacto, teléfono y correo de avisos de su empresa (`cliente-guardar`). */
export async function guardarDatosCliente(form) {
  const v = validarDatosCliente(form);
  if (!v.ok) return v;
  if (!haySupabase() || esCuentaDeMuestra()) return DEMO;
  return accionApp("cliente-guardar", v.limpio);
}

/**
 * Cancelar o cambiar la fecha de una solicitud suya (`solicitud-cambiar`).
 * El servidor revisa que siga en un estado que lo permite y avisa a la
 * oficina (y al chofer, si ya estaba asignada).
 */
export async function cambiarMiSolicitud({ id, accion, fecha, motivo }) {
  if (!haySupabase()) return { ok: true, demo: true, fecha };
  if (esCuentaDeMuestra()) {
    const r = cambiarSolicitudDeMuestra({ id, accion, fecha, motivoRechazo: motivoCancelacion(motivo) });
    if (r) return r;
    return { ok: false, motivo: "En la cuenta de muestra solo se cambian las solicitudes que pediste en esta sesión." };
  }
  const datos = { id, accion };
  if (accion === "reagendar") datos.fecha = fecha;
  if (accion === "cancelar" && String(motivo || "").trim()) datos.motivo = String(motivo).trim();
  return accionApp("solicitud-cambiar", datos);
}

/* ==================================================================== */
/* MI CUENTA (cliente, personal y chofer)                               */
/* ==================================================================== */

/**
 * Nombre y teléfono del perfil, el correo de la cuenta y si tiene
 * contraseña que cambiar (no la tiene quien entra solo con Google o Apple).
 */
export async function miPerfil(demo = { nombre: "", telefono: "", correo: "" }) {
  if (!haySupabase()) return { ok: true, demo: true, ...demo, tieneContrasena: true };
  try {
    const { data: { session } = {} } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
    const { data, error } = await supabase.from("perfiles").select("nombre, telefono").eq("id", user.id).maybeSingle();
    if (error) return { ok: false, motivo: FALLO_LECTURA };
    return {
      ok: true,
      nombre: data?.nombre || user.user_metadata?.nombre || "",
      telefono: data?.telefono || "",
      correo: user.email || "",
      tieneContrasena: tieneContrasena(user),
    };
  } catch {
    return { ok: false, sinRed: true, motivo: FALLO_LECTURA };
  }
}

/**
 * Guarda MI nombre y teléfono directo en `perfiles` (política
 * `perfiles_edita_el_suyo`; el disparador de la 022 no deja tocar rol,
 * empresa ni estado). El nombre de arriba sale de Auth: también se cambia.
 */
export async function guardarMiPerfil({ nombre, telefono }) {
  const v = validarMisDatos({ nombre, telefono });
  if (!v.ok) return v;
  if (!haySupabase() || esCuentaDeMuestra()) return DEMO;
  try {
    const { data: { session } = {} } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
    const { data, error } = await supabase
      .from("perfiles")
      .update({ nombre: v.limpio.nombre, telefono: v.limpio.telefono })
      .eq("id", uid)
      .select("id");
    if (error) {
      return /network|fetch/i.test(error.message || "")
        ? { ok: false, sinRed: true, motivo: "Sin conexión. No se guardó." }
        : { ok: false, motivo: `No se guardó: ${error.message}` };
    }
    // Un UPDATE que el RLS bloquea no da error: cambia cero filas.
    if (!data?.length) return { ok: false, motivo: "No se guardó: la base no te dejó cambiar tu perfil." };
    await supabase.auth.updateUser({ data: { nombre: v.limpio.nombre } }).catch(() => {});
    return { ok: true, limpio: v.limpio };
  } catch {
    return { ok: false, sinRed: true, motivo: "Sin conexión. No se guardó." };
  }
}

/**
 * Cambiar MI contraseña con la actual (`cuenta-contrasena`). El dueño y los
 * administradores la cambian con el pase del segundo paso (`accionAdmin`):
 * con solo la sesión, quien encuentre el teléfono abierto podría dejar fuera
 * al dueño de la cuenta. El cliente y el chofer, con su sesión.
 */
export async function cambiarMiContrasena({ modo, actual, nueva, repetir }) {
  if (!actual) return { ok: false, motivo: "Escribe tu contraseña actual." };
  if (String(nueva || "").length < 8) return { ok: false, motivo: "La contraseña nueva debe tener al menos 8 caracteres." };
  if (nueva === actual) return { ok: false, motivo: "La nueva tiene que ser distinta de la actual." };
  if (nueva !== repetir) return { ok: false, motivo: "Las dos contraseñas nuevas no coinciden." };
  if (!haySupabase()) return DEMO;
  if (esCuentaDeMuestra()) {
    return { ok: false, motivo: "Esta es la cuenta de muestra: su contraseña no se cambia, para que la revisión pueda seguir entrando." };
  }
  const cuerpo = { actual, nueva, repetir };
  return modo === "admin" ? accionAdmin("cuenta-contrasena", cuerpo) : accionApp("cuenta-contrasena", cuerpo);
}
