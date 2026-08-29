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
export async function correoCuentaActivada({ correo, contacto, empresa, folio }) {
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
      <p style="margin:0 0 14px;font-size:14px">
        Entra en <a href="https://morcast.mx/portal/login" style="color:#144C4F">morcast.mx/portal/login</a>
        con el mismo botón de Google que usaste para registrarte.</p>
      <p style="margin:0 0 14px;font-size:14px">
        Ahí puedes agendar recolecciones, ver tu historial, descargar tus
        manifiestos y consultar tu saldo.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7a7c">
        ¿Dudas? Responde a este correo o llámanos al 868 384 9478.</p>`),
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
