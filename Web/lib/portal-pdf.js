/**
 * Generación de PDFs del portal (cliente, en el navegador con jsPDF).
 * Documentos: manifiesto de residuos, constancia de situación fiscal,
 * cotización y exportación de reportes.
 *
 * Los datos duros del emisor vienen de `cotizacion-datos.js` (fuente única).
 * Lo que el cliente todavía no entrega (RFC, datos bancarios) se imprime como
 * "Pendiente de confirmar" — NUNCA inventado, porque estos PDF van a terceros.
 */

import { pesos, fechaLarga, IVA } from "@/lib/portal-datos";
import {
  EMPRESA_COTIZACION,
  CONDICIONES_COMERCIALES,
  DATOS_TRANSFERENCIA,
} from "@/lib/cotizacion-datos";

const PENDIENTE = "Pendiente de confirmar";

/** Datos fiscales de Morcast (emisor), derivados de la fuente única. */
export const MORCAST_FISCAL = {
  razonSocial: EMPRESA_COTIZACION.razonSocial.toUpperCase(),
  representanteLegal: EMPRESA_COTIZACION.representanteLegal,
  // PENDIENTE: falta la constancia de situación fiscal del cliente.
  rfc: EMPRESA_COTIZACION.rfc || PENDIENTE,
  regimen: "601 — General de Ley Personas Morales",
  domicilio: EMPRESA_COTIZACION.domicilioLinea,
  codigoPostal: EMPRESA_COTIZACION.domicilio.cp,
  telefonos: EMPRESA_COTIZACION.telefonos.join(" · "),
  correo: EMPRESA_COTIZACION.correos[0],
  actividad: "Manejo de residuos y servicios de remediación",
};

const VERDE = [78, 179, 74];
const TEAL = [20, 76, 79];
const TINTA = [26, 34, 33];
const GRIS = [110, 122, 120];

async function nuevoDoc() {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "pt", format: "letter" });
}

/** Encabezado de marca. Devuelve la Y donde continuar. */
function encabezado(doc, titulo, folio) {
  const W = doc.internal.pageSize.getWidth();
  // Banda superior
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, W, 74, "F");
  doc.setFillColor(...VERDE);
  doc.rect(0, 74, W, 4, "F");

  // Logotipo textual
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("MORCAST", 40, 38);
  doc.setTextColor(...VERDE);
  doc.setFontSize(20);
  doc.text("DEL NORTE", 148, 38);
  doc.setTextColor(210, 224, 222);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("MANEJO INTEGRAL DE RESIDUOS", 41, 54);

  // Bloque de contacto a la derecha
  doc.setFontSize(8);
  doc.setTextColor(220, 232, 230);
  doc.text(
    [MORCAST_FISCAL.telefonos, MORCAST_FISCAL.correo, "morcast.mx"],
    W - 40,
    28,
    { align: "right" }
  );

  // Título del documento
  doc.setTextColor(...TINTA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(titulo, 40, 110);
  if (folio) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GRIS);
    doc.text(`Folio: ${folio}`, W - 40, 110, { align: "right" });
  }
  doc.setDrawColor(225, 230, 229);
  doc.line(40, 122, W - 40, 122);
  return 148;
}

function pie(doc, nota) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(225, 230, 229);
  doc.line(40, H - 54, W - 40, H - 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.text(
    nota || "Documento generado por el Portal de Clientes de Morcast del Norte.",
    40,
    H - 40
  );
  doc.text(MORCAST_FISCAL.domicilio, 40, H - 30);
  const hoy = new Date();
  doc.text(
    `Emitido: ${hoy.toLocaleDateString("es-MX")} ${hoy.toLocaleTimeString("es-MX")}`,
    W - 40,
    H - 40,
    { align: "right" }
  );
}

/** Bloque etiqueta/valor. `ancho` = ancho total del bloque (etiqueta + valor). */
function bloqueDatos(doc, x, y, titulo, filas, ancho = 250) {
  const OFFSET_VALOR = 92; // separación etiqueta → valor
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...VERDE);
  doc.text(titulo.toUpperCase(), x, y);
  y += 16;
  doc.setFontSize(9.5);
  filas.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRIS);
    doc.text(`${k}:`, x, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TINTA);
    // El valor arranca en x+OFFSET_VALOR, así que se ajusta al espacio
    // restante DENTRO del bloque para no invadir la columna vecina.
    const lineas = doc.splitTextToSize(String(v), ancho - OFFSET_VALOR - 6);
    doc.text(lineas, x + OFFSET_VALOR, y);
    y += 14 * lineas.length;
  });
  return y;
}

/** Bloque de viñetas con título. Devuelve la Y donde termina. */
function bloqueLista(doc, x, y, titulo, puntos, ancho = 250) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...VERDE);
  doc.text(titulo.toUpperCase(), x, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA);
  puntos.forEach((p) => {
    const lineas = doc.splitTextToSize(String(p), ancho - 12);
    doc.text("•", x, y);
    doc.text(lineas, x + 12, y);
    y += 12 * lineas.length + 2;
  });
  return y;
}

/* ============================ MANIFIESTO ============================ */

export async function descargarManifiesto(servicio, cliente) {
  const doc = await nuevoDoc();
  const autoTable = (await import("jspdf-autotable")).default;
  const W = doc.internal.pageSize.getWidth();
  let y = encabezado(doc, "Manifiesto de manejo de residuos", servicio.manifiesto);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text(
    "Comprobante del protocolo de recolección, transporte y disposición final de residuos.",
    40,
    y
  );
  y += 22;

  const yA = bloqueDatos(doc, 40, y, "Generador", [
    ["Empresa", cliente.empresa],
    ["RFC", cliente.rfc],
    ["Domicilio", cliente.domicilio],
    ["Contrato", cliente.id],
  ]);
  const yB = bloqueDatos(doc, W / 2 + 10, y, "Prestador de servicio", [
    ["Empresa", "Morcast del Norte, S.A. de C.V."],
    ["RFC", MORCAST_FISCAL.rfc],
    ["Unidad", servicio.unidad],
    ["Operador", servicio.operador],
  ], 230);
  y = Math.max(yA, yB) + 12;

  autoTable(doc, {
    startY: y,
    head: [["Fecha", "Tipo de residuo", "Descripción", "Contenedor", "Volumen", "Peso"]],
    body: [[
      fechaLarga(servicio.fecha),
      servicio.tipo,
      servicio.residuo,
      servicio.contenedor,
      servicio.volumen,
      servicio.peso,
    ]],
    theme: "grid",
    headStyles: { fillColor: TEAL, textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: TINTA },
    styles: { cellPadding: 6, lineColor: [225, 230, 229] },
    margin: { left: 40, right: 40 },
  });
  y = doc.lastAutoTable.finalY + 30;

  // Declaración + firmas
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  const decl = doc.splitTextToSize(
    "El generador declara que los residuos entregados corresponden a la descripción anterior. El prestador de servicio confirma su recolección, transporte y disposición final conforme a la normatividad ambiental aplicable (permiso municipal RSU, registro estatal SEDUMA y, para residuos peligrosos, tercero autorizado).",
    W - 80
  );
  doc.text(decl, 40, y);
  y += decl.length * 11 + 44;

  doc.setDrawColor(...GRIS);
  doc.line(60, y, 240, y);
  doc.line(W - 240, y, W - 60, y);
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA);
  doc.text("Firma del generador", 150, y + 14, { align: "center" });
  doc.text("Firma del prestador de servicio", W - 150, y + 14, { align: "center" });

  pie(doc, "Manifiesto de demostración generado por el Portal de Clientes de Morcast del Norte.");
  doc.save(`Manifiesto_${servicio.manifiesto}.pdf`);
}

/* ======================= CONSTANCIA FISCAL ========================= */

export async function descargarConstanciaFiscal() {
  const doc = await nuevoDoc();
  const W = doc.internal.pageSize.getWidth();
  let y = encabezado(doc, "Constancia de Situación Fiscal", MORCAST_FISCAL.rfc);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text(
    "Datos fiscales del prestador de servicio para efectos de facturación.",
    40,
    y
  );
  y += 24;

  y = bloqueDatos(doc, 40, y, "Datos de identificación", [
    ["Razón social", MORCAST_FISCAL.razonSocial],
    ["RFC", MORCAST_FISCAL.rfc],
    ["Régimen fiscal", MORCAST_FISCAL.regimen],
    ["Actividad económica", MORCAST_FISCAL.actividad],
  ], W - 200) + 10;

  y = bloqueDatos(doc, 40, y, "Domicilio fiscal", [
    ["Domicilio", MORCAST_FISCAL.domicilio],
    ["Código postal", MORCAST_FISCAL.codigoPostal],
    ["Teléfonos", MORCAST_FISCAL.telefonos],
    ["Correo", MORCAST_FISCAL.correo],
  ], W - 200) + 20;

  doc.setFillColor(244, 249, 247);
  doc.rect(40, y, W - 80, 54, "F");
  doc.setFillColor(...VERDE);
  doc.rect(40, y, 4, 54, "F");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.text(
    doc.splitTextToSize(
      "Esta constancia reproduce los datos fiscales registrados para la emisión de comprobantes fiscales (CFDI). Documento de demostración; para trámites oficiales, solicite la Constancia de Situación Fiscal emitida por el SAT.",
      W - 110
    ),
    54,
    y + 18
  );

  pie(doc, "Constancia de demostración generada por el Portal de Clientes de Morcast del Norte.");
  doc.save(`Constancia_Fiscal_Morcast.pdf`);
}

/* =========================== COTIZACIÓN ============================ */

export async function descargarCotizacion(cotizacion, cliente) {
  const doc = await nuevoDoc();
  const autoTable = (await import("jspdf-autotable")).default;
  const W = doc.internal.pageSize.getWidth();
  const folio = `COT-${new Date().getFullYear()}-${String(
    Math.floor((Date.now() % 100000) / 10)
  ).padStart(4, "0")}`;
  let y = encabezado(doc, "Cotización de servicios", folio);

  const yA = bloqueDatos(doc, 40, y, "Cliente", [
    ["Empresa", cliente.empresa],
    ["RFC", cliente.rfc],
    ["Contacto", cliente.contacto],
    ["Contrato", cliente.id],
  ]);
  const yB = bloqueDatos(doc, W / 2 + 10, y, "Vigencia", [
    ["Emitida", fechaLarga(new Date().toISOString().slice(0, 10))],
    ["Válida", `${CONDICIONES_COMERCIALES.diasVigencia} días naturales`],
    ["Crédito", `${CONDICIONES_COMERCIALES.diasCredito} días`],
    ["Moneda", "MXN"],
  ], 230);
  y = Math.max(yA, yB) + 14;

  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Unidad", "Cant.", "P. unitario", "Importe"]],
    body: cotizacion.items.map((it) => [
      it.servicio,
      it.unidad,
      String(it.cantidad),
      pesos(it.precio),
      pesos(it.precio * it.cantidad),
    ]),
    theme: "striped",
    headStyles: { fillColor: TEAL, textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: TINTA },
    styles: { cellPadding: 6, lineColor: [225, 230, 229] },
    columnStyles: {
      2: { halign: "center" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });
  y = doc.lastAutoTable.finalY + 16;

  // Totales
  const x = W - 220;
  const fila = (label, val, bold) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...(bold ? TINTA : GRIS));
    doc.setFontSize(bold ? 11 : 9.5);
    doc.text(label, x, y);
    doc.setTextColor(...TINTA);
    doc.text(val, W - 40, y, { align: "right" });
    y += bold ? 20 : 16;
  };
  fila("Subtotal", pesos(cotizacion.subtotal));
  fila(`IVA (${IVA * 100}%)`, pesos(cotizacion.iva));
  doc.setDrawColor(225, 230, 229);
  doc.line(x, y - 6, W - 40, y - 6);
  fila("Total", pesos(cotizacion.total), true);

  y += 14;

  // Condiciones comerciales (columna izquierda) y datos para transferencia
  // (columna derecha), a la misma altura.
  const yCond = bloqueLista(
    doc,
    40,
    y,
    "Condiciones comerciales",
    CONDICIONES_COMERCIALES.lista,
    W / 2 - 60
  );

  const t = DATOS_TRANSFERENCIA;
  const val = (v) => (t.pendiente || !v ? t.leyendaPendiente : v);
  const yBanco = bloqueDatos(doc, W / 2 + 10, y, "Datos para transferencia", [
    ["Beneficiario", t.beneficiario],
    ["Banco", val(t.banco)],
    ["CLABE", val(t.clabe)],
    ["Cuenta", val(t.cuenta)],
  ], 230);
  y = Math.max(yCond, yBanco) + 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.text(
    doc.splitTextToSize(
      "Precios de referencia sujetos a confirmación según volumen, frecuencia y condiciones del sitio. Permisos vigentes y manifiesto incluido en cada servicio.",
      W - 80
    ),
    40,
    y
  );

  pie(doc, `Representante legal: ${EMPRESA_COTIZACION.representanteLegal}.`);
  doc.save(`${folio}.pdf`);
}

/* ====================== EXPORTAR REPORTE =========================== */

export async function descargarReportePDF(titulo, filas, cliente, totales) {
  const doc = await nuevoDoc();
  const autoTable = (await import("jspdf-autotable")).default;
  const W = doc.internal.pageSize.getWidth();
  let y = encabezado(doc, titulo, cliente.id);

  bloqueDatos(doc, 40, y, "Cliente", [
    ["Empresa", cliente.empresa],
    ["RFC", cliente.rfc],
  ], W - 200);
  y += 60;

  autoTable(doc, {
    startY: y,
    head: [["Periodo", "Volumen (m³)", "Monto"]],
    body: filas.map((f) => [f.periodo, f.volumen.toLocaleString("es-MX"), pesos(f.monto)]),
    foot: totales
      ? [["Total", totales.volumen.toLocaleString("es-MX"), pesos(totales.monto)]]
      : undefined,
    theme: "striped",
    headStyles: { fillColor: TEAL, textColor: 255, fontSize: 9 },
    footStyles: { fillColor: [244, 249, 247], textColor: TINTA, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: TINTA },
    styles: { cellPadding: 6, lineColor: [225, 230, 229] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  pie(doc, "Reporte de demostración generado por el Portal de Clientes de Morcast del Norte.");
  doc.save(`${titulo.replace(/\s+/g, "_")}.pdf`);
}

/* ================= REPORTE DEL NEGOCIO (ADMIN) ==================== */

export async function descargarReporteNegocio(titulo, filas, total) {
  const doc = await nuevoDoc();
  const autoTable = (await import("jspdf-autotable")).default;
  const W = doc.internal.pageSize.getWidth();
  let y = encabezado(doc, titulo, "Reporte interno");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text("Resumen de ingresos del negocio por periodo.", 40, y);
  y += 22;

  autoTable(doc, {
    startY: y,
    head: [["Periodo", "Ingresos"]],
    body: filas.map((f) => [f.periodo, pesos(f.monto)]),
    foot: total != null ? [["Total", pesos(total)]] : undefined,
    theme: "striped",
    headStyles: { fillColor: TEAL, textColor: 255, fontSize: 9 },
    footStyles: { fillColor: [244, 249, 247], textColor: TINTA, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: TINTA },
    styles: { cellPadding: 6, lineColor: [225, 230, 229] },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  pie(doc, "Reporte de demostración generado por el Panel de Administración de Morcast del Norte.");
  doc.save(`${titulo.replace(/\s+/g, "_")}.pdf`);
}
