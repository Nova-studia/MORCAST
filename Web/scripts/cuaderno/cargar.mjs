/**
 * LA OPERACION REAL DEL CUADERNO -> LA BASE.
 *
 *   node scripts/cuaderno/cargar.mjs              (ENSAYO: no escribe nada)
 *   node scripts/cuaderno/cargar.mjs --de-verdad  (escribe)
 *
 * EL ENSAYO ES EL MODO POR OMISION, y es a proposito: escribir en produccion
 * tiene que costar teclear una bandera, no olvidarla.
 *
 * ES IDEMPOTENTE. Busca por llave natural (empresa normalizada; punto por
 * cliente + alias) y actualiza si ya existe. Se puede volver a correr cuando
 * la empresa mande las correcciones sin duplicar nada.
 *
 * SE DETIENE ANTES DE ESCRIBIR si encuentra un nombre que no esta en
 * `equivalencias.js`. Vale mas que falle diez veces a que le cuelgue un
 * servicio a la empresa equivocada.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import {
  limpio, telefono, esRegimen, nombreClave, esRenglonDeInstrucciones,
  diasDesdeTexto, tipoDeRuta, frecuenciaPorMes, claveDeRuta,
} from "./normalizar.mjs";
import { EMPRESAS, PUNTOS, CLIENTES_EXTRA, SIN_RESOLVER } from "./equivalencias.js";
import { estadoPorCompletitud, loQueFalta } from "../../lib/estado-cliente.mjs";

const DE_VERDAD = process.argv.includes("--de-verdad");

// Se lee con readFileSync y no con `import ... with { type: "json" }`: la
// sintaxis de atributos de importacion cambio entre versiones de Node (`assert`
// antes, `with` despues) y este script tiene que correr sin depender de cual
// esta instalada.
const cuaderno = JSON.parse(
  readFileSync(new URL("./cuaderno.json", import.meta.url), "utf8")
);

/* ---------- 1. LEER Y NORMALIZAR (sin tocar la base) ---------------- */

const filas = (hoja, n) =>
  cuaderno.hojas[hoja].slice(5).filter((f) => String(f[0]).trim()).map((f) => f.slice(0, n));

// CLIENTES. Los 2 renglones duplicados se quedan con el primero: son la misma
// empresa tecleada dos veces, no dos empresas.
const clientes = new Map();
for (const f of filas("2 Clientes", 11)) {
  const clave = nombreClave(f[0]);
  if (clientes.has(clave)) continue;
  const domicilio = limpio(f[6]);
  const cli = {
    clave,
    empresa: limpio(f[0]),
    contacto: limpio(f[1]),
    telefono: telefono(f[2]),
    correo: limpio(f[3]),
    rfc: limpio(f[5]),
    // El "domicilio fiscal" que en realidad es el regimen se MUDA a su
    // columna en vez de tirarse: es un dato bueno mal guardado.
    regimen: domicilio && esRegimen(domicilio) ? domicilio : null,
    domicilio_fiscal: domicilio && !esRegimen(domicilio) ? domicilio : null,
    codigo_postal: limpio(f[7]),
    uso_cfdi: limpio(f[8]),
    forma_pago: limpio(f[9]),
  };
  cli.estado = estadoPorCompletitud(cli);
  cli.falta = loQueFalta(cli);
  clientes.set(clave, cli);
}

// Clientes que la hoja 2 no trae y que la hoja de PUNTOS revela. Hoy solo
// KARZINI: tiene 2 puntos propios en las mismas direcciones que KARZO y con
// sus propios conteos (12 al mes contra 8). Luis decidio el 1-sep-2026 que
// son negocios distintos, no un duplicado de captura.
for (const extra of CLIENTES_EXTRA) {
  const clave = nombreClave(extra.empresa);
  if (clientes.has(clave)) continue;
  const cli = {
    clave, empresa: extra.empresa,
    contacto: null, telefono: null, correo: null,
    rfc: null, regimen: null, domicilio_fiscal: null,
    codigo_postal: null, uso_cfdi: null, forma_pago: null,
    notaExtra: extra.nota || null,
  };
  cli.estado = estadoPorCompletitud(cli);
  cli.falta = loQueFalta(cli);
  clientes.set(clave, cli);
}

// RUTAS.
//
// ⚠️ SE UNEN LOS DIAS DE **TODOS** LOS RENGLONES DE LA HOJA 1, no solo de los
// 46-62. Los renglones 46-62 son las rutas como se disenaron, dia por dia,
// pero VERIFICADO contra el cuaderno: ahi solo aparecen RUTA 1, RUTA 2 y
// RUTA 3. RUTA 10 y RUTA 11 —las de TPI, las UNICAS que trabajan domingo—
// existen unicamente en los renglones 6-45. Usar solo 46-62 las dejaria sin
// dias, sin tipo y sin chofer, y de paso volveria inutil el domingo que se le
// agrego a DIAS_SEMANA.
//
// La union ademas es correcta: si un punto de RUTA 3 se atiende el lunes,
// RUTA 3 pasa el lunes. El `cupo` sale del maximo, que lo aportan los
// renglones 46-62 (paradas por dia de la ruta), no los 6-45 (por punto).
const rutas = new Map();
for (const f of filas("1 Rutas", 8)) {
  const clave = claveDeRuta(f[0]);
  if (!clave) continue;
  const r = rutas.get(clave) || {
    clave, nombre: `Ruta ${clave.split("-")[1]}`, tipo: null,
    dias: new Set(), unidad: null, chofer: null, cupo: 0, colonias: new Set(),
  };
  r.tipo = r.tipo || tipoDeRuta(f[1]);
  for (const d of diasDesdeTexto(f[2]).dias) r.dias.add(d);
  r.unidad = r.unidad || limpio(f[3]);
  r.chofer = r.chofer || limpio(f[4]);
  r.cupo = Math.max(r.cupo, Number(f[5]) || 0);
  if (limpio(f[6])) r.colonias.add(limpio(f[6]));
  rutas.set(clave, r);
}

// EL CALENDARIO ESCONDIDO: los renglones 6-45 de la hoja 1 van en el MISMO
// orden que los renglones de la hoja 3. De ahi salen los dias de cada punto.
// Ver el comentario de `suscripciones.dias` en db/019.
const calendario = cuaderno.hojas["1 Rutas"].slice(5, 45).map((f) => diasDesdeTexto(f[2]));

// PUNTOS. Aqui se resuelven las empresas escritas como sucursal.
//
// ⚠️ SE RECORRE LA HOJA CRUDA, NO `filas()`. Dos razones, las dos medidas
// contra el cuaderno real:
//
//  1. `filas()` descarta los renglones cuya primera columna esta vacia, y los
//     puntos "PLANTA TOLVA" y "PLANTA COMPACTADOR" de TPI (indices 37 y 38)
//     traen la empresa EN BLANCO: se sobreentiende que heredan la de arriba.
//     Descartarlos perderia 2 puntos reales de un cliente grande.
//
//  2. EL INDICE DEL CALENDARIO ES EL DEL RENGLON EN LA HOJA. Si se descarta un
//     renglon antes de indexar, TODOS los de abajo se recorren y heredan los
//     dias de otro punto. Serian dias plausibles pero de otro cliente: el peor
//     tipo de error, porque no se ve raro al revisarlo.
const sinMapear = new Set();
const puntos = [];
const HOJA3 = cuaderno.hojas["3 Puntos de recoleccion"].slice(5);
let empresaAnterior = null;

for (let i = 0; i < HOJA3.length; i++) {
  const f = HOJA3[i].slice(0, 8);
  if (!String(f[1]).trim()) continue; // sin nombre de punto: renglon vacio

  let bruto = nombreClave(f[0]);
  if (bruto) empresaAnterior = bruto;
  else bruto = empresaAnterior; // hereda la de arriba: los 2 puntos de TPI

  const empresa = clientes.has(bruto) ? bruto : nombreClave(EMPRESAS[bruto] || "");
  if (!empresa || !clientes.has(empresa)) {
    sinMapear.add(f[0] || `(empresa en blanco) ${f[1]}`);
    continue;
  }
  puntos.push({
    empresa,
    alias: limpio(f[1]) || "SUCURSAL",
    calle: limpio(f[2]),
    colonia: limpio(f[3]),
    cp: limpio(f[4]),
    ruta: claveDeRuta(f[6]),
    // `i` es la posicion en la HOJA. Ese es el amarre con el calendario.
    dias: calendario[i]?.dias || [],
    porLlamada: calendario[i]?.porLlamada || false,
  });
}

// SERVICIOS.
const servicios = [];
for (const f of filas("4 Servicio contratado", 9)) {
  if (esRenglonDeInstrucciones(f)) continue;
  const bruto = nombreClave(f[0]);
  const llave = `${bruto} :: ${nombreClave(f[1])}`;
  const tieneMapa = llave in PUNTOS;
  const mapa = PUNTOS[llave];

  // La empresa sale de tres sitios, en este orden. El tercero y el cuarto
  // existen por LLANTERA y TPI: los 4 servicios de LLANTERA dicen solo
  // "LLANTERA", que no es cliente de nadie —hay DOS llanteras con RFC
  // distinto—, y quien sabe de cual es cada uno es la tabla, no la hoja.
  let empresa = clientes.has(bruto) ? bruto : nombreClave(EMPRESAS[bruto] || "");
  if (!empresa && mapa?.empresa) empresa = nombreClave(mapa.empresa);
  if (!empresa && mapa?.porEquipo) {
    const porEq = mapa.porEquipo[nombreClave(f[4])];
    if (porEq) empresa = nombreClave(porEq.empresa);
  }
  if (!empresa || !clientes.has(empresa)) { sinMapear.add(f[0]); continue; }

  const propios = puntos.filter((p) => p.empresa === empresa);
  let destino = propios.filter((p) => nombreClave(p.alias) === nombreClave(f[1]));

  if (!destino.length) {
    // `tieneMapa` y `mapa === null` NO son lo mismo: `null` significa "se
    // reparte entre todos los puntos de la empresa" y es un valor legitimo
    // de la tabla. Un `if (!mapa)` a secas confundiria los dos casos.
    if (!tieneMapa) { sinMapear.add(llave); continue; }

    if (mapa === null) {
      destino = propios;                          // se reparte entre todos
    } else if (mapa.porEquipo) {
      // TPI: los 3 servicios comparten la MISMA llave porque los 3 dicen
      // "PLANTA"; lo unico que los distingue es el equipo.
      const porEq = mapa.porEquipo[nombreClave(f[4])];
      if (!porEq) { sinMapear.add(`${llave} (equipo ${JSON.stringify(f[4])})`); continue; }
      destino = propios.filter((p) => nombreClave(p.alias) === nombreClave(porEq.alias));
    } else {
      destino = propios.filter((p) => nombreClave(p.alias) === nombreClave(mapa.alias));
    }
  }
  if (!destino.length) { sinMapear.add(llave); continue; }

  const alMes = Number(String(f[2]).replace(/[^\d.]/g, "")) || 0;
  const porPunto = Math.round(alMes / destino.length);
  for (const p of destino) {
    servicios.push({
      empresa, alias: p.alias, ruta: p.ruta, dias: p.dias,
      servicios_por_mes: porPunto || null,
      frecuencia: frecuenciaPorMes(porPunto),
      repartido: destino.length > 1,
      equipo: [{
        tipo: limpio(f[4]), medida: limpio(f[5]),
        cantidad: Number(f[6]) || 1, residuo: limpio(f[3]),
      }],
    });
  }
}

/* ---------- 2. EL INFORME ------------------------------------------- */

const activos = [...clientes.values()].filter((c) => c.estado === "activo");
const pendientes = [...clientes.values()].filter((c) => c.estado === "pendiente-info");

console.log(`\n${DE_VERDAD ? "CARGA DE VERDAD" : "ENSAYO — no se escribe nada"}\n${"=".repeat(60)}`);
console.log(`Clientes:   ${clientes.size}  (${activos.length} activos, ${pendientes.length} pendientes)`);
console.log(`Rutas:      ${rutas.size}`);
console.log(`Puntos:     ${puntos.length}`);
console.log(`Servicios:  ${servicios.length}` +
  (servicios.some((s) => s.repartido) ? `  (${servicios.filter((s) => s.repartido).length} repartidos entre varios puntos)` : ""));

console.log(`\nPENDIENTES POR INFORMACION (${pendientes.length}):`);
for (const c of pendientes) console.log(`  ${c.empresa.padEnd(28)} falta: ${c.falta.join(", ")}`);

if (SIN_RESOLVER.length) {
  console.log(`\n🔴 PREGUNTAS SIN CONTESTAR (${SIN_RESOLVER.length}):`);
  for (const q of SIN_RESOLVER) console.log(`  - ${q}`);
}
if (sinMapear.size) {
  console.log(`\n🔴 NOMBRES QUE NO ESTAN EN equivalencias.js (${sinMapear.size}):`);
  for (const n of [...sinMapear].sort()) console.log(`  ${JSON.stringify(n)}`);
}

if (sinMapear.size || SIN_RESOLVER.length) {
  console.error(`\nEl script NO escribe con amarres sin resolver. Un servicio colgado de la\n` +
                `empresa equivocada es facturarle a quien no era.`);
  process.exit(1);
}

if (!DE_VERDAD) {
  console.log(`\nEnsayo terminado. Para escribir:  node scripts/cuaderno/cargar.mjs --de-verdad`);
  process.exit(0);
}

/* ---------- 3. ESCRIBIR (solo con --de-verdad) ---------------------- */
// (se completa en la Task 15)
console.error("La escritura se implementa en la Task 15 del plan.");
process.exit(1);
