import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { pasarFreno, ipDeLaPeticion } from "@/lib/freno";
import { registrar } from "@/lib/bitacora";
import {
  hayResend,
  correoAvisoAlta,
  correoConfirmarAlta,
  correoSolicitudFirmada,
  correoAvisoAltaConfirmada,
} from "@/lib/correo";
import { origenPermitido } from "@/lib/origen.mjs";
import { AVISO_PRIVACIDAD, TIPOS_SERVICIO } from "@/lib/datos";
import { EQUIPO_RENTA, EMPRESA_COTIZACION } from "@/lib/cotizacion-datos";
import { USOS_CFDI, FORMAS_PAGO, RUTAS_SEED } from "@/lib/rutas-datos";
import { ZONA_MATAMOROS } from "@/lib/zona-matamoros.mjs";
import { rutasQueCubren } from "@/lib/punto-en-zona.mjs";
import {
  terminosVigentes,
  terminosDeVersion,
  textoTerminos,
  RUTA_AVISO_PRIVACIDAD,
} from "@/lib/terminos.mjs";
import {
  validarAlta,
  validarFirmante,
  validarFirmaPng,
  validarConstancia,
  sha256Hex,
  armarContenidoFirmado,
  huellaContenido,
  generarToken,
  huellaToken,
  venceToken,
  estadoToken,
  fechaHoraMatamoros,
  folioAlta,
  nombrePdfAlta,
  tipoDeChoque,
  MAX_DATOS_JSON,
  TEXTO_MAX_CONSTANCIA,
  MAX_CONSTANCIA_BYTES,
  MAX_FIRMA_BYTES,
} from "@/lib/alta-firma.mjs";
import { generarPdfAlta } from "@/lib/alta-pdf.mjs";

/**
 * EL ALTA FIRMADA, DEL LADO DEL SERVIDOR — la usan las DOS puertas de alta.
 *
 * Hay dos caminos para darse de alta y los dos tienen que terminar igual
 * (pedido del socio, 5-oct-2026): el formulario público
 * (`app/acciones-alta.js` → /portal/alta) y el registro con Google
 * (`app/acciones-registro.js` → /portal/registro). Toda la faena —validar,
 * firmar, generar el PDF, subir a la cubeta, guardar, mandar correos— vive
 * aquí una sola vez, para que las dos puertas no se desincronicen.
 *
 * 🔴 Este archivo NO lleva `"use server"`, a propósito. Todo lo que exporta
 * un archivo `"use server"` queda como un endpoint abierto al mundo, y
 * `procesarAltaFirmada` recibe al `usuario` por parámetro: si fuera
 * endpoint, cualquiera podría mandarle el id de otra persona. Las acciones
 * de servidor sacan al usuario de la SESIÓN y luego llaman aquí.
 */

const CUBETA = "altas";

/** Las listas cerradas contra las que se valida (ver `validarAlta`). */
const CATALOGOS = {
  residuos: TIPOS_SERVICIO,
  equipo: EQUIPO_RENTA,
  usosCfdi: USOS_CFDI,
  formasPago: FORMAS_PAGO,
};

/**
 * Quién emite el PDF. El correo es el institucional y no `correos[0]`, que
 * es el Gmail personal del dueño (marcado como temporal en
 * `cotizacion-datos.js`): un documento firmado no debería publicar un buzón
 * personal.
 */
const EMISOR = {
  razonSocial: EMPRESA_COTIZACION.razonSocial,
  domicilioLinea: EMPRESA_COTIZACION.domicilioLinea,
  telefonos: EMPRESA_COTIZACION.telefonos,
  correo: "contacto@morcast.mx",
  sitio: EMPRESA_COTIZACION.sitio,
};


const esArchivo = (v) => v && typeof v === "object" && typeof v.arrayBuffer === "function";

/* ------------------------------------------------------------------ */
/* Zonas de cobertura                                                  */
/* ------------------------------------------------------------------ */

/**
 * Las zonas reales (las que Morcast dibuja en el panel), o null si no hay
 * base. Vivía en `acciones-alta.js`; se mudó aquí porque ahora también la
 * usa el alta firmada para RECALCULAR la cobertura en el servidor: antes el
 * "sí estás en cobertura" que se guardaba y se mandaba por correo lo decía
 * el navegador, y el navegador puede decir lo que quiera.
 */
export async function leerZonas() {
  if (!haySupabase()) return null;

  const { data, error } = await supabaseServidor()
    .from("rutas")
    .select("id, clave, nombre, tipo, dias, zona, activa")
    .eq("activa", true)
    .order("clave");

  if (error) {
    console.error("[alta] no se pudieron leer las zonas:", error.message);
    return null;
  }
  const conZona = (data || [])
    .filter((r) => Array.isArray(r.zona) && r.zona.length >= 3)
    .map((r) => ({
      id: r.id, clave: r.clave, nombre: r.nombre, tipo: r.tipo,
      dias: r.dias || [], zona: r.zona, activa: true,
    }));

  // Las 5 rutas reales entraron SIN polígono: el cuaderno da nombres de
  // colonias, no coordenadas. Sin este respaldo el verificador le contestaría
  // "no hay cobertura" a todo el mundo, incluida la gente que sí la tiene.
  // Se quita el día que la empresa entregue las zonas por ruta.
  if (!conZona.length) {
    return [{ id: ZONA_MATAMOROS.clave, ...ZONA_MATAMOROS, activa: true }];
  }
  return conZona;
}

/* ------------------------------------------------------------------ */
/* Leer el formulario                                                  */
/* ------------------------------------------------------------------ */

/**
 * Saca del FormData lo que manda la pantalla: los datos (un JSON), quién
 * firma, la firma (PNG) y la constancia (opcional). Los tamaños se revisan
 * ANTES de leer los bytes: no tiene caso cargar en memoria un archivo que de
 * todos modos se va a rechazar.
 */
async function leerFormulario(formData) {
  const mal = (motivo) => ({ ok: false, motivo });
  if (!formData || typeof formData.get !== "function") return mal("No llegó el formulario. Inténtalo de nuevo.");

  const crudo = formData.get("datos");
  if (typeof crudo !== "string" || !crudo || crudo.length > MAX_DATOS_JSON) {
    return mal("No llegaron tus datos completos. Inténtalo de nuevo.");
  }
  let entrada;
  try {
    entrada = JSON.parse(crudo);
  } catch {
    return mal("No llegaron tus datos completos. Inténtalo de nuevo.");
  }
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
    return mal("No llegaron tus datos completos. Inténtalo de nuevo.");
  }

  const firma = formData.get("firma");
  if (!esArchivo(firma) || !firma.size) return mal("Falta tu firma: dibújala en el recuadro.");
  if (firma.size > MAX_FIRMA_BYTES) return mal("La firma pesa demasiado. Bórrala y vuelve a dibujarla.");
  const firmaBytes = new Uint8Array(await firma.arrayBuffer());

  let constanciaBytes = null;
  const constancia = formData.get("constancia");
  if (esArchivo(constancia) && constancia.size > 0) {
    if (constancia.size > MAX_CONSTANCIA_BYTES) {
      return mal(TEXTO_MAX_CONSTANCIA);
    }
    constanciaBytes = new Uint8Array(await constancia.arrayBuffer());
  }

  return {
    ok: true,
    entrada,
    firmante: {
      nombre: formData.get("firmanteNombre"),
      cargo: formData.get("firmanteCargo"),
      // Sólo el "si" que pone la casilla cuenta como aceptar.
      acepta: formData.get("acepta") === "si",
    },
    firmaBytes,
    constanciaBytes,
  };
}

/* ------------------------------------------------------------------ */
/* El alta firmada                                                     */
/* ------------------------------------------------------------------ */

/**
 * Valida, firma, genera el PDF, guarda y avisa.
 *
 * @param {object} p
 * @param {FormData} p.formData
 * @param {"formulario"|"google"} p.origen
 * @param {{id:string, correo:string, verificado:boolean}|null} p.usuario
 *        SÓLO para el registro con Google, sacado de la sesión.
 *
 * El orden importa, como en `acciones-empleo.js`:
 *   1. se valida TODO (servidor, no navegador) y se pregunta el freno,
 *   2. se arma lo firmado, su huella y el PDF,
 *   3. se SUBEN firma, constancia y PDF a la cubeta privada,
 *   4. se ESCRIBE la fila de un solo golpe — si falla, se borran los archivos,
 *   5. y hasta el final los correos, que no pueden tumbar el alta.
 */
export async function procesarAltaFirmada({ formData, origen, usuario = null }) {
  const leido = await leerFormulario(formData);
  if (!leido.ok) return leido;

  // En el registro con Google el correo sale de la SESIÓN (Google ya lo
  // verificó), no de lo que diga el formulario.
  const entrada = origen === "google" ? { ...leido.entrada, correo: usuario?.correo } : leido.entrada;

  const v = validarAlta(entrada, CATALOGOS);
  if (!v.ok) return { ok: false, motivo: v.motivo, campo: v.campo };
  const f = validarFirmante(leido.firmante);
  if (!f.ok) return { ok: false, motivo: f.motivo, campo: f.campo };
  const fp = validarFirmaPng(leido.firmaBytes);
  if (!fp.ok) return { ok: false, motivo: fp.motivo, campo: "firma" };
  const vc = validarConstancia(leido.constanciaBytes);
  if (!vc.ok) return { ok: false, motivo: vc.motivo, campo: "constancia" };

  const limpia = v.limpia;
  const { firmante } = f;

  // La cobertura la decide el servidor con las zonas reales (o las de
  // muestra en el prototipo, que son las mismas que enseña la pantalla).
  const zonas = (await leerZonas()) || RUTAS_SEED;
  const cubren = rutasQueCubren([limpia.lat, limpia.lng], zonas);
  const enCobertura = cubren.length > 0;
  const rutasCubren = cubren.map((r) => r.clave || r.nombre).slice(0, 10);

  if (haySupabase()) {
    // Cada alta manda correos: sin freno, la pantalla servía para mandarle
    // correos de Morcast a cualquiera. Por IP en las DOS puertas (la de
    // Google también genera PDF y escribe en la cubeta)…
    const frenoPorIp = origen === "google" ? "registro" : "alta";
    if (!(await pasarFreno(frenoPorIp, { maximo: 5, minutos: 60 }))) {
      return { ok: false, motivo: "Recibimos varias solicitudes desde este equipo. Espera un rato o llámanos directo." };
    }
    // …y en la pública, además, un tope GLOBAL: quien rota IPs (una red de
    // bots) esquiva el de arriba, y cada alta pública le manda un correo a
    // una dirección que escribió un desconocido. 40 por hora es mucho más de
    // lo que Morcast recibe en un mes; si se llega, algo raro está pasando.
    if (origen === "formulario" && !(await pasarFreno("alta:global", { maximo: 40, minutos: 60, porIp: false }))) {
      return { ok: false, motivo: "Estamos recibiendo muchas solicitudes en este momento. Inténtalo en un rato o llámanos al 868 384 9478." };
    }
  }

  // ---- Lo firmado y su evidencia ----
  const ahora = new Date();
  const fechaIso = ahora.toISOString();
  const fechaTexto = fechaHoraMatamoros(ahora);
  const ip = await ipDeLaPeticion();
  const navegador = String((await headers()).get("user-agent") || "desconocido").slice(0, 400);
  const id = randomUUID();
  const prefijo = origen === "google" ? "REG" : "ALTA";
  const terminos = terminosVigentes();
  const terminosHuella = await sha256Hex(textoTerminos(terminos));
  const firmaHuella = await sha256Hex(leido.firmaBytes);
  const constancia = vc.vacia
    ? null
    : { sha256: await sha256Hex(leido.constanciaBytes), tipo: vc.tipo, bytes: leido.constanciaBytes.length };
  // En el registro con Google el correo ya lo verificó Google: queda
  // confirmado desde el inicio y así lo dice la evidencia.
  const correoConfirmado = origen === "google" && Boolean(usuario?.verificado);

  /**
   * Arma lo firmado y su PDF para UN folio. Es función porque el folio va
   * impreso en el PDF y dentro de lo firmado: si al guardar choca con otro
   * folio (azar repetido), hay que volver a armarlo todo con uno nuevo.
   */
  const armar = async (folio) => {
    const contenido = armarContenidoFirmado({
      folio,
      origen,
      datos: limpia,
      terminos: { version: terminos.version, textoSha256: terminosHuella },
      avisoPrivacidad: { version: AVISO_PRIVACIDAD.version, url: `${EMISOR.sitio}${RUTA_AVISO_PRIVACIDAD}` },
      firma: { imagenSha256: firmaHuella, nombre: firmante.nombre, cargo: firmante.cargo },
      constancia,
      evidencia: { fechaIso, ip, navegador, correo: limpia.correo },
    });
    const contenidoHuella = await huellaContenido(contenido);
    const pdf = await generarPdfAlta({
      alta: { ...limpia, folio, enCobertura, rutasQueCubren: rutasCubren },
      firmante,
      firmaPng: leido.firmaBytes,
      firmaTamano: fp,
      evidencia: {
        fechaTexto, fechaIso, ip, navegador, origen,
        terminosVersion: terminos.version,
        terminosHuella,
        avisoVersion: AVISO_PRIVACIDAD.version,
        contenidoHuella,
        firmaHuella,
        constancia,
        confirmacion: correoConfirmado ? { estado: "google", fechaTexto } : { estado: "pendiente" },
      },
      terminos,
      avisoPrecios: terminos.avisoPrecios,
      emisor: EMISOR,
    });
    return {
      folio,
      contenido,
      contenidoHuella,
      pdf,
      pdfHuella: await sha256Hex(pdf),
      pdfBase64: Buffer.from(pdf).toString("base64"),
      nombrePdf: nombrePdfAlta(folio),
    };
  };

  /**
   * `armar` con red: jsPDF decodifica el PNG de la firma y puede tronar con
   * una imagen rara que pasó la revisión de la cabecera. Se arma ANTES de
   * subir nada, así que si truena no queda ningún archivo huérfano.
   */
  const armarSeguro = async () => {
    try {
      return await armar(folioAlta(prefijo, ahora));
    } catch (e) {
      console.error("[alta] no se pudo generar el PDF:", e?.message);
      return null;
    }
  };
  const ERROR_PDF = {
    ok: false,
    campo: "firma",
    motivo: "No pudimos generar el PDF con tu firma. Bórrala, vuelve a firmar e inténtalo otra vez.",
  };

  let doc = await armarSeguro();
  if (!doc) return ERROR_PDF;

  const rutas = cubren.map((r) => ({ id: r.id, nombre: r.nombre, tipo: r.tipo, dias: r.dias || [] }));
  // Lo que la pantalla "¡Alta exitosa!" necesita, y nada más (las acciones
  // de servidor devuelven al navegador TODO lo que regresan).
  const respuesta = (d) => ({
    ok: true,
    folio: d.folio,
    pdfBase64: d.pdfBase64,
    nombrePdf: d.nombrePdf,
    correoConfirmado,
    enCobertura,
    rutas,
  });

  // Sin base (modo prototipo) la pantalla es navegable y el PDF se genera
  // igual, para que se pueda revisar; no se guarda ni se manda nada.
  if (!haySupabase()) return { ...respuesta(doc), demo: true, correo: "sin-servicio" };

  const sb = supabaseServidor();

  // ---- El enlace de confirmación (sólo se guarda su huella) ----
  let token = null;
  let tokenHuella = null;
  let tokenVence = null;
  if (!correoConfirmado) {
    token = generarToken();
    tokenHuella = await huellaToken(token);
    tokenVence = venceToken(ahora).toISOString();
  }

  // ---- Los archivos, antes que la fila ----
  const rutaFirma = `${id}/firma.png`;
  const rutaConstancia = constancia ? `${id}/constancia.${vc.extension}` : null;
  let subidos = [];
  const subir = async (ruta, bytes, tipo) => {
    const { error } = await sb.storage.from(CUBETA).upload(ruta, bytes, { contentType: tipo, upsert: false });
    if (error) throw new Error(`${ruta}: ${error.message}`);
    subidos.push(ruta);
  };
  const borrar = async (lista) => {
    if (!lista.length) return;
    const { error } = await sb.storage.from(CUBETA).remove(lista);
    if (error) console.error("[alta] quedaron archivos huérfanos en la cubeta:", lista, error.message);
  };
  const deshacerArchivos = () => borrar(subidos);
  try {
    await subir(rutaFirma, leido.firmaBytes, "image/png");
    if (rutaConstancia) await subir(rutaConstancia, leido.constanciaBytes, vc.tipo);
  } catch (e) {
    console.error("[alta] no se pudo subir a la cubeta:", e?.message);
    await deshacerArchivos();
    return { ok: false, motivo: "No se pudo guardar tu solicitud firmada. Inténtalo de nuevo." };
  }

  // ---- La fila, de un solo golpe ----
  const filaDe = (d) => ({
    id,
    folio: d.folio,
    origen,
    usuario_id: usuario?.id ?? null,
    correo_verificado: origen === "google" ? Boolean(usuario?.verificado) : false,
    empresa: limpia.empresa,
    contacto: limpia.contacto,
    telefono: limpia.telefono,
    correo: limpia.correo,
    alias: limpia.alias,
    calle: limpia.calle,
    colonia: limpia.colonia,
    cp: limpia.cp,
    referencias: limpia.referencias,
    lat: limpia.lat,
    lng: limpia.lng,
    residuos: limpia.residuos,
    equipo: limpia.equipo,
    servicios_por_mes: limpia.serviciosPorMes,
    razon_social: limpia.razonSocial,
    rfc: limpia.rfc,
    domicilio_fiscal: limpia.domicilioFiscal,
    uso_cfdi: limpia.usoCFDI,
    forma_pago: limpia.formaPago,
    en_cobertura: enCobertura,
    rutas_que_cubren: rutasCubren,
    representante_nombre: limpia.representanteNombre || null,
    representante_cargo: limpia.representanteCargo || null,
    facturacion_nombre: limpia.facturacionNombre || null,
    facturacion_correo: limpia.facturacionCorreo || null,
    facturacion_telefono: limpia.facturacionTelefono || null,
    horario_acceso: limpia.horarioAcceso || null,
    constancia_ruta: rutaConstancia,
    firmado_en: fechaIso,
    firmante_nombre: firmante.nombre,
    firmante_cargo: firmante.cargo || null,
    firma_ruta: rutaFirma,
    firma_ip: ip,
    firma_navegador: navegador,
    terminos_version: terminos.version,
    aviso_version: AVISO_PRIVACIDAD.version,
    contenido_firmado: d.contenido,
    contenido_huella: d.contenidoHuella,
    pdf_ruta: `${id}/${d.nombrePdf}`,
    pdf_huella: d.pdfHuella,
    pdf_inicial_huella: d.pdfHuella,
    correo_confirmado: correoConfirmado,
    correo_confirmado_en: correoConfirmado ? fechaIso : null,
    correo_confirmado_por: correoConfirmado ? "google" : null,
    confirmacion_huella: tokenHuella,
    confirmacion_vence: tokenVence,
  });

  // El folio lleva 4 caracteres al azar: chocar con uno existente es raro
  // pero posible, y no es culpa de quien firma. En ese caso se vuelve a
  // armar todo (el folio va impreso en el PDF y dentro de lo firmado) con un
  // folio nuevo, hasta 3 intentos. El choque se distingue POR EL NOMBRE del
  // índice (`tipoDeChoque`): uno con `usuario_id` es otra cosa.
  let fila = null;
  for (let intento = 1; intento <= 3 && !fila; intento++) {
    const rutaPdf = `${id}/${doc.nombrePdf}`;
    try {
      await subir(rutaPdf, doc.pdf, "application/pdf");
    } catch (e) {
      console.error("[alta] no se pudo subir el PDF:", e?.message);
      await deshacerArchivos();
      return { ok: false, motivo: "No se pudo guardar tu solicitud firmada. Inténtalo de nuevo." };
    }

    const candidata = filaDe(doc);
    const { error: errFila } = await sb.from("solicitudes_alta").insert(candidata);
    if (!errFila) {
      fila = candidata;
      break;
    }

    // El PDF de este intento ya no sirve: lleva un folio que no se guardó.
    await borrar([rutaPdf]);
    subidos = subidos.filter((r) => r !== rutaPdf);

    const choque = tipoDeChoque(errFila);
    if (choque === "folio" && intento < 3) {
      console.warn(`[alta] el folio ${doc.folio} ya existía; se reintenta con otro (intento ${intento}).`);
      doc = await armarSeguro();
      if (!doc) {
        await deshacerArchivos();
        return ERROR_PDF;
      }
      continue;
    }

    console.error("[alta] no se pudo guardar:", errFila.message);
    await deshacerArchivos();
    // La misma persona de Google mandó dos veces a la vez (índice único de la 017).
    if (choque === "usuario") {
      return { ok: false, motivo: "Ya recibimos tu solicitud. Morcast la revisa y te contacta." };
    }
    return { ok: false, motivo: "No se pudo guardar tu solicitud. Inténtalo de nuevo." };
  }
  if (!fila) {
    await deshacerArchivos();
    return { ok: false, motivo: "No se pudo guardar tu solicitud. Inténtalo de nuevo." };
  }

  const { folio, pdfBase64, nombrePdf, pdfHuella, contenidoHuella } = doc;

  // ---- Los correos: hasta el final y sin poder tumbar nada ----
  // Si fallan, el alta ya quedó guardada con su PDF, y la pantalla le da el
  // PDF al cliente de todos modos. Pero el fallo se anota: es la lección del
  // mes que el sitio estuvo mudo sin que nadie se enterara.
  let correo = "sin-servicio";
  if (hayResend()) {
    correo = "enviado";
    try {
      if (correoConfirmado) {
        // Google ya verificó el correo: va de una vez la versión con PDF.
        await correoSolicitudFirmada({
          correo: limpia.correo, contacto: limpia.contacto, empresa: limpia.empresa,
          folio, pdfBase64, nombrePdf, porGoogle: true,
        });
      } else {
        // SIN el PDF adjunto, a propósito: este correo va a una dirección que
        // escribió alguien sin cuenta. Si un tercero la usara para mandar
        // documentos "de Morcast" a quien quiera, al menos no viajan adjuntos;
        // el PDF le llega al cliente cuando confirma que el buzón es suyo.
        const enlace = `${origenPermitido(await headers())}/portal/alta/confirmar?t=${token}`;
        await correoConfirmarAlta({
          correo: limpia.correo, contacto: limpia.contacto, empresa: limpia.empresa,
          folio, enlace,
        });
      }
    } catch (e) {
      correo = "fallo";
      console.error("[alta] el alta SÍ se guardó, pero el correo al cliente falló:", e?.message);
    }
    try {
      await correoAvisoAlta(fila, { pdfBase64, nombrePdf, huellaPdf: pdfHuella });
    } catch (e) {
      console.error("[alta] el alta SÍ se guardó, pero el aviso a Morcast falló:", e?.message);
    }
  } else {
    console.warn(`[alta] ${folio} guardada SIN correos: falta RESEND_API_KEY.`);
  }

  await registrar({
    accion: "alta_firmada",
    tabla: "solicitudes_alta",
    registroId: folio,
    detalle: {
      empresa: limpia.empresa,
      origen,
      en_cobertura: enCobertura,
      correo_confirmado: correoConfirmado,
      contenido_huella: contenidoHuella,
    },
  });

  return { ...respuesta(doc), correo };
}

/* ------------------------------------------------------------------ */
/* Confirmación del correo                                             */
/* ------------------------------------------------------------------ */

/**
 * ¿Qué pasa con este enlace? Sólo LEE: la página de confirmación lo usa
 * para decir "confirma" o "este enlace ya no sirve" sin gastar el token.
 */
export async function estadoConfirmacion(token) {
  const huella = await huellaToken(token);
  if (!huella) return { estado: "invalido" };
  if (!haySupabase()) return { estado: "vigente", demo: true, folio: "ALTA-2026-DEMO", empresa: "Empresa de muestra" };

  const { data, error } = await supabaseServidor()
    .from("solicitudes_alta")
    .select("folio, empresa, correo_confirmado, confirmacion_huella, confirmacion_vence")
    .eq("confirmacion_huella", huella)
    .maybeSingle();
  if (error) {
    console.error("[alta] no se pudo leer la confirmación:", error.message);
    return { estado: "error" };
  }
  // Un enlace ya usado no se encuentra: al confirmar se borra su huella.
  if (!data) return { estado: "invalido" };
  return {
    estado: estadoToken({ correoConfirmado: data.correo_confirmado, huella: data.confirmacion_huella, vence: data.confirmacion_vence }),
    folio: data.folio,
    empresa: data.empresa,
  };
}

const MOTIVO_ESTADO = {
  invalido: "Este enlace ya se usó o no es válido. Si ya confirmaste, no tienes que hacer nada más.",
  vencido: "Este enlace venció (dura 7 días). Escríbenos a contacto@morcast.mx o llámanos al 868 384 9478 y te mandamos otro.",
  confirmado: "Este correo ya estaba confirmado. No tienes que hacer nada más.",
  error: "No pudimos revisar el enlace ahora. Inténtalo de nuevo en un momento.",
};

/**
 * Confirma el correo con el token del enlace: lo marca confirmado, GASTA el
 * token, vuelve a generar el PDF con "Correo confirmado el …" en la hoja de
 * evidencia, lo guarda y se lo manda al cliente y a Morcast.
 */
export async function confirmarCorreo(token) {
  const huella = await huellaToken(token);
  if (!huella) return { ok: false, estado: "invalido", motivo: MOTIVO_ESTADO.invalido };
  if (!haySupabase()) return { ok: true, demo: true, folio: "ALTA-2026-DEMO", pdfBase64: null };

  const sb = supabaseServidor();
  const { data: fila, error } = await sb
    .from("solicitudes_alta")
    .select(`id, folio, empresa, contacto, correo, en_cobertura, rutas_que_cubren,
      terminos_version, contenido_firmado, contenido_huella, firma_ruta, pdf_inicial_huella,
      correo_confirmado, confirmacion_huella, confirmacion_vence`)
    .eq("confirmacion_huella", huella)
    .maybeSingle();
  if (error) {
    console.error("[alta] no se pudo leer la confirmación:", error.message);
    return { ok: false, estado: "error", motivo: MOTIVO_ESTADO.error };
  }
  if (!fila) return { ok: false, estado: "invalido", motivo: MOTIVO_ESTADO.invalido };

  const estado = estadoToken({ correoConfirmado: fila.correo_confirmado, huella: fila.confirmacion_huella, vence: fila.confirmacion_vence });
  if (estado !== "vigente") return { ok: false, estado, motivo: MOTIVO_ESTADO[estado] };

  const ahora = new Date();
  const ip = await ipDeLaPeticion();
  const navegador = String((await headers()).get("user-agent") || "desconocido").slice(0, 400);

  // Se gasta el token en la MISMA sentencia que confirma, y sólo si la
  // huella sigue ahí: dos clics a la vez (o un antivirus del correo que
  // abre el enlace) no confirman dos veces.
  const { data: marcadas, error: errMarca } = await sb
    .from("solicitudes_alta")
    .update({
      correo_confirmado: true,
      correo_confirmado_en: ahora.toISOString(),
      correo_confirmado_por: "enlace",
      confirmacion_ip: ip,
      confirmacion_navegador: navegador,
      confirmacion_huella: null,
      confirmacion_vence: null,
    })
    .eq("id", fila.id)
    .eq("confirmacion_huella", huella)
    .select("id");
  if (errMarca) {
    console.error("[alta] no se pudo confirmar:", errMarca.message);
    return { ok: false, estado: "error", motivo: MOTIVO_ESTADO.error };
  }
  if (!marcadas?.length) return { ok: false, estado: "invalido", motivo: MOTIVO_ESTADO.invalido };

  await registrar({
    accion: "alta_correo_confirmado",
    tabla: "solicitudes_alta",
    registroId: fila.folio,
    detalle: { empresa: fila.empresa, correo: fila.correo },
  });

  // El correo YA quedó confirmado. Lo que sigue es la versión final del PDF:
  // si falla, la confirmación no se deshace (el registro manda), sólo se
  // anota y el cliente se queda con el PDF original.
  let final = null;
  try {
    final = await pdfFinal(sb, fila, { ahora, ip, navegador });
    const rutaFinal = `${fila.id}/${final.nombrePdf}`;
    const { error: errSubida } = await sb.storage.from(CUBETA)
      .upload(rutaFinal, final.pdf, { contentType: "application/pdf", upsert: false });
    if (errSubida) throw new Error(errSubida.message);
    const { error: errRuta } = await sb.from("solicitudes_alta")
      .update({ pdf_ruta: rutaFinal, pdf_huella: final.huella })
      .eq("id", fila.id);
    if (errRuta) throw new Error(errRuta.message);
  } catch (e) {
    console.error(`[alta] ${fila.folio}: correo confirmado, pero el PDF final no se pudo emitir:`, e?.message);
    final = null;
  }

  if (final && hayResend()) {
    try {
      await correoSolicitudFirmada({
        correo: fila.correo, contacto: fila.contacto, empresa: fila.empresa, folio: fila.folio,
        pdfBase64: final.base64, nombrePdf: final.nombrePdf, porGoogle: false,
      });
    } catch (e) {
      console.error("[alta] la versión final al cliente falló:", e?.message);
    }
    try {
      await correoAvisoAltaConfirmada({
        correo: fila.correo, empresa: fila.empresa, folio: fila.folio,
        pdfBase64: final.base64, nombrePdf: final.nombrePdf, huellaPdf: final.huella,
      });
    } catch (e) {
      console.error("[alta] el aviso de confirmación a Morcast falló:", e?.message);
    }
  }

  return {
    ok: true,
    folio: fila.folio,
    empresa: fila.empresa,
    pdfBase64: final?.base64 ?? null,
    nombrePdf: final?.nombrePdf ?? null,
  };
}

/**
 * La versión final del PDF, armada SÓLO con lo que quedó firmado
 * (`contenido_firmado`) y la firma guardada. Antes de imprimir nada se
 * comprueba que todo siga cuadrando: la huella de lo firmado, la de la
 * imagen de la firma y la del texto de los términos de ESA versión. Si algo
 * no cuadra no se emite: un PDF "confirmado" con datos distintos a los
 * firmados sería peor que no tener versión final.
 */
async function pdfFinal(sb, fila, { ahora, ip, navegador }) {
  const c = fila.contenido_firmado;
  if (!c?.datos || !c?.firma || !c?.evidencia) throw new Error("el alta no tiene contenido firmado");
  if ((await huellaContenido(c)) !== fila.contenido_huella) throw new Error("la huella de lo firmado no cuadra");
  // Lo firmado dice de qué folio es: tiene que ser el de la fila. Si no, la
  // versión "confirmada" de un folio saldría con el contenido de otro.
  if (c.folio !== fila.folio) throw new Error(`lo firmado es del folio ${c.folio}, no del ${fila.folio}`);

  const terminos = terminosDeVersion(fila.terminos_version);
  if (!terminos) throw new Error(`los términos ${fila.terminos_version} ya no están en el archivo`);
  const terminosHuella = await sha256Hex(textoTerminos(terminos));
  if (terminosHuella !== c.terminos?.texto_sha256) throw new Error("el texto de los términos cambió sin cambiar de versión");

  const { data: blob, error } = await sb.storage.from(CUBETA).download(fila.firma_ruta);
  if (error || !blob) throw new Error(`no se pudo bajar la firma: ${error?.message}`);
  const firmaPng = new Uint8Array(await blob.arrayBuffer());
  if ((await sha256Hex(firmaPng)) !== c.firma.imagen_sha256) throw new Error("la imagen de la firma no cuadra");
  const tam = validarFirmaPng(firmaPng);
  if (!tam.ok) throw new Error("la firma guardada no es un PNG válido");

  const pdf = await generarPdfAlta({
    alta: {
      ...c.datos,
      folio: fila.folio,
      enCobertura: fila.en_cobertura,
      rutasQueCubren: fila.rutas_que_cubren || [],
    },
    firmante: { nombre: c.firma.nombre, cargo: c.firma.cargo },
    firmaPng,
    firmaTamano: tam,
    evidencia: {
      fechaTexto: fechaHoraMatamoros(new Date(c.evidencia.fecha_iso)),
      fechaIso: c.evidencia.fecha_iso,
      ip: c.evidencia.ip,
      navegador: c.evidencia.navegador,
      origen: c.origen,
      terminosVersion: fila.terminos_version,
      terminosHuella,
      avisoVersion: c.aviso_privacidad?.version,
      contenidoHuella: fila.contenido_huella,
      firmaHuella: c.firma.imagen_sha256,
      constancia: c.constancia,
      confirmacion: { estado: "enlace", fechaTexto: fechaHoraMatamoros(ahora), ip, navegador },
      pdfInicialHuella: fila.pdf_inicial_huella,
    },
    terminos,
    // El aviso CONGELADO en la versión firmada de los términos (no el vivo de
    // hoy): el texto de esa versión ya pasó la comprobación de huella.
    avisoPrecios: terminos.avisoPrecios,
    emisor: EMISOR,
  });

  return {
    pdf,
    huella: await sha256Hex(pdf),
    base64: Buffer.from(pdf).toString("base64"),
    nombrePdf: nombrePdfAlta(fila.folio, { final: true }),
  };
}
