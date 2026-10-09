/**
 * LAS ACCIONES DE LAS APPS POR UNA SOLA PUERTA (9-oct-2026, "apps al 100%").
 *
 * `POST /api/app/accion/<nombre>`. Aquí, sin dependencias (lo revisa
 * tests/app-acciones.test.mjs), quién puede llamar cada una:
 *   · zona "admin":    dueño o admin con el segundo paso (`pase`) y la SECCIÓN
 *                      `permiso` de su rol (db/029). Sin sección solo las de
 *                      LIBRES_DE_SECCION, a propósito.
 *   · zona "cliente":  rol cliente.
 *   · zona "cuenta":   cualquiera con cuenta (su propia contraseña).
 * El trabajo de cada una está en lib/app-acciones.js.
 */
export const ROLES_ZONA = {
  cliente: ["cliente"],
  cuenta: ["dueno", "admin", "operador", "cliente"],
};

const poco = { maximo: 30, minutos: 60 };
const normal = { maximo: 120, minutos: 60 };

export const ACCIONES_APP = {
  // ---- cualquiera de la administración
  "mis-permisos": { zona: "admin", permiso: null, freno: normal },
  "puente-admin": { zona: "admin", permiso: null, freno: { maximo: 20, minutos: 60 } },
  // ---- su propia cuenta
  // El freno fino (5 en 15 min) es el de la web, con su misma llave, dentro del manejador.
  "cuenta-contrasena": { zona: "cuenta", freno: { maximo: 20, minutos: 15 } },
  // ---- el cliente
  "cliente-cuenta": { zona: "cliente", freno: normal },
  "cliente-guardar": { zona: "cliente", freno: poco },
  "solicitud-cambiar": { zona: "cliente", freno: { maximo: 20, minutos: 60 } },
  // ---- clientes (oficina)
  "cliente-ficha": { zona: "admin", permiso: "clientes", freno: normal },
  "cliente-estado": { zona: "admin", permiso: "clientes", freno: poco },
  "cliente-editar": { zona: "admin", permiso: "clientes", freno: poco },
  "cliente-eliminar": { zona: "admin", permiso: "clientes", freno: { maximo: 10, minutos: 60 } },
  "cliente-acceso": { zona: "admin", permiso: "clientes", freno: poco },
  "cliente-reenviar": { zona: "admin", permiso: "clientes", freno: poco },
  "cliente-punto-agregar": { zona: "admin", permiso: "clientes", freno: poco },
  "cliente-punto-quitar": { zona: "admin", permiso: "clientes", freno: poco },
  "cliente-servicio": { zona: "admin", permiso: "clientes", freno: poco },
  // ---- equipo (oficina)
  "usuarios-detalle": { zona: "admin", permiso: "usuarios", freno: normal },
  "usuario-editar": { zona: "admin", permiso: "usuarios", freno: poco },
  "usuario-enlace": { zona: "admin", permiso: "usuarios", freno: { maximo: 20, minutos: 60 } },
  "usuario-eliminar": { zona: "admin", permiso: "usuarios", freno: { maximo: 10, minutos: 60 } },
  "usuario-permiso": { zona: "admin", permiso: "usuarios", freno: poco },
  // ---- recolecciones (oficina)
  "recoleccion-crear": { zona: "admin", permiso: "recolecciones", freno: poco },
};

/** Las de administración que no piden sección (cualquiera del personal). */
export const LIBRES_DE_SECCION = Object.entries(ACCIONES_APP)
  .filter(([, d]) => d.zona === "admin" && !d.permiso)
  .map(([n]) => n);

/** Rutas del panel web que puede abrir el puente desde la app (lista cerrada). */
export const DESTINOS_PANEL = [
  "/admin/rutas", "/admin/sectores", "/admin/precios", "/admin/empleo", "/admin/unidades",
  "/admin/contenedores", "/admin/viajes", "/admin/bitacora", "/admin/reportes", "/admin",
];
export const destinoPanel = (d) => (DESTINOS_PANEL.includes(d) ? d : "/admin");

/**
 * ¿Esta zona le pide el segundo paso a este rol? El PERSONAL lo necesita
 * también para su propia contraseña: con solo la contraseña robada, alguien
 * podría cambiarla y dejar fuera al dueño de la cuenta (revisión de la web,
 * 9-oct-2026). Las de zona "admin" ya lo piden siempre.
 */
export function exigePase({ zona, rol }) {
  return zona === "cuenta" && (rol === "dueno" || rol === "admin");
}

/**
 * La "sesión" del pase del puente: amarrada al enlace mágico (`th`). Como
 * Supabase consume `th` una sola vez, el pase solo se canjea con SU enlace,
 * una vez: con la contraseña robada y el enlace visto de reojo ya no basta.
 */
export async function marcaPuente(th) {
  const datos = new TextEncoder().encode(String(th || ""));
  const h = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", datos));
  return `puente:${Array.from(h.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * La cuenta de muestra del revisor de Apple (`app_metadata.demo`, solo con la
 * llave de servicio) no cambia nada por aquí. La app ya lo evita en el
 * teléfono; esto cubre el caso en que el perfil no se leyó (revisión 9-oct).
 */
const ESCRIBEN = new Set(["cliente-guardar", "solicitud-cambiar", "cuenta-contrasena"]);
export const bloqueadaParaMuestra = (nombre, usuario) => usuario?.app_metadata?.demo === true && ESCRIBEN.has(nombre);
