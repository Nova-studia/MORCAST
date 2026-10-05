/**
 * LA BANDEJA DE INCIDENTES, sin base de datos (lógica pura, con pruebas en
 * tests/incidentes.test.mjs).
 *
 * Los incidentes los reporta el chofer desde la calle (db/023): accidente,
 * retraso, falla mecánica, o un contenedor dañado, movido o que no está.
 * Aquí se decide en qué orden los ve la administración y qué se acepta al
 * cerrarlos. Vive junto a la pantalla y no en lib/ porque nadie más lo usa.
 */

import { TIPOS_INCIDENTE as TIPOS_BASE } from "../../../../lib/chofer-reportes.mjs";
import { fechaEnMatamoros } from "../../../../lib/avisos.mjs";

/**
 * Los tipos que acepta la base, con su nombre de pantalla y su TONO.
 *
 * El tono es el color del estado, no decoración (DESIGN.md: error, alerta y
 * neutro; el naranja es "en ruta" y aquí no se usa). Un accidente es lo único
 * URGENTE: puede haber alguien herido. Retraso y falla van en alerta porque
 * le pegan a la ruta del día. Lo del contenedor se arregla con calma.
 */
//
// La LISTA de tipos es una sola, la del chofer (lib/chofer-reportes.mjs,
// atada al `check` de db/023): aquí solo se le pone el tono y un nombre más
// corto para la tabla. Así un tipo nuevo no puede existir en un lado y no
// en el otro.
const TONO = { accidente: "urgente", retraso: "alerta", "falla-mecanica": "alerta" };
const TEXTO_CORTO = {
  "contenedor-movido": "Contenedor movido",
  "contenedor-no-esta": "Contenedor no está",
  otro: "Otro",
};
export const TIPOS_INCIDENTE = TIPOS_BASE.map((t) => ({
  id: t.id,
  texto: TEXTO_CORTO[t.id] || t.texto,
  tono: TONO[t.id] || "neutro",
}));

export const MAX_NOTA = 1000;

export function infoTipo(id) {
  return TIPOS_INCIDENTE.find((t) => t.id === id) || { id, texto: id || "—", tono: "neutro" };
}

/** "5 oct 2026 · 14:32", en hora de Matamoros (el servidor y el navegador pueden no estarlo). */
export function fechaHora(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "—";
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [a, m, dia] = fechaEnMatamoros(d).split("-").map(Number);
  const hora = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Matamoros",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${dia} ${meses[m - 1]} ${a} · ${hora}`;
}

/**
 * Filtra por estado, tipo y rango de fechas. Las fechas se comparan como
 * días de calendario de Matamoros: un incidente de las 11 de la noche del 4
 * es del 4, aunque en UTC ya sea el 5.
 */
export function filtrarIncidentes(lista, { estado = "abiertos", tipo = "todos", desde = "", hasta = "" } = {}) {
  return (lista || []).filter((i) => {
    if (estado === "abiertos" && i.estado !== "abierto") return false;
    if (estado === "atendidos" && i.estado !== "atendido") return false;
    if (tipo !== "todos" && i.tipo !== tipo) return false;
    if (desde || hasta) {
      const dia = fechaEnMatamoros(i.creado);
      if (desde && dia < desde) return false;
      if (hasta && dia > hasta) return false;
    }
    return true;
  });
}

/**
 * Orden de la bandeja: lo que falta atender, arriba; y de eso, los
 * accidentes primero. Dentro de cada grupo, lo más nuevo arriba.
 *
 * El accidente va primero aunque sea más viejo que un retraso de hace cinco
 * minutos: un retraso se resuelve solo, un accidente sin atender no.
 */
export function ordenarBandeja(lista) {
  const peso = (i) => (i.estado === "abierto" ? (i.tipo === "accidente" ? 0 : 1) : 2);
  return [...(lista || [])].sort((a, b) => {
    const p = peso(a) - peso(b);
    if (p) return p;
    return new Date(b.creado).getTime() - new Date(a.creado).getTime();
  });
}

/** Las cifras de los botones de filtro. */
export function contarIncidentes(lista) {
  const l = lista || [];
  return {
    todos: l.length,
    abiertos: l.filter((i) => i.estado === "abierto").length,
    atendidos: l.filter((i) => i.estado === "atendido").length,
    urgentes: l.filter((i) => i.estado === "abierto" && i.tipo === "accidente").length,
  };
}

/**
 * La nota al marcar como atendido es OBLIGATORIA. Es lo único que contesta,
 * semanas después, "¿y qué se hizo con el contenedor que se reportó dañado?"
 * Un "atendido" sin nota solo dice que alguien apretó un botón.
 */
export function validarAtencion(nota) {
  const limpia = String(nota || "").trim();
  if (limpia.length < 3) return { ok: false, motivo: "Escribe qué se hizo (al menos unas palabras)." };
  if (limpia.length > MAX_NOTA) return { ok: false, motivo: `La nota es muy larga (máximo ${MAX_NOTA} caracteres).` };
  return { ok: true, nota: limpia };
}
