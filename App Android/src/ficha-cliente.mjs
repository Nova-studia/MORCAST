/**
 * LA FICHA DEL CLIENTE EN LA APP (apps al 100%, 9-oct-2026): lo mismo que
 * Web/app/(admin)/admin/clientes/[id]/page.js. Puro, con pruebas en
 * tests/oficina-100.test.mjs. Lo que cambia algo pasa por las acciones
 * `cliente-*` del servidor, que deciden quién puede.
 */

/** Los datos que se ven y se editan, en el orden de la web. */
export const CAMPOS_FICHA = [
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

const NUMEROS = new Set(["dias_credito", "limite_credito"]);
export const esCampoNumero = (k) => NUMEROS.has(k);

/** Lo que dice cada cambio de estado antes de confirmarlo (textos de la web). */
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

/** Qué botones de estado tiene una cuenta en cada estado. */
export function botonesDeEstado(estado) {
  const b = [];
  if (estado !== "suspendido" && estado !== "baja") b.push("suspendido");
  if (estado !== "baja") b.push("baja");
  if (estado === "suspendido" || estado === "baja") b.push("activo");
  return b;
}

/** El formulario de "Editar" con lo que tiene el cliente (todo en texto). */
export function formularioDeCliente(c = {}) {
  return Object.fromEntries(CAMPOS_FICHA.map(([k]) => [k, c[k] === null || c[k] === undefined ? "" : String(c[k])]));
}

/** Lo que viaja a `cliente-editar`: los números como números (como la web). */
export function cambiosDeEdicion(form = {}) {
  return {
    ...form,
    dias_credito: Number(form.dias_credito) || 0,
    limite_credito: Number(form.limite_credito) || 0,
  };
}

/** El servicio (suscripción) de un punto: la base lo manda como lista o como objeto. */
export function servicioDelPunto(d) {
  const s = d?.suscripciones;
  if (Array.isArray(s)) return s[0] || null;
  return s || null;
}

/** "correo · entra con correo · último acceso 1 oct". */
export function lineaUsuarioCliente(u = {}, fecha = (x) => x) {
  const partes = [u.correo || "sin correo"];
  if (u.proveedor) partes.push(`entra con ${u.proveedor === "email" ? "correo" : u.proveedor}`);
  partes.push(u.ultimoAcceso ? `último acceso ${fecha(String(u.ultimoAcceso).slice(0, 10))}` : "nunca ha entrado");
  return partes.join(" · ");
}
