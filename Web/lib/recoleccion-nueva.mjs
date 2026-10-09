/**
 * UNA RECOLECCIÓN QUE CREA LA OFICINA (Entrega 3, 9-oct-2026).
 *
 * Los pedidos por teléfono o WhatsApp no tenían cómo entrar: solo el cliente
 * podía crear una solicitud. La oficina escoge cliente, punto, fecha, residuo
 * y nota, y decide si nace "solicitada" o ya "confirmada" (con hora y chofer).
 * Sin dependencias, con pruebas (tests/recoleccion-nueva.test.mjs).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const masDias = (iso, n) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};

export function validarRecoleccionOficina(datos = {}, { hoy, tipos = [] } = {}) {
  const clienteId = String(datos.clienteId || "");
  const domicilioId = String(datos.domicilioId || "");
  const fecha = String(datos.fecha || "");
  const tipoResiduo = String(datos.tipoResiduo || "");
  const nota = String(datos.nota || "").trim().slice(0, 500);
  const confirmar = Boolean(datos.confirmar);
  const hora = datos.hora ? String(datos.hora) : null;
  const choferId = datos.choferId ? String(datos.choferId) : null;

  if (!UUID.test(clienteId)) return { ok: false, motivo: "Elige el cliente." };
  if (!UUID.test(domicilioId)) return { ok: false, motivo: "Elige el punto de recolección." };
  if (!FECHA.test(fecha)) return { ok: false, motivo: "Elige una fecha válida." };
  if (fecha < masDias(hoy, -1)) return { ok: false, motivo: "La fecha no puede ser de más de un día atrás." };
  if (fecha > masDias(hoy, 365)) return { ok: false, motivo: "La fecha no puede ser de más de un año adelante." };
  if (!tipos.includes(tipoResiduo)) return { ok: false, motivo: "Elige qué tipo de residuo se va a recoger." };
  if (tipoResiduo === "Otro" && !nota) return { ok: false, motivo: "Con «Otro», escribe en la nota qué residuo es." };
  if (confirmar && hora && !HORA.test(hora)) return { ok: false, motivo: "La hora no es válida." };
  if (confirmar && choferId && !UUID.test(choferId)) return { ok: false, motivo: "Ese chofer no existe." };

  return {
    ok: true,
    limpio: {
      clienteId,
      domicilioId,
      fecha,
      tipoResiduo,
      nota,
      origen: datos.origen === "ruta" ? "ruta" : "extra",
      confirmar,
      hora: confirmar ? hora : null,
      choferId: confirmar ? choferId : null,
    },
  };
}
