/**
 * REGLAS PEQUEÑAS DE LA ADMINISTRACIÓN QUE COMPARTEN EL PANEL WEB Y LA APP
 * (6-oct-2026, paridad de la app 1.1).
 *
 * Antes cada pantalla del panel traía su propia lista de estados y su propia
 * forma de armar la fila de un cliente nuevo. Cuando la app empezó a hacer
 * lo mismo por `/api/app/...`, esas listas tenían que ser UNA: si el panel
 * acepta "en-evaluacion" y la ruta de la app no, la misma zona se puede
 * mover desde un lado y no desde el otro.
 *
 * Sin dependencias, para que `node --test` lo importe directo
 * (tests/admin-app.test.mjs). La app guarda una copia de los textos en
 * `src/cuentas-admin`.
 */

/** Estados de una solicitud de alta (/admin/altas). Las clases son las de portal.css. */
export const ESTADOS_ALTA = [
  { id: "nueva", texto: "Nueva", clase: "" },
  { id: "contactada", texto: "Contactada", clase: "prog" },
  { id: "aprobada", texto: "Aprobada", clase: "ok" },
  { id: "rechazada", texto: "Rechazada", clase: "mal" },
];

/** Estados de una zona pedida (/admin/zonas-pedidas). */
export const ESTADOS_ZONA = [
  { id: "nueva", texto: "Nueva", clase: "prog" },
  { id: "en-evaluacion", texto: "En evaluación", clase: "ruta" },
  { id: "aprobada", texto: "Aprobada", clase: "ok" },
  { id: "descartada", texto: "Descartada", clase: "mal" },
];

/** ¿`estado` es uno de la lista? (Para no mandarle a la base un estado inventado.) */
export function esEstado(lista, estado) {
  return typeof estado === "string" && lista.some((e) => e.id === estado);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esId = (v) => typeof v === "string" && UUID_RE.test(v);

/** Los planes que ofrece el alta de cliente del panel. */
export const PLANES_CLIENTE = ["Por evento", "Contrato mensual", "Contrato anual"];

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * La fila de `clientes` de un alta hecha a mano ("Nuevo cliente"). No crea
 * ningún acceso: eso va aparte, con "Dar acceso", para que el cliente escoja
 * su contraseña. El folio lo pone la base (db/014).
 *
 * El formulario de la web pide los cuatro datos; aquí sólo se EXIGE la
 * empresa (lo demás puede faltar y el cliente queda "Pendiente por
 * información", como los del cuaderno), pero si viene un correo tiene que
 * parecer correo: un correo mal escrito es un acceso que nunca va a llegar.
 */
export function filaClienteNuevo({ empresa, contacto, correo, telefono, plan } = {}) {
  const limpio = {
    empresa: String(empresa ?? "").trim(),
    contacto: String(contacto ?? "").trim(),
    correo: String(correo ?? "").trim().toLowerCase(),
    telefono: String(telefono ?? "").trim(),
    plan: String(plan ?? "").trim(),
  };
  if (!limpio.empresa) return { ok: false, motivo: "Escribe el nombre de la empresa." };
  if (limpio.empresa.length > 200) return { ok: false, motivo: "El nombre de la empresa es muy largo." };
  if (limpio.correo && !CORREO_RE.test(limpio.correo)) return { ok: false, motivo: "Ese correo no parece válido." };
  if (limpio.plan && !PLANES_CLIENTE.includes(limpio.plan)) return { ok: false, motivo: "Elige un plan de la lista." };
  return {
    ok: true,
    fila: {
      empresa: limpio.empresa,
      contacto: limpio.contacto || null,
      correo: limpio.correo || null,
      telefono: limpio.telefono || null,
      plan: limpio.plan || null,
      estado: "activo",
    },
  };
}

/**
 * Contraseña legible por teléfono: sin l/1/O/0, que se confunden al dictarla.
 * Es la misma que genera "Activar cuenta" de /admin/altas.
 *
 * Recibe los bytes ALEATORIOS de afuera (`crypto.getRandomValues` en el
 * navegador, `randomBytes` en el servidor) para poder probarla; nunca
 * `Math.random()`, que no es criptográfico.
 */
export const ABC_CONTRASENA = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function contrasenaLegible(bytes) {
  return Array.from(bytes, (b) => ABC_CONTRASENA[b % ABC_CONTRASENA.length]).join("");
}
