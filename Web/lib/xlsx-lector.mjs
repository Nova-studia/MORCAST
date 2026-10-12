/**
 * LECTOR MÍNIMO DE .XLSX (sin dependencias; navegador y Node).
 *
 * Solo lo que hace falta para cargar los Excel del personal
 * (lib/excel-personal.mjs): el texto de las celdas de cada hoja y las
 * IMÁGENES con el renglón donde están. Un .xlsx es un ZIP de archivos XML; se
 * abre con `DecompressionStream`, que ya traen los navegadores y Node, en vez
 * de sumar al proyecto una librería de hojas de cálculo entera (las que leen
 * imágenes pesan cientos de KB).
 *
 * Las fotos pueden venir de dos maneras y se leen las dos:
 *   · "Sobre las celdas": una imagen flotante. Su renglón es el que queda
 *     debajo de su CENTRO (se mide con las alturas de los renglones: quien
 *     la pega casi nunca la deja exacta dentro de la celda).
 *   · "En la celda" (Excel 365, «Colocar en celda»): la imagen es el valor
 *     de la celda.
 *
 * No calcula fórmulas (usa el último valor que guardó Excel), ni lee fechas
 * ni formatos: las plantillas del personal son solo texto.
 */

const decodificador = new TextDecoder("utf-8");

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

async function inflar(bytes) {
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/**
 * Los archivos de un ZIP: `Map<nombre, () => Promise<Uint8Array>>`. Lanza si
 * los bytes no son un ZIP (p. ej. un .xls viejo, o un Excel con contraseña).
 */
export function abrirZip(entrada) {
  const bytes = entrada instanceof Uint8Array ? entrada : new Uint8Array(entrada);
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // El índice va al final. Se busca su firma de atrás para adelante.
  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (vista.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error("El archivo no es un Excel .xlsx.");

  const total = vista.getUint16(fin + 10, true);
  let p = vista.getUint32(fin + 16, true);
  const archivos = new Map();
  for (let n = 0; n < total; n++) {
    if (p + 46 > bytes.length || vista.getUint32(p, true) !== 0x02014b50) throw new Error("El archivo .xlsx está dañado.");
    const metodo = vista.getUint16(p + 10, true);
    const comprimido = vista.getUint32(p + 20, true);
    const largoNombre = vista.getUint16(p + 28, true);
    const largoExtra = vista.getUint16(p + 30, true);
    const largoNota = vista.getUint16(p + 32, true);
    const local = vista.getUint32(p + 42, true);
    const nombre = decodificador.decode(bytes.subarray(p + 46, p + 46 + largoNombre));
    archivos.set(nombre, async () => {
      const inicio = local + 30 + vista.getUint16(local + 26, true) + vista.getUint16(local + 28, true);
      const datos = bytes.subarray(inicio, inicio + comprimido);
      if (metodo === 0) return datos;
      if (metodo === 8) return inflar(datos);
      throw new Error("El archivo .xlsx usa una compresión que no se puede leer.");
    });
    p += 46 + largoNombre + largoExtra + largoNota;
  }
  return archivos;
}

/* ------------------------------------------------------------------ */
/* XML, lo justo                                                       */
/* ------------------------------------------------------------------ */

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const texto = (s) =>
  String(s).replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (todo, e) => {
    if (e[0] !== "#") return ENTIDADES[e] ?? todo;
    const codigo = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : todo;
  });

/** El valor de un atributo dentro de la etiqueta de apertura `etiqueta`. */
const atributo = (etiqueta, nombre) => {
  const m = etiqueta.match(new RegExp(`(?:^|\\s)${nombre}="([^"]*)"`));
  return m ? texto(m[1]) : null;
};

/** Junta los `<t>` de un trozo (texto simple o con formato), sin la guía fonética. */
const textoDe = (xml) =>
  [...xml.replace(/<rPh[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => texto(m[1])).join("");

/** "B12" → { col: 1, fila: 12 } (col desde 0, fila desde 1). */
export function posicionDe(referencia) {
  const m = String(referencia).match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const letra of m[1]) col = col * 26 + (letra.charCodeAt(0) - 64);
  return { col: col - 1, fila: Number(m[2]) };
}

/** Resuelve `destino` (de un archivo .rels) contra la carpeta de `base`. */
function ruta(base, destino) {
  if (destino.startsWith("/")) return destino.slice(1);
  const partes = base.split("/").slice(0, -1);
  for (const trozo of destino.split("/")) {
    if (trozo === "..") partes.pop();
    else if (trozo !== ".") partes.push(trozo);
  }
  return partes.join("/");
}

const TIPO_POR_EXTENSION = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", bmp: "image/bmp" };
const tipoDe = (nombre) => TIPO_POR_EXTENSION[nombre.split(".").pop().toLowerCase()] || "application/octet-stream";

/* ------------------------------------------------------------------ */
/* El libro                                                            */
/* ------------------------------------------------------------------ */

/**
 * Lee un .xlsx. Devuelve `{ hojas: [{ nombre, filas, imagenes }] }`:
 *   · `filas`: Map<número de renglón (desde 1), string[]> con el texto de
 *     cada celda (las vacías, "").
 *   · `imagenes`: [{ fila, col, nombre, tipo, bytes }].
 */
export async function leerXlsx(entrada) {
  const zip = abrirZip(entrada);
  const leer = async (nombre) => (zip.has(nombre) ? decodificador.decode(await zip.get(nombre)()) : null);
  /** Las relaciones de `archivo`: Map<rId, { destino, tipo }>. */
  const relaciones = async (archivo) => {
    const partes = archivo.split("/");
    const xml = await leer([...partes.slice(0, -1), "_rels", `${partes.at(-1)}.rels`].join("/"));
    const mapa = new Map();
    for (const m of (xml || "").matchAll(/<Relationship\s[^>]*>/g)) {
      mapa.set(atributo(m[0], "Id"), { destino: ruta(archivo, atributo(m[0], "Target") || ""), tipo: atributo(m[0], "Type") || "" });
    }
    return mapa;
  };
  const imagen = async (archivo) => (zip.has(archivo)
    ? { nombre: archivo.split("/").pop(), tipo: tipoDe(archivo), bytes: await zip.get(archivo)() }
    : null);

  const libro = await leer("xl/workbook.xml");
  if (!libro) throw new Error("El archivo no es un libro de Excel.");
  const relLibro = await relaciones("xl/workbook.xml");

  const compartidos = [...((await leer("xl/sharedStrings.xml")) || "").matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)]
    .map((m) => textoDe(m[1] || ""));

  // Imágenes "en la celda": el atributo vm de la celda → metadata → valor
  // enriquecido → relación → archivo de imagen.
  const enCelda = await (async () => {
    const meta = await leer("xl/metadata.xml");
    const valores = await leer("xl/richData/rdrichvalue.xml");
    const rels = await leer("xl/richData/richValueRel.xml");
    if (!meta || !valores || !rels) return [];
    const destinos = await relaciones("xl/richData/richValueRel.xml");
    const ids = [...rels.matchAll(/<rel\s[^>]*r:id="([^"]+)"/g)].map((m) => m[1]);
    const ricos = [...valores.matchAll(/<rv\s[^>]*>([\s\S]*?)<\/rv>/g)]
      .map((m) => Number((m[1].match(/<v>(-?\d+)<\/v>/) || [])[1]));
    // valueMetadata[vm] apunta a futureMetadata, y éste al valor enriquecido.
    const futuro = (meta.match(/<futureMetadata[^>]*name="XLRICHVALUE"[^>]*>([\s\S]*?)<\/futureMetadata>/) || [])[1] || "";
    const saltos = [...futuro.matchAll(/<bk>([\s\S]*?)<\/bk>/g)]
      .map((m) => Number((m[1].match(/<xlrd:rvb\s[^>]*i="(\d+)"/) || [])[1]));
    const bloque = (meta.match(/<valueMetadata[^>]*>([\s\S]*?)<\/valueMetadata>/) || [])[1] || "";
    return [...bloque.matchAll(/<bk>([\s\S]*?)<\/bk>/g)].map((m) => {
      const v = Number((m[1].match(/<rc\s[^>]*v="(\d+)"/) || [])[1]);
      const rico = saltos.length ? saltos[v] : v;
      return destinos.get(ids[ricos[rico]])?.destino || null;
    });
  })();

  const hojas = [];
  for (const m of libro.matchAll(/<sheet\s[^>]*>/g)) {
    const nombre = atributo(m[0], "name") || "";
    const archivo = relLibro.get(atributo(m[0], "r:id"))?.destino;
    const xml = archivo && (await leer(archivo));
    if (!xml) continue;

    const filas = new Map();
    const alturas = new Map();
    const imagenes = [];
    const porDefecto = Number(atributo((xml.match(/<sheetFormatPr\s[^>]*>/) || [""])[0], "defaultRowHeight")) || 15;

    for (const r of xml.matchAll(/<row\s([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const numero = Number(atributo(` ${r[1]}`, "r"));
      const alto = Number(atributo(` ${r[1]}`, "ht"));
      if (numero && alto) alturas.set(numero, alto);
      const celdas = [];
      for (const c of (r[2] || "").matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const pos = posicionDe(atributo(` ${c[1]}`, "r") || "");
        if (!pos) continue;
        const tipo = atributo(` ${c[1]}`, "t");
        const cuerpo = c[2] || "";
        const crudo = (cuerpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        const vm = Number(atributo(` ${c[1]}`, "vm"));
        if (vm && enCelda[vm - 1]) {
          const foto = await imagen(enCelda[vm - 1]);
          if (foto) imagenes.push({ fila: pos.fila, col: pos.col, ...foto });
          continue; // el "valor" de esa celda es un #VALUE! de relleno
        }
        let valor = "";
        if (tipo === "s") valor = compartidos[Number(crudo)] ?? "";
        else if (tipo === "inlineStr") valor = textoDe(cuerpo);
        else if (tipo === "b") valor = crudo === "1" ? "1" : "";
        else if (tipo === "e") valor = "";
        else if (crudo != null) valor = texto(crudo);
        celdas[pos.col] = valor.replace(/\r\n?/g, "\n").trim();
      }
      if (numero && celdas.length) filas.set(numero, Array.from(celdas, (v) => v ?? ""));
    }

    // Imágenes flotantes: el renglón que queda bajo su centro.
    const PT = 12700; // EMU por punto
    const cimaDe = (fila0) => { // puntos desde arriba hasta el renglón de índice `fila0` (desde 0)
      let y = 0;
      for (let i = 1; i <= fila0; i++) y += alturas.get(i) ?? porDefecto;
      return y;
    };
    const filaEn = (y) => {
      let acumulado = 0;
      for (let i = 1; i < 100000; i++) {
        acumulado += alturas.get(i) ?? porDefecto;
        if (y < acumulado) return i;
      }
      return 1;
    };
    const relHoja = await relaciones(archivo);
    for (const d of xml.matchAll(/<drawing\s[^>]*r:id="([^"]+)"/g)) {
      const dibujo = relHoja.get(d[1])?.destino;
      const xmlDibujo = dibujo && (await leer(dibujo));
      if (!xmlDibujo) continue;
      const relDibujo = await relaciones(dibujo);
      for (const a of xmlDibujo.matchAll(/<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g)) {
        const trozo = a[0];
        const incrustada = (trozo.match(/<a:blip\s[^>]*r:embed="([^"]+)"/) || [])[1];
        const foto = incrustada && (await imagen(relDibujo.get(incrustada)?.destino || ""));
        if (!foto) continue;
        const punto = (etiqueta) => {
          const t = (trozo.match(new RegExp(`<xdr:${etiqueta}>([\\s\\S]*?)</xdr:${etiqueta}>`)) || [])[1];
          if (!t) return null;
          const n = (x) => Number((t.match(new RegExp(`<xdr:${x}>(-?\\d+)</xdr:${x}>`)) || [])[1]) || 0;
          return { col: n("col"), fila: n("row"), y: cimaDe(n("row")) + n("rowOff") / PT };
        };
        const desde = punto("from");
        const hasta = punto("to");
        const alto = Number((trozo.match(/<xdr:ext\s[^>]*cy="(\d+)"/) || [])[1]) / PT || 0;
        let centro;
        let col = desde?.col ?? 0;
        if (desde && hasta) centro = (desde.y + hasta.y) / 2;
        else if (desde) centro = desde.y + alto / 2;
        else {
          const y = Number((trozo.match(/<xdr:pos\s[^>]*y="(-?\d+)"/) || [])[1]) / PT || 0;
          centro = y + alto / 2;
          col = 0;
        }
        imagenes.push({ fila: filaEn(centro), col, ...foto });
      }
    }

    hojas.push({ nombre, filas, imagenes });
  }
  return { hojas };
}
