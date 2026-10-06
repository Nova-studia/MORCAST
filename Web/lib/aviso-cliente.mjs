/**
 * AVISOS AL CLIENTE SOBRE SU RECOLECCIÓN — lógica pura (6-oct-2026, Luis).
 *
 * "Que también le llegue al cliente un aviso de que ya sigue su recolección,
 * o en el caso de reagendar o incidencia también se le avise." Cada cambio
 * que el cliente necesita saber de SU recolección sale por correo y por
 * notificación al teléfono (si tiene la app). Aquí vive qué dice cada uno y
 * cuándo procede; mandar está en lib/avisar-cliente.js.
 *
 * Sin React ni Supabase, para probarlo con `node --test`.
 */

export const EVENTOS_AVISO = ["confirmada", "reagendada", "en-camino", "retraso", "completada", "no-procedio"];

/**
 * Los que se mandan UNA sola vez por recolección: si el chofer toca dos
 * veces "En camino" o la app reintenta, el cliente no recibe dos avisos.
 * Confirmar y reagendar no van aquí: cada vez es una fecha nueva que el
 * cliente tiene que saber.
 */
export const EVENTOS_UNA_VEZ = ["en-camino", "completada", "no-procedio"];

/** El estado en que tiene que estar la recolección para avisar de cada evento. */
const ESTADO_DEL_EVENTO = {
  "en-camino": ["en-ruta"],
  completada: ["completada"],
  "no-procedio": ["no-procedio"],
};

/** Incidentes del chofer que retrasan la recolección del cliente. Los de contenedor son internos. */
export const INCIDENTES_QUE_RETRASAN = ["retraso", "accidente", "falla-mecanica"];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "2026-10-08" → "jueves 8 de octubre". Sin zona horaria: es una fecha, no un instante. */
export function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${DIAS[d.getUTCDay()]} ${+m[3]} de ${MESES[+m[2] - 1]}`;
}

const horaCorta = (h) => (h ? String(h).slice(0, 5) : "");

/**
 * ¿Se puede avisar de este evento con la recolección como está? El evento
 * tiene que coincidir con lo que dice la base: un aviso de "ya la recogimos"
 * de una recolección que sigue abierta sería mentirle al cliente.
 */
export function puedeAvisar(evento, estado) {
  if (!EVENTOS_AVISO.includes(evento)) return false;
  const validos = ESTADO_DEL_EVENTO[evento];
  return !validos || validos.includes(estado);
}

/**
 * ¿Es esta parada de este chofer? La asignada directamente a la parada o,
 * si no tiene, la de su ruta. Es la misma regla que `mis_paradas()` (db/013).
 */
export function esChoferDeParada(parada, uid) {
  if (!parada || !uid) return false;
  const asignado = parada.chofer_id || parada.rutas?.chofer_id || null;
  return asignado === uid;
}

/**
 * Lo que dice el aviso. `d`: { folio, fecha, hora, chofer, motivo, detalle, retrasoMin }.
 * Devuelve { asunto, titulo, parrafos: string[], push: { titulo, cuerpo } } o null.
 */
export function mensajeAvisoCliente(evento, d = {}) {
  const folio = d.folio || "";
  const cuando = [fechaCorta(d.fecha), horaCorta(d.hora) && `alrededor de las ${horaCorta(d.hora)}`]
    .filter(Boolean)
    .join(" ");

  switch (evento) {
    case "confirmada":
      return {
        asunto: `Confirmamos tu recolección${cuando ? ` del ${cuando}` : ""} — ${folio}`,
        titulo: "Tu recolección está confirmada",
        parrafos: [cuando ? `Pasamos por tus residuos el ${cuando}.` : "Ya quedó confirmada tu recolección."],
        push: { titulo: "Recolección confirmada", cuerpo: cuando ? `Pasamos el ${cuando}. Folio ${folio}.` : `Folio ${folio}.` },
      };
    case "reagendada":
      return {
        asunto: `Cambió la fecha de tu recolección — ${folio}`,
        titulo: "Tu recolección cambió de fecha",
        parrafos: [
          cuando ? `Ahora pasamos el ${cuando}.` : "Le cambiamos la fecha a tu recolección.",
          "Si esa fecha no te funciona, contesta este correo o llámanos.",
        ],
        push: { titulo: "Cambió tu recolección", cuerpo: cuando ? `Ahora pasamos el ${cuando}.` : `Folio ${folio}.` },
      };
    case "en-camino":
      return {
        asunto: `Tu recolección va en camino — ${folio}`,
        titulo: "Vamos en camino",
        parrafos: [
          `${d.chofer ? `${d.chofer}, nuestro chofer,` : "Nuestro chofer"} ya va hacia tu domicilio por tu recolección.`,
          "Ten listo el acceso a tus residuos, por favor.",
        ],
        push: { titulo: "Vamos en camino", cuerpo: `El chofer ya va por tu recolección. Folio ${folio}.` },
      };
    case "retraso": {
      const min = Number(d.retrasoMin) > 0 ? Number(d.retrasoMin) : null;
      return {
        asunto: `Tu recolección viene con retraso — ${folio}`,
        titulo: "Tu recolección viene con retraso",
        parrafos: [
          min
            ? `Tuvimos un contratiempo en la ruta y llegaremos unos ${min} minutos más tarde de lo previsto.`
            : "Tuvimos un contratiempo en la ruta y llegaremos más tarde de lo previsto.",
          "Si no podemos pasar hoy, te avisamos la nueva fecha.",
        ],
        push: { titulo: "Tu recolección viene con retraso", cuerpo: min ? `Llegamos unos ${min} min más tarde.` : "Llegamos más tarde de lo previsto." },
      };
    }
    case "completada":
      return {
        asunto: `Recolección realizada — ${folio}`,
        titulo: "Listo: recogimos tus residuos",
        parrafos: ["Tu recolección quedó realizada. El comprobante, con las fotos del chofer, ya está en tu historial."],
        push: { titulo: "Recolección realizada", cuerpo: `Tu comprobante ya está en tu historial. Folio ${folio}.` },
      };
    case "no-procedio": {
      const porque = [d.motivo, d.detalle].filter(Boolean).join(": ");
      return {
        asunto: `No se pudo hacer tu recolección — ${folio}`,
        titulo: "No se pudo hacer tu recolección",
        parrafos: [
          porque ? `Nuestro chofer llegó, pero no se pudo recoger. Motivo: ${porque}.` : "Nuestro chofer llegó, pero no se pudo recoger.",
          "Esta visita no se te cobra. Contesta este correo o llámanos para volver a agendarla.",
        ],
        push: { titulo: "No se pudo hacer tu recolección", cuerpo: porque ? `Motivo: ${porque}` : `Folio ${folio}.` },
      };
    }
    default:
      return null;
  }
}
