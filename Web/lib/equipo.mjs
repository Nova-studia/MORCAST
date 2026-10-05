/**
 * LAS REGLAS DEL EQUIPO DE MORCAST (/admin/usuarios), sin base de datos.
 *
 * Por qué existe
 * --------------
 * Hasta el 2-oct-2026 "Invitar usuario" no creaba nada: agregaba una fila a un
 * `useState` y al recargar desaparecía. Y la pantalla ofrecía cinco roles
 * ("Auxiliar", "Facturación", "Operaciones"…) de los que en la base solo
 * existen dos para el personal: `admin` y `operador` (db/001: `dueno`,
 * `admin`, `operador`, `cliente`). Ofrecer un rol que nadie aplica es
 * prometer un candado que no existe.
 *
 * Las decisiones viven aquí, puras y con pruebas (tests/equipo.test.mjs); la
 * acción del servidor (app/acciones-equipo.js) solo junta los datos y llama.
 */

/** Los únicos roles que se pueden dar al invitar. El dueño no se invita. */
export const ROLES_INVITABLES = {
  admin: "Administrador",
  operador: "Chofer / Operador",
};

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Limpia y valida lo que llega del formulario. */
export function validarInvitacion({ nombre, correo, rol } = {}) {
  const limpio = {
    nombre: String(nombre || "").trim(),
    correo: String(correo || "").trim().toLowerCase(),
    rol: String(rol || "").trim(),
  };
  if (!limpio.nombre) return { ok: false, motivo: "Escribe el nombre completo." };
  if (!CORREO_RE.test(limpio.correo)) return { ok: false, motivo: "Ese correo no parece válido." };
  if (!Object.hasOwn(ROLES_INVITABLES, limpio.rol)) {
    return { ok: false, motivo: "Elige un rol: Administrador o Chofer / Operador." };
  }
  return { ok: true, limpio };
}

const ES_PERSONAL = (rol) => rol === "dueno" || rol === "admin";

/** ¿Puede esta persona invitar a alguien al equipo? */
export function puedeInvitar(quien) {
  return ES_PERSONAL(quien?.rol);
}

/**
 * ¿Puede `quien` dar este rol?
 *
 * El acceso administrativo lo da y lo quita SOLO el dueño (pedido de los
 * dueños, 4-oct-2026: "seguridad para roles administrativos"). Si un admin
 * pudiera crear otros admins, una sola cuenta robada bastaría para abrir
 * puertas nuevas que sobreviven al cambio de su contraseña. El admin sí puede
 * invitar choferes: es su trabajo diario. La base aplica la misma regla
 * (db/022), así que no se brinca llamando a Supabase directo.
 */
export function puedeDarRol(quien, rol) {
  if (!ES_PERSONAL(quien?.rol)) return false;
  if (rol === "admin") return quien.rol === "dueno";
  return rol === "operador";
}

/**
 * ¿Puede `quien` desactivar o reactivar a `objetivo`?
 *
 * Nunca al dueño (es la cuenta que no se puede perder) ni a sí mismo (se
 * quedaría fuera sin que nadie más pueda regresarlo). Solo personal del
 * equipo: a un cliente se le da de baja desde Clientes, no desde aquí.
 */
export function puedeCambiarActivo({ quien, objetivo } = {}) {
  if (!ES_PERSONAL(quien?.rol)) return { puede: false, motivo: "No tienes permiso para cambiar al equipo." };
  if (!objetivo) return { puede: false, motivo: "No se encontró a esa persona." };
  if (objetivo.rol === "dueno") return { puede: false, motivo: "La cuenta del dueño no se puede desactivar." };
  if (objetivo.id === quien.id) return { puede: false, motivo: "No puedes desactivar tu propia cuenta." };
  if (objetivo.rol !== "admin" && objetivo.rol !== "operador") {
    return { puede: false, motivo: "Desde aquí solo se administra al personal de Morcast." };
  }
  if (objetivo.rol === "admin" && quien.rol !== "dueno") {
    return { puede: false, motivo: "Solo el dueño puede desactivar o reactivar a un administrador." };
  }
  return { puede: true };
}
