/**
 * QUÉ HACE FALTA PARA PEDIR UNA RECOLECCIÓN — lógica pura.
 *
 * Pedido de los dueños (4-oct-2026, db/023): el tipo de residuo es
 * OBLIGATORIO al agendar. Es lo que le dice al chofer con qué ir y lo que
 * respalda un "No procedió" ("el residuo no es el que se agendó"). Con
 * «Otro» la nota pasa a ser obligatoria: "Otro" a secas no le dice al chofer
 * qué llevar ni a la oficina si lo puede recoger. Mismas reglas que
 * `Web/app/(portal)/portal/agendar/page.js`.
 *
 * El catálogo (`TIPOS_RESIDUO`) vive en `cotizar-whatsapp.js`, espejo del de
 * la web; aquí llega como parámetro para que este archivo no dependa de nada.
 */

export function validarSolicitudAgenda({ fecha, tipoResiduo, nota } = {}, catalogo = []) {
  if (!String(fecha || "").trim()) {
    return { ok: false, campo: "fecha", mensaje: "Elige el día de tu recolección." };
  }
  const tipo = String(tipoResiduo || "").trim();
  if (!tipo) {
    return { ok: false, campo: "tipoResiduo", mensaje: "Elige el tipo de residuo que vas a entregar." };
  }
  if (catalogo.length && !catalogo.includes(tipo)) {
    return { ok: false, campo: "tipoResiduo", mensaje: "Ese tipo de residuo no está en la lista." };
  }
  if (tipo === "Otro" && !String(nota || "").trim()) {
    return { ok: false, campo: "nota", mensaje: "Con «Otro», escribe en la nota qué residuo es." };
  }
  return { ok: true };
}
