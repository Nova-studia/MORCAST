import {
  ROLES_INVITABLES,
  puedeEditarUsuario,
  puedeMandarEnlace,
  puedeEliminarUsuario,
  validarEdicionUsuario,
} from "./equipo.mjs";

/**
 * LAS CUENTAS DEL EQUIPO, DEL LADO DEL SERVIDOR (Entrega 2, 9-oct-2026):
 * editar, mandar el enlace de contraseña, eliminar y leer correo y último
 * acceso. Invitar y desactivar siguen en lib/equipo-servidor.js.
 *
 * Todo con la llave de SERVICIO (`sb`): Auth no se toca de otra forma. Por
 * eso cada función revisa primero las reglas de lib/equipo.mjs con `quien`,
 * que el que llama leyó de SU sesión. El correo llega inyectado
 * (`enviarCorreo`) para que esto se pruebe sin mandar nada
 * (tests/equipo-cuentas.test.mjs).
 */

const objetivoDe = async (sb, id) =>
  (await sb.from("perfiles").select("id, nombre, rol, telefono, rol_id").eq("id", id).maybeSingle()).data;

/** Nombre, teléfono y, si viene `rolId` (aunque sea vacío), el rol. */
export async function editarUsuarioEquipoCon({ sb, quien, anotar }, datos = {}) {
  const objetivo = await objetivoDe(sb, datos.id);
  const conRol = Object.hasOwn(datos, "rolId");
  const permiso = puedeEditarUsuario({ quien, objetivo, cambios: conRol ? { rolId: datos.rolId } : {} });
  if (!permiso.puede) return { ok: false, motivo: permiso.motivo };
  const v = validarEdicionUsuario(datos);
  if (!v.ok) return v;

  const cambios = { nombre: v.limpio.nombre, telefono: v.limpio.telefono };
  if (conRol) {
    if (v.limpio.rolId) {
      const { data: rol } = await sb.from("roles").select("id").eq("id", v.limpio.rolId).maybeSingle();
      if (!rol) return { ok: false, motivo: "Ese rol ya no existe. Recarga la página." };
    }
    cambios.rol_id = v.limpio.rolId;
  }
  const { data, error } = await sb.from("perfiles").update(cambios).eq("id", objetivo.id).select("id");
  if (error || !data?.length) return { ok: false, motivo: `No se guardó: ${error?.message || "ninguna fila"}` };
  // El nombre que enseña el panel arriba sale de Auth (user_metadata).
  await sb.auth.admin.updateUserById(objetivo.id, { user_metadata: { nombre: v.limpio.nombre } });

  await anotar({
    accion: "editar_usuario",
    tabla: "perfiles",
    registroId: objetivo.id,
    detalle: { antes: { nombre: objetivo.nombre, telefono: objetivo.telefono, rolId: objetivo.rol_id }, despues: cambios },
  });
  return { ok: true };
}

/**
 * Reenviar la invitación o restablecer la contraseña: es el mismo enlace de
 * un solo uso a /portal/nueva-clave (al terminar, el guardia lo lleva a su
 * área). Nadie ve ni dicta contraseñas.
 */
export async function mandarEnlaceEquipoCon({ sb, quien, anotar, origen, enviarCorreo }, { id } = {}) {
  const objetivo = await objetivoDe(sb, id);
  const permiso = puedeMandarEnlace({ quien, objetivo });
  if (!permiso.puede) return { ok: false, motivo: permiso.motivo };

  const { data: u, error: errU } = await sb.auth.admin.getUserById(objetivo.id);
  const correo = u?.user?.email;
  if (errU || !correo) return { ok: false, motivo: "Esa cuenta no tiene correo." };
  const { data: link, error: errLink } = await sb.auth.admin.generateLink({ type: "recovery", email: correo });
  if (errLink || !link?.properties?.hashed_token) {
    return { ok: false, motivo: `No se pudo generar el enlace: ${errLink?.message || "sin token"}` };
  }
  const enlace = `${origen}/portal/nueva-clave?token=${encodeURIComponent(link.properties.hashed_token)}`;
  try {
    await enviarCorreo({
      correo,
      nombre: objetivo.nombre || "",
      rolLegible: ROLES_INVITABLES[objetivo.rol] || "equipo",
      enlace,
      invitadoPor: quien.nombre || null,
    });
  } catch (e) {
    return { ok: false, motivo: `No se pudo mandar el correo: ${e?.message || "error desconocido"}` };
  }
  await anotar({ accion: "enlace_contrasena_equipo", tabla: "perfiles", registroId: objetivo.id, detalle: { correo } });
  return { ok: true, correo };
}

/** Dónde queda el nombre de alguien del equipo como autor de algo. */
const HISTORIAL = [
  ["rutas", "chofer_id"],
  ["solicitudes_recoleccion", "chofer_id"],
  ["recolecciones", "operador_id"],
  ["incidentes", "operador_id"],
  ["viajes_relleno", "operador_id"],
];

/** Eliminar la cuenta para siempre (solo el dueño, y solo sin historial). */
export async function eliminarUsuarioEquipoCon({ sb, quien, anotar }, { id } = {}) {
  const objetivo = await objetivoDe(sb, id);
  const permiso = puedeEliminarUsuario({ quien, objetivo });
  if (!permiso.puede) return { ok: false, motivo: permiso.motivo };

  // Toda llave hacia perfiles es `on delete set null`: la base NO se niega,
  // borraría en silencio quién recolectó, quién manejaba la ruta, etc. (la
  // evidencia ambiental). Por eso se cuenta aquí y, con historial, no se borra.
  let historial = 0;
  for (const [tabla, columna] of HISTORIAL) {
    const { count } = await sb.from(tabla).select("id", { count: "exact", head: true }).eq(columna, objetivo.id);
    historial += count || 0;
  }
  const sinBorrar = {
    ok: false,
    motivo:
      `No se puede eliminar a ${objetivo.nombre || "esa persona"}: tiene historial en el sistema ` +
      "(recolecciones, rutas o incidentes). Desactívala: ya no podrá entrar y su historial se conserva.",
  };
  if (historial > 0) return sinBorrar;

  const { error } = await sb.auth.admin.deleteUser(objetivo.id);
  if (error) return sinBorrar;
  await anotar({
    accion: "eliminar_usuario",
    tabla: "perfiles",
    registroId: objetivo.id,
    detalle: { nombre: objetivo.nombre, rol: objetivo.rol },
  });
  return { ok: true };
}

/** Correo y último acceso de cada cuenta (Auth no se lee desde el navegador). */
export async function detalleEquipoCon({ sb }) {
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return { ok: false, motivo: error.message };
  const porId = {};
  for (const u of data?.users || []) porId[u.id] = { correo: u.email || null, ultimoAcceso: u.last_sign_in_at || null };
  return { ok: true, porId };
}
