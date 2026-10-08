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

/**
 * Manda un correo. `payload` pasa tal cual a la API de Resend, así que ya
 * acepta `attachments: [{ filename, content }]` con el contenido en base64
 * (lo usa el alta firmada para adjuntar el PDF; ver `adjuntoPdf`).
 */
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
export async function correoAvisoAlta(datos, { pdfBase64, nombrePdf, huellaPdf } = {}) {
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
        ${fila("Origen", datos.origen === "google" ? "Se registró con Google (activar su cuenta desde el panel)" : "")}
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
        ${fila("Representante legal", [datos.representante_nombre, datos.representante_cargo].filter(Boolean).join(" · "))}
        ${fila("Facturación", [datos.facturacion_nombre, datos.facturacion_correo, datos.facturacion_telefono].filter(Boolean).join(" · "))}
        ${fila("Horario de acceso", datos.horario_acceso)}
        ${fila("Constancia fiscal", datos.constancia_ruta ? "Adjunta (en el panel)" : "")}
        ${fila("Firmó", datos.firmante_nombre ? [datos.firmante_nombre, datos.firmante_cargo].filter(Boolean).join(" · ") : "")}
        ${fila("Confirmación del correo", datos.firmante_nombre ? (datos.correo_confirmado ? "Confirmado (Google)" : "Por confirmar: se le mandó el enlace") : "")}
        ${fila("Huella del PDF", huellaPdf)}
      </table>
      ${pdfBase64 ? `<p style="margin:16px 0 0;font-size:14px">
        Va adjunta la <strong>Solicitud de alta firmada</strong> en PDF.</p>` : ""}
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Está en el panel, en <strong>Altas de clientes</strong>
        (morcast.mx/admin/altas). Puedes responderle directamente a este correo.</p>`),
    ...(pdfBase64 ? { attachments: [adjuntoPdf(nombrePdf, pdfBase64)] } : {}),
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

/* ==================================================================== */
/* AVISOS DEL CIRCUITO (confirmar recolección, aplicar saldo)            */
/*                                                                      */
/* Hasta el 21-ago-2026 el sistema solo mandaba correo en los DOS       */
/* formularios públicos. Dentro no avisaba de nada: a un cliente se le  */
/* confirmaba su recolección y no se enteraba, se le aplicaba su saldo  */
/* y no se enteraba, y al chofer nadie le decía que le habían puesto    */
/* una parada. Todos tenían que entrar a mirar por si acaso.            */
/* ==================================================================== */

/** Fecha ISO → "22 de agosto de 2026", para que se lea en un correo. */
function fechaEnLetra(iso) {
  if (!iso) return "";
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const [a, m, d] = String(iso).split("-").map(Number);
  return `${d} de ${meses[m - 1]} de ${a}`;
}

/** Al CLIENTE: su recolección quedó confirmada. */
export async function correoRecoleccionConfirmada({ correo, empresa, folio, fecha, hora, domicilio }) {
  if (!correo) return null;
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: `Confirmamos tu recolección del ${fechaEnLetra(fecha)} — ${folio}`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#144C4F">Tu recolección está confirmada</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        ${esc(empresa || "Hola")}, pasamos por tus residuos el
        <strong>${fechaEnLetra(fecha)}</strong>${hora ? ` <strong>alrededor de las ${esc(String(hora).slice(0, 5))}</strong>` : ""}.
      </p>
      ${hora ? "" : `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Todavía no podemos darte una hora exacta; te avisamos si se define.</p>`}
      ${domicilio ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Domicilio: <strong>${esc(domicilio)}</strong>.</p>` : ""}
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Folio <strong>${esc(folio)}</strong>. Puedes seguirla en
        <a href="https://morcast.mx/portal">tu portal</a>.
      </p>
      <p style="margin:24px 0 0;font-size:15px">— El equipo de Morcast del Norte</p>`),
  });
}

/**
 * Al CLIENTE: un cambio en SU recolección (en camino, cambio de fecha,
 * retraso, realizada, no procedió). El texto lo arma lib/aviso-cliente.mjs
 * para que el correo y la notificación del teléfono digan lo mismo.
 */
export async function correoAvisoRecoleccion({ correo, empresa, folio, asunto, titulo, parrafos = [] }) {
  if (!correo) return null;
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: asunto,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#144C4F">${esc(titulo)}</h1>
      ${empresa ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(empresa)}:</p>` : ""}
      ${parrafos.map((t) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(t)}</p>`).join("")}
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Folio <strong>${esc(folio)}</strong>. Puedes seguirla en
        <a href="https://morcast.mx/portal/historial">tu portal</a>.
      </p>
      <p style="margin:24px 0 0;font-size:15px">— El equipo de Morcast del Norte</p>`),
  });
}

/** Al CLIENTE: no se pudo, y por qué. */
export async function correoRecoleccionRechazada({ correo, empresa, folio, fecha, motivo }) {
  if (!correo) return null;
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: `No pudimos programar tu recolección del ${fechaEnLetra(fecha)} — ${folio}`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#144C4F">No pudimos programarla</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        ${esc(empresa || "Hola")}, tu solicitud <strong>${esc(folio)}</strong> para el
        <strong>${fechaEnLetra(fecha)}</strong> no se pudo programar.
      </p>
      ${motivo ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Motivo: <strong>${esc(motivo)}</strong>.</p>` : ""}
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Pide otra fecha en <a href="https://morcast.mx/portal/agendar">tu portal</a>, o
        llámanos al <strong>868 384 9478</strong> y lo vemos.
      </p>
      <p style="margin:24px 0 0;font-size:15px">— El equipo de Morcast del Norte</p>`),
  });
}

/** Al CHOFER: le tocó una parada nueva. */
export async function correoParadaAsignada({ correo, nombre, folio, cliente, domicilio, fecha, hora }) {
  if (!correo) return null;
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: `Parada nueva el ${fechaEnLetra(fecha)}: ${cliente}`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Tienes una parada nueva</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        ${esc(nombre || "Hola")}, te toca <strong>${esc(cliente)}</strong> el
        <strong>${fechaEnLetra(fecha)}</strong>${hora ? ` a las <strong>${esc(String(hora).slice(0, 5))}</strong>` : ""}.
      </p>
      ${domicilio ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Domicilio: <strong>${esc(domicilio)}</strong>.</p>` : ""}
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Folio <strong>${esc(folio)}</strong>. La tienes en
        <a href="https://morcast.mx/chofer">tu pantalla de ruta</a> el día que toca.
      </p>`),
  });
}

/** Al CLIENTE: su depósito se aplicó, o no. */
export async function correoSaldoResuelto({ correo, empresa, monto, aplicado, notas }) {
  if (!correo) return null;
  const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(monto || 0);
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: aplicado
      ? `Aplicamos tu pago de ${dinero} — Morcast del Norte`
      : `No pudimos aplicar tu pago de ${dinero} — Morcast del Norte`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:22px;color:#144C4F">
        ${aplicado ? "Tu pago ya está aplicado" : "No pudimos aplicar tu pago"}
      </h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        ${esc(empresa || "Hola")}, ${aplicado
          ? `verificamos tu comprobante y abonamos <strong>${dinero}</strong> a tu saldo.`
          : `revisamos tu comprobante por <strong>${dinero}</strong> y no pudimos aplicarlo.`}
      </p>
      ${notas ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Nota de nuestro equipo: <strong>${esc(notas)}</strong>.</p>` : ""}
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        Consulta tu saldo en <a href="https://morcast.mx/portal">tu portal</a>.
      </p>
      <p style="margin:24px 0 0;font-size:15px">— El equipo de Morcast del Norte</p>`),
  });
}

/* ------------------------------------------------------------------ */
/* Registro abierto con Google                                         */
/*                                                                     */
/* Son funciones aparte y no un parámetro de correoAvisoAlta /         */
/* correoAcuseAlta a propósito: esas dos hablan de cobertura y de      */
/* "pediste N recolecciones al mes", y el registro con Google no       */
/* pregunta ninguna de las dos cosas. Meterles un `if` las volvería    */
/* dos correos disfrazados de uno. Lo que sí se reusa —`plantilla()` y */
/* `enviar()`— es la parte que de verdad se comparte.                  */
/* ------------------------------------------------------------------ */

/** Aviso a Morcast: alguien se registró solo. */
export async function correoAvisoRegistro(datos) {
  const fila = (etiqueta, valor) =>
    valor
      ? `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;white-space:nowrap;vertical-align:top">${etiqueta}</td><td style="padding:6px 0">${esc(String(valor))}</td></tr>`
      : "";

  return enviar({
    from: REMITENTE,
    to: [CORREO_AVISOS],
    reply_to: datos.correo,
    subject: `Registro nuevo — ${datos.empresa} (${datos.folio})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Alguien se registró con Google</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Creó su cuenta en morcast.mx. <strong>Todavía no tiene acceso a nada</strong>:
        entra al portal hasta que ustedes activen la cuenta.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">
        ${fila("Folio", datos.folio)}
        ${fila("Empresa", datos.empresa)}
        ${fila("Contacto", datos.contacto)}
        ${fila("Teléfono", datos.telefono)}
        ${fila("Correo", datos.correo)}
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Está en el panel, en <strong>Altas de clientes</strong>
        (morcast.mx/admin/altas), con el filtro <strong>Se registraron</strong>.
        Ahí mismo está el botón para activarle la cuenta.</p>`),
  });
}

/** Acuse para quien se registró. */
export async function correoAcuseRegistro(datos) {
  return enviar({
    from: REMITENTE,
    to: [datos.correo],
    subject: `Recibimos tu registro — Morcast del Norte (${datos.folio})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Recibimos tu registro</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Hola ${esc(datos.contacto)}, ya quedó registrada
        <strong>${esc(datos.empresa)}</strong>. Tu folio es
        <strong>${esc(datos.folio)}</strong>.</p>
      <p style="margin:0 0 14px;font-size:14px">
        El siguiente paso lo damos nosotros: revisamos tus datos y te
        contactamos para activarte la cuenta. Mientras tanto, tu acceso al
        portal todavía no está abierto.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Te buscamos al ${esc(datos.telefono)}. Si algo cambió, responde a este correo.</p>`),
  });
}

/**
 * Aviso de que la cuenta ya quedó activa.
 *
 * ⚠️ NO lleva la contraseña adentro, a propósito. La contraseña se la enseña
 * el panel a quien activa, una sola vez, para que se la mande por WhatsApp.
 * Una contraseña dentro de un correo se queda ahí para siempre, en el buzón
 * del cliente y en el de quien reenvíe el hilo.
 */
export async function correoCuentaActivada({ correo, contacto, empresa, folio, apple = false }) {
  return enviar({
    from: REMITENTE,
    to: [correo],
    subject: `Tu cuenta ya está activa — Morcast del Norte`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Tu cuenta ya está activa</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Hola ${esc(contacto)}, ya puedes entrar al portal de
        <strong>${esc(empresa)}</strong>. Tu número de cliente es
        <strong>${esc(folio)}</strong>.</p>
      <p style="margin:0 0 14px;font-size:14px">${apple
        ? `Abre la app de Morcast y toca <strong>“Ya me activaron — revisar”</strong>.
        Entras con Apple, igual que cuando te registraste: no necesitas contraseña.`
        : `Entra en <a href="https://morcast.mx/portal/login" style="color:#144C4F">morcast.mx/portal/login</a>
        con el mismo botón de Google que usaste para registrarte.`}</p>
      <p style="margin:0 0 14px;font-size:14px">
        Ahí puedes agendar recolecciones, ver tu historial, descargar tus
        manifiestos y consultar tu saldo.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        ¿Dudas? Responde a este correo o llámanos al 868 384 9478.</p>`),
  });
}

/**
 * Invitación al portal para un cliente que YA estaba dado de alta en la
 * operación (el cuaderno, o un alta anterior sin acceso) y nunca había
 * tocado el sitio. Es distinta de `correoCuentaActivada`: aquélla le avisa a
 * quien se registró SOLO con Google que ya puede entrar con ESE botón; esta
 * le manda el enlace a alguien que nunca se registró, para que elija su
 * contraseña por primera vez. Ver `app/acciones-alta-cliente.js:darAccesoACliente`.
 *
 * Mismo patrón que `correoRecuperacion`: el enlace lo genera Supabase pero lo
 * envía Resend, para no toparse con el límite de correos del plan gratuito ni
 * con la plantilla ajena.
 */
export async function correoAccesoCliente({ correo, contacto, empresa, folio, enlace }) {
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: `Tu acceso al Portal de Clientes — Morcast del Norte (${folio})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Tu portal ya está listo</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Hola ${esc(contacto)}, somos Morcast del Norte, la empresa que recolecta
        los residuos de <strong>${esc(empresa)}</strong>. Ya dimos de alta tu
        cuenta en el portal en línea; tu número de cliente es
        <strong>${esc(folio)}</strong>.</p>
      <p style="margin:0 0 14px;font-size:14px">
        Pulsa el botón y elige la contraseña con la que vas a entrar:</p>
      <p style="margin:0 0 22px">
        <a href="${esc(enlace)}"
           style="display:inline-block;background:#144C4F;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:bold">
          Crear mi contraseña</a></p>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7a7c">
        Si el botón no funciona, copia y pega esta dirección en tu navegador:<br>
        <span style="word-break:break-all">${esc(enlace)}</span></p>
      <p style="margin:0 0 14px;font-size:14px">
        <strong>El enlace vence en una hora</strong> y sólo se puede usar una vez.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Con esa contraseña vas a entrar en
        <a href="https://morcast.mx/portal/login" style="color:#144C4F">morcast.mx/portal/login</a>,
        donde puedes agendar recolecciones, ver tu historial, descargar tus
        manifiestos y consultar tu saldo.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        ¿Dudas? Responde a este correo o llámanos al 868 384 9478.</p>`),
  });
}

/**
 * Invitación al EQUIPO de Morcast (administrador o chofer), desde
 * /admin/usuarios. Igual que el acceso de cliente: nadie ve la contraseña,
 * la persona la elige con el enlace. Al terminar, el sistema la manda sola a
 * su área (/admin o /chofer) según su rol.
 */
export async function correoInvitacionEquipo({ correo, nombre, rolLegible, enlace, invitadoPor }) {
  const esChofer = rolLegible.startsWith("Chofer");
  const entrada = esChofer ? "morcast.mx/chofer/login" : "morcast.mx/admin/login";
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: "Te invitaron al equipo de Morcast del Norte",
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Bienvenido al equipo</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Hola ${esc(nombre)}, ${invitadoPor ? `${esc(invitadoPor)} te dio` : "te dieron"} acceso al sistema
        de Morcast del Norte como <strong>${esc(rolLegible)}</strong>.</p>
      <p style="margin:0 0 14px;font-size:14px">
        Pulsa el botón y elige la contraseña con la que vas a entrar:</p>
      <p style="margin:0 0 22px">
        <a href="${esc(enlace)}"
           style="display:inline-block;background:#144C4F;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:bold">
          Crear mi contraseña</a></p>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7a7c">
        Si el botón no funciona, copia y pega esta dirección en tu navegador:<br>
        <span style="word-break:break-all">${esc(enlace)}</span></p>
      <p style="margin:0 0 14px;font-size:14px">
        <strong>El enlace vence en una hora</strong> y sólo se puede usar una vez. Si se te
        pasa, pide que te vuelvan a invitar o usa "¿Olvidaste tu contraseña?".</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Después vas a entrar en
        <a href="https://${entrada}" style="color:#144C4F">${entrada}</a>${esChofer ? ", o desde la app de Morcast en tu teléfono" : ""}.</p>`),
  });
}

/**
 * Enlace para crear una contraseña nueva.
 *
 * Lo manda Resend y no Supabase a propósito: el correo de Supabase sale con su
 * remitente y su plantilla, y en el plan gratuito está limitado a unos pocos
 * por hora. Ver `app/acciones-recuperar.js`.
 *
 * ⚠️ El enlace da acceso a la cuenta durante una hora. Por eso el texto dice
 * qué hacer si la persona NO pidió esto: es el único aviso que va a recibir.
 */
export async function correoRecuperacion({ correo, enlace }) {
  return enviar({
    from: REMITENTE,
    to: [correo],
    subject: "Crea tu contraseña nueva — Morcast del Norte",
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Crea tu contraseña nueva</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Recibimos una solicitud para cambiar la contraseña de tu cuenta en el
        portal de Morcast del Norte. Pulsa el botón y elige una nueva:</p>
      <p style="margin:0 0 22px">
        <a href="${esc(enlace)}"
           style="display:inline-block;background:#144C4F;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:bold">
          Crear mi contraseña</a></p>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7a7c">
        Si el botón no funciona, copia y pega esta dirección en tu navegador:<br>
        <span style="word-break:break-all">${esc(enlace)}</span></p>
      <p style="margin:0 0 14px;font-size:14px">
        <strong>El enlace vence en una hora</strong> y sólo se puede usar una vez.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        ¿No pediste esto? Puedes ignorar este correo: tu contraseña no cambia
        hasta que alguien abra ese enlace y escriba una nueva. Si te llega
        varias veces sin que tú lo pidas, avísanos al 868 384 9478.</p>`),
  });
}

/**
 * Aviso de que la contraseña acaba de cambiar.
 *
 * Es la red de seguridad: si alguien toma una cuenta, éste es el ÚNICO correo
 * que la persona va a recibir, y por eso dice qué hacer y a quién llamar. No
 * lleva enlaces de acción a propósito — un correo de alerta con un botón es
 * exactamente lo que imita el phishing.
 */
export async function correoContrasenaCambiada({ correo }) {
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: "Tu contraseña de Morcast del Norte cambió",
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Tu contraseña cambió</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Te avisamos de que la contraseña de tu cuenta en el portal de Morcast
        del Norte acaba de cambiar. Si fuiste tú, no tienes que hacer nada.</p>
      <p style="margin:0 0 14px;font-size:14px">
        <strong>¿No fuiste tú?</strong> Llámanos cuanto antes al
        <strong>868 384 9478</strong> para que bloqueemos el acceso. No hace
        falta que respondas a este correo ni que pulses ningún enlace.</p>`),
  });
}

/**
 * Código del segundo paso del panel (dueño y administradores).
 *
 * Sin botones ni enlaces a propósito: un correo de "código de acceso" con un
 * botón es justo lo que imita el phishing. Solo el número, cuánto dura y qué
 * hacer si la persona no estaba entrando.
 */
export async function correoCodigoPanel({ correo, codigo, minutos }) {
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: `${codigo} es tu código para entrar al panel de Morcast`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Tu código para entrar al panel</h1>
      <p style="margin:0 0 18px;font-size:14px">
        Escribe este código en la pantalla del panel de administración:</p>
      <p style="margin:0 0 18px;font-size:34px;font-weight:bold;letter-spacing:8px;color:#144C4F;text-align:center">
        ${esc(codigo)}</p>
      <p style="margin:0 0 14px;font-size:14px">
        <strong>Vence en ${esc(minutos)} minutos.</strong> No lo compartas con nadie:
        nadie de Morcast te lo va a pedir.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        ¿No estabas entrando al panel? Alguien escribió tu contraseña. Cámbiala
        cuanto antes y avísanos al <strong>868 384 9478</strong>.</p>`),
  });
}

/**
 * A la OFICINA: un chofer reportó un incidente desde la calle (accidente,
 * retraso, falla o un contenedor dañado, movido o que no está).
 *
 * Lleva solo lo que hace falta para actuar —qué pasó, quién, en qué unidad,
 * ruta y parada— y el enlace al panel, donde está el resto (la foto, el
 * historial). Nada de datos del cliente más allá del nombre de la parada:
 * este buzón lo leen varias personas y nadie lo borra.
 *
 * `asunto`, `tipoTexto` y `urgente` llegan ya armados (lib/chofer-reportes.mjs)
 * para que el texto del tipo sea el mismo en el teléfono, en el panel y aquí.
 */
export async function correoIncidente({
  asunto, tipoTexto, urgente, chofer, unidad, ruta, parada, contenedor,
  descripcion, retraso, mapa, cuando, enlace,
}) {
  const fila = (etiqueta, valor) =>
    valor
      ? `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#6b7a7c;vertical-align:top;white-space:nowrap">${esc(etiqueta)}</td>
         <td style="padding:6px 0;font-size:15px;color:#1c2b2d">${esc(valor)}</td></tr>`
      : "";
  return enviar({
    from: REMITENTE,
    to: [CORREO_AVISOS],
    reply_to: RESPONDER_A,
    subject: asunto,
    html: plantilla(`
      ${urgente ? `<p style="margin:0 0 16px;padding:12px 16px;background:#fbe9e7;border-left:4px solid #c0392b;font-size:15px;color:#8e2a1f">
        <strong>Urgente.</strong> Llama al chofer cuanto antes.</p>` : ""}
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">${esc(tipoTexto)}</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
        ${fila("Chofer", chofer)}
        ${fila("Unidad", unidad)}
        ${fila("Ruta", ruta)}
        ${fila("Parada", parada)}
        ${fila("Contenedor", contenedor)}
        ${fila("Retraso", retraso)}
        ${fila("Cuándo", cuando)}
      </table>
      ${descripcion ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;white-space:pre-line">${esc(descripcion)}</p>` : ""}
      ${mapa ? `<p style="margin:0 0 12px;font-size:14px"><a href="${esc(mapa)}">Ver dónde estaba el chofer</a></p>` : ""}
      <p style="margin:20px 0 0;font-size:15px">
        <a href="${esc(enlace)}" style="display:inline-block;background:#2a6a99;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">
          Ver en el panel</a></p>`),
  });
}

/* ------------------------------------------------------------------ */
/* Trabaja con nosotros                                                */
/* ------------------------------------------------------------------ */

/**
 * Cuánto de la experiencia entra al correo. `LIMITES.experiencia` (en
 * `empleo.mjs`) permite hasta 2000 caracteres, y este correo cae en un buzón
 * que nadie borra (`CORREO_AVISOS`) — mismo criterio que ya se usa para no
 * mandar el currículum por correo: lo largo se ve en el panel, no aquí.
 */
const EXTRACTO_EXPERIENCIA = 220;

/** Recorta la experiencia a un extracto, con "…" sólo si de verdad se cortó. */
function extractoExperiencia(experiencia) {
  const texto = String(experiencia ?? "");
  if (texto.length <= EXTRACTO_EXPERIENCIA) return texto;
  return `${texto.slice(0, EXTRACTO_EXPERIENCIA).trimEnd()}…`;
}

/** A MORCAST: llegó una solicitud de empleo. */
export async function correoAvisoEmpleo(datos) {
  const fila = (etiqueta, valor) =>
    valor
      ? `<tr><td style="padding:6px 12px 6px 0;font-weight:bold;white-space:nowrap;vertical-align:top">${etiqueta}</td><td style="padding:6px 0">${esc(valor)}</td></tr>`
      : "";
  // `datos.puesto` ya trae el título de la vacante real, o el texto fijo de
  // "solicitud general" cuando no aplicó a ninguna — ver `puesto` en
  // `enviarSolicitudEmpleo()`. Si la vacante se cerró a medio llenado el
  // formulario, se avisa aparte: el título en `puesto` sigue siendo el de
  // esa plaza, pero ya no hay vacante abierta detrás.
  const vacante = datos.vacanteCerrada
    ? `${datos.puesto} (se cerró antes de que llegara esta solicitud)`
    : datos.puesto;
  return enviar({
    from: REMITENTE,
    to: [CORREO_AVISOS],
    ...(datos.correo ? { reply_to: datos.correo } : {}),
    subject: `Solicitud de empleo — ${datos.nombre} (${datos.puesto})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Nueva solicitud de empleo</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">
        ${fila("Folio", datos.folio)}
        ${fila("Nombre", datos.nombre)}
        ${fila("Teléfono", datos.telefono)}
        ${fila("Correo", datos.correo)}
        ${fila("Vacante", vacante)}
        ${fila("Experiencia", extractoExperiencia(datos.experiencia))}
        ${fila("Currículum", datos.traeCurriculum ? "Sí, adjunto en el panel" : "No adjuntó")}
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Ábrela en el panel, en <strong>Trabaja con nosotros</strong>, para ver la
        experiencia completa. El currículum tampoco viaja en este correo a
        propósito: se ve desde el panel con un enlace que caduca, para que no
        se multiplique en bandejas de entrada.</p>`),
  });
}

/** AL CANDIDATO: acuse, sólo si dejó correo. */
export async function correoAcuseEmpleo({ correo, nombre, folio, puesto }) {
  if (!correo) return { ok: true, omitido: true };
  return enviar({
    from: REMITENTE,
    to: [correo],
    subject: `Recibimos tu solicitud — ${folio}`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Gracias, ${esc(nombre)}</h1>
      <p style="font-size:14px;line-height:1.6">
        Recibimos tu solicitud para <strong>${esc(puesto)}</strong>. Tu folio es
        <strong>${esc(folio)}</strong>.</p>
      <p style="font-size:14px;line-height:1.6">
        Si tu perfil encaja con una vacante, te contactamos por teléfono. Guardamos
        tu información 12 meses y después se borra.</p>`),
  });
}

/* ------------------------------------------------------------------ */
/* Avisos a clientes (/admin/avisos)                                   */
/* ------------------------------------------------------------------ */

/** Color del rótulo del motivo. Retraso en ámbar, como en el portal. */
const MOTIVO_AVISO = {
  retraso: { texto: "Retraso", fondo: "#fbf1dc", tinta: "#7a5310" },
  reagenda: { texto: "Reagenda", fondo: "#e3eef7", tinta: "#1f4f73" },
  general: { texto: "Aviso", fondo: "#eef1f0", tinta: "#3d4b4d" },
};

/**
 * Al CLIENTE: un aviso de la administración (retraso, reagenda, general).
 *
 * Un correo por destinatario, con un solo `to`: el aviso le llega a decenas
 * de empresas y ninguna tiene por qué ver el correo de las demás (con un
 * `to` o `cc` compartido, cualquiera las vería todas). Por eso no hay copia
 * oculta a nadie ni lista de varios.
 *
 * El mensaje lo escribe una persona del panel: se escapa COMPLETO y los
 * saltos de línea se vuelven <br> después de escapar, nunca antes.
 */
export async function correoAvisoCliente({ correo, empresa, titulo, mensaje, motivo, vigenteHasta }) {
  if (!correo) return null;
  const m = MOTIVO_AVISO[motivo] || MOTIVO_AVISO.general;
  const cuerpo = esc(mensaje).replace(/\n/g, "<br>");
  // El asunto no es HTML, pero un salto de línea ahí rompe la cabecera.
  const asunto = `${m.texto}: ${String(titulo || "").replace(/\s+/g, " ").trim()} — Morcast del Norte`;
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: asunto,
    html: plantilla(`
      <p style="margin:0 0 14px">
        <span style="display:inline-block;background:${m.fondo};color:${m.tinta};font-size:12px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:4px">${m.texto}</span>
      </p>
      <h1 style="margin:0 0 16px;font-size:21px;color:#144C4F">${esc(titulo)}</h1>
      ${empresa ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(empresa)}:</p>` : ""}
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${cuerpo}</p>
      ${vigenteHasta ? `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#6b7a7c">
        Este aviso aplica hasta el ${fechaEnLetra(vigenteHasta)}.</p>` : ""}
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
        También lo tienes en <a href="https://morcast.mx/portal">tu portal</a>.
      </p>
      <p style="margin:24px 0 0;font-size:15px">— El equipo de Morcast del Norte</p>`),
  });
}

/* ==================================================================== */
/* ALTA CON FIRMA ELECTRÓNICA (5-oct-2026)                               */
/*                                                                      */
/* El alta ya no termina con un acuse de "recibimos tus datos": el      */
/* cliente FIRMA su Solicitud de alta y recibe el PDF. En el formulario */
/* público, además, tiene que confirmar que el correo es suyo con un    */
/* enlace de un solo uso — es parte de la evidencia de la firma: prueba */
/* que quien firmó controla ese buzón. En el registro con Google ese    */
/* paso ya lo hizo Google y el correo sale sin enlace.                  */
/* ==================================================================== */

/** Un PDF adjunto, en el formato que pide Resend. */
function adjuntoPdf(nombre, base64) {
  return { filename: nombre || "solicitud.pdf", content: base64 };
}

/**
 * Al CLIENTE: el enlace para confirmar el correo. SIN el PDF adjunto, a
 * propósito: la dirección la escribió alguien sin cuenta, y este correo no
 * debe servir para hacerle llegar documentos a un tercero. El PDF va cuando
 * confirma (`correoSolicitudFirmada`).
 */
export async function correoConfirmarAlta({ correo, contacto, empresa, folio, enlace }) {
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: `Confirma tu solicitud de alta — Morcast del Norte (${folio})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Confirma tu solicitud de alta</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Hola ${esc(contacto)}, recibimos la Solicitud de alta de
        <strong>${esc(empresa)}</strong>, firmada electrónicamente. Tu folio es
        <strong>${esc(folio)}</strong>.</p>
      <p style="margin:0 0 14px;font-size:14px">
        Para terminar, confirma que este correo es tuyo:</p>
      <p style="margin:0 0 22px">
        <a href="${esc(enlace)}"
           style="display:inline-block;background:#2a6a99;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:bold">
          Confirmar mi solicitud</a></p>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7a7c">
        Si el botón no funciona, copia y pega esta dirección en tu navegador:<br>
        <span style="word-break:break-all">${esc(enlace)}</span></p>
      <p style="margin:0 0 14px;font-size:14px">
        <strong>El enlace vence en 7 días</strong> y sólo se puede usar una vez. Al
        confirmar te mandamos tu solicitud firmada en PDF.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        ¿No fuiste tú? Ignora este correo o respóndelo para avisarnos.</p>`),
  });
}

/**
 * Al CLIENTE: la versión FINAL de su solicitud (el correo ya está
 * confirmado). Sale al confirmar con el enlace, y de una vez en el registro
 * con Google, donde el correo ya viene verificado.
 */
export async function correoSolicitudFirmada({ correo, contacto, empresa, folio, pdfBase64, nombrePdf, porGoogle }) {
  return enviar({
    from: REMITENTE,
    to: [correo],
    reply_to: RESPONDER_A,
    subject: `Tu solicitud de alta firmada — Morcast del Norte (${folio})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Tu solicitud de alta está firmada</h1>
      <p style="margin:0 0 14px;font-size:14px">
        Hola ${esc(contacto)}, ${porGoogle
          ? "como te registraste con tu cuenta de Google, tu correo ya quedó verificado."
          : "gracias por confirmar tu correo."}
        Va adjunta la versión final de la Solicitud de alta de
        <strong>${esc(empresa)}</strong> (folio <strong>${esc(folio)}</strong>).</p>
      <p style="margin:0 0 14px;font-size:14px">
        El siguiente paso lo damos nosotros: revisamos tu solicitud y te
        contactamos para confirmar el precio y el día de arranque.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Guarda este PDF: es tu copia de lo que firmaste. ¿Dudas? Responde a este
        correo o llámanos al 868 384 9478.</p>`),
    attachments: [adjuntoPdf(nombrePdf, pdfBase64)],
  });
}

/** A MORCAST: el cliente confirmó su correo; va la versión final. */
export async function correoAvisoAltaConfirmada({ correo, empresa, folio, pdfBase64, nombrePdf, huellaPdf }) {
  return enviar({
    from: REMITENTE,
    to: [CORREO_AVISOS],
    reply_to: correo,
    subject: `Alta confirmada — ${empresa} (${folio})`,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">El cliente confirmó su correo</h1>
      <p style="margin:0 0 14px;font-size:14px">
        <strong>${esc(empresa)}</strong> confirmó con el enlace que el correo
        <strong>${esc(correo)}</strong> es suyo. La solicitud <strong>${esc(folio)}</strong>
        ya está firmada y confirmada; va adjunta la versión final.</p>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7a7c">
        Huella SHA-256 del PDF: <span style="font-family:monospace;word-break:break-all">${esc(huellaPdf)}</span></p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        Está en el panel, en <strong>Altas de clientes</strong> (morcast.mx/admin/altas).</p>`),
    attachments: [adjuntoPdf(nombrePdf, pdfBase64)],
  });
}

/* ------------------------------------------------------------------ */
/* equipo 1: recolección pedida (6-oct-2026)                           */
/* ------------------------------------------------------------------ */

/**
 * A MORCAST: un cliente pidió una recolección (portal o app). Antes no se
 * avisaba de nada y la oficina se enteraba solo si abría Recolecciones.
 * Los datos llegan ya armados (lib/solicitud-aviso.mjs).
 */
export async function correoSolicitudRecoleccion({
  asunto, empresa, folio, fecha, tipo, residuo, punto, ruta, nota, enlace,
}) {
  const fila = (etiqueta, valor) =>
    valor
      ? `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#6b7a7c;vertical-align:top;white-space:nowrap">${esc(etiqueta)}</td>
         <td style="padding:6px 0;font-size:15px;color:#1c2b2d">${esc(valor)}</td></tr>`
      : "";
  return enviar({
    from: REMITENTE,
    to: [CORREO_AVISOS],
    reply_to: RESPONDER_A,
    subject: asunto,
    html: plantilla(`
      <h1 style="margin:0 0 16px;font-size:20px;color:#144C4F">Recolección pedida</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">
        <strong>${esc(empresa)}</strong> pidió una recolección. Falta confirmarle
        el día, la hora y el chofer.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
        ${fila("Folio", folio)}
        ${fila("Para el", fecha)}
        ${fila("Tipo", tipo)}
        ${fila("Residuo", residuo)}
        ${fila("Punto", punto)}
        ${fila("Ruta", ruta)}
      </table>
      ${nota ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;white-space:pre-line">“${esc(nota)}”</p>` : ""}
      <p style="margin:20px 0 0;font-size:15px">
        <a href="${esc(enlace)}" style="display:inline-block;background:#2a6a99;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">
          Confirmar en el panel</a></p>`),
  });
}
