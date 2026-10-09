// COPIA de Web/lib/solicitud-cliente.mjs (apps al 100%, 9-oct-2026). NO se edita aquí: se cambia en la web
// y se vuelve a copiar; Web/tests/apps-copias.test.mjs avisa si se queda atrás.
/**
 * EL CLIENTE CANCELA O REAGENDA SU SOLICITUD (Entrega 4, 9-oct-2026).
 *
 * Sin estado nuevo en la base: las apps 1.1.1 ya instaladas no conocerían
 * "cancelada". Una cancelación del cliente es `rechazada` con el motivo
 * "Cancelada por el cliente…"; la web la enseña como "Cancelada".
 * Sin dependencias, con pruebas (tests/solicitud-cliente.test.mjs).
 */
export const MOTIVO_CANCELADA = "Cancelada por el cliente";

const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const masDias = (iso, n) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};
const existe = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
};

/** Mientras el chofer no vaya en camino. */
export const puedeCancelar = (estado) => estado === "solicitada" || estado === "confirmada";
/** Una confirmada ya tiene camión y chofer: esa la mueve la oficina. */
export const puedeReagendar = (estado) => estado === "solicitada";

export function validarReagenda({ fecha, hoy, actual = null } = {}) {
  const f = String(fecha || "");
  if (!FECHA.test(f) || !existe(f)) return { ok: false, motivo: "Elige una fecha válida." };
  if (f < hoy) return { ok: false, motivo: "La fecha no puede ser del pasado." };
  if (f > masDias(hoy, 365)) return { ok: false, motivo: "La fecha no puede ser de más de un año adelante." };
  if (actual && f === actual) return { ok: false, motivo: "Es la misma fecha que ya tenía." };
  return { ok: true, fecha: f };
}

export function motivoCancelacion(texto) {
  const t = String(texto ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  return t ? `${MOTIVO_CANCELADA}: ${t}` : MOTIVO_CANCELADA;
}

/** Lo que se enseña: una rechazada por el propio cliente es "cancelada". */
export function estadoParaMostrar(s) {
  const motivo = s?.motivoRechazo ?? s?.motivo_rechazo ?? "";
  if (s?.estado === "rechazada" && String(motivo).startsWith(MOTIVO_CANCELADA)) return "cancelada";
  return s?.estado;
}
