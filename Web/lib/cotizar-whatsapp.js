/**
 * COTIZAR POR WHATSAPP — el cuestionario de /cotizar.
 *
 * Lo pidió el dueño de Morcast (14-sep-2026): a cada cliente que escribía por
 * WhatsApp había que sacarle los datos uno por uno, y eso les quitaba tiempo a
 * los dos. Aquí se llenan una sola vez y salen ORDENADOS en el mensaje.
 *
 * A propósito NO se guarda nada en la base ni se manda correo (decisión de
 * Luis): el propio cliente envía el mensaje desde su WhatsApp, y su número
 * llega con él. Por eso tampoco se pide teléfono.
 *
 * Todo lo de este archivo es lógica pura, sin React, para poder probarla sola.
 */
import { enlaceWhatsApp } from "./datos";

/** Los nombres de la página (TIPOS_SERVICIO), sin los que son servicios y no residuos. */
export const TIPOS_RESIDUO = [
  "Residuos Sólidos Urbanos (RSU)",
  "Residuos de Manejo Especial",
  "Residuos Peligrosos",
  "Aguas residuales",
  "Aguas oleosas",
  "Aguas peligrosas",
  "Reciclables (cartón, metal, plástico…)",
  "Otro",
];

/** `corto` va en la lista (en un teléfono "toneladas" no cabe); el mensaje usa la palabra completa. */
export const UNIDADES = [
  { id: "kg", corto: "kg", uno: "kg", varios: "kg" },
  { id: "toneladas", corto: "ton", uno: "tonelada", varios: "toneladas" },
  { id: "litros", corto: "litros", uno: "litro", varios: "litros" },
  { id: "m3", corto: "m³", uno: "m³", varios: "m³" },
];

/** `texto` es lo que se elige en la lista; `frase`, como se lee en el mensaje. */
export const EMBALAJES = [
  { texto: "Contenedor o tolva", frase: "en contenedor o tolva" },
  { texto: "Tambos", frase: "en tambos" },
  { texto: "Porrones o cubetas", frase: "en porrones o cubetas" },
  { texto: "Costales o bolsas", frase: "en costales o bolsas" },
  { texto: "Pacas", frase: "en pacas" },
  { texto: "Tarimas", frase: "en tarimas" },
  { texto: "A granel (suelto)", frase: "a granel" },
  { texto: "Pipa (líquidos)", frase: "en pipa" },
  { texto: "Otro", frase: "" },
];

export const OTRO = "Otro";
export const MAX_RESIDUOS = 5;

/** Topes de largo: mantienen el enlace (y su código QR) en un tamaño que se lea. */
export const LARGO = { empresa: 80, nombre: 60, puesto: 60, ciudad: 80, otro: 40, cantidad: 12 };

/**
 * Un renglón de residuo en blanco. El `id` es la `key` de React (el índice
 * cambiaría al quitar uno) y lo pone el componente: un contador a nivel de
 * módulo seguiría subiendo entre visitas en el servidor y no cuadraría con el
 * del navegador al hidratar.
 */
export function residuoVacio(id) {
  return { id, tipo: "", tipoOtro: "", cantidad: "", unidad: "kg", embalaje: "", embalajeOtro: "" };
}

/**
 * Deja el texto en un solo renglón y sin los caracteres con los que WhatsApp
 * da formato (`*negrita*`, `_cursiva_`, `~tachado~`, código): una empresa
 * llamada "*ABC*" rompería las negritas del mensaje.
 */
export function limpiar(texto) {
  return String(texto ?? "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lee la cantidad como la escribe la gente en México: "1500", "1,500",
 * "1,500.5" o "2,5". Devuelve `NaN` si no es un número mayor que cero.
 */
export function leerCantidad(valor) {
  let s = limpiar(valor).replace(/\s/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ""); // 1,500 · 1,500.5
  else if (/^\d+,\d+$/.test(s)) s = s.replace(",", "."); // 2,5
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  const n = Number(s);
  return n > 0 ? n : NaN;
}

function formatoCantidad(n) {
  return n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

function nombreUnidad(id, n) {
  const u = UNIDADES.find((x) => x.id === id) || UNIDADES[0];
  return n === 1 ? u.uno : u.varios;
}

function fraseEmbalaje(r) {
  if (r.embalaje !== OTRO) return EMBALAJES.find((e) => e.texto === r.embalaje)?.frase || "";
  const otro = limpiar(r.embalajeOtro);
  // "cajas" → "en cajas"; pero si ya dice "en…" o "a…" se deja como viene.
  return /^(en|a)\s/i.test(otro) ? otro : `en ${otro}`;
}

/**
 * Revisa el cuestionario. Las llaves de `errores` son los `id` de los campos,
 * para poder llevar el foco al primero que falte.
 */
export function validar({ residuos, empresa, nombre, puesto, ciudad }) {
  const errores = {};

  residuos.forEach((r) => {
    const pre = `residuo-${r.id}`;
    if (!r.tipo) errores[`${pre}-tipo`] = "Elige el tipo de residuo.";
    else if (r.tipo === OTRO && !limpiar(r.tipoOtro)) errores[`${pre}-tipo-otro`] = "Escribe qué residuo es.";
    if (!limpiar(r.cantidad)) errores[`${pre}-cantidad`] = "Escribe una cantidad aproximada.";
    else if (Number.isNaN(leerCantidad(r.cantidad))) errores[`${pre}-cantidad`] = "Escribe solo el número, por ejemplo 500.";
    if (!r.embalaje) errores[`${pre}-embalaje`] = "Elige cómo lo tienen.";
    else if (r.embalaje === OTRO && !limpiar(r.embalajeOtro)) errores[`${pre}-embalaje-otro`] = "Escribe cómo lo tienen.";
  });

  if (!limpiar(empresa)) errores.empresa = "Escribe el nombre de la empresa.";
  if (!limpiar(ciudad)) errores.ciudad = "Escribe la ciudad o la colonia.";
  if (!limpiar(nombre)) errores.nombre = "Escribe tu nombre.";
  if (!limpiar(puesto)) errores.puesto = "Escribe tu puesto.";

  return { ok: Object.keys(errores).length === 0, errores };
}

/**
 * El mensaje tal como le llega a Morcast. Las etiquetas van en *negrita* para
 * que el dueño encuentre cada dato de un vistazo.
 */
export function armarMensaje({ residuos, empresa, nombre, puesto, ciudad }) {
  const lineas = residuos.map((r, i) => {
    const tipo = r.tipo === OTRO ? limpiar(r.tipoOtro) : r.tipo;
    const n = leerCantidad(r.cantidad);
    return `${i + 1}. ${tipo}: ${formatoCantidad(n)} ${nombreUnidad(r.unidad, n)} al mes, ${fraseEmbalaje(r)}`;
  });

  return [
    "Hola, quiero cotizar el servicio de recolección de residuos.",
    "",
    `*Empresa:* ${limpiar(empresa)}`,
    `*Solicita:* ${limpiar(nombre)}, ${limpiar(puesto)}`,
    `*Ciudad o colonia:* ${limpiar(ciudad)}`,
    "",
    "*Residuos:*",
    ...lineas,
  ].join("\n");
}

/** El enlace que abre el chat de Morcast con el mensaje ya escrito. */
export function enlaceCotizacion(datos) {
  return enlaceWhatsApp(armarMensaje(datos));
}

/**
 * El dibujo del código QR como un solo trazo SVG: cada tramo de módulos
 * negros seguidos de un renglón es un rectángulo. Recibe la matriz de `uqr`.
 */
export function trazoQR(matriz) {
  let d = "";
  matriz.forEach((fila, y) => {
    let x = 0;
    while (x < fila.length) {
      if (!fila[x]) { x++; continue; }
      let fin = x;
      while (fin < fila.length && fila[fin]) fin++;
      d += `M${x} ${y}h${fin - x}v1h${x - fin}z`;
      x = fin;
    }
  });
  return d;
}
