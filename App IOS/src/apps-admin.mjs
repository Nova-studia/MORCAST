import { puedeVer } from "./permisos-app.mjs";
import { puede, SECCIONES, PERMISOS_SUELTOS } from "./web/permisos.mjs";
import { ROLES_LEGIBLES } from "./cuentas-admin.mjs";
import { POR_PAGINA } from "./web/consulta-recolecciones.mjs";

/**
 * LA ADMINISTRACIÓN AL 100% EN LA APP (9-oct-2026, "apps al 100%") — lógica
 * pura: qué ve cada rol, los botones "En la web", roles con casillas, avisos
 * a clientes elegidos, el chofer de cada ruta y la ficha del cliente.
 *
 * Quien decide de verdad es el servidor (y la base): esto solo evita pintar
 * botones que contestarían "Tu rol no incluye…". Sin React ni Supabase, con
 * pruebas (tests/apps-al-100.test.mjs).
 */

/* ------------------------------------------------------------------ */
/* Qué ve cada rol                                                     */
/* ------------------------------------------------------------------ */

/** Las pestañas de abajo, en orden. Panel y Más son de todo el personal. */
export const PESTANAS_ADMIN = ["Panel", "Solicitudes", "Saldos", "MasA"];
export const pestanasVisibles = (yo) => PESTANAS_ADMIN.filter((p) => puedeVer(yo, p));

/** Las entradas del menú "Más" que su rol abre (`{ pantalla, ... }`). */
export const menuVisible = (yo, menu) => (menu || []).filter((m) => puedeVer(yo, m.pantalla));

/**
 * HERRAMIENTAS DE ESCRITORIO (fase D): lo que en el teléfono no cabe bien
 * (mapas de sectores, la tabla de precios, la bitácora completa…) se abre
 * en el panel web CON LA SESIÓN YA INICIADA (`puente-admin`). `destino` es
 * de la lista cerrada del servidor (DESTINOS_PANEL) y `seccion` la que pide
 * esa página (la prueba lo compara con `seccionDeRuta`).
 */
export const HERRAMIENTAS_WEB = [
  { destino: "/admin/rutas", seccion: "rutas", titulo: "Zonas y sectores", sub: "Mapa de rutas, sectores y pines", icono: "map" },
  { destino: "/admin/precios", seccion: "precios", titulo: "Precios", sub: "Lista y precios especiales por cliente", icono: "tag" },
  { destino: "/admin/empleo", seccion: "empleo", titulo: "Trabaja con nosotros", sub: "Solicitudes de empleo", icono: "briefcase" },
  { destino: "/admin/unidades", seccion: "unidades", titulo: "Unidades (alta y edición)", sub: "Camiones, placas y documentos", icono: "truck" },
  { destino: "/admin/contenedores", seccion: "contenedores", titulo: "Contenedores", sub: "Inventario y códigos QR", icono: "box" },
  { destino: "/admin/viajes", seccion: "recolecciones", titulo: "Peso real", sub: "Viajes al relleno y ticket de báscula", icono: "bar-chart-2" },
  { destino: "/admin/bitacora", seccion: "bitacora", titulo: "Bitácora completa", sub: "Filtros y búsqueda de todo el historial", icono: "book-open" },
];
export const herramientasVisibles = (yo) => HERRAMIENTAS_WEB.filter((h) => puede(yo, h.seccion));

/* ------------------------------------------------------------------ */
/* Roles y usuarios                                                    */
/* ------------------------------------------------------------------ */

/** Las casillas de un rol: las secciones y los permisos sueltos, en el orden de la web. */
export const CASILLAS_ROL = [...SECCIONES, ...PERMISOS_SUELTOS].map(({ id, texto }) => ({ id, texto }));
export const textoPermiso = (p) => CASILLAS_ROL.find((x) => x.id === p)?.texto || p;

export const alternarPermiso = (lista, p) =>
  (lista || []).includes(p) ? (lista || []).filter((x) => x !== p) : [...(lista || []), p];

/** Cuántas personas del equipo llevan ese rol. */
export const personasConRol = (rolId, equipo) => (equipo || []).filter((u) => u.rolId === rolId).length;

/** "Caja", "Sin rol (solo el Panel)", "Chofer / Operador"… */
export function etiquetaRolUsuario(u, roles) {
  if (u?.rol === "admin") return (roles || []).find((r) => r.id === u.rolId)?.nombre || "Sin rol (solo el Panel)";
  return ROLES_LEGIBLES[u?.rol] || u?.rol || "—";
}

/**
 * ¿Puede quien mira editar, mandar enlace o tocar a este usuario? El dueño a
 * todo el equipo; un admin, solo a los choferes. Al dueño y a uno mismo, no
 * (lo suyo va en Mi cuenta). Las mismas reglas que /admin/usuarios.
 */
export function puedeTocarUsuario({ yo, u } = {}) {
  if (!yo || !u?.id) return false;
  if (u.rol === "dueno" || u.id === yo.id) return false;
  return yo.rol === "dueno" || (yo.rol === "admin" && u.rol === "operador");
}

/* ------------------------------------------------------------------ */
/* Avisos a clientes elegidos                                          */
/* ------------------------------------------------------------------ */

const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** La lista para marcar, filtrada por el buscador (empresa, folio o correo). */
export function filtrarClientesAviso(clientes, q) {
  const t = normal(q).trim();
  if (!t) return clientes || [];
  return (clientes || []).filter((c) => normal(`${c.empresa} ${c.folio || ""} ${c.correo || ""}`).includes(t));
}

export const alternarId = (ids, id) => ((ids || []).includes(id) ? ids.filter((x) => x !== id) : [...(ids || []), id]);

/** "Marcar todos" / "Marcar los que se ven": suma sin repetir. */
export const marcarVisibles = (ids, visibles) => [...new Set([...(ids || []), ...(visibles || []).map((c) => c.id)])];

/* ------------------------------------------------------------------ */
/* Rutas y su chofer                                                   */
/* ------------------------------------------------------------------ */

/**
 * Las rutas para la lista. `aMano`: el nombre escrito a mano de antes
 * (`rutas.chofer` sin `chofer_id`). Con eso la parada no le llega a NADIE:
 * se avisa para que lo escojan de la lista.
 */
export function filasRutas(rutas) {
  return [...(rutas || [])]
    .sort((a, b) => String(a.clave || "").localeCompare(String(b.clave || ""), "es"))
    .map((r) => ({
      id: r.id,
      clave: r.clave || "",
      nombre: r.nombre || r.clave || "Ruta",
      dias: (r.dias || []).length ? r.dias.join(", ") : "Sin días",
      choferId: r.chofer_id || null,
      textoChofer: r.chofer_id ? r.chofer || "Chofer sin nombre" : "Sin chofer asignado",
      aMano: !r.chofer_id && r.chofer ? r.chofer : "",
      activa: r.activa !== false,
    }));
}

/* ------------------------------------------------------------------ */
/* Ficha del cliente                                                   */
/* ------------------------------------------------------------------ */

/** Lo que explica cada cambio de estado (el mismo texto que la ficha web). */
export const TEXTO_ESTADO = {
  suspendido: {
    titulo: "Suspender",
    explica: "Podrá entrar y ver todo, pero SOLO agregar saldo. Verá un aviso rojo. Sus servicios se pausan.",
  },
  baja: {
    titulo: "Dar de baja",
    explica: "No podrá entrar. Se cancelan sus servicios y sus recolecciones futuras, y se liberan sus contenedores. Su historial se conserva.",
  },
  activo: {
    titulo: "Reactivar",
    explica: "Vuelve a entrar. Sus servicios regresan en pausa para que la oficina los revise.",
  },
};

/** Los botones de estado que tocan según el estado actual (como la web). */
export function botonesEstado(estado) {
  const b = [];
  if (estado !== "suspendido" && estado !== "baja") b.push("suspendido");
  if (estado !== "baja") b.push("baja");
  if (estado === "suspendido" || estado === "baja") b.push("activo");
  return b;
}

/** Los datos editables de la ficha, en el orden de la web. */
export const CAMPOS_CLIENTE = [
  ["empresa", "Empresa / razón social"],
  ["contacto", "Persona de contacto"],
  ["correo", "Correo"],
  ["telefono", "Teléfono"],
  ["rfc", "RFC"],
  ["plan", "Plan"],
  ["dias_credito", "Días de crédito"],
  ["limite_credito", "Límite de crédito"],
  ["nota_interna", "Nota interna"],
];

/** Lo que se manda al guardar: los números como números (vacío o basura = 0). */
export function cambiosDeFicha(editando) {
  const c = { ...(editando || {}) };
  if ("dias_credito" in c) c.dias_credito = Number(c.dias_credito) || 0;
  if ("limite_credito" in c) c.limite_credito = Number(c.limite_credito) || 0;
  return c;
}

/** El servicio de un punto (PostgREST lo da como lista o como objeto). */
export function servicioDePunto(d) {
  const s = d?.suscripciones;
  if (Array.isArray(s)) return s[0] || null;
  return s || null;
}

/* ------------------------------------------------------------------ */
/* Recolecciones                                                       */
/* ------------------------------------------------------------------ */

export const totalPaginas = (total, porPagina = POR_PAGINA) => Math.max(1, Math.ceil((Number(total) || 0) / porPagina));

/** "51–100 de 120". */
export function textoPagina({ pagina = 1, total = 0, porPagina = POR_PAGINA } = {}) {
  if (!total) return "Ninguna";
  const de = (pagina - 1) * porPagina + 1;
  const a = Math.min(total, pagina * porPagina);
  return `${de}–${a} de ${total}`;
}

/* ------------------------------------------------------------------ */
/* Chofer                                                              */
/* ------------------------------------------------------------------ */

/**
 * Si cerrar una parada falla en el ÚLTIMO paso (pasarla a completada) y al
 * releerla ya está completada, fue un reintento tras una respuesta perdida:
 * es éxito, no error (como la web, lib/datos-chofer.js).
 */
export const cierreYaHecho = (estado) => estado === "completada";
