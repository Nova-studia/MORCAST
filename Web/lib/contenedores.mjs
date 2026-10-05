/**
 * INVENTARIO DE CONTENEDORES — la lógica pura (sin React ni Supabase).
 *
 * Pedido de los dueños (4-oct-2026): van a hacer el inventario de cada
 * contenedor y pegarle un QR que el chofer escanea al recoger. La app ya lee
 * códigos con el formato `MOR-C-0421`, así que ese formato manda aquí: si la
 * web aceptara "MOR-C-421" o "mor-c-0421" tal cual, el mismo contenedor
 * podría quedar dos veces en la base y el QR de uno no encontraría al otro.
 * Todo lo que entra (alta, lote, Excel) pasa por `normalizarCodigo()`.
 *
 * Va en .mjs y sin dependencias de la web para que `node --test` lo importe
 * directo (tests/contenedores.test.mjs). La única dependencia es `uqr`, que
 * genera el QR y también corre en Node.
 */

import { encode } from "uqr";

export const PREFIJO = "MOR-C-";
const DIGITOS = 4;
const MAXIMO = 10 ** DIGITOS - 1; // MOR-C-9999

/**
 * Tope de un lote o de un pegado de Excel. No es un límite de la base: es
 * para que un dedazo ("del 1 al 90000") no cree noventa mil filas que luego
 * hay que borrar una por una. El inventario completo cabe en dos o tres
 * tandas de este tamaño.
 */
export const MAX_LOTE = 500;

/**
 * Tope de renglones al pegar desde Excel. Más alto que el del lote porque
 * aquí sí puede venir el inventario completo, y cada renglón ya se revisó
 * a ojo en la vista previa antes de guardar.
 */
export const MAX_IMPORTAR = 2000;

/** Estados de la 023, con la insignia que les toca (`.pt-badge.<clase>`). */
export const ESTADOS_CONTENEDOR = [
  { id: "en-servicio", texto: "En servicio", clase: "ok" },
  { id: "en-bodega", texto: "En bodega", clase: "prog" },
  { id: "danado", texto: "Dañado", clase: "alerta" },
  { id: "perdido", texto: "Perdido", clase: "mal" },
  { id: "baja", texto: "Baja", clase: "" },
];

/**
 * Sugerencias, no catálogo cerrado: en la base `tipo` y `medida` son texto
 * libre (db/023) para que la empresa pueda anotar un "tambo de 200 L" sin
 * esperar una migración. Las medidas salen del equipo que ya renta
 * (lib/cotizacion-datos.js, EQUIPO_RENTA).
 */
export const TIPOS_CONTENEDOR = ["contenedor", "tolva", "compactador", "tambo", "otro"];
export const MEDIDAS_SUGERIDAS = ["1.5 m³", "3 m³", "6 m³", "21 m³", "30 m³"];

const LIMITES = { tipo: 40, medida: 20, notas: 500 };

export function etiquetaEstado(id) {
  return ESTADOS_CONTENEDOR.find((e) => e.id === id) || { id, texto: id || "—", clase: "" };
}

/* ------------------------------------------------------------------ */
/* El código                                                           */
/* ------------------------------------------------------------------ */

/** Número → "MOR-C-0001". `null` si se sale de 1…9999. */
export function codigoDeNumero(n) {
  const num = Number(n);
  if (!Number.isInteger(num) || num < 1 || num > MAXIMO) return null;
  return `${PREFIJO}${String(num).padStart(DIGITOS, "0")}`;
}

/** "MOR-C-0421" → 421. `null` si no es un código bien formado. */
export function numeroDeCodigo(codigo) {
  const m = /^MOR-C-(\d{4})$/.exec(String(codigo ?? ""));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? n : null;
}

/** ¿Es exactamente el formato que lee la app? (MOR-C-0000 no vale.) */
export function esCodigoValido(codigo) {
  return numeroDeCodigo(codigo) !== null;
}

/**
 * Lleva lo que teclea o pega una persona al formato canónico.
 *
 * Acepta las variantes que de verdad aparecen al capturar a mano o en Excel:
 * minúsculas, espacios, sin guiones, sin ceros a la izquierda ("mor c 421",
 * "MORC0421", "MOR-C-421") y el número suelto ("421", "0421"). Lo que no se
 * parece a un código devuelve `null`: mejor rechazar que adivinar.
 */
export function normalizarCodigo(texto) {
  const limpio = String(texto ?? "").trim().toUpperCase();
  if (!limpio) return null;
  const m = /^(?:MOR[\s-]*C[\s-]*)?(\d{1,4})$/.exec(limpio);
  if (!m) return null;
  return codigoDeNumero(Number(m[1]));
}

/**
 * Los códigos de un rango, ambos extremos incluidos. Acepta códigos o
 * números ("MOR-C-0001" o 1). Devuelve `{ ok, codigos }` o `{ ok:false, motivo }`.
 */
export function rangoCodigos(desde, hasta) {
  const a = numeroDeCodigo(normalizarCodigo(desde));
  const b = numeroDeCodigo(normalizarCodigo(hasta));
  if (a === null || b === null) {
    return { ok: false, motivo: "Escribe los dos códigos con el formato MOR-C-0001 (o solo el número)." };
  }
  if (b < a) {
    return { ok: false, motivo: "El código final tiene que ser mayor o igual que el inicial." };
  }
  const cantidad = b - a + 1;
  if (cantidad > MAX_LOTE) {
    return { ok: false, motivo: `Son ${cantidad} contenedores; el máximo por lote es ${MAX_LOTE}. Divídelo en tandas.` };
  }
  const codigos = [];
  for (let n = a; n <= b; n++) codigos.push(codigoDeNumero(n));
  return { ok: true, codigos };
}

/**
 * Qué se crearía de un rango y qué se salta porque ya existe. Los que ya
 * existen NO se tocan: su tipo, punto y notas pueden ser de otro inventario
 * y pisarlos en silencio sería perder datos.
 */
export function planLote(desde, hasta, existentes = []) {
  const r = rangoCodigos(desde, hasta);
  if (!r.ok) return r;
  const ya = new Set(existentes);
  return {
    ok: true,
    crear: r.codigos.filter((c) => !ya.has(c)),
    yaExisten: r.codigos.filter((c) => ya.has(c)),
  };
}

/**
 * El siguiente código después del más alto que exista.
 *
 * NO rellena huecos a propósito: si el MOR-C-0007 se borró, su etiqueta puede
 * seguir pegada en algún contenedor o en un cajón. Reusar el número haría que
 * dos contenedores físicos respondieran al mismo QR. Mismo criterio que los
 * folios de `rutas-datos.js`: por el máximo, nunca por la cantidad.
 */
export function siguienteCodigoLibre(existentes = []) {
  const nums = existentes.map(numeroDeCodigo).filter((n) => n !== null);
  return codigoDeNumero((nums.length ? Math.max(...nums) : 0) + 1);
}

/* ------------------------------------------------------------------ */
/* Validación de un contenedor                                         */
/* ------------------------------------------------------------------ */

/**
 * Revisa y limpia lo que se va a guardar. Devuelve `{ ok, datos }` con los
 * valores ya normalizados, o `{ ok:false, errores }` con un texto por campo
 * para pintarlo junto al campo que falla.
 */
export function validarContenedor(entrada = {}) {
  const errores = {};
  const codigo = normalizarCodigo(entrada.codigo);
  if (!codigo) errores.codigo = "El código va con el formato MOR-C-0001.";

  const tipo = String(entrada.tipo ?? "").trim().toLowerCase();
  if (!tipo) errores.tipo = "Falta el tipo (contenedor, tolva…).";
  else if (tipo.length > LIMITES.tipo) errores.tipo = `Máximo ${LIMITES.tipo} letras.`;

  const medida = String(entrada.medida ?? "").trim();
  if (medida.length > LIMITES.medida) errores.medida = `Máximo ${LIMITES.medida} letras.`;

  const estado = entrada.estado || "en-servicio";
  if (!ESTADOS_CONTENEDOR.some((e) => e.id === estado)) errores.estado = "Estado desconocido.";

  const notas = String(entrada.notas ?? "").trim();
  if (notas.length > LIMITES.notas) errores.notas = `Máximo ${LIMITES.notas} letras.`;

  if (Object.keys(errores).length) return { ok: false, errores };
  return {
    ok: true,
    datos: {
      codigo,
      tipo,
      medida: medida || null,
      estado,
      domicilio_id: entrada.domicilio_id || null,
      notas: notas || null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Importar desde Excel                                                */
/* ------------------------------------------------------------------ */

/** Minúsculas, sin acentos, sin puntuación ni "S.A. de C.V.": para comparar nombres. */
export function normalizarNombre(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(s\s*a\s*p?\s*i?\s*de\s*c\s*v|s\s*de\s*r\s*l\s*de\s*c\s*v|s\s*a|s\s*c)\b/g, " ")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lo pegado desde Excel → filas. Excel copia con TABULADOR entre columnas;
 * si no viene ningún tabulador (p. ej. lo pegaron de un CSV) se acepta `;` o
 * `,`. El orden de columnas es fijo: código, tipo, medida, empresa, punto.
 *
 * El renglón de títulos se reconoce y se brinca solo: la gente copia la
 * tabla completa, con encabezados, y no tiene por qué saber que estorban.
 */
export function parsearPegado(texto) {
  const renglones = String(texto ?? "").replace(/\r\n?/g, "\n").split("\n");
  const conTab = renglones.some((r) => r.includes("\t"));
  const sep = conTab ? "\t" : renglones.some((r) => r.includes(";")) ? ";" : ",";

  const filas = [];
  renglones.forEach((r, i) => {
    if (!r.trim()) return;
    const c = r.split(sep).map((x) => x.trim());
    const primera = normalizarNombre(c[0]);
    if (filas.length === 0 && !normalizarCodigo(c[0]) && /^(codigo|clave|id|folio|qr)\b/.test(primera)) return;
    filas.push({
      linea: i + 1,
      original: c[0] || "",
      codigo: normalizarCodigo(c[0]),
      tipo: c[1] || "",
      medida: c[2] || "",
      empresa: c[3] || "",
      punto: c[4] || "",
    });
  });
  return filas;
}

/**
 * Busca la empresa por nombre. Primero igual (ya normalizado); si no, la
 * ÚNICA que contenga lo escrito o que esté contenida en ello ("Vidriera" →
 * "Vidriera Matamoros"). Si casan dos o más, no se elige ninguna: asignar un
 * contenedor a la empresa equivocada es peor que dejarlo sin asignar.
 */
export function buscarCliente(nombre, clientes = []) {
  const n = normalizarNombre(nombre);
  if (!n) return { cliente: null, motivo: null };
  const exactos = clientes.filter((c) => normalizarNombre(c.empresa) === n);
  if (exactos.length === 1) return { cliente: exactos[0] };
  const parecidos = clientes.filter((c) => {
    const e = normalizarNombre(c.empresa);
    return e && (e.includes(n) || n.includes(e));
  });
  if (parecidos.length === 1) return { cliente: parecidos[0] };
  if (parecidos.length > 1 || exactos.length > 1) {
    return { cliente: null, motivo: `«${nombre}» se parece a ${parecidos.length || exactos.length} clientes; queda sin asignar.` };
  }
  return { cliente: null, motivo: `No hay ningún cliente «${nombre}»; queda sin asignar.` };
}

/**
 * La vista previa de una importación: qué pasa con cada renglón ANTES de
 * guardar nada.
 *
 *   nuevo       se crea (con o sin punto asignado; `aviso` dice por qué no)
 *   ya-existe   el código ya está en la base: se salta, no se pisa
 *   repetido    el código sale dos veces en lo pegado: vale el primero
 *   error       no se puede guardar (código mal escrito, sin tipo…)
 *
 * `clientes` = [{ id, empresa, puntos: [{ id, alias }] }].
 */
export function validarImportacion(filas, { existentes = [], clientes = [] } = {}) {
  const ya = new Set(existentes);
  const vistos = new Set();
  const resultado = filas.map((f) => {
    const base = { ...f, domicilio_id: null, cliente: null, puntoAlias: null, aviso: null };
    if (!f.codigo) {
      return { ...base, estado: "error", aviso: `«${f.original}» no es un código válido (MOR-C-0001).` };
    }
    if (vistos.has(f.codigo)) return { ...base, estado: "repetido", aviso: "Ya venía más arriba en lo pegado." };
    vistos.add(f.codigo);
    if (ya.has(f.codigo)) return { ...base, estado: "ya-existe", aviso: "Se salta: no se cambia nada de lo que ya tiene." };

    const v = validarContenedor({ codigo: f.codigo, tipo: f.tipo || "contenedor", medida: f.medida });
    if (!v.ok) return { ...base, estado: "error", aviso: Object.values(v.errores).join(" ") };

    const fila = { ...base, tipo: v.datos.tipo, medida: v.datos.medida || "", estado: "nuevo" };
    if (!f.empresa && !f.punto) return fila;

    const { cliente, motivo } = buscarCliente(f.empresa, clientes);
    if (!cliente) {
      return { ...fila, aviso: motivo || "Trae punto pero no empresa; queda sin asignar." };
    }
    const puntos = cliente.puntos || [];
    let punto = null;
    if (f.punto) {
      const p = normalizarNombre(f.punto);
      const iguales = puntos.filter((x) => normalizarNombre(x.alias) === p);
      punto = iguales.length === 1 ? iguales[0] : null;
      if (!punto) {
        return { ...fila, cliente: cliente.empresa, aviso: `${cliente.empresa} no tiene un punto «${f.punto}»; queda sin asignar.` };
      }
    } else if (puntos.length === 1) {
      // Sin punto escrito pero la empresa tiene uno solo: no hay duda posible.
      punto = puntos[0];
    } else {
      return {
        ...fila,
        cliente: cliente.empresa,
        aviso: puntos.length
          ? `${cliente.empresa} tiene ${puntos.length} puntos y no se dijo cuál; queda sin asignar.`
          : `${cliente.empresa} no tiene puntos dados de alta; queda sin asignar.`,
      };
    }
    return { ...fila, cliente: cliente.empresa, puntoAlias: punto.alias, domicilio_id: punto.id };
  });

  const cuenta = (e) => resultado.filter((r) => r.estado === e).length;
  return {
    filas: resultado,
    resumen: {
      nuevos: cuenta("nuevo"),
      yaExisten: cuenta("ya-existe"),
      repetidos: cuenta("repetido"),
      errores: cuenta("error"),
      sinAsignar: resultado.filter((r) => r.estado === "nuevo" && !r.domicilio_id && r.aviso).length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Selección para imprimir (va en la URL)                              */
/* ------------------------------------------------------------------ */

/**
 * ["MOR-C-0001", …, "MOR-C-0050", "MOR-C-0060"] → "1-50,60".
 *
 * La hoja de etiquetas recibe la selección en la URL para que se pueda
 * recargar o abrir en otra pestaña sin perderla. Con los códigos completos,
 * un lote de 500 serían ~5,500 caracteres; con rangos casi siempre es un
 * puñado, porque los lotes se crean seguidos.
 */
export function comprimirCodigos(codigos = []) {
  const nums = [...new Set(codigos.map(numeroDeCodigo).filter((n) => n !== null))].sort((a, b) => a - b);
  const partes = [];
  for (let i = 0; i < nums.length; i++) {
    const inicio = nums[i];
    while (i + 1 < nums.length && nums[i + 1] === nums[i] + 1) i++;
    partes.push(inicio === nums[i] ? `${inicio}` : `${inicio}-${nums[i]}`);
  }
  return partes.join(",");
}

/** "1-50,60" → los códigos, en orden y sin repetir. Ignora lo mal formado. */
export function expandirCodigos(texto, max = 2000) {
  const nums = new Set();
  for (const parte of String(texto ?? "").split(",")) {
    const m = /^\s*(\d{1,4})(?:\s*-\s*(\d{1,4}))?\s*$/.exec(parte);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.max(1, a); n <= Math.min(b, MAXIMO) && nums.size < max; n++) nums.add(n);
  }
  return [...nums].sort((x, y) => x - y).map(codigoDeNumero);
}

/* ------------------------------------------------------------------ */
/* El QR                                                               */
/* ------------------------------------------------------------------ */

/** Margen blanco alrededor del QR, en módulos. La norma pide 4. */
export const MARGEN_QR = 4;

/**
 * El QR de un código, listo para un <svg>: `tam` es el lado en módulos (con
 * margen) y `d` el trazo de los módulos negros.
 *
 * Corrección de errores **H** (aguanta ~30 % dañado): la etiqueta va pegada a
 * un contenedor de basura, a la intemperie, y se va a rayar. Un código de 10
 * caracteres alfanuméricos sigue cabiendo en la versión 1 (21×21), la de
 * módulos más grandes, que es la que mejor se lee de lejos y con poca luz.
 *
 * Se dibuja aquí en vez de usar el SVG que trae `uqr` para no meterlo con
 * `dangerouslySetInnerHTML` y para poder probar el trazo (la prueba lo
 * vuelve a leer como QR en tests/contenedores.test.mjs).
 */
export function qrDeCodigo(codigo) {
  const qr = encode(String(codigo), { ecc: "H", border: 0 });
  let d = "";
  qr.data.forEach((fila, y) => {
    fila.forEach((negro, x) => {
      if (negro) d += `M${x + MARGEN_QR} ${y + MARGEN_QR}h1v1h-1z`;
    });
  });
  return { tam: qr.size + MARGEN_QR * 2, d, version: qr.version };
}

/** El QR como texto SVG completo (para pruebas o para descargarlo suelto). */
export function svgQR(codigo) {
  const { tam, d } = qrDeCodigo(codigo);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tam} ${tam}" shape-rendering="crispEdges"><rect width="${tam}" height="${tam}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
