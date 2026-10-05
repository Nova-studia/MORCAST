/**
 * LAS REGLAS DEL ALTA CON FIRMA ELECTRÓNICA, SUELTAS Y COMPROBABLES.
 *
 * Qué es esto
 * -----------
 * Pedido del socio (5-oct-2026): que el alta del cliente sea amplia, que se
 * firme, que salga un PDF con todo y que el cliente vea "¡Alta exitosa!".
 * Decisión tomada con Luis: lo que se firma es la "Solicitud de alta" con la
 * aceptación de los Términos del servicio y del Aviso de privacidad, con una
 * FIRMA ELECTRÓNICA SIMPLE hecha en casa. Ese tipo de firma vale; lo que
 * pesa el día de una discusión es la EVIDENCIA que la acompaña, y por eso
 * casi todo este archivo es evidencia: qué se firmó (JSON canónico), su
 * huella SHA-256, la huella de la imagen de la firma y del PDF, y el token
 * con el que el cliente confirma que el correo es suyo.
 *
 * Preparado para después (NO construido): e.firma del SAT + constancia
 * NOM-151 con un proveedor (Mifiel u otro). Ese proveedor sella una HUELLA,
 * no el documento: `huellaContenido()` y la huella del PDF son justo lo que
 * se le mandaría, sin cambiar nada de lo que hay aquí.
 *
 * Por qué es un módulo puro
 * -------------------------
 * No importa React, Supabase ni nada de Node: usa Web Crypto, que existe
 * igual en el servidor, en el navegador y en `node --test`. Lo usan los dos
 * lados: la acción de servidor (que es la que manda) y el formulario, que
 * valida lo mismo para no hacer esperar a nadie por un error que ya se veía.
 */

/* ------------------------------------------------------------------ */
/* Límites y catálogos                                                 */
/* ------------------------------------------------------------------ */

export const LIMITES = {
  empresa: 120, contacto: 120, telefono: 30, correo: 160,
  alias: 80, calle: 160, colonia: 120, cp: 5, referencias: 400,
  razonSocial: 160, rfc: 13, domicilioFiscal: 240, usoCFDI: 80, formaPago: 80,
  representanteNombre: 120, representanteCargo: 80,
  facturacionNombre: 120, facturacionCorreo: 160, facturacionTelefono: 30,
  horarioAcceso: 200,
  firmanteNombre: 120, firmanteCargo: 80,
  residuo: 120, equipoTexto: 40,
};

/**
 * La Constancia de Situación Fiscal: PDF o foto, hasta 3.5 MB.
 *
 * ¿Por qué 3.5 y no 5? Vercel corta con un 413 CUALQUIER cuerpo de función
 * de más de 4.5 MB, antes de que la petición llegue a Next — sin nuestro
 * mensaje, sin nada. La constancia viaja en el MISMO cuerpo que la firma y
 * los datos, así que entre los tres tienen que caber holgados bajo ese tope
 * (`LIMITE_CUERPO_VERCEL`; lo comprueba `tests/alta-firma.test.mjs`).
 */
export const TIPOS_CONSTANCIA = ["application/pdf", "image/jpeg", "image/png"];
export const EXTENSION_POR_TIPO = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
export const MAX_CONSTANCIA_BYTES = 3.5 * 1024 * 1024;
export const TEXTO_MAX_CONSTANCIA =
  "La Constancia de Situación Fiscal puede pesar máximo 3.5 MB; si tu constancia pesa más, mándala por correo a contacto@morcast.mx.";

/**
 * La firma dibujada llega como PNG. 200 KB es de sobra: un trazo a mano en un
 * lienzo de 1200×400 pesa entre 5 y 40 KB. El tope está para que nadie use
 * el campo de la firma para subir una foto de 5 MB a la cubeta.
 */
export const MAX_FIRMA_BYTES = 200 * 1024;

/** El JSON de los datos del formulario: de sobra para un alta, corto para un abuso. */
export const MAX_DATOS_JSON = 64 * 1024;

/** Lo más que Vercel deja pasar en el cuerpo de una función (4.5 MB). */
export const LIMITE_CUERPO_VERCEL = 4.5 * 1000 * 1000;
/** Un PNG con menos que esto no trae un trazo (sólo cabecera y fondo). */
export const MIN_FIRMA_BYTES = 200;

/** Formato de RFC: 12 caracteres persona moral, 13 persona física. No valida ante el SAT. */
export const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;
const CORREO_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const texto = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
/** Para campos de varios renglones (referencias): sólo se recorta. */
const textoLargo = (v, max) => String(v ?? "").trim().slice(0, max);
const digitos = (v) => String(v ?? "").replace(/\D/g, "");

/* ------------------------------------------------------------------ */
/* Validación del alta ampliada                                        */
/* ------------------------------------------------------------------ */

/**
 * Valida y recorta TODO lo que manda el formulario de alta. Devuelve
 * `{ ok: true, limpia }` o `{ ok: false, motivo, campo }`.
 *
 * `catalogos` (opcional) trae las listas cerradas —tipos de residuo, equipo,
 * usos de CFDI, formas de pago—. Se reciben por parámetro y no se importan
 * porque viven en archivos que Node no puede cargar sueltos (`lib/datos.js`
 * importa sin extensión). Con catálogo, lo que no esté en la lista se
 * descarta: un bot no puede meter "residuo: <script>" en el PDF.
 */
export function validarAlta(entrada = {}, catalogos = {}) {
  const e = entrada || {};
  const mal = (motivo, campo) => ({ ok: false, motivo, campo });

  const empresa = texto(e.empresa, LIMITES.empresa);
  const contacto = texto(e.contacto, LIMITES.contacto);
  const telefono = texto(e.telefono, LIMITES.telefono);
  const correo = texto(e.correo, LIMITES.correo).toLowerCase();
  if (!empresa) return mal("Escribe el nombre de la empresa o negocio.", "empresa");
  if (!contacto) return mal("Escribe el nombre de la persona de contacto.", "contacto");
  const tel = digitos(telefono);
  if (tel.length < 10 || tel.length > 15) {
    return mal("El teléfono debe traer 10 dígitos (por ejemplo 868 384 9478).", "telefono");
  }
  if (!CORREO_RE.test(correo)) return mal("El correo no parece válido.", "correo");

  // Domicilio: el mismo que hoy exige la pantalla.
  const alias = texto(e.alias, LIMITES.alias);
  const calle = texto(e.calle, LIMITES.calle);
  const colonia = texto(e.colonia, LIMITES.colonia);
  const cp = digitos(e.cp).slice(0, LIMITES.cp);
  if (!alias) return mal("Ponle nombre al domicilio (Planta 1, Matriz…).", "alias");
  if (!calle) return mal("Escribe la calle y el número.", "calle");
  if (!colonia) return mal("Escribe la colonia.", "colonia");
  if (!/^\d{5}$/.test(cp)) return mal("El código postal lleva 5 dígitos.", "cp");

  // `Number("")` y `Number(null)` dan 0, que es una coordenada válida (en el
  // golfo de Guinea): un pin que no se marcó tiene que dar error, no 0,0.
  const coord = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
  const lat = coord(e.lat);
  const lng = coord(e.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return mal("Falta marcar el domicilio en el mapa.", "mapa");
  }

  // Residuos: texto suelto recortado, y si hay catálogo, sólo lo del catálogo.
  let residuos = (Array.isArray(e.residuos) ? e.residuos : [])
    .map((r) => texto(r, LIMITES.residuo))
    .filter(Boolean);
  if (Array.isArray(catalogos.residuos)) residuos = residuos.filter((r) => catalogos.residuos.includes(r));
  residuos = [...new Set(residuos)].slice(0, 20);
  if (!residuos.length) return mal("Elige al menos un tipo de residuo.", "residuos");

  // Equipo: cantidades enteras de 1 a 20, y sólo tipos y medidas que existen.
  const equipo = [];
  for (const it of Array.isArray(e.equipo) ? e.equipo.slice(0, 20) : []) {
    const tipo = texto(it?.tipo, LIMITES.equipoTexto);
    const medida = texto(it?.medida, LIMITES.equipoTexto);
    const cantidad = Number.parseInt(it?.cantidad, 10);
    if (!tipo || !medida || !Number.isFinite(cantidad) || cantidad < 1 || cantidad > 20) continue;
    if (Array.isArray(catalogos.equipo)) {
      const def = catalogos.equipo.find((x) => x.tipo === tipo);
      if (!def || !def.medidas.includes(medida)) continue;
    }
    equipo.push({ tipo, medida, cantidad });
  }

  const serviciosPorMes = Number.parseInt(e.serviciosPorMes, 10);
  if (!Number.isFinite(serviciosPorMes) || serviciosPorMes < 1 || serviciosPorMes > 200) {
    return mal("Di cuántas recolecciones al mes necesitas (entre 1 y 200).", "serviciosPorMes");
  }

  // Facturación: OPCIONAL por ahora (Luis, 5-oct-2026). Morcast todavía no
  // define cómo va a facturar, así que no se le exige a nadie. Lo que sí: si
  // escriben un RFC, que tenga forma de RFC; uno mal tecleado es peor que
  // ninguno, porque después se factura con él.
  const razonSocial = texto(e.razonSocial, LIMITES.razonSocial);
  const rfc = texto(e.rfc, 20).toUpperCase().replace(/[\s-]/g, "");
  const domicilioFiscal = texto(e.domicilioFiscal, LIMITES.domicilioFiscal);
  if (rfc && !RFC_RE.test(rfc)) return mal("El RFC no tiene el formato correcto (12 o 13 caracteres). Si no lo tienes a la mano, déjalo en blanco.", "rfc");

  // Vacío = "lo definimos después"; si viene algo fuera del catálogo, también.
  let usoCFDI = texto(e.usoCFDI, LIMITES.usoCFDI);
  let formaPago = texto(e.formaPago, LIMITES.formaPago);
  if (Array.isArray(catalogos.usosCfdi) && !catalogos.usosCfdi.includes(usoCFDI)) usoCFDI = "";
  if (Array.isArray(catalogos.formasPago) && !catalogos.formasPago.includes(formaPago)) formaPago = "";

  // Lo nuevo del alta "amplia" (5-oct). Todo opcional, pero si viene, bien.
  const facturacionCorreo = texto(e.facturacionCorreo, LIMITES.facturacionCorreo).toLowerCase();
  if (facturacionCorreo && !CORREO_RE.test(facturacionCorreo)) {
    return mal("El correo de facturación no parece válido.", "facturacionCorreo");
  }
  const facturacionTelefono = texto(e.facturacionTelefono, LIMITES.facturacionTelefono);
  if (facturacionTelefono) {
    const n = digitos(facturacionTelefono).length;
    if (n < 10 || n > 15) return mal("El teléfono de facturación debe traer 10 dígitos.", "facturacionTelefono");
  }

  return {
    ok: true,
    limpia: {
      empresa, contacto, telefono, correo,
      alias, calle, colonia, cp,
      referencias: textoLargo(e.referencias, LIMITES.referencias),
      lat, lng,
      residuos, equipo, serviciosPorMes,
      razonSocial, rfc, domicilioFiscal, usoCFDI, formaPago,
      representanteNombre: texto(e.representanteNombre, LIMITES.representanteNombre),
      representanteCargo: texto(e.representanteCargo, LIMITES.representanteCargo),
      facturacionNombre: texto(e.facturacionNombre, LIMITES.facturacionNombre),
      facturacionCorreo,
      facturacionTelefono,
      horarioAcceso: texto(e.horarioAcceso, LIMITES.horarioAcceso),
    },
  };
}

/**
 * Quien firma: nombre COMPLETO (al menos nombre y apellido), cargo opcional y
 * la casilla de aceptación marcada. Sin las tres cosas no hay firma.
 */
export function validarFirmante({ nombre, cargo, acepta } = {}) {
  const n = texto(nombre, LIMITES.firmanteNombre);
  if (acepta !== true) {
    return { ok: false, motivo: "Para firmar tienes que aceptar los Términos del servicio y el Aviso de privacidad.", campo: "acepta" };
  }
  if (n.split(" ").filter((p) => p.length >= 2).length < 2) {
    return { ok: false, motivo: "Escribe tu nombre completo (nombre y apellido) como firmante.", campo: "firmanteNombre" };
  }
  return { ok: true, firmante: { nombre: n, cargo: texto(cargo, LIMITES.firmanteCargo) } };
}

/* ------------------------------------------------------------------ */
/* Archivos: no se cree el tipo que dice el navegador                  */
/* ------------------------------------------------------------------ */

const empiezaCon = (bytes, firma) => firma.every((b, i) => bytes[i] === b);

/**
 * El tipo REAL de un archivo, por sus primeros bytes. El `type` que manda el
 * navegador lo escribe quien manda el formulario; los bytes no mienten igual.
 */
export function tipoPorContenido(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (empiezaCon(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (empiezaCon(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empiezaCon(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  return null;
}

/** La constancia: tamaño y tipo comprobados con los bytes. Opcional. */
export function validarConstancia(bytes) {
  if (!bytes || !bytes.length) return { ok: true, vacia: true };
  if (bytes.length > MAX_CONSTANCIA_BYTES) {
    return { ok: false, motivo: TEXTO_MAX_CONSTANCIA };
  }
  const tipo = tipoPorContenido(bytes);
  if (!TIPOS_CONSTANCIA.includes(tipo)) {
    return { ok: false, motivo: "La Constancia de Situación Fiscal tiene que ser PDF, JPG o PNG." };
  }
  return { ok: true, tipo, extension: EXTENSION_POR_TIPO[tipo] };
}

/**
 * La firma: un PNG de verdad, de un tamaño razonable. Lee el ancho y el alto
 * de la cabecera IHDR (bytes 16 a 23) sin decodificar la imagen.
 *
 * Que el trazo no esté vacío lo comprueba la pantalla (no deja enviar sin
 * trazo); aquí se garantiza que lo que se guarda y se imprime en el PDF es
 * una imagen chica y bien formada, no cualquier cosa con extensión .png.
 */
export function validarFirmaPng(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length < MIN_FIRMA_BYTES) return { ok: false, motivo: "Falta tu firma: dibújala en el recuadro." };
  if (b.length > MAX_FIRMA_BYTES) return { ok: false, motivo: "La firma pesa demasiado. Bórrala y vuelve a dibujarla." };
  if (tipoPorContenido(b) !== "image/png") return { ok: false, motivo: "La firma no llegó como imagen. Vuelve a dibujarla." };
  const vista = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const ancho = vista.getUint32(16);
  const alto = vista.getUint32(20);
  if (ancho < 100 || alto < 40 || ancho > 4000 || alto > 2000) {
    return { ok: false, motivo: "La firma llegó con un tamaño raro. Vuelve a dibujarla." };
  }
  return { ok: true, ancho, alto };
}

/* ------------------------------------------------------------------ */
/* JSON canónico y huellas                                             */
/* ------------------------------------------------------------------ */

/**
 * JSON CANÓNICO: el mismo objeto da SIEMPRE los mismos bytes, sin importar en
 * qué orden se armaron las llaves. Llaves ordenadas en cada nivel, arreglos
 * en su orden, sin espacios, y lo `undefined` fuera (como JSON.stringify).
 *
 * Importa porque la huella se calcula sobre estos bytes: si el orden de las
 * llaves cambiara la huella, recalcularla dentro de un año —desde la copia
 * que guarda la base en `contenido_firmado`, donde jsonb reordena todo— daría
 * otra cosa, y la evidencia no probaría nada.
 */
export function jsonCanonico(valor) {
  if (valor === null || typeof valor !== "object") {
    if (typeof valor === "number" && !Number.isFinite(valor)) return "null";
    return JSON.stringify(valor);
  }
  if (Array.isArray(valor)) {
    return `[${valor.map((v) => (v === undefined || typeof v === "function" ? "null" : jsonCanonico(v))).join(",")}]`;
  }
  const llaves = Object.keys(valor)
    .filter((k) => valor[k] !== undefined && typeof valor[k] !== "function")
    .sort();
  return `{${llaves.map((k) => `${JSON.stringify(k)}:${jsonCanonico(valor[k])}`).join(",")}}`;
}

const codificador = new TextEncoder();

/** SHA-256 en hexadecimal (minúsculas) de un texto o de unos bytes. */
export async function sha256Hex(entrada) {
  const bytes = typeof entrada === "string"
    ? codificador.encode(entrada)
    : entrada instanceof Uint8Array ? entrada : new Uint8Array(entrada);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Lo que se firma, en una sola pieza. Entra TODO lo que alguien podría querer
 * discutir después: los datos del alta, qué términos y qué aviso se
 * aceptaron (versión y huella del texto), la huella de la imagen de la firma
 * y de la constancia, y la evidencia del momento (fecha, IP, navegador,
 * correo). Así nadie puede cambiar un dato —ni siquiera la IP— sin que la
 * huella deje de cuadrar.
 */
export function armarContenidoFirmado({
  folio, origen, datos, terminos, avisoPrivacidad, firma, constancia, evidencia,
}) {
  return {
    documento: "Solicitud de alta de servicio — Morcast del Norte, S.A. de C.V.",
    folio,
    origen,
    datos,
    terminos: { version: terminos.version, texto_sha256: terminos.textoSha256 },
    aviso_privacidad: { version: avisoPrivacidad.version, url: avisoPrivacidad.url },
    firma: { imagen_sha256: firma.imagenSha256, nombre: firma.nombre, cargo: firma.cargo || "" },
    constancia: constancia
      ? { sha256: constancia.sha256, tipo: constancia.tipo, bytes: constancia.bytes }
      : null,
    evidencia: {
      fecha_iso: evidencia.fechaIso,
      zona_horaria: ZONA_MATAMOROS,
      ip: evidencia.ip,
      navegador: evidencia.navegador,
      correo: evidencia.correo,
    },
  };
}

/** La huella del contenido firmado: SHA-256 de su JSON canónico. */
export async function huellaContenido(contenido) {
  return sha256Hex(jsonCanonico(contenido));
}

/* ------------------------------------------------------------------ */
/* Token de confirmación del correo                                    */
/* ------------------------------------------------------------------ */

export const VIGENCIA_TOKEN_DIAS = 7;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

function aBase64Url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Token de un solo uso para "Confirmar mi solicitud": 32 bytes de azar
 * criptográfico (256 bits), en base64url → 43 caracteres que caben en un
 * enlace sin escaparse.
 */
export function generarToken() {
  return aBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * La HUELLA del token, que es lo único que se guarda. Quien llegara a leer
 * la tabla no puede armar el enlace con ella. SHA-256 a secas basta (sin
 * HMAC ni sal): con 256 bits de azar no hay diccionario que probar, a
 * diferencia de un código de 6 dígitos (ver `lib/mfa.mjs`).
 * Devuelve null si el texto no tiene forma de token: así ni se consulta la
 * base con basura.
 */
export async function huellaToken(token) {
  if (!TOKEN_RE.test(String(token || ""))) return null;
  return sha256Hex(String(token));
}

/** Hasta cuándo sirve un token creado `ahora`. */
export function venceToken(ahora = new Date()) {
  return new Date(ahora.getTime() + VIGENCIA_TOKEN_DIAS * 24 * 60 * 60 * 1000);
}

/**
 * ¿Sirve todavía el enlace? Recibe la fila tal como la guarda la base.
 *   "confirmado" — ya se usó (el correo ya está confirmado)
 *   "vencido"    — pasaron los 7 días
 *   "invalido"   — no hay token guardado
 *   "vigente"    — se puede confirmar
 */
export function estadoToken({ correoConfirmado, huella, vence } = {}, ahora = new Date()) {
  if (correoConfirmado) return "confirmado";
  if (!huella || !vence) return "invalido";
  const v = new Date(vence);
  if (Number.isNaN(v.getTime()) || v.getTime() <= ahora.getTime()) return "vencido";
  return "vigente";
}

/**
 * ¿Con qué índice chocó un INSERT que falló por llave repetida (23505)?
 *   "folio"   — el folio al azar ya existía: se reintenta con otro.
 *   "usuario" — esa cuenta de Google ya tiene su solicitud (017).
 *   null      — cualquier otra cosa.
 * Se decide por el NOMBRE del índice que trae el mensaje de Postgres, no
 * sólo por el código: los dos choques llevan el mismo 23505 y piden
 * respuestas opuestas.
 */
export function tipoDeChoque(error) {
  if (!error || error.code !== "23505") return null;
  const texto = `${error.message || ""} ${error.details || ""}`;
  if (/solicitudes_alta_folio_key|\(folio\)=/.test(texto)) return "folio";
  if (/solicitudes_alta_usuario_idx|\(usuario_id\)=/.test(texto)) return "usuario";
  return null;
}

/* ------------------------------------------------------------------ */
/* Fechas, folio y nombres                                             */
/* ------------------------------------------------------------------ */

export const ZONA_MATAMOROS = "America/Matamoros";

/**
 * Fecha y hora EN MATAMOROS, para la evidencia: "5 de octubre de 2026,
 * 14:32:10 (hora de Matamoros, GMT-05:00)". Se fija la zona y se escribe el
 * desfase porque el servidor de Vercel vive en UTC: sin esto el PDF diría la
 * hora de otro lugar, y en una firma la hora es parte de lo que se prueba.
 */
export function fechaHoraMatamoros(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const dia = new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA_MATAMOROS, day: "numeric", month: "long", year: "numeric",
  }).format(d);
  const hora = new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA_MATAMOROS, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(d);
  const desfase = new Intl.DateTimeFormat("en-US", { timeZone: ZONA_MATAMOROS, timeZoneName: "longOffset" })
    .formatToParts(d).find((p) => p.type === "timeZoneName")?.value || "";
  return `${dia}, ${hora} (hora de Matamoros${desfase ? `, ${desfase.replace("−", "-")}` : ""})`;
}

/**
 * Folio ALTA-2026-8F3K (o REG- para el registro con Google): legible por
 * teléfono. Con azar criptográfico y no `Math.random()`, que es predecible.
 */
export function folioAlta(prefijo = "ALTA", ahora = new Date()) {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin I/L/O/0/1: se confunden al dictarlo
  const azar = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(4)), (b) => abc[b % abc.length]).join("");
  return `${prefijo}-${ahora.getFullYear()}-${azar}`;
}

/** Nombre del PDF: el mismo en la cubeta, en el correo y en la descarga. */
export function nombrePdfAlta(folio, { final = false } = {}) {
  const limpio = String(folio || "alta").replace(/[^A-Za-z0-9-]/g, "");
  return `solicitud-${limpio}${final ? "-confirmada" : ""}.pdf`;
}
