import { SECCIONES, PERMISOS_SUELTOS, ROL_COMPLETO } from "./web/permisos.mjs";

/**
 * EL EQUIPO Y SUS ROLES EN LA APP (apps al 100%, 9-oct-2026). Las mismas
 * reglas que /admin/usuarios de la web, para que la app no pinte botones que
 * el servidor va a rechazar. El que decide sigue siendo el servidor (y la
 * base). Puro, con pruebas en tests/cuenta-y-equipo.test.mjs.
 */

const TODAS = [...SECCIONES, ...PERMISOS_SUELTOS];

/** "saldos" → "Saldos de clientes". */
export const textoPermiso = (id) => TODAS.find((x) => x.id === id)?.texto || id;

/** Prende o apaga una casilla del rol. */
export function alternarPermisoRol(lista, id) {
  const l = Array.isArray(lista) ? lista : [];
  return l.includes(id) ? l.filter((x) => x !== id) : [...l, id];
}

const ROL_BASE = { dueno: "Dueño", admin: "Administrador", operador: "Chofer / Operador" };

/** Lo que dice la insignia de rol de alguien del equipo. */
export function etiquetaRolDe(u, roles = []) {
  if (u?.rol === "admin") return roles.find((r) => r.id === u.rolId)?.nombre || "Sin rol (solo el Panel)";
  return ROL_BASE[u?.rol] || u?.rol || "";
}

/** Cuántas personas tienen ese rol. */
export const personasConRol = (lista = [], rolId) => lista.filter((u) => u.rolId === rolId).length;

/**
 * ¿Puede `yo` editar, mandar enlace o desactivar a `u`? El dueño a todo el
 * equipo; un admin solo a choferes; a sí mismo nadie (eso va en Mi cuenta).
 * Copia de `puedeTocar` de Web/lib/equipo.mjs.
 */
export function puedoTocarUsuario(yo, u) {
  if (!yo || !u || (yo.rol !== "dueno" && yo.rol !== "admin")) return false;
  if (u.id === yo.id) return false;
  if (u.rol !== "admin" && u.rol !== "operador") return false;
  return u.rol === "operador" || yo.rol === "dueno";
}

/**
 * Lo que viaja a `usuario-editar`. El rol SOLO si quien guarda es el dueño
 * y la persona es administrador; `""` quiere decir "sin rol". Si viajara
 * siempre, un admin que edita a un chofer recibiría "Solo el dueño asigna
 * roles" por un campo que ni ve.
 */
export function datosEdicionUsuario({ u, nombre, telefono, rolId, soyDueno }) {
  const datos = { id: u.id, nombre, telefono };
  if (soyDueno && u.rol === "admin") datos.rolId = rolId || "";
  return datos;
}

/** Al invitar un admin, el rol con que nace: el completo (lo mismo que pondría el servidor). */
export const rolInicialInvitado = (roles = []) => roles.find((r) => r.nombre === ROL_COMPLETO)?.id || "";
