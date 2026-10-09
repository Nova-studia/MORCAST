import { supabase, haySupabase } from "./supabase";
import { accionAdmin } from "./accion";
import { postAdmin } from "./api-admin";
import { resultado, DEMO, SIN_CONEXION } from "./resultado";
import { Linking } from "react-native";
import { validarRol, rolProtegido, ROL_COMPLETO } from "./web/permisos.mjs";
import { elegirChoferRuta } from "./web/rutas-chofer.mjs";

/**
 * LA ADMINISTRACIÓN AL 100% — datos y acciones (9-oct-2026, apps al 100%).
 *
 * Como todo el panel de la app:
 *  · LEER con la sesión, bajo RLS (roles, perfiles, rutas, choferes);
 *  · ESCRIBIR por la puerta única `/api/app/accion/<nombre>` con el pase del
 *    segundo paso (`accionAdmin`): ahí se exige la sección del rol, se anota
 *    la bitácora y salen los correos — el MISMO código que la web.
 *  · Las excepciones que el contrato deja directas, con su candado en la
 *    base: los roles (solo el dueño, `roles_dueno` de db/029) y el chofer de
 *    una ruta (`rutas.chofer_id`).
 *
 * Todas devuelven `{ ok, motivo?, sinRed?, ... }` y nunca lanzan. Sin base
 * (demostración) contestan algo vacío o `{ ok:true, demo:true }`.
 */

const accion = async (nombre, datos, porOmision) =>
  haySupabase() ? resultado(await accionAdmin(nombre, datos), porOmision) : DEMO;

/* ==================================================================== */
/* FICHA DEL CLIENTE                                                    */
/* ==================================================================== */

/** `{ ok, cliente, puntos[], solicitudes[], movimientos[], usuarios[], conteos, puedeEliminar }`. */
export async function fichaCliente(clienteId) {
  if (!haySupabase()) return { ok: false, motivo: "La ficha necesita la base conectada (demostración)." };
  return resultado(await accionAdmin("cliente-ficha", { clienteId }), "No se pudo abrir la ficha.");
}

export const cambiarEstadoCliente = (clienteId, estado, motivo) =>
  accion("cliente-estado", { clienteId, estado, motivo }, "No se cambió el estado.");
export const editarCliente = (clienteId, cambios) =>
  accion("cliente-editar", { clienteId, cambios }, "No se guardaron los datos.");
export const eliminarCliente = (clienteId, confirmacion) =>
  accion("cliente-eliminar", { clienteId, confirmacion }, "No se eliminó el cliente.");
export const accesoUsuarioCliente = (clienteId, perfilId, activo) =>
  accion("cliente-acceso", { clienteId, perfilId, activo: Boolean(activo) }, "No se cambió el acceso.");
export const reenviarAccesoCliente = (clienteId, perfilId) =>
  accion("cliente-reenviar", { clienteId, perfilId }, "No se mandó el enlace.");
export const agregarPuntoCliente = (clienteId, punto) =>
  accion("cliente-punto-agregar", { clienteId, punto }, "No se agregó el punto.");
export const quitarPuntoCliente = (clienteId, domicilioId) =>
  accion("cliente-punto-quitar", { clienteId, domicilioId }, "No se quitó el punto.");
export const cambiarServicioCliente = (clienteId, suscripcionId, estado) =>
  accion("cliente-servicio", { clienteId, suscripcionId, estado }, "No se cambió el servicio.");

/* ==================================================================== */
/* EQUIPO                                                               */
/* ==================================================================== */

/**
 * El personal con su rol de sección (`rol_id`) y sus permisos sueltos.
 * `null` si la base no contestó.
 */
export async function listarEquipoConRoles() {
  if (!haySupabase()) return [];
  try {
    const { data, error } = await supabase
      .from("perfiles")
      .select("id, nombre, rol, activo, creado, telefono, rol_id, permisos")
      .in("rol", ["dueno", "admin", "operador"])
      .order("creado");
    if (error) return null;
    return (data || []).map((p) => ({
      id: p.id,
      rol: p.rol,
      nombre: p.nombre || "Sin nombre",
      nombreReal: p.nombre || "",
      telefono: p.telefono || "",
      activo: Boolean(p.activo),
      desde: (p.creado || "").slice(0, 10),
      rolId: p.rol_id || null,
      permisos: Array.isArray(p.permisos) ? p.permisos : [],
    }));
  } catch {
    return null;
  }
}

/** Correo y último acceso de cada quien del personal (vive en Auth: lo da el servidor). */
export async function detalleEquipo() {
  if (!haySupabase()) return { ok: true, porId: {} };
  return resultado(await accionAdmin("usuarios-detalle"), "No se pudieron leer los correos.");
}

/** `rolId` solo si quien edita es el dueño y el otro es admin ("" = sin rol). */
export const editarUsuario = (datos) => accion("usuario-editar", datos, "No se guardó.");
export const mandarEnlaceUsuario = (id) => accion("usuario-enlace", { id }, "No se pudo mandar el enlace.");
export const eliminarUsuario = (id) => accion("usuario-eliminar", { id }, "No se pudo eliminar.");
export const cambiarPermisoUsuario = (perfilId, permiso, valor) =>
  accion("usuario-permiso", { perfilId, permiso, valor: Boolean(valor) }, "No se guardó el permiso.");

/** Invitar con rol de sección (`usuarios/invitar` acepta `rolId` desde la Entrega 2). */
export const invitarConRol = ({ nombre, correo, rol, rolId }) =>
  haySupabase()
    ? postAdmin("usuarios/invitar", { nombre, correo, rol, ...(rol === "admin" && rolId !== undefined ? { rolId: rolId || null } : {}) })
    : Promise.resolve(DEMO);

/* ==================================================================== */
/* ROLES (directo con la sesión; solo el dueño escribe, lo exige la base)*/
/* ==================================================================== */

/** `null` si no se pudieron leer. */
export async function listarRoles() {
  if (!haySupabase()) return [];
  try {
    const { data, error } = await supabase.from("roles").select("id, nombre, descripcion, permisos").order("nombre");
    if (error) return null;
    return (data || []).map((r) => ({ ...r, permisos: Array.isArray(r.permisos) ? r.permisos : [] }));
  } catch {
    return null;
  }
}

const motivoBase = (e) => (/duplicate|unique/i.test(e?.message || "") ? "Ya hay un rol con ese nombre." : e?.message || "No se guardó.");

/** Crea (sin `id`) o cambia un rol. Mismas reglas que la acción de la web. */
export async function guardarRol({ id, nombre, descripcion, permisos }, { nombreActual } = {}) {
  const v = validarRol({ nombre, descripcion, permisos });
  if (!v.ok) return v;
  if (!haySupabase()) return DEMO;
  // "Administrador completo" no se renombra: con él entran los admins
  // invitados desde la app 1.1.1. Sus casillas sí cambian.
  if (id && rolProtegido({ nombre: nombreActual }) && v.limpio.nombre !== ROL_COMPLETO) {
    return { ok: false, motivo: `"${ROL_COMPLETO}" no se renombra (con él entran los administradores invitados desde la app). Sus casillas sí se pueden cambiar.` };
  }
  try {
    if (id) {
      const { data, error } = await supabase.from("roles").update(v.limpio).eq("id", id).select("id");
      if (error) return { ok: false, motivo: motivoBase(error) };
      // Cero filas: o ya no existe, o la base no deja (solo el dueño).
      if (!data?.length) return { ok: false, motivo: "No se guardó: el rol ya no existe o solo el dueño puede cambiar roles." };
      return { ok: true };
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("roles").insert({ ...v.limpio, creado_por: user?.id || null }).select("id").single();
    if (error) return { ok: false, motivo: /row-level security/i.test(error.message) ? "Solo el dueño crea roles." : motivoBase(error) };
    return { ok: true, id: data?.id };
  } catch {
    return { ok: false, sinRed: true, motivo: SIN_CONEXION };
  }
}

/** Quien tenía este rol se queda SIN rol: solo el Panel y Mi cuenta. */
export async function borrarRol(rol) {
  if (rolProtegido(rol)) return { ok: false, motivo: `"${ROL_COMPLETO}" no se borra: con él entran los administradores invitados desde la app.` };
  if (!haySupabase()) return DEMO;
  try {
    const { data, error } = await supabase.from("roles").delete().eq("id", rol.id).select("id");
    if (error) return { ok: false, motivo: error.message };
    if (!data?.length) return { ok: false, motivo: "No se borró: el rol ya no existe o solo el dueño puede borrar roles." };
    return { ok: true };
  } catch {
    return { ok: false, sinRed: true, motivo: SIN_CONEXION };
  }
}

/* ==================================================================== */
/* RUTAS Y SU CHOFER                                                    */
/* ==================================================================== */

/** Las rutas con su chofer. `null` si no se pudieron leer. */
export async function listarRutasConChofer() {
  if (!haySupabase()) return [];
  try {
    const { data, error } = await supabase.from("rutas").select("id, clave, nombre, dias, chofer, chofer_id, activa").order("clave");
    return error ? null : data || [];
  } catch {
    return null;
  }
}

/** Los choferes activos (`perfiles` con rol operador). */
export async function listarChoferes() {
  if (!haySupabase()) return [];
  try {
    const { data, error } = await supabase.from("perfiles").select("id, nombre").eq("rol", "operador").eq("activo", true).order("nombre");
    return error ? null : data || [];
  } catch {
    return null;
  }
}

/**
 * Escoger el chofer de una ruta: se guardan `chofer_id` (de él dependen las
 * paradas que ve cada chofer y sus avisos) y `chofer` (el nombre que se
 * enseña). Directo con la sesión; la base pide la sección de rutas.
 */
export async function cambiarChoferRuta(rutaId, choferId, choferes) {
  if (!haySupabase()) return DEMO;
  const cambios = elegirChoferRuta(choferId, choferes);
  try {
    const { data, error } = await supabase.from("rutas").update(cambios).eq("id", rutaId).select("id");
    if (error) return { ok: false, motivo: `No se guardó: ${error.message}` };
    if (!data?.length) return { ok: false, motivo: "No se guardó: tu rol no puede cambiar rutas." };
    return { ok: true, ...cambios };
  } catch {
    return { ok: false, sinRed: true, motivo: SIN_CONEXION };
  }
}

/* ==================================================================== */
/* EL PANEL WEB CON LA SESIÓN YA INICIADA (fase D)                      */
/* ==================================================================== */

/**
 * Pide al servidor un enlace de un solo uso (2 minutos) que abre esa página
 * del panel web ya con la sesión y el segundo paso hechos, y lo abre.
 * `destino` es de la lista cerrada del servidor.
 */
export async function abrirEnLaWeb(destino) {
  if (!haySupabase()) return { ok: false, motivo: "En la demostración no hay panel web que abrir." };
  const r = resultado(await accionAdmin("puente-admin", { destino }), "No se pudo abrir el panel.");
  if (!r.ok) return r;
  if (!r.url) return { ok: false, motivo: "El servidor no mandó el enlace. Inténtalo otra vez." };
  // En el navegador del teléfono (no dentro de la app): ahí se queda la
  // sesión del panel para seguir trabajando, como en la computadora.
  try {
    await Linking.openURL(r.url);
    return { ok: true };
  } catch {
    return { ok: false, motivo: "No se pudo abrir el navegador del teléfono." };
  }
}
