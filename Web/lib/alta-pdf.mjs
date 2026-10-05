/**
 * EL PDF DE LA SOLICITUD DE ALTA FIRMADA.
 *
 * Se genera en el SERVIDOR (acción de servidor, en Node), no en el navegador
 * como los de `lib/portal-pdf.js`: es un documento con evidencia de firma, y
 * si lo armara el navegador, el cliente podría armar el que quisiera. El
 * servidor lo genera, guarda su huella y lo manda por correo.
 *
 * El estilo (banda de color arriba, rótulos en mayúsculas, recuadro del
 * aviso de precios) es el de `portal-pdf.js` para que todos los PDF de
 * Morcast se vean de la misma familia. No se importa de ahí porque ese
 * archivo usa los alias `@/` del empaquetador y no carga en Node suelto
 * (`node --test`); por lo mismo, los datos del emisor llegan por parámetro.
 *
 * Secciones, en orden: datos del alta → aviso de precios → declaración de
 * aceptación con la firma → anexo con los Términos completos → hoja de
 * "Evidencia de la firma electrónica". La hoja de evidencia va al final a
 * propósito: es lo que se busca el día que alguien pregunta "¿quién firmó
 * esto y cuándo?".
 */

const TEAL = [20, 76, 79];
const VERDE_FRANJA = [78, 179, 74];
const VERDE_TXT = [38, 84, 33]; // #265421: sobre BLANCO sí se lee (no así sobre oscuro)
const TINTA = [26, 34, 33];
const GRIS = [100, 112, 110];
const LINEA = [225, 230, 229];

const M = 40; // margen
const PIE = 64; // alto reservado al pie

/** Texto o raya: un dato que el cliente no dio no se inventa. */
const o = (v) => (v || v === 0 ? String(v) : "—");

/**
 * @param {object} p
 * @param {object} p.alta         datos validados (`validarAlta().limpia`) + folio, enCobertura, rutasQueCubren
 * @param {object} p.firmante     { nombre, cargo }
 * @param {Uint8Array} p.firmaPng la imagen de la firma
 * @param {{ancho:number, alto:number}} p.firmaTamano
 * @param {object} p.evidencia    ver la hoja de evidencia abajo
 * @param {object} p.terminos     { version, nota, clausulas }
 * @param {string} p.avisoPrecios `TEXTO_AVISO_PRECIOS`
 * @param {object} p.emisor       { razonSocial, domicilioLinea, telefonos, correo, sitio }
 * @returns {Promise<Uint8Array>}
 */
export async function generarPdfAlta({
  alta, firmante, firmaPng, firmaTamano, evidencia, terminos, avisoPrecios, emisor,
}) {
  const { jsPDF } = await import("jspdf");
  // `compress`: el PDF viaja ADJUNTO en dos correos; sin comprimir pesa el triple.
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ANCHO = W - 2 * M;
  const confirmado = evidencia.confirmacion?.estado === "enlace" || evidencia.confirmacion?.estado === "google";

  doc.setProperties({
    title: `Solicitud de alta ${alta.folio}`,
    subject: "Solicitud de alta de servicio con firma electrónica",
    author: emisor.razonSocial,
    creator: "morcast.mx",
    keywords: `huella-contenido-sha256:${evidencia.contenidoHuella}`,
  });

  let y = 0;

  /* ---------------- utilidades de página ---------------- */

  const bandaChica = () => {
    doc.setFillColor(...TEAL);
    doc.rect(0, 0, W, 30, "F");
    doc.setFillColor(...VERDE_FRANJA);
    doc.rect(0, 30, W, 2.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("MORCAST DEL NORTE", M, 19);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(210, 224, 222);
    doc.text(`Solicitud de alta · ${alta.folio}`, W - M, 19, { align: "right" });
    return 58;
  };

  const nuevaPagina = () => {
    doc.addPage();
    y = bandaChica();
  };

  /** Si lo que sigue (de `alto` puntos) no cabe, pasa a otra hoja. */
  const asegurar = (alto) => {
    if (y + alto > H - PIE) nuevaPagina();
  };

  const titulo = (t) => {
    asegurar(40);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...VERDE_TXT);
    doc.text(t.toUpperCase(), M, y);
    doc.setDrawColor(...LINEA);
    doc.line(M, y + 5, W - M, y + 5);
    y += 20;
  };

  /** Renglones etiqueta → valor, con el valor partido en su columna. */
  const filas = (pares, { ancho = 150, mono = false } = {}) => {
    for (const [k, v] of pares) {
      doc.setFont(mono ? "courier" : "helvetica", "normal");
      doc.setFontSize(mono ? 8 : 9.5);
      const lineas = doc.splitTextToSize(o(v), ANCHO - ancho);
      const alto = Math.max(1, lineas.length) * (mono ? 11 : 13) + 3;
      asegurar(alto);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...GRIS);
      doc.text(String(k), M, y);
      doc.setFont(mono ? "courier" : "helvetica", "normal");
      doc.setFontSize(mono ? 8 : 9.5);
      doc.setTextColor(...TINTA);
      doc.text(lineas, M + ancho, y);
      y += alto;
    }
  };

  const parrafo = (t, { tam = 9, color = TINTA, estilo = "normal", interlineado = 12, sangria = 0 } = {}) => {
    doc.setFont("helvetica", estilo);
    doc.setFontSize(tam);
    doc.setTextColor(...color);
    const lineas = doc.splitTextToSize(String(t), ANCHO - sangria);
    for (const l of lineas) {
      asegurar(interlineado);
      doc.text(l, M + sangria, y);
      y += interlineado;
    }
  };

  /** Recuadro de color con título (aviso de precios, nota de borrador). */
  const recuadro = (tituloR, cuerpo, { fondo, borde, tinta }) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lineas = doc.splitTextToSize(cuerpo, ANCHO - 28);
    const alto = 30 + lineas.length * 11.5;
    asegurar(alto + 14);
    doc.setFillColor(...fondo);
    doc.setDrawColor(...borde);
    doc.setLineWidth(0.8);
    doc.rect(M, y, ANCHO, alto, "FD");
    doc.setFillColor(...borde);
    doc.rect(M, y, 4, alto, "F");
    doc.setLineWidth(1);
    doc.setTextColor(...tinta);
    doc.setFont("helvetica", "bold");
    doc.text(tituloR, M + 14, y + 16);
    doc.setFont("helvetica", "normal");
    doc.text(lineas, M + 14, y + 30);
    y += alto + 14;
  };

  /* ---------------- hoja 1: encabezado ---------------- */

  doc.setFillColor(...TEAL);
  doc.rect(0, 0, W, 74, "F");
  doc.setFillColor(...VERDE_FRANJA);
  doc.rect(0, 74, W, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("MORCAST", M, 38);
  doc.setTextColor(...VERDE_FRANJA);
  doc.text("DEL NORTE", 148, 38);
  doc.setTextColor(210, 224, 222);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("MANEJO INTEGRAL DE RESIDUOS", M + 1, 54);
  doc.setFontSize(8);
  doc.setTextColor(220, 232, 230);
  doc.text([emisor.telefonos.join(" · "), emisor.correo, emisor.sitio.replace(/^https?:\/\//, "")], W - M, 28, { align: "right" });

  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Solicitud de alta de servicio", M, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRIS);
  doc.text(`Folio: ${alta.folio}`, W - M, 104, { align: "right" });
  doc.setFontSize(8.5);
  doc.text(evidencia.fechaTexto, W - M, 117, { align: "right" });

  // Estado del correo, a la vista: quien reciba el PDF reenviado sabe de
  // inmediato si esta es la versión final o la que espera confirmación.
  const sello = confirmado ? "FIRMADA · CORREO CONFIRMADO" : "FIRMADA · CORREO POR CONFIRMAR";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const anchoSello = doc.getTextWidth(sello) + 16;
  doc.setFillColor(...(confirmado ? [232, 243, 230] : [250, 243, 226]));
  doc.setDrawColor(...(confirmado ? [111, 168, 103] : [214, 164, 74]));
  doc.roundedRect(M, 120, anchoSello, 16, 3, 3, "FD");
  doc.setTextColor(...(confirmado ? [38, 84, 33] : [120, 84, 10]));
  doc.text(sello, M + 8, 131);

  doc.setDrawColor(...LINEA);
  doc.line(M, 146, W - M, 146);
  y = 168;

  /* ---------------- datos del alta ---------------- */

  titulo("Empresa y facturación");
  filas([
    ["Empresa o negocio", alta.empresa],
    ["Razón social", alta.razonSocial],
    ["RFC", alta.rfc],
    ["Domicilio fiscal", alta.domicilioFiscal],
    ["Uso de CFDI", alta.usoCFDI],
    ["Forma de pago", alta.formaPago],
    ["Constancia fiscal", evidencia.constancia ? `Adjunta (${evidencia.constancia.tipo === "application/pdf" ? "PDF" : "imagen"}, ${Math.max(1, Math.round(evidencia.constancia.bytes / 1024))} KB)` : "No se adjuntó"],
  ]);

  titulo("Contactos");
  filas([
    ["Persona de contacto", alta.contacto],
    ["Teléfono", alta.telefono],
    ["Correo", alta.correo],
    ["Representante legal", alta.representanteNombre ? `${alta.representanteNombre}${alta.representanteCargo ? ` · ${alta.representanteCargo}` : ""}` : "—"],
    ["Contacto de facturación", [alta.facturacionNombre, alta.facturacionCorreo, alta.facturacionTelefono].filter(Boolean).join(" · ") || "—"],
  ]);

  titulo("Punto de recolección");
  filas([
    ["Nombre del punto", alta.alias],
    ["Domicilio", [alta.calle, alta.colonia, alta.cp ? `C.P. ${alta.cp}` : ""].filter(Boolean).join(", ")],
    ["Referencias", alta.referencias],
    ["Horario de acceso", alta.horarioAcceso],
    ["Ubicación (GPS)", Number.isFinite(alta.lat) ? `${alta.lat.toFixed(6)}, ${alta.lng.toFixed(6)}` : "—"],
    ["Cobertura", alta.enCobertura
      ? `Dentro de ruta${alta.rutasQueCubren?.length ? `: ${alta.rutasQueCubren.join(", ")}` : ""}`
      : "Fuera de las rutas actuales (se evalúa abrir zona)"],
  ]);

  titulo("Servicio solicitado");
  filas([
    ["Tipos de residuo", (alta.residuos || []).join(", ")],
    ["Equipo", (alta.equipo || []).map((e) => `${e.cantidad} × ${e.tipo} ${e.medida}`).join(", ") || "Por definir"],
    ["Recolecciones al mes", alta.serviciosPorMes],
  ]);

  y += 4;
  recuadro("IMPORTANTE", avisoPrecios, { fondo: [238, 244, 250], borde: [42, 106, 153], tinta: [22, 58, 85] });

  /* ---------------- declaración y firma ---------------- */

  // La declaración y la firma van en la MISMA hoja: una firma sola en una
  // hoja, separada del texto que firma, es justo lo que se discute después.
  asegurar(270);
  titulo("Declaración y aceptación");
  const quien = `${firmante.nombre}${firmante.cargo ? `, ${firmante.cargo}` : ""}`;
  parrafo(
    `Yo, ${quien}, en nombre de ${alta.razonSocial || alta.empresa}, declaro que la información de esta solicitud es verdadera, ` +
    `que tengo facultades para presentarla, y que he leído y acepto los Términos del servicio (versión ${evidencia.terminosVersion}, ` +
    `anexos a este documento) y el Aviso de privacidad (versión ${evidencia.avisoVersion}, publicado en morcast.mx/aviso-de-privacidad) ` +
    `de ${emisor.razonSocial.replace(/\.$/, "")}. Firmo electrónicamente esta solicitud el ${evidencia.fechaTexto}.`,
    { tam: 9.5, interlineado: 13 }
  );
  y += 10;

  // La firma, a escala dentro de su recuadro, sin deformarla.
  const cajaW = 240;
  const cajaH = 92;
  asegurar(cajaH + 60);
  const escala = Math.min(cajaW / firmaTamano.ancho, cajaH / firmaTamano.alto);
  const fw = firmaTamano.ancho * escala;
  const fh = firmaTamano.alto * escala;
  doc.addImage(firmaPng, "PNG", M + (cajaW - fw) / 2, y + (cajaH - fh) / 2, fw, fh);
  y += cajaH + 4;
  doc.setDrawColor(...TINTA);
  doc.setLineWidth(0.7);
  doc.line(M, y, M + cajaW, y);
  doc.setLineWidth(1);
  y += 13;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TINTA);
  doc.text(firmante.nombre, M, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  if (firmante.cargo) {
    doc.text(firmante.cargo, M, y);
    y += 11;
  }
  doc.text(`Firma electrónica · ${alta.folio} · ver hoja de evidencia`, M, y);
  y += 16;

  /* ---------------- anexo: términos ---------------- */

  nuevaPagina();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...TINTA);
  doc.text("Anexo · Términos del servicio", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.text(`Versión ${terminos.version}`, M, y);
  y += 16;
  recuadro("BORRADOR", terminos.nota, { fondo: [250, 243, 226], borde: [214, 164, 74], tinta: [96, 66, 8] });

  for (const c of terminos.clausulas) {
    asegurar(36);
    y += 4;
    parrafo(c.titulo, { tam: 9.5, estilo: "bold", interlineado: 13 });
    for (const p of c.parrafos) {
      parrafo(p, { tam: 8.5, interlineado: 11.2 });
      y += 3;
    }
  }

  /* ---------------- hoja de evidencia ---------------- */

  nuevaPagina();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...TINTA);
  doc.text("Evidencia de la firma electrónica", M, y);
  y += 16;
  parrafo(
    "Esta solicitud se firmó con firma electrónica simple. La evidencia de abajo se registró en el momento de la firma. " +
    "La huella SHA-256 del contenido firmado se calcula sobre el JSON canónico de los datos del alta, los términos aceptados, " +
    "la imagen de la firma y la evidencia del momento: Morcast del Norte conserva ese contenido, y al recalcular su huella " +
    "debe salir exactamente la misma. Si cambiara un solo dato, la huella sería otra.",
    { tam: 8.5, color: GRIS, interlineado: 11.5 }
  );
  y += 10;

  const conf = evidencia.confirmacion || { estado: "pendiente" };
  const textoConfirmacion = {
    pendiente: `Pendiente. Se envía a ${alta.correo} un enlace de un solo uso, vigente 7 días, para confirmar que el correo pertenece a quien firma. Al confirmarlo se emite la versión final de este documento.`,
    enlace: `Correo confirmado el ${conf.fechaTexto || "—"}, con el enlace de un solo uso enviado a ${alta.correo}.`,
    google: `Correo verificado por Google: quien firma inició sesión con la cuenta de Google ${alta.correo}, que Google reporta como verificada. Quedó confirmado al momento de firmar.`,
  }[conf.estado] || "—";

  titulo("Quién firmó");
  filas([
    ["Folio", alta.folio],
    ["Nombre de quien firma", firmante.nombre],
    ["Cargo", firmante.cargo || "—"],
    ["Empresa", alta.razonSocial || alta.empresa],
    ["Correo electrónico", alta.correo],
    ["Confirmación del correo", textoConfirmacion],
    ["Origen", evidencia.origen === "google" ? "Registro con Google en morcast.mx/portal/registro" : "Formulario público en morcast.mx/portal/alta"],
  ]);

  titulo("Cuándo y desde dónde");
  filas([
    ["Fecha y hora de la firma", evidencia.fechaTexto],
    ["Fecha y hora (UTC)", evidencia.fechaIso],
    ["Dirección IP", evidencia.ip],
    ["Navegador (user-agent)", evidencia.navegador],
    ...(conf.estado === "enlace"
      ? [["IP de la confirmación", conf.ip], ["Navegador de la confirmación", conf.navegador]]
      : []),
  ]);

  titulo("Qué se aceptó");
  filas([
    ["Términos del servicio", `Versión ${evidencia.terminosVersion} (texto completo en el anexo)`],
    ["Aviso de privacidad", `Versión ${evidencia.avisoVersion} · morcast.mx/aviso-de-privacidad`],
    ["Aceptación", "Casilla \"He leído y acepto\" marcada por quien firma antes de firmar"],
  ]);

  titulo("Huellas SHA-256");
  filas([
    ["Contenido firmado", evidencia.contenidoHuella],
    ["Imagen de la firma", evidencia.firmaHuella],
    ["Términos (texto)", evidencia.terminosHuella],
    ["Constancia fiscal", evidencia.constancia?.sha256 || "No se adjuntó"],
    ...(evidencia.pdfInicialHuella ? [["PDF firmado original", evidencia.pdfInicialHuella]] : []),
  ], { mono: true });
  y += 4;
  parrafo(
    "La huella de este mismo archivo PDF no se puede imprimir dentro de él (cambiaría al escribirla): queda guardada en el " +
    "registro de Morcast del Norte junto con el folio" +
    (evidencia.pdfInicialHuella ? ". La huella del PDF firmado original, emitido antes de confirmar el correo, aparece arriba." : "."),
    { tam: 8, color: GRIS, interlineado: 10.5 }
  );

  /* ---------------- pie en todas las hojas ---------------- */

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINEA);
    doc.line(M, H - 50, W - M, H - 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(`${emisor.razonSocial} · ${emisor.domicilioLinea}`, M, H - 37);
    doc.text(`Huella del contenido: ${evidencia.contenidoHuella.slice(0, 16)}…`, M, H - 27);
    doc.text(`${alta.folio} · Hoja ${i} de ${total}`, W - M, H - 37, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
