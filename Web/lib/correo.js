/**
 * Envío de correos transaccionales vía Resend (api.resend.com).
 *
 * Sin RESEND_API_KEY configurada no se envía nada y el sitio funciona igual
 * (mismo patrón que haySupabase). Se usa fetch directo para no sumar
 * dependencias. Solo para uso en el servidor.
 */

const REMITENTE = "Morcast del Norte <solicitudes@morcast.mx>";
const RESPONDER_A = "contacto@morcast.mx";
// Buzón que recibe el aviso interno de cada solicitud
const CORREO_AVISOS = process.env.CORREO_AVISOS || "contacto@morcast.mx";

export function hayResend() {
  return Boolean(process.env.RESEND_API_KEY);
}

async function enviar(payload) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

function plantilla(contenido) {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1c2b2d">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td style="background:#144C4F;padding:20px 32px" align="center">
        <img src="https://morcast.mx/img/logo-h-blanco.png" alt="Morcast del Norte" height="44" style="display:block;height:44px">
      </td></tr>
      <tr><td style="padding:32px">${contenido}</td></tr>
      <tr><td style="background:#f4f6f5;padding:16px 32px;font-size:12px;color:#6b7a7c" align="center">
        MORCAST DEL NORTE, S.A. de C.V. · Matamoros, Tamaulipas<br>
        Tel. 868 384 9478 · contacto@morcast.mx · morcast.mx
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/** Confirmación al interesado: "recibimos tu solicitud". */
export async function correoConfirmacion(datos) {
  return enviar({
    from: REMITENTE,
    to: [datos.correo],
    reply_to: RESPONDER_A,
    subject: "Recibimos tu solicitud — Morcast del Norte",
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#144C4F">¡Gracias, ${esc(datos.nombre)}!</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Recibimos tu solicitud de cotización para
        <strong>${esc(datos.tipo_servicio)}</strong> y nuestro equipo ya la está revisando.
        <strong>Nos pondremos en contacto contigo pronto</strong> al teléfono o correo que nos compartiste.
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Si tu solicitud es urgente, llámanos directo al <strong>868 384 9478</strong>.
      </p>
      <p style="margin:24px 0 0;font-size:15px">— El equipo de Morcast del Norte</p>`),
  });
}

/**
 * Aviso interno cuando alguien se da de alta desde /portal/alta.
 *
 * Va aparte del de cotizaciones porque es otra cosa: aquí ya eligió equipo,
 * marcó su domicilio en el mapa y dijo cuántas recolecciones al mes necesita.
 * El asunto avisa de una vez si cae dentro de cobertura, que es lo primero
 * que se pregunta quien lo lee.
 */
export async function correoAvisoAlta(datos) {
  const fila = (etiqueta, valor) =>
    valor || valor === 0
      ? `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;white-space:nowrap;vertical-align:top">${etiqueta}</td><td style="padding:6px 0">${esc(String(valor))}</td></tr>`
      : "";

  const equipo = (datos.equipo || [])
    .map((e) => `${e.cantidad} × ${e.tipo} ${e.medida}`)
    .join(", ");

  const cobertura = datos.en_cobertura
    ? `<span style="color:#2f7d32;font-weight:bold">SÍ, ya pasamos por ahí</span>`
    : `<span style="color:#b4531f;font-weight:bold">NO, queda fuera de las rutas de hoy</span>`;

  return enviar({
    from: REMITENTE,
    to: [CORREO_AVISOS],
    reply_to: datos.correo,
    subject: `${datos.en_cobertura ? "Alta" : "Alta FUERA DE COBERTURA"} — ${datos.empresa} (${datos.folio})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Alguien se dio de alta en morcast.mx</h1>
      <p style="margin:0 0 14px;font-size:14px">¿Está en cobertura? ${cobertura}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">
        ${fila("Folio", datos.folio)}
        ${fila("Empresa", datos.empresa)}
        ${fila("Contacto", datos.contacto)}
        ${fila("Teléfono", datos.telefono)}
        ${fila("Correo", datos.correo)}
        ${fila("Domicilio", [datos.calle, datos.colonia, datos.cp].filter(Boolean).join(", "))}
        ${fila("Referencias", datos.referencias)}
        ${fila("Residuos", (datos.residuos || []).join(", "))}
        ${fila("Equipo", equipo)}
        ${fila("Recolecciones al mes", datos.servicios_por_mes)}
        ${fila("Razón social", datos.razon_social)}
        ${fila("RFC", datos.rfc)}
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Está en el panel, en <strong>Altas de clientes</strong>
        (morcast.mx/admin/altas). Puedes responderle directamente a este correo.</p>`),
  });
}

/** Acuse para quien se dio de alta. */
export async function correoAcuseAlta(datos) {
  return enviar({
    from: REMITENTE,
    to: [datos.correo],
    subject: `Recibimos tu alta — Morcast del Norte (${datos.folio})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Recibimos tu solicitud</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Hola ${esc(datos.contacto)}, ya tenemos los datos de
        <strong>${esc(datos.empresa)}</strong>. Tu folio es
        <strong>${esc(datos.folio)}</strong>.</p>
      <p style="margin:0 0 14px;font-size:14px">
        ${datos.en_cobertura
          ? "Tu domicilio queda dentro de una de nuestras rutas, así que el siguiente paso es confirmarte los días y el precio."
          : "Tu domicilio queda fuera de las rutas que tenemos hoy. Lo registramos: cuando abramos ruta por tu zona te buscamos."}
      </p>
      <p style="margin:0 0 14px;font-size:14px">
        Pediste <strong>${esc(String(datos.servicios_por_mes))} recolecciones al mes</strong>.
        Cuando tu cuenta esté activa tú decides cómo repartirlas entre las semanas.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Te contactamos al ${esc(datos.telefono)}. Si algo cambió, responde a este correo.</p>`),
  });
}

/** Aviso interno con los datos del prospecto. */
export async function correoAvisoInterno(datos) {
  const fila = (etiqueta, valor) =>
    valor
      ? `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;white-space:nowrap;vertical-align:top">${etiqueta}</td><td style="padding:6px 0">${esc(valor)}</td></tr>`
      : "";
  return enviar({
    from: REMITENTE,
    to: [CORREO_AVISOS],
    reply_to: datos.correo,
    subject: `Nueva solicitud de cotización — ${datos.nombre}`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Nueva solicitud desde morcast.mx</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">
        ${fila("Nombre", datos.nombre)}
        ${fila("Empresa", datos.empresa)}
        ${fila("Teléfono", datos.telefono)}
        ${fila("Correo", datos.correo)}
        ${fila("Servicio", datos.tipo_servicio)}
        ${fila("Frecuencia", datos.frecuencia)}
        ${fila("Dirección", datos.direccion)}
        ${fila("Mensaje", datos.mensaje)}
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        También quedó guardada en Supabase (tabla cotizaciones). Puedes responderle
        directamente a este correo.</p>`),
  });
}
