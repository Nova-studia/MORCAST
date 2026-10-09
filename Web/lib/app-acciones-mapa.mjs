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
  "cuenta-contrasena": { zona: "cuenta", freno: { maximo: 5, minutos: 15 } },
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
