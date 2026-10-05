import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarCodigo,
  esCodigoValido,
  codigoDeNumero,
  numeroDeCodigo,
  rangoCodigos,
  planLote,
  siguienteCodigoLibre,
  validarContenedor,
  parsearPegado,
  validarImportacion,
  buscarCliente,
  normalizarNombre,
  comprimirCodigos,
  expandirCodigos,
  qrDeCodigo,
  svgQR,
  MARGEN_QR,
  MAX_LOTE,
} from "../lib/contenedores.mjs";

/* ---------------- el código ---------------- */

test("el formato es MOR-C- y cuatro dígitos, como lo lee la app", () => {
  assert.equal(esCodigoValido("MOR-C-0421"), true);
  assert.equal(esCodigoValido("MOR-C-421"), false);
  assert.equal(esCodigoValido("mor-c-0421"), false);
  assert.equal(esCodigoValido("MOR-C-0000"), false);
  assert.equal(esCodigoValido("MOR-C-12345"), false);
  assert.equal(esCodigoValido(null), false);
});

test("lo tecleado a mano se lleva al formato canónico", () => {
  assert.equal(normalizarCodigo(" mor-c-421 "), "MOR-C-0421");
  assert.equal(normalizarCodigo("MOR C 0421"), "MOR-C-0421");
  assert.equal(normalizarCodigo("MORC421"), "MOR-C-0421");
  assert.equal(normalizarCodigo("7"), "MOR-C-0007");
  assert.equal(normalizarCodigo("0"), null);
  assert.equal(normalizarCodigo("12345"), null);
  assert.equal(normalizarCodigo("MOR-T-0001"), null);
  assert.equal(normalizarCodigo(""), null);
});

test("número y código van y vienen", () => {
  assert.equal(codigoDeNumero(1), "MOR-C-0001");
  assert.equal(codigoDeNumero(9999), "MOR-C-9999");
  assert.equal(codigoDeNumero(10000), null);
  assert.equal(codigoDeNumero(1.5), null);
  assert.equal(numeroDeCodigo("MOR-C-0050"), 50);
});

test("un rango incluye los dos extremos y acepta números sueltos", () => {
  const r = rangoCodigos("MOR-C-0001", "5");
  assert.equal(r.ok, true);
  assert.deepEqual(r.codigos, ["MOR-C-0001", "MOR-C-0002", "MOR-C-0003", "MOR-C-0004", "MOR-C-0005"]);
  assert.equal(rangoCodigos("MOR-C-0010", "MOR-C-0010").codigos.length, 1);
});

test("un rango al revés, mal escrito o enorme se rechaza con motivo", () => {
  assert.equal(rangoCodigos("10", "1").ok, false);
  assert.equal(rangoCodigos("abc", "1").ok, false);
  const enorme = rangoCodigos("1", String(MAX_LOTE + 1));
  assert.equal(enorme.ok, false);
  assert.match(enorme.motivo, /máximo/);
  assert.equal(rangoCodigos("1", String(MAX_LOTE)).ok, true);
});

test("el lote salta los códigos que ya existen y dice cuáles", () => {
  const p = planLote("1", "5", ["MOR-C-0002", "MOR-C-0004", "MOR-C-0099"]);
  assert.deepEqual(p.crear, ["MOR-C-0001", "MOR-C-0003", "MOR-C-0005"]);
  assert.deepEqual(p.yaExisten, ["MOR-C-0002", "MOR-C-0004"]);
});

test("el siguiente libre va después del más alto, sin rellenar huecos", () => {
  assert.equal(siguienteCodigoLibre([]), "MOR-C-0001");
  assert.equal(siguienteCodigoLibre(["MOR-C-0001", "MOR-C-0050", "MOR-C-0003", "basura"]), "MOR-C-0051");
});

/* ---------------- validación ---------------- */

test("validar limpia y normaliza lo que se guarda", () => {
  const v = validarContenedor({ codigo: "mor-c-12", tipo: " Tolva ", medida: " 30 m³ ", notas: "  " });
  assert.equal(v.ok, true);
  assert.deepEqual(v.datos, { codigo: "MOR-C-0012", tipo: "tolva", medida: "30 m³", estado: "en-servicio", domicilio_id: null, notas: null });
});

test("validar marca cada campo que falla", () => {
  const v = validarContenedor({ codigo: "X", tipo: "", estado: "robado", notas: "x".repeat(501) });
  assert.equal(v.ok, false);
  assert.ok(v.errores.codigo && v.errores.tipo && v.errores.estado && v.errores.notas);
});

/* ---------------- importar de Excel ---------------- */

const CLIENTES = [
  { id: "c1", empresa: "Industrias del Golfo, S.A. de C.V.", puntos: [{ id: "d1", alias: "Planta 1" }, { id: "d2", alias: "Planta 2" }] },
  { id: "c2", empresa: "Vidriera Matamoros", puntos: [{ id: "d3", alias: "Matriz" }] },
  { id: "c3", empresa: "Ferretera del Golfo", puntos: [] },
];

test("lo pegado de Excel se parte por tabulador y se brinca el encabezado", () => {
  const filas = parsearPegado("Código\tTipo\tMedida\tEmpresa\tPunto\r\nMOR-C-0001\tTolva\t30 m³\tVidriera\t\r\n\r\n2\tcontenedor\t3 m³\n");
  assert.equal(filas.length, 2);
  assert.equal(filas[0].codigo, "MOR-C-0001");
  assert.equal(filas[0].empresa, "Vidriera");
  assert.equal(filas[0].linea, 2);
  assert.equal(filas[1].codigo, "MOR-C-0002");
  assert.equal(filas[1].punto, "");
});

test("sin tabuladores acepta punto y coma (CSV)", () => {
  const filas = parsearPegado("MOR-C-0003;tambo;200 L");
  assert.equal(filas[0].tipo, "tambo");
  assert.equal(filas[0].medida, "200 L");
});

test("los nombres se comparan sin acentos ni razón social", () => {
  assert.equal(normalizarNombre("Industrias del Golfo, S.A. de C.V."), "industrias del golfo");
  assert.equal(normalizarNombre("VIDRIERA  Matamoros."), "vidriera matamoros");
});

test("una empresa ambigua no se adivina", () => {
  assert.equal(buscarCliente("Industrias del Golfo", CLIENTES).cliente.id, "c1");
  assert.equal(buscarCliente("vidriera", CLIENTES).cliente.id, "c2");
  const amb = buscarCliente("Golfo", CLIENTES);
  assert.equal(amb.cliente, null);
  assert.match(amb.motivo, /2 clientes/);
});

test("la vista previa dice qué pasa con cada renglón antes de guardar", () => {
  const filas = parsearPegado([
    "MOR-C-0001\ttolva\t30 m³\tIndustrias del Golfo\tPlanta 2", // asignado
    "MOR-C-0002\tcontenedor\t3 m³\tVidriera Matamoros\t",        // un solo punto: se asigna
    "MOR-C-0003\tcontenedor\t3 m³\tIndustrias del Golfo\t",      // dos puntos: sin asignar
    "MOR-C-0004\tcontenedor\t\tPatito SA\t",                      // no existe: sin asignar
    "MOR-C-0005\tcontenedor",                                     // ya existe
    "MOR-C-0001\ttolva",                                          // repetido
    "MOR-X-1\ttolva",                                             // error
    "6",                                                          // sin tipo: contenedor
  ].join("\n"));
  const { filas: r, resumen } = validarImportacion(filas, { existentes: ["MOR-C-0005"], clientes: CLIENTES });
  assert.equal(r[0].domicilio_id, "d2");
  assert.equal(r[1].domicilio_id, "d3");
  assert.equal(r[2].domicilio_id, null);
  assert.match(r[2].aviso, /2 puntos/);
  assert.equal(r[3].estado, "nuevo");
  assert.match(r[3].aviso, /No hay ningún cliente/);
  assert.equal(r[4].estado, "ya-existe");
  assert.equal(r[5].estado, "repetido");
  assert.equal(r[6].estado, "error");
  assert.equal(r[7].tipo, "contenedor");
  assert.deepEqual(resumen, { nuevos: 5, yaExisten: 1, repetidos: 1, errores: 1, sinAsignar: 2 });
});

test("un punto que la empresa no tiene queda sin asignar con aviso", () => {
  const filas = parsearPegado("MOR-C-0009\ttolva\t\tIndustrias del Golfo\tPlanta 9");
  const { filas: r } = validarImportacion(filas, { clientes: CLIENTES });
  assert.equal(r[0].domicilio_id, null);
  assert.match(r[0].aviso, /no tiene un punto «Planta 9»/);
});

/* ---------------- selección en la URL ---------------- */

test("la selección se comprime en rangos y se recupera igual", () => {
  const codigos = ["MOR-C-0005", "MOR-C-0001", "MOR-C-0002", "MOR-C-0003", "MOR-C-0010", "MOR-C-0011", "MOR-C-0003"];
  const txt = comprimirCodigos(codigos);
  assert.equal(txt, "1-3,5,10-11");
  assert.deepEqual(expandirCodigos(txt), ["MOR-C-0001", "MOR-C-0002", "MOR-C-0003", "MOR-C-0005", "MOR-C-0010", "MOR-C-0011"]);
});

test("expandir ignora basura y respeta el tope", () => {
  assert.deepEqual(expandirCodigos("x,0,3,<script>"), ["MOR-C-0003"]);
  assert.equal(expandirCodigos("1-9999", 100).length, 100);
});

/* ---------------- el QR se lee ---------------- */

/**
 * Lector de QR mínimo, SOLO para esta prueba: versión 1 (21×21), un bloque,
 * modos alfanumérico y byte. Lee el TRAZO que dibuja `qrDeCodigo()` — no la
 * matriz de `uqr` —, así que si el dibujo saliera corrido, al revés o sin
 * margen, esta prueba lo agarra. No adivina la máscara: prueba las ocho y
 * exige que solo una dé un texto bien formado.
 */
const ALFANUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const MASCARAS = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

function leerQR({ tam, d }) {
  const malla = Array.from({ length: tam }, () => Array(tam).fill(false));
  for (const m of d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) malla[Number(m[2])][Number(m[1])] = true;
  const n = tam - MARGEN_QR * 2;
  assert.equal(n, 21, "se esperaba la versión 1");
  // El margen tiene que estar limpio: sin él, el teléfono no encuentra el QR.
  malla.forEach((fila, y) => fila.forEach((v, x) => {
    const dentro = x >= MARGEN_QR && y >= MARGEN_QR && x < tam - MARGEN_QR && y < tam - MARGEN_QR;
    if (!dentro) assert.equal(v, false, `módulo negro en el margen (${x},${y})`);
  }));
  const q = malla.slice(MARGEN_QR, MARGEN_QR + n).map((f) => f.slice(MARGEN_QR, MARGEN_QR + n));
  const funcion = (r, c) => (r <= 8 && c <= 8) || (r <= 8 && c >= n - 8) || (r >= n - 8 && c <= 8) || r === 6 || c === 6;

  const leidos = [];
  for (const mascara of MASCARAS) {
    const bits = [];
    let subiendo = true;
    for (let c = n - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      for (let k = 0; k < n; k++) {
        const r = subiendo ? n - 1 - k : k;
        for (const cc of [c, c - 1]) if (!funcion(r, cc)) bits.push(q[r][cc] !== mascara(r, cc) ? 1 : 0);
      }
      subiendo = !subiendo;
    }
    let p = 0;
    const tomar = (k) => { let v = 0; for (let i = 0; i < k; i++) v = (v << 1) | bits[p++]; return v; };
    const modo = tomar(4);
    let texto = null;
    if (modo === 0b0010) {
      let cuenta = tomar(9);
      if (cuenta > 0 && cuenta <= 10) {
        texto = "";
        while (cuenta >= 2) { const v = tomar(11); texto += ALFANUM[Math.floor(v / 45)] + ALFANUM[v % 45]; cuenta -= 2; }
        if (cuenta) texto += ALFANUM[tomar(6)];
      }
    } else if (modo === 0b0100) {
      const cuenta = tomar(8);
      if (cuenta > 0 && cuenta <= 7) texto = String.fromCharCode(...Array.from({ length: cuenta }, () => tomar(8)));
    }
    if (texto && /^MOR-C-\d{4}$/.test(texto)) leidos.push(texto);
  }
  assert.equal(leidos.length, 1, `se leyeron ${leidos.length} textos válidos`);
  return leidos[0];
}

test("el QR dibujado se vuelve a leer como el código exacto", () => {
  for (const codigo of ["MOR-C-0001", "MOR-C-0421", "MOR-C-0050", "MOR-C-9999", "MOR-C-1234"]) {
    assert.equal(leerQR(qrDeCodigo(codigo)), codigo);
  }
});

test("el lector de la prueba no se traga un QR mal dibujado", () => {
  // Si el lector aceptara cualquier cosa, la prueba de arriba no valdría.
  const q = qrDeCodigo("MOR-C-0421");
  const volteado = { tam: q.tam, d: q.d.replace(/M(\d+) (\d+)/g, (_, x, y) => `M${y} ${x}`) };
  assert.throws(() => leerQR(volteado));
});

test("todos los códigos posibles caben en la versión 1 con corrección H", () => {
  for (let n = 1; n <= 9999; n += 97) assert.equal(qrDeCodigo(codigoDeNumero(n)).version, 1);
});

test("el SVG suelto es un QR blanco y negro con su margen", () => {
  const svg = svgQR("MOR-C-0001");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 29 29"/);
  assert.match(svg, /fill="#fff"/);
  assert.ok(svg.includes(qrDeCodigo("MOR-C-0001").d));
});
