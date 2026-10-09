/**
 * LAS SECCIONES DEL PANEL Y QUIÉN PUEDE QUÉ (Entrega 2, 9-oct-2026).
 *
 * El dueño arma roles con casillas ("Caja: Saldos y Clientes"). Esta es la
 * ÚNICA lista de secciones: de aquí salen las casillas, el menú, el guardia
 * de páginas (proxy.js) y las acciones del servidor. La base tiene su copia
 * en db/029 (`roles_permisos_validos`) y tests/permisos.test.mjs compara las
 * dos.
 *
 * Lo que decide de verdad es la base: aquí solo se pinta y se ataja.
 * Sin dependencias, para que `node --test` lo importe directo.
 */

/** Secciones del panel, en el orden del menú. `rutas` = páginas que abre. */
export const SECCIONES = [
  { id: "rutas", texto: "Rutas, sectores y puntos", rutas: ["/admin/rutas", "/admin/sectores"] },
  { id: "recolecciones", texto: "Recolecciones (y peso real)", rutas: ["/admin/recolecciones", "/admin/viajes"] },
  { id: "incidentes", texto: "Incidentes", rutas: ["/admin/incidentes"] },
  { id: "avisos", texto: "Avisos a clientes", rutas: ["/admin/avisos"] },
  { id: "unidades", texto: "Unidades", rutas: ["/admin/unidades"] },
  { id: "contenedores", texto: "Contenedores", rutas: ["/admin/contenedores"] },
  { id: "zonas", texto: "Zonas pedidas", rutas: ["/admin/zonas-pedidas"] },
  { id: "solicitudes", texto: "Solicitudes (cotizaciones)", rutas: ["/admin/solicitudes"] },
  { id: "altas", texto: "Altas de clientes", rutas: ["/admin/altas"] },
  { id: "empleo", texto: "Trabaja con nosotros", rutas: ["/admin/empleo"] },
  { id: "clientes", texto: "Clientes", rutas: ["/admin/clientes"] },
  { id: "saldos", texto: "Saldos de clientes", rutas: ["/admin/saldos"] },
  { id: "precios", texto: "Precios", rutas: ["/admin/precios"] },
  { id: "servicios", texto: "Servicios", rutas: ["/admin/servicios"] },
  { id: "reportes", texto: "Reportes", rutas: ["/admin/reportes"] },
  { id: "usuarios", texto: "Usuarios (invitar choferes)", rutas: ["/admin/usuarios"] },
  { id: "bitacora", texto: "Bitácora", rutas: ["/admin/bitacora"] },
];

/** Permisos sueltos que no son una página. */
export const PERMISOS_SUELTOS = [
  { id: "eliminar_clientes", texto: "Eliminar clientes definitivamente" },
];

/** Todo lo que puede llevar un rol (la lista de db/029). */
export const PERMISOS_DE_ROL = [...SECCIONES.map((s) => s.id), ...PERMISOS_SUELTOS.map((p) => p.id)];

const esArea = (ruta, area) => ruta === area || ruta.startsWith(`${area}/`);

/**
 * La sección que pide una página del panel, o null si es de todo el personal
 * (Panel, Mi cuenta, verificación).
 */
export function seccionDeRuta(ruta) {
  const r = String(ruta || "");
  const s = SECCIONES.find((x) => x.rutas.some((a) => esArea(r, a)));
  return s ? s.id : null;
}

/**
 * ¿`quien` ({ rol, permisos efectivos }) puede la sección `p`? El dueño todo;
 * un admin lo que diga su rol; `p` vacío (Panel) cualquiera del personal.
 */
export function puede(quien, p) {
  if (!quien || (quien.rol !== "dueno" && quien.rol !== "admin")) return false;
  if (!p || quien.rol === "dueno") return true;
  return Array.isArray(quien.permisos) && quien.permisos.includes(p);
}

/** Los del rol más los sueltos del perfil, sin repetir. */
export function permisosEfectivos(sueltos, delRol) {
  return [...new Set([...(Array.isArray(sueltos) ? sueltos : []), ...(Array.isArray(delRol) ? delRol : [])])];
}

/** Limpia y valida un rol antes de guardarlo. */
export function validarRol({ nombre, descripcion, permisos } = {}) {
  const limpio = {
    nombre: String(nombre ?? "").trim().replace(/\s+/g, " "),
    descripcion: String(descripcion ?? "").trim(),
    permisos: [...new Set(Array.isArray(permisos) ? permisos : [])],
  };
  if (!limpio.nombre) return { ok: false, motivo: "Ponle nombre al rol." };
  if (limpio.nombre.length > 60) return { ok: false, motivo: "El nombre es muy largo (máximo 60)." };
  const raro = limpio.permisos.find((p) => !PERMISOS_DE_ROL.includes(p));
  if (raro) return { ok: false, motivo: `No existe la sección "${raro}".` };
  return { ok: true, limpio };
}

/**
 * Lee de la base el rol y los permisos efectivos de `uid`. Sirve con la
 * sesión (RLS: cada quien ve su perfil y el personal ve los roles) o con la
 * llave de servicio. Ojo: entre perfiles y roles hay DOS llaves (rol_id y
 * roles.creado_por), por eso el embed nombra la suya.
 */
export async function leerPermisos(sb, uid) {
  const { data } = await sb
    .from("perfiles")
    .select("rol, permisos, rol_id, roles!perfiles_rol_id_fkey ( nombre, permisos )")
    .eq("id", uid)
    .maybeSingle();
  if (!data) return { rol: null, rolId: null, rolNombre: null, permisos: [] };
  return {
    rol: data.rol,
    rolId: data.rol_id || null,
    rolNombre: data.roles?.nombre || null,
    permisos: permisosEfectivos(data.permisos, data.roles?.permisos),
  };
}

/** El rol con que nace un administrador invitado, si no se escoge otro. */
export const ROL_COMPLETO = "Administrador completo";

/**
 * Qué `rol_id` lleva alguien que se invita. Solo los administradores llevan
 * rol; si no se escogió (p. ej. la app 1.1.1, que no sabe de roles), el
 * completo: es lo que daba invitar un admin hasta hoy.
 */
export function rolDeInvitado({ rol, rolId, roles = [] }) {
  if (rol !== "admin") return { ok: true, rolId: null };
  if (rolId) {
    return roles.some((r) => r.id === rolId)
      ? { ok: true, rolId }
      : { ok: false, motivo: "Ese rol ya no existe. Recarga la página." };
  }
  return { ok: true, rolId: roles.find((r) => r.nombre === ROL_COMPLETO)?.id || null };
}
