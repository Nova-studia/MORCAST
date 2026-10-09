/**
 * MI CUENTA DEL CLIENTE (Entrega 4, 9-oct-2026). Sin dependencias, con
 * pruebas (tests/cuenta-cliente.test.mjs).
 *
 * El cliente cambia solo su contacto, su teléfono y el correo donde le llegan
 * los avisos. La razón social y el RFC son datos fiscales: se le PIDEN a
 * Morcast (la base tampoco le deja editar su ficha, db/002).
 */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarDatosCliente({ contacto, telefono, correo } = {}) {
  const limpio = {
    contacto: String(contacto ?? "").trim().replace(/\s+/g, " "),
    telefono: String(telefono ?? "").replace(/\D/g, "").slice(-10) || null,
    correo: String(correo ?? "").trim().toLowerCase(),
  };
  if (limpio.contacto.length > 120) return { ok: false, motivo: "El nombre de contacto es muy largo." };
  if (!CORREO.test(limpio.correo)) return { ok: false, motivo: "Escribe un correo válido: ahí te llegan los avisos." };
  if (limpio.telefono && limpio.telefono.length !== 10) return { ok: false, motivo: "El teléfono debe tener 10 dígitos." };
  return { ok: true, limpio };
}

/** El mensaje de WhatsApp para pedir un cambio de razón social o RFC. */
export function mensajeCambioFiscal({ empresa, folio } = {}) {
  return `Hola, soy de ${empresa || "mi empresa"} (cliente ${folio || "—"}). Quiero cambiar mi razón social o RFC.`;
}

export const CONFIRMAR_ELIMINAR = "ELIMINAR";
export const confirmaEliminar = (texto) => String(texto ?? "").trim().toUpperCase() === CONFIRMAR_ELIMINAR;
