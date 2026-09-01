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
