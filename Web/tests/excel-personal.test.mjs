import { test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { abrirZip, leerXlsx, posicionDe } from "../lib/xlsx-lector.mjs";
import { personasDelLibro, revisarCarga } from "../lib/excel-personal.mjs";

/* ------------------------------------------------------------------ */
/* Un .xlsx de mentiras, armado a mano                                 */
/* ------------------------------------------------------------------ */

/** ZIP mínimo: `archivos` es { nombre: texto | Uint8Array }. Comprime los XML, como Excel. */
function zip(archivos) {
  const locales = [];
  const indice = [];
  let desplazamiento = 0;
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const crudo = typeof contenido === "string" ? Buffer.from(contenido, "utf8") : Buffer.from(contenido);
    const comprimir = nombre.endsWith(".xml") || nombre.endsWith(".rels");
    const datos = comprimir ? zlib.deflateRawSync(crudo) : crudo;
    const n = Buffer.from(nombre, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(comprimir ? 8 : 0, 8);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(crudo.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(comprimir ? 8 : 0, 10);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(crudo.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    locales.push(local, n, datos);
    indice.push(central, n);
    desplazamiento += 30 + n.length + datos.length;
  }
  const tamIndice = indice.reduce((t, b) => t + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(Object.keys(archivos).length, 8);
  fin.writeUInt16LE(Object.keys(archivos).length, 10);
  fin.writeUInt32LE(tamIndice, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return new Uint8Array(Buffer.concat([...locales, ...indice, fin]));
}

const REL = (pares) =>
  `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${pares
    .map(([id, destino, tipo = "x"]) => `<Relationship Id="${id}" Type="${tipo}" Target="${destino}"/>`).join("")}</Relationships>`;

const ENCABEZADOS = [
  "No.", "Foto", "Nombre(s)", "Apellido paterno", "Apellido materno", "Puesto", "Área / departamento",
  "Reporta a (jefe directo)", "Número de empleado (si tienen)", "Archivo de la foto (si la mandan aparte)",
  "Tipo de sangre", "Alergias", "Contacto de emergencia (nombre y parentesco)", "Teléfono de emergencia", "¿Firmó permiso?",
];
const LETRAS = "ABCDEFGHIJKLMNO";

/** Un renglón con textos en línea; "" no escribe la celda (como hace Excel). */
const renglon = (n, valores, extra = "") =>
  `<row r="${n}"${extra}>${valores.map((v, i) => (v === "" ? "" : typeof v === "number"
    ? `<c r="${LETRAS[i]}${n}"><v>${v}</v></c>`
    : `<c r="${LETRAS[i]}${n}" t="inlineStr"><is><t>${v}</t></is></c>`)).join("")}</row>`;

function libroDePrueba() {
  const hoja2 = `<?xml version="1.0"?><worksheet xmlns:r="r"><sheetFormatPr defaultRowHeight="15"/><sheetData>
    <row r="1" ht="30" customHeight="1">${ENCABEZADOS.map((t, i) => `<c r="${LETRAS[i]}1" t="s"><v>${i}</v></c>`).join("")}</row>
    ${renglon(2, [1, "", "Dora Elena", "Garza", "Treviño", "Gerente general", "Dirección", "", "0001", "", "o positivo", "", "Raúl (esposo)", "868 111 2233", "Sí"], ' ht="60" customHeight="1"')}
    ${renglon(3, [2, "", "Ramiro", "Salinas", "Cantú", "Jefe de operaciones", "Operación", "Dora Garza", "", "ramiro.JPG", "", "", "", "", ""], ' ht="60" customHeight="1"')}
    ${renglon(4, [3, "", "Ana &amp; Sofía", "Núñez", "", "Contadora", "Administración", "Dora Elena Garza Treviño", "", "", "Z+", "", "", "12345", "si"], ' ht="60" customHeight="1"')}
    <row r="5" ht="60" customHeight="1"><c r="A5"><v>4</v></c><c r="B5" t="e" vm="1"><v>#VALUE!</v></c><c r="C5" t="s"><v>15</v></c><c r="D5" t="inlineStr"><is><t>Villarreal</t></is></c><c r="F5" t="inlineStr"><is><t>Supervisor</t></is></c><c r="H5" t="inlineStr"><is><t>Pedro Páramo</t></is></c></row>
    ${renglon(6, [5, "", "", "", "", "", "", "", "", "", "", "", "", "", ""])}
    ${renglon(7, [6, "", "", "Sin Nombre", "", "", "", "", "", "", "", "", "", "", ""])}
    <row r="8"><c r="A8"><v>7</v></c></row>
  </sheetData><drawing r:id="rId1"/></worksheet>`;
  // Dos fotos flotantes: una dentro del renglón 2; otra que empieza al final
  // del 2 y cae casi toda en el 3 (así las deja quien las pega a mano).
  const ancla = (desdeFila, desdeOff, hastaFila, hastaOff, rid) =>
    `<xdr:twoCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${desdeFila}</xdr:row><xdr:rowOff>${desdeOff}</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>1</xdr:col><xdr:colOff>9</xdr:colOff><xdr:row>${hastaFila}</xdr:row><xdr:rowOff>${hastaOff}</xdr:rowOff></xdr:to>` +
    `<xdr:pic><xdr:blipFill><a:blip r:embed="${rid}"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`;
  const dibujo = `<?xml version="1.0"?><xdr:wsDr>${ancla(1, 12700 * 5, 1, 12700 * 55, "rId1")}${ancla(1, 12700 * 50, 2, 12700 * 50, "rId2")}</xdr:wsDr>`;

  return zip({
    "[Content_Types].xml": "<Types/>",
    "xl/workbook.xml": `<?xml version="1.0"?><workbook><sheets><sheet name="Instrucciones" sheetId="1" r:id="rId1"/><sheet name="Administrativos" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": REL([["rId1", "worksheets/sheet1.xml"], ["rId2", "/xl/worksheets/sheet2.xml"]]),
    "xl/sharedStrings.xml": `<?xml version="1.0"?><sst>${ENCABEZADOS.map((t) => `<si><t>${t}</t></si>`).join("")}<si><r><t>Héc</t></r><r><rPr><b/></rPr><t xml:space="preserve">tor </t></r><rPh><t>fonética</t></rPh></si></sst>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet><sheetData>${renglon(2, ["", "Organigrama administrativo"])}${renglon(5, ["", "CÓMO LLENARLO"])}</sheetData></worksheet>`,
    "xl/worksheets/sheet2.xml": hoja2,
    "xl/worksheets/_rels/sheet2.xml.rels": REL([["rId1", "../drawings/drawing1.xml"]]),
    "xl/drawings/drawing1.xml": dibujo,
    "xl/drawings/_rels/drawing1.xml.rels": REL([["rId1", "../media/image1.png"], ["rId2", "../media/image2.jpeg"]]),
    "xl/media/image1.png": new Uint8Array([1, 1, 1]),
    "xl/media/image2.jpeg": new Uint8Array([2, 2]),
    "xl/media/image3.png": new Uint8Array([3]),
    // La foto "en la celda" de B5.
    "xl/metadata.xml": `<?xml version="1.0"?><metadata><futureMetadata name="XLRICHVALUE" count="1"><bk><extLst><ext><xlrd:rvb i="0"/></ext></extLst></bk></futureMetadata><valueMetadata count="1"><bk><rc t="1" v="0"/></bk></valueMetadata></metadata>`,
    "xl/richData/rdrichvalue.xml": `<?xml version="1.0"?><rvData count="1"><rv s="0"><v>0</v><v>5</v></rv></rvData>`,
    "xl/richData/richValueRel.xml": `<?xml version="1.0"?><richValueRels><rel r:id="rId1"/></richValueRels>`,
    "xl/richData/_rels/richValueRel.xml.rels": REL([["rId1", "../media/image3.png"]]),
  });
}

/* ------------------------------------------------------------------ */
/* El lector                                                           */
/* ------------------------------------------------------------------ */

test("posicionDe: la referencia de una celda", () => {
  assert.deepEqual(posicionDe("A1"), { col: 0, fila: 1 });
  assert.deepEqual(posicionDe("O41"), { col: 14, fila: 41 });
  assert.deepEqual(posicionDe("AB7"), { col: 27, fila: 7 });
  assert.equal(posicionDe("x"), null);
});

test("abrirZip: lee archivos comprimidos y sin comprimir, y rechaza lo que no es ZIP", async () => {
  const archivos = abrirZip(zip({ "a.xml": "<hola>ñ</hola>".repeat(50), "b.bin": new Uint8Array([9, 8, 7]) }));
  assert.equal(new TextDecoder().decode(await archivos.get("a.xml")()), "<hola>ñ</hola>".repeat(50));
  assert.deepEqual([...(await archivos.get("b.bin")())], [9, 8, 7]);
  assert.throws(() => abrirZip(new TextEncoder().encode("esto es un .xls viejo o cualquier otra cosa")), /no es un Excel/);
});

test("leerXlsx: hojas, textos (compartidos, en línea, con formato) y celdas vacías", async () => {
  const { hojas } = await leerXlsx(libroDePrueba());
  assert.deepEqual(hojas.map((h) => h.nombre), ["Instrucciones", "Administrativos"]);
  const adm = hojas[1];
  assert.deepEqual(adm.filas.get(1), ENCABEZADOS);
  assert.equal(adm.filas.get(2)[2], "Dora Elena");
  assert.equal(adm.filas.get(2)[1], "", "la celda de la foto no trae texto");
  assert.equal(adm.filas.get(2)[0], "1", "los números llegan como texto");
  assert.equal(adm.filas.get(4)[2], "Ana & Sofía", "las entidades de XML se deshacen");
  assert.equal(adm.filas.get(5)[2], "Héctor", "texto con formato, sin la guía fonética y recortado");
  assert.equal(adm.filas.get(5)[4], "", "un hueco en medio del renglón");
});

test("leerXlsx: cada foto cae en el renglón de su centro, flotante o dentro de la celda", async () => {
  const { hojas } = await leerXlsx(libroDePrueba());
  const fotos = hojas[1].imagenes.map((i) => ({ fila: i.fila, col: i.col, nombre: i.nombre, tipo: i.tipo, bytes: [...i.bytes] }))
    .sort((a, b) => a.fila - b.fila);
  assert.deepEqual(fotos, [
    { fila: 2, col: 1, nombre: "image1.png", tipo: "image/png", bytes: [1, 1, 1] },
    // Empieza en el renglón 2, pero su centro está en el 3.
    { fila: 3, col: 1, nombre: "image2.jpeg", tipo: "image/jpeg", bytes: [2, 2] },
    { fila: 5, col: 1, nombre: "image3.png", tipo: "image/png", bytes: [3] },
  ]);
  assert.deepEqual(hojas[0].imagenes, []);
});

/* ------------------------------------------------------------------ */
/* La interpretación                                                   */
/* ------------------------------------------------------------------ */

test("personasDelLibro: salta instrucciones y renglones vacíos, y reconoce las columnas por su encabezado", async () => {
  const personas = personasDelLibro(await leerXlsx(libroDePrueba()), "admin.xlsx");
  assert.deepEqual(personas.map((p) => p.fila), [2, 3, 4, 5, 7], "el 6 y el 8 solo traen el número de renglón");
  const dora = personas[0];
  assert.equal(dora.archivo, "admin.xlsx");
  assert.equal(dora.hoja, "Administrativos");
  assert.equal(dora.tipo, "administrativo");
  assert.deepEqual(dora.entrada, {
    numero: "0001", nombre: "Dora Elena", apellido_paterno: "Garza", apellido_materno: "Treviño",
    puesto: "Gerente general", area: "Dirección", tipo: "administrativo", tipo_sangre: "o positivo", alergias: "",
    contacto_emergencia: "Raúl (esposo)", telefono_emergencia: "868 111 2233", permiso_emergencia: true,
  });
  assert.deepEqual([...dora.imagen.bytes], [1, 1, 1]);
  assert.equal(personas[1].reporta, "Dora Garza");
  assert.equal(personas[1].archivoFoto, "ramiro.JPG");
  assert.deepEqual([...personas[1].imagen.bytes], [2, 2]);
  assert.equal(personas[2].imagen, null);
  assert.deepEqual([...personas[3].imagen.bytes], [3], "la foto puesta dentro de la celda");
});

test("personasDelLibro: sin columna de jefe es personal general, aunque muevan las columnas", () => {
  const filas = new Map([
    [1, ["Puesto", "Apellido paterno", "Nombre(s)", "Área / ruta / planta"]],
    [2, ["Ayudante", "Soto", "Luis", "Ruta Sur"]],
  ]);
  const [luis] = personasDelLibro({ hojas: [{ nombre: "Personal general", filas, imagenes: [] }] });
  assert.equal(luis.tipo, "general");
  assert.equal(luis.entrada.nombre, "Luis");
  assert.equal(luis.entrada.puesto, "Ayudante");
  assert.equal(luis.entrada.area, "Ruta Sur");
  assert.equal(luis.entrada.numero, "");
  assert.deepEqual(personasDelLibro({ hojas: [{ nombre: "Otra", filas: new Map([[1, ["a", "b"]]]), imagenes: [] }] }), []);
});

test("revisarCarga: qué se crea, qué falta y qué no cuadra", async () => {
  const personas = personasDelLibro(await leerXlsx(libroDePrueba()), "admin.xlsx");
  const { filas, resumen } = revisarCarga(personas, { fotosSueltas: ["Ramiro.jpg"] });
  const [dora, ramiro, ana, hector, sinNombre] = filas;

  assert.equal(dora.estado, "crear");
  assert.equal(dora.datos.tipo_sangre, "O+");
  assert.equal(dora.datos.telefono_emergencia, "8681112233");
  assert.equal(dora.datos.permiso_emergencia, true);
  assert.equal(dora.foto, "excel");
  assert.deepEqual(dora.avisos, []);

  // «Dora Garza» es Dora Elena Garza Treviño: todas sus palabras están en un solo nombre.
  assert.deepEqual(ramiro.jefe, { indice: 0 });
  assert.equal(ramiro.foto, "excel", "si hay foto en el Excel, manda esa");

  // Datos opcionales que no se entienden: se avisa y la persona se crea igual.
  assert.equal(ana.estado, "crear");
  assert.equal(ana.datos.tipo_sangre, null);
  assert.equal(ana.datos.telefono_emergencia, null);
  assert.equal(ana.datos.permiso_emergencia, false, "sin teléfono no hay ficha de emergencia");
  assert.equal(ana.avisos.length, 4);
  assert.match(ana.avisos.join(" "), /tipo de sangre «Z\+»/);
  assert.match(ana.avisos.join(" "), /no tiene 10 dígitos/);
  assert.match(ana.avisos.join(" "), /Sin foto/);
  assert.deepEqual(ana.jefe, { indice: 0 }, "con el nombre completo también");

  assert.equal(hector.estado, "crear");
  assert.equal(hector.jefe, null);
  assert.match(hector.avisos.join(" "), /Pedro Páramo» no está en el Excel ni en el directorio/);

  assert.equal(sinNombre.estado, "error");
  assert.equal(sinNombre.datos, null);
  assert.ok(sinNombre.errores.length >= 2, "le falta el nombre y el puesto");

  assert.deepEqual(resumen, { crear: 4, errores: 1, repetidas: 0, sinFoto: 1, administrativos: 4 });
});

test("revisarCarga: no duplica a quien ya está ni a quien viene dos veces, y no pisa números", () => {
  const persona = (nombre, paterno, extra = {}) => ({
    archivo: "x.xlsx", hoja: "Personal general", fila: 2, tipo: "general", reporta: "", archivoFoto: "", imagen: null,
    entrada: { numero: "", nombre, apellido_paterno: paterno, apellido_materno: "", puesto: "Ayudante", area: "", tipo: "general", ...extra },
    ...("reporta" in extra ? { reporta: extra.reporta } : {}),
    ...("archivoFoto" in extra ? { archivoFoto: extra.archivoFoto } : {}),
  });
  const existentes = [
    { id: "e1", numero: "0007", nombre: "JOSÉ", apellido_paterno: "Peña", apellido_materno: "", estado: "activo" },
    { id: "e2", numero: "0008", nombre: "Dora", apellido_paterno: "Garza", apellido_materno: "", estado: "activo" },
    { id: "e3", numero: "0009", nombre: "Dora", apellido_paterno: "Garza", apellido_materno: "Ruiz", estado: "baja" },
  ];
  const { filas, resumen } = revisarCarga([
    persona("Jose", "Pena"),                                   // ya está (sin acentos ni mayúsculas)
    persona("Luis", "Soto", { numero: "0007" }),               // número ocupado
    persona("Luis", "Soto"),                                   // viene dos veces
    persona("Ana", "Ruiz", { numero: "12/3" }),                // número que no sirve
    persona("Eva", "Cruz", { numero: "0050", reporta: "Dora Garza" }),
    persona("Iván", "Mora", { numero: "0050", archivoFoto: "ivan.png" }), // repite el de Eva
  ], { existentes, fotosSueltas: [] });

  assert.deepEqual(filas.map((f) => f.estado), ["repetida", "crear", "repetida", "crear", "crear", "crear"]);
  assert.match(filas[0].errores[0], /Ya está en el directorio/);
  assert.match(filas[2].errores[0], /dos veces/);
  assert.equal(filas[1].datos.numero, "", "se le pondrá el siguiente");
  assert.match(filas[1].avisos.join(" "), /0007 ya lo tiene otra persona/);
  assert.equal(filas[3].datos.numero, "");
  assert.match(filas[3].avisos.join(" "), /no sirve/);
  assert.equal(filas[4].datos.numero, "0050");
  // La Dora de baja no cuenta: queda una sola candidata, la activa.
  assert.deepEqual(filas[4].jefe, { id: "e2" });
  assert.equal(filas[5].datos.numero, "", "el 0050 ya lo tomó Eva en esta misma carga");
  assert.match(filas[5].avisos.join(" "), /No se subió la foto «ivan.png»/);
  assert.equal(resumen.crear, 4);
  assert.equal(resumen.repetidas, 2);
  assert.equal(resumen.sinFoto, 4);
});

test("revisarCarga: un «Reporta a» que coincide con varias personas no se adivina", () => {
  const base = { archivo: "", hoja: "A", fila: 2, tipo: "administrativo", archivoFoto: "", imagen: null };
  const entrada = (nombre, paterno) => ({ numero: "", nombre, apellido_paterno: paterno, apellido_materno: "", puesto: "X", area: "", tipo: "administrativo" });
  const { filas } = revisarCarga([
    { ...base, reporta: "", entrada: entrada("Juan", "Pérez") },
    { ...base, reporta: "", entrada: entrada("Juan", "López") },
    { ...base, reporta: "Juan", entrada: entrada("Rosa", "Díaz") },
    { ...base, reporta: "Rosa Díaz", entrada: entrada("Rosa", "Díaz Mora") }, // no se reporta a sí misma
  ]);
  assert.equal(filas[2].jefe, null);
  assert.match(filas[2].avisos.join(" "), /coincide con varias personas/);
  assert.deepEqual(filas[3].jefe, { indice: 2 });
});
