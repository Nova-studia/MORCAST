/**
 * QUE LE FALTA A UN CLIENTE, Y COMO SE LLAMA SU ESTADO.
 *
 * DE DONDE SALE ESTO
 * El cuaderno que devolvio la empresa el 27-ago-2026 trae la operacion real,
 * pero incompleta: de 42 clientes, 13 no tienen correo, 13 no tienen telefono
 * y 13 no tienen persona de contacto. Cargarlos como "activos" seria mentir;
 * no cargarlos seria seguir con una base de mentira.
 *
 * POR QUE LA VARA ES CONTACTO + TELEFONO + CORREO
 * Es lo que hace falta para OPERAR: a quien se le llama y a donde se le manda
 * su acceso al portal. Lo fiscal (RFC, domicilio) se dejo FUERA a proposito:
 * exigirlo dejaria 2 clientes activos de 42, porque la empresa lleno la
 * columna de domicilio fiscal con el REGIMEN en 28 de ellos. Lo fiscal sirve
 * para facturar, no para operar, y bloquear la operacion por eso seria
 * castigar a Morcast por un error de captura.
 *
 * LO QUE FALTA NO SE GUARDA EN UNA COLUMNA
 * Se calcula aqui, mirando los campos. Guardarlo seria una copia que se
 * desincroniza en cuanto alguien llene el telefono.
 *
 * ⚠️ `scripts/cuaderno/normalizar.mjs` importa `estadoPorCompletitud` de aqui.
 * La regla vive en UN solo lugar: dos copias de una regla acaban diciendo
 * cosas distintas. Por eso este modulo es `.mjs` sin depender de React ni de
 * Supabase — tiene que poder importarse desde un script de Node suelto.
 */

/** Lo que hace falta para operar, en el orden en que se le reporta a Morcast. */
export const CAMPOS_PARA_OPERAR = [
  { campo: "contacto", etiqueta: "persona de contacto" },
  { campo: "telefono", etiqueta: "teléfono" },
  { campo: "correo", etiqueta: "correo" },
];

/**
 * Rellenos que la gente teclea cuando no tiene el dato. En el cuaderno hay
 * "N-A" literal en la columna de correo: si llegara asi a la base, un cliente
 * sin correo se veria completo.
 */
const RELLENOS = new Set([
  "na", "n/a", "n-a", "n.a.", "no", "-", "--", ".", "ninguno", "sin correo",
  // El guion largo lo pone NUESTRA propia capa de datos: `datos-clientes.js`
  // mapea `contacto: c.contacto || "—"` para que la tabla no salga con
  // huecos. Sin esta entrada, un cliente sin persona de contacto llegaria
  // aqui con "—" y se veria completo — el bug se lo habriamos hecho nosotros
  // solos, no la empresa.
  "—", "–",
]);

/** ¿Este campo trae un dato de verdad? */
export function hayDato(valor) {
  const v = String(valor ?? "").trim();
  if (!v) return false;
  return !RELLENOS.has(v.toLowerCase());
}

/** Las etiquetas de lo que le falta al cliente. Vacio = esta completo. */
export function loQueFalta(cliente) {
  return CAMPOS_PARA_OPERAR
    .filter(({ campo }) => !hayDato(cliente?.[campo]))
    .map(({ etiqueta }) => etiqueta);
}

/** El estado que le toca por lo que trae, sin mirar lo fiscal. */
export function estadoPorCompletitud(cliente) {
  return loQueFalta(cliente).length ? "pendiente-info" : "activo";
}

/**
 * Como se llama cada estado en pantalla.
 *
 * Antes esta pantalla pintaba `estatus === "activo" ? "Activo" : "Moroso"`.
 * Con el estado nuevo, los 16 clientes a los que solo les falta un dato
 * habrian aparecido en vivo ACUSADOS DE MOROSOS.
 */
const ETIQUETAS = {
  activo: { texto: "Activo", clase: "ok" },
  "pendiente-info": { texto: "Pendiente por información", clase: "prog" },
  suspendido: { texto: "Suspendido", clase: "mal" },
  baja: { texto: "Baja", clase: "" },
};

export function etiquetaEstado(estado) {
  return ETIQUETAS[estado] || { texto: String(estado ?? ""), clase: "" };
}

/**
 * ¿SE LE PUEDE DAR ACCESO AL PORTAL A ESTE CLIENTE?
 *
 * De donde sale esto
 * -------------------
 * De los 43 clientes reales cargados el 27-ago-2026, ninguno tiene acceso: las
 * dos acciones que existian para eso (`activarCuentaCliente` y
 * `activarCuentaRegistrada`, en app/acciones-alta-cliente.js) siempre hacian
 * `insert` en `clientes` -- se escribieron para "llega un prospecto de la
 * nada", no para "dale acceso a alguien que ya esta en la base". Intentarlo
 * con ellas truena contra el indice unico `clientes_empresa_key` (db/020).
 *
 * `darAccesoACliente` (la accion nueva) usa esta funcion para decidir SI
 * puede seguir, y la pantalla de /admin/clientes la usa para decidir si el
 * boton se puede pulsar. Es la MISMA regla en los dos lados a proposito: si
 * viviera por separado, tarde o temprano dirian cosas distintas y el boton
 * se veria habilitado para un cliente que el servidor va a rechazar.
 *
 * `cliente.tieneAcceso` lo calcula `listarClientes()` mirando si hay algun
 * `perfiles.cliente_id` que apunte a el -- no es una columna de `clientes`,
 * asi que esta funcion no puede ir a buscarlo por su cuenta: recibe lo que ya
 * se calculo.
 *
 * El orden importa: si ya tiene acceso, eso se contesta primero aunque
 * ademas le falte el correo. Decirle "sin correo" a un cliente que ya tiene
 * acceso seria disfrazar la razon real de por que no se le puede dar otro.
 */
export function puedeRecibirAcceso(cliente) {
  if (cliente?.tieneAcceso) return { puede: false, motivo: "ya-tiene-acceso" };
  // hayDato() ya trata "N-A" y el guion largo (el que pone `datos-clientes.js`
  // cuando no hay correo) como vacios. Sin reusarla, un cliente sin correo
  // pero con el relleno "—" se veria con correo valido.
  if (!hayDato(cliente?.correo)) return { puede: false, motivo: "sin-correo" };
  return { puede: true };
}

/**
 * ¿ES SEGURO SELLAR (rol "cliente" + esta empresa) A UN USUARIO QUE YA
 * EXISTIA en Supabase Auth?
 *
 * De donde sale esto
 * -------------------
 * `darAccesoACliente` (app/acciones-alta-cliente.js) liga un usuario ya
 * existente cuando el correo del cliente coincide con alguien que se
 * registro solo, por ejemplo con Google. Pero "ya existe un usuario con ese
 * correo" no dice QUE es ese usuario: podria ser personal de Morcast (dueno,
 * admin, operador) o un cliente que YA administra OTRA empresa. Sellarlo sin
 * mirar eso primero le sobrescribiria el rol o la empresa a una persona real
 * sin que nadie se entere -- exactamente el dano silencioso que
 * `scripts/cuaderno/limpiar.mjs` ya frena con su guardia de "no toco a un
 * `dueno` ni a un `operador`".
 *
 * Por que es pura
 * ----------------
 * No consulta la base: recibe el perfil tal cual se leyo (o `null` si el
 * usuario es nuevo y no tiene perfil todavia) y el id del cliente al que se
 * le quiere dar acceso. Quien la llama es quien decide como enriquecer el
 * mensaje de error (por ejemplo, buscando el nombre de la OTRA empresa) --
 * aqui solo vive la decision de "para o sigue".
 *
 * Los motivos:
 *   "es-personal"   -> el perfil no es `cliente` ni `pendiente`.
 *   "otra-empresa"  -> ya es cliente, pero de una empresa distinta.
 */
export function puedeSellarUsuarioExistente(perfilAjeno, clienteId) {
  if (!perfilAjeno) return { puede: true };

  if (perfilAjeno.rol !== "cliente" && perfilAjeno.rol !== "pendiente") {
    return { puede: false, motivo: "es-personal", rol: perfilAjeno.rol };
  }

  if (perfilAjeno.cliente_id && perfilAjeno.cliente_id !== clienteId) {
    return { puede: false, motivo: "otra-empresa", clienteIdAjeno: perfilAjeno.cliente_id };
  }

  return { puede: true };
}

/* =====================================================================
 * ESTADOS CON EFECTO REAL (Entrega 1, 8-oct-2026). Hasta aquí el estado
 * solo se pintaba; desde la 028 la base también lo respeta:
 *   · suspendido: entra y ve, pero SOLO puede reportar depósitos
 *     (la causa típica es la falta de pago). Aviso rojo fijo arriba.
 *   · baja: no entra.
 * ===================================================================== */

export const AVISO_SUSPENDIDO = "Tu cuenta está suspendida. Contáctanos para restablecerla.";
export const AVISO_BAJA = "Tu cuenta fue dada de baja. Comunícate con Morcast al 868 384 9478.";

export function permisosDeEstado(estado) {
  if (estado === "suspendido") return { entra: true, puedeOperar: false, puedePagar: true, aviso: AVISO_SUSPENDIDO };
  if (estado === "baja") return { entra: false, puedeOperar: false, puedePagar: false, aviso: AVISO_BAJA };
  return { entra: true, puedeOperar: true, puedePagar: true, aviso: null };
}

const A_MANO = ["activo", "suspendido", "baja"];

/** ¿Se puede pasar de `actual` a `nuevo`? Suspender o dar de baja pide motivo. */
export function validarCambioEstado({ actual, nuevo, motivo }) {
  if (!A_MANO.includes(nuevo)) return { ok: false, motivo: "Ese estado no se pone a mano." };
  if (nuevo === actual) return { ok: false, motivo: "El cliente ya está en ese estado." };
  if ((nuevo === "suspendido" || nuevo === "baja") && !String(motivo || "").trim()) {
    return { ok: false, motivo: "Escribe el motivo: queda en la bitácora." };
  }
  return { ok: true };
}

const pesosMx = (n) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Lo que se va a borrar, en palabras, para la confirmación de "Eliminar". */
export function resumenBorrado(c = {}) {
  const partes = [];
  if (c.recolecciones) partes.push(plural(c.recolecciones, "recolección", "recolecciones"));
  if (c.solicitudes) partes.push(plural(c.solicitudes, "solicitud", "solicitudes"));
  if (c.movimientos) partes.push(`${plural(c.movimientos, "movimiento", "movimientos")} de saldo por ${pesosMx(c.montoMovimientos)}`);
  if (c.precios) partes.push(plural(c.precios, "precio especial", "precios especiales"));
  if (c.puntos) partes.push(plural(c.puntos, "punto", "puntos"));
  if (c.usuarios) partes.push(plural(c.usuarios, "usuario", "usuarios"));
  if (!partes.length) return "No tiene historial: solo se borra la empresa.";
  return `Se borrarán: ${partes.join(", ")}.`;
}

/** Eliminar definitivamente: el dueño, o un admin al que el dueño le dio el permiso. */
export function puedeEliminarCliente({ rol, permisos = [] }) {
  if (rol === "dueno") return true;
  return rol === "admin" && (permisos || []).includes("eliminar_clientes");
}

/**
 * El mensaje del login cuando Supabase rechaza la entrada. A una cuenta
 * BLOQUEADA (baja o acceso quitado) se le explica; antes leía "contraseña
 * incorrecta" y la persona seguía intentando (revisión final, 8-oct-2026).
 */
export function mensajeErrorLogin(error) {
  const t = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  if (/banned|user_banned/.test(t)) return AVISO_BAJA;
  return "Correo o contraseña incorrectos.";
}

/** Permisos sueltos que el dueño asigna a un admin desde Usuarios (db/027, 028). */
export const PERMISOS_ASIGNABLES = [
  { clave: "precios", texto: "Puede cambiar precios" },
  { clave: "eliminar_clientes", texto: "Puede eliminar clientes" },
];

export function aplicarPermiso(actuales, permiso, valor) {
  if (!PERMISOS_ASIGNABLES.some((p) => p.clave === permiso)) throw new Error(`Permiso desconocido: ${permiso}`);
  const resto = (actuales || []).filter((p) => p !== permiso);
  return valor ? [...resto, permiso] : resto;
}
