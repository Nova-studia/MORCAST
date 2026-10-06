/**
 * QUIÉN ES EL CHOFER DE CADA SERVICIO DEL CLIENTE — lógica pura.
 *
 * Bug que vio Luis en el iPhone (6-oct-2026): un servicio COMPLETADO decía
 * "Operador: Marco Antonio" y lo hizo José Medina. El historial (app y
 * portal) tomaba el chofer del TEXTO LIBRE de la ruta (`rutas.chofer`), que
 * nadie actualiza cuando la oficina manda a otro.
 *
 * La verdad, en este orden:
 *   1. Ya se hizo → quien levantó la evidencia (`recolecciones.operador_id`).
 *   2. El chofer asignado a ESA parada (`solicitudes_recoleccion.chofer_id`).
 *   3. El chofer con usuario de la ruta (`rutas.chofer_id`).
 *   4. Solo al final, el texto libre de la ruta.
 *
 * El cliente no puede leer los perfiles de otros (RLS `perfiles_ve_el_suyo`),
 * así que los nombres los arma el servidor (lib/choferes-servicios.js) y la
 * pantalla solo los MEZCLA con su lista (`mezclarChoferes`). Si el servidor
 * no contesta, se dice "—": mejor no decir nombre que decir uno equivocado.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ COPIADO TAL CUAL en las apps
 * (`App IOS/src/chofer-servicio.mjs`, `App Android/src/chofer-servicio.js`);
 * sus pruebas comparan las copias con esta.
 */

const limpio = (x) => String(x ?? "").trim();

/** ¿Ya pasó el camión? Entonces el nombre es de quien fue, no de quien iba a ir. */
function yaSeAtendio(estado) {
  return estado === "completada" || estado === "completado" || estado === "no-procedio";
}

/** La etiqueta del renglón según el estado (de la base o de pantalla). */
export function etiquetaChofer(estado) {
  return yaSeAtendio(estado) ? "Chofer" : "Chofer asignado";
}

/**
 * @param {{estado?: string, operador?: string, asignado?: string, deRuta?: string, textoRuta?: string}} datos
 *   Nombres ya resueltos (no ids). `operador` = quien levantó la evidencia.
 * @returns {{nombre: string, etiqueta: string}}
 */
export function elegirChofer({ estado, operador, asignado, deRuta, textoRuta } = {}) {
  const hecho = yaSeAtendio(estado);
  // Para lo que todavía no pasa NO cuenta `operador`: no existe aún.
  const candidatos = hecho ? [operador, asignado, deRuta, textoRuta] : [asignado, deRuta, textoRuta];
  const nombre = candidatos.map(limpio).find(Boolean) || "—";
  return { nombre, etiqueta: etiquetaChofer(estado) };
}

/**
 * Filas de la base → `{ [folio]: { nombre, etiqueta } }`.
 *
 * @param {Array} filas  solicitudes con `estado, folio, chofer_id,
 *   rutas ( chofer, chofer_id ), recolecciones ( operador_id )`.
 * @param {Record<string,string>} nombrePorId  perfiles: id → nombre.
 */
export function mapaDeChoferes(filas, nombrePorId = {}) {
  const nombre = (id) => (id ? limpio(nombrePorId[id]) : "");
  const mapa = {};
  for (const s of filas || []) {
    if (!s?.folio) continue;
    const ev = Array.isArray(s.recolecciones) ? s.recolecciones[0] : s.recolecciones;
    const ruta = Array.isArray(s.rutas) ? s.rutas[0] : s.rutas;
    mapa[s.folio] = elegirChofer({
      estado: s.estado,
      operador: nombre(ev?.operador_id),
      asignado: nombre(s.chofer_id),
      deRuta: nombre(ruta?.chofer_id),
      textoRuta: ruta?.chofer,
    });
  }
  return mapa;
}

/** Los ids de perfil que hay que traducir a nombre, sin repetir. */
export function idsDeChoferes(filas) {
  const ids = new Set();
  for (const s of filas || []) {
    const ev = Array.isArray(s?.recolecciones) ? s.recolecciones[0] : s?.recolecciones;
    const ruta = Array.isArray(s?.rutas) ? s.rutas[0] : s?.rutas;
    for (const id of [ev?.operador_id, s?.chofer_id, ruta?.chofer_id]) if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * Pega el chofer bueno a cada servicio de la lista del cliente.
 *
 * `choferes` null (el servidor no contestó) → "—" en todos: el texto de la
 * ruta era justo el que mentía. Nunca tumba la lista: devuelve una copia con
 * `operador`, `etiquetaOperador` y la firma del comprobante corregidos.
 */
export function mezclarChoferes(servicios, choferes) {
  return (servicios || []).map((s) => {
    const c = choferes && s?.folio ? choferes[s.folio] : null;
    const nombre = limpio(c?.nombre) || "—";
    const etiqueta = c?.etiqueta || etiquetaChofer(s?.estatus);
    const ev = s?.evidencia;
    return {
      ...s,
      operador: nombre,
      etiquetaOperador: etiqueta,
      evidencia: ev && ev.despues ? { ...ev, despues: { ...ev.despues, firma: nombre } } : ev,
    };
  });
}
