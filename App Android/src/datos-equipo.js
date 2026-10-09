import { supabase, haySupabase } from "./supabase";
import { accionAdmin } from "./accion";
import { postAdmin } from "./api-admin";
import { validarRol, rolProtegido, ROL_COMPLETO } from "./web/permisos.mjs";

/**
 * EL EQUIPO Y LOS ROLES DESDE LA APP (apps al 100%, fase C), como
 * /admin/usuarios de la web.
 *
 *  · Editar, mandar enlace, eliminar, permisos sueltos y "correo y último
 *    acceso" van por la web (`/api/app/accion/usuario-*`): necesitan la llave
 *    de servicio (Auth) y dejan bitácora.
 *  · Los ROLES se leen y se escriben DIRECTO con la sesión: la base (db/029,
 *    `roles_dueno`) solo deja crear, cambiar y borrar al dueño, igual que la
 *    acción de la web. Se valida con `validarRol` antes de mandar.
 *
 * Nunca lanzan; devuelven `{ ok, motivo?, sinRed? }`.
 */
const DEMO = { ok: true, demo: true };
const sinRedDe = (e) => /network|fetch/i.test(String(e?.message || e || ""));

/**
 * El personal con lo que necesita la pantalla: rol de la base, su rol
 * personalizado (`rol_id`) y sus permisos sueltos. `null` si no contestó.
 */
export async function listarEquipoCompleto() {
  if (!haySupabase()) return [];
  try {
    let { data, error } = await supabase
      .from("perfiles")
      .select("id, nombre, rol, activo, creado, telefono, rol_id, permisos")
      .in("rol", ["dueno", "admin", "operador"])
      .order("creado");
    if (error) {
      // Sin la migración de roles todavía: la lista sale igual, sin roles.
      ({ data, error } = await supabase
        .from("perfiles")
        .select("id, nombre, rol, activo, creado, telefono")
        .in("rol", ["dueno", "admin", "operador"])
        .order("creado"));
    }
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

/** Correo y último acceso de cada quien (viven en Auth). `{}` si no se pudo. */
export async function detalleEquipo() {
  if (!haySupabase()) return {};
  const r = await accionAdmin("usuarios-detalle");
  return r?.ok && r.porId ? r.porId : {};
}

/** Invitar; `rolId` solo para administradores (el servidor pone el completo si no viene). */
export const invitarConRol = ({ nombre, correo, rol, rolId }) =>
  haySupabase()
    ? postAdmin("usuarios/invitar", { nombre, correo, rol, ...(rol === "admin" && rolId ? { rolId } : {}) })
    : Promise.resolve(DEMO);

export const editarUsuario = (datos) => (haySupabase() ? accionAdmin("usuario-editar", datos) : Promise.resolve(DEMO));
export const mandarEnlaceUsuario = (id) => (haySupabase() ? accionAdmin("usuario-enlace", { id }) : Promise.resolve(DEMO));
export const eliminarUsuario = (id) => (haySupabase() ? accionAdmin("usuario-eliminar", { id }) : Promise.resolve(DEMO));
export const cambiarPermisoSuelto = ({ perfilId, permiso, valor }) =>
  haySupabase() ? accionAdmin("usuario-permiso", { perfilId, permiso, valor: Boolean(valor) }) : Promise.resolve(DEMO);

/* ================================ ROLES ================================ */

/** Los roles (todo el personal los puede leer). `null` si no se pudo. */
export async function listarRoles() {
  if (!haySupabase()) return [{ id: "demo-completo", nombre: ROL_COMPLETO, descripcion: "", permisos: [] }];
  try {
    const { data, error } = await supabase.from("roles").select("id, nombre, descripcion, permisos").order("nombre");
    if (error) return null;
    return (data || []).map((r) => ({ ...r, permisos: Array.isArray(r.permisos) ? r.permisos : [] }));
  } catch {
    return null;
  }
}

const motivoRol = (e) =>
  sinRedDe(e)
    ? { ok: false, sinRed: true, motivo: "Sin conexión. No se guardó el rol." }
    : { ok: false, motivo: /duplicate|unique/i.test(e?.message || "") ? "Ya hay un rol con ese nombre." : e?.message || "No se guardó el rol." };

export async function crearRol(datos) {
  const v = validarRol(datos);
  if (!v.ok) return v;
  if (!haySupabase()) return DEMO;
  try {
    const { data: { session } = {} } = await supabase.auth.getSession();
    const { error } = await supabase.from("roles").insert({ ...v.limpio, creado_por: session?.user?.id }).select("id").single();
    return error ? motivoRol(error) : { ok: true };
  } catch (e) {
    return motivoRol(e);
  }
}

export async function editarRol({ id, ...datos }, actual) {
  const v = validarRol(datos);
  if (!v.ok) return v;
  if (rolProtegido(actual) && v.limpio.nombre !== ROL_COMPLETO) {
    return { ok: false, motivo: `"${ROL_COMPLETO}" no se renombra (con él entran los administradores invitados desde la app). Sus casillas sí se pueden cambiar.` };
  }
  if (!haySupabase()) return DEMO;
  try {
    const { data, error } = await supabase.from("roles").update(v.limpio).eq("id", id).select("id");
    if (error) return motivoRol(error);
    // Un UPDATE que el RLS bloquea (no eres el dueño) cambia cero filas.
    return data?.length ? { ok: true } : { ok: false, motivo: "No se guardó: solo el dueño cambia los roles." };
  } catch (e) {
    return motivoRol(e);
  }
}

export async function borrarRol(rol) {
  if (rolProtegido(rol)) return { ok: false, motivo: `"${ROL_COMPLETO}" no se borra: con él entran los administradores invitados desde la app.` };
  if (!haySupabase()) return DEMO;
  try {
    const { data, error } = await supabase.from("roles").delete().eq("id", rol.id).select("id");
    if (error) return motivoRol(error);
    return data?.length ? { ok: true } : { ok: false, motivo: "No se borró: solo el dueño borra roles." };
  } catch (e) {
    return motivoRol(e);
  }
}
