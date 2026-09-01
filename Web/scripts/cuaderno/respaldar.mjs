/**
 * RESPALDO DE LA BASE ANTES DE BORRAR NADA.
 *
 * Va SEPARADO de `limpiar.mjs` y de `cargar.mjs` a proposito: tres comandos
 * distintos, para que nadie borre produccion creyendo que solo estaba
 * cargando.
 *
 * El archivo sale FUERA del repositorio: trae correos y telefonos de personas
 * reales y no tiene por que acabar en GitHub.
 *
 *   node scripts/cuaderno/respaldar.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TABLAS = [
  "clientes", "perfiles", "rutas", "domicilios", "suscripciones",
  "solicitudes_recoleccion", "recolecciones", "movimientos_saldo",
  "solicitudes_alta", "zonas_pedidas", "cotizaciones",
];

// Con segundos, no solo minuto: dos corridas en el mismo minuto no deben
// pisarse una a la otra sin avisar.
const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const raiz = process.env.USERPROFILE || process.env.HOME;
const destino = resolve(raiz, "Downloads", `morcast-respaldo-${sello}.json`);
const carpetaArchivos = resolve(raiz, "Downloads", `morcast-respaldo-${sello}-archivos`);

// Nunca sobreescribir un respaldo que ya existe: mejor fallar y que Luis
// corra el script de nuevo un segundo despues que perder el de antes.
if (existsSync(destino)) {
  console.error(`[respaldo] ya existe ${destino}, no lo piso. Vuelve a correr el script.`);
  process.exit(1);
}

const datos = { fecha: new Date().toISOString(), tablas: {} };

for (const tabla of TABLAS) {
  const { data, error } = await supabase.from(tabla).select("*");
  if (error) {
    console.error(`[respaldo] ${tabla}: ${error.message}`);
    process.exit(1); // Sin respaldo COMPLETO no hay respaldo.
  }
  datos.tablas[tabla] = data;
  console.log(`  ${tabla}: ${data.length} filas`);
}

const { data: usuarios, error: eUsuarios } =
  await supabase.auth.admin.listUsers({ perPage: 1000 });
if (eUsuarios) {
  console.error(`[respaldo] usuarios: ${eUsuarios.message}`);
  process.exit(1);
}
// Solo lo identificable: la contrasena no se puede respaldar y no hay que
// fingir que si. Supabase solo guarda el hash y la Admin API no lo entrega,
// asi que este respaldo restituye las FILAS de las tablas, pero si hubiera
// que echar atras los usuarios de auth, las cuentas se vuelven a CREAR
// (con una contrasena nueva que el cliente tendria que restablecer), no se
// resucitan con la contrasena original.
datos.usuarios = usuarios.users.map((u) => ({
  id: u.id, email: u.email, rol: u.app_metadata?.rol, creado: u.created_at,
}));
console.log(`  auth.users: ${datos.usuarios.length} usuarios`);

// `list()` no es recursivo: una entrada con id null es una CARPETA (Supabase
// la representa asi, sin metadata), no un archivo. Hay que bajar un nivel
// para llegar a las rutas de verdad, o el respaldo "de la cubeta" queda
// siendo solo un listado de nombres de carpeta.
async function listarArchivos(cubeta, prefijo = "") {
  const { data, error } = await supabase.storage.from(cubeta).list(prefijo, { limit: 1000 });
  if (error) {
    console.error(`[respaldo] cubeta ${cubeta}${prefijo ? "/" + prefijo : ""}: ${error.message}`);
    process.exit(1); // Mismo criterio que las tablas: sin lectura completa, no hay respaldo.
  }
  let archivos = [];
  for (const entrada of data || []) {
    const ruta = prefijo ? `${prefijo}/${entrada.name}` : entrada.name;
    if (entrada.id === null) {
      archivos = archivos.concat(await listarArchivos(cubeta, ruta));
    } else {
      archivos.push({
        ruta,
        tamano: entrada.metadata?.size ?? null,
        tipo: entrada.metadata?.mimetype ?? null,
      });
    }
  }
  return archivos;
}

const CUBETAS = ["comprobantes", "evidencias"];
for (const cubeta of CUBETAS) {
  const archivos = await listarArchivos(cubeta);
  datos[`cubeta_${cubeta}`] = archivos;
  console.log(`  cubeta ${cubeta}: ${archivos.length} archivos`);
}

// Freno: hoy son 5 fotos, pero el dia que haya miles de recolecciones reales
// bajar todo aqui adentro seria absurdo (tardaria o llenaria el disco sin
// avisar). Si se llega al tope, el script se detiene ANTES de escribir nada
// -- ni el JSON de las tablas -- para no dejar la impresion de que hubo un
// respaldo completo cuando los archivos se quedaron fuera.
const TOPE_ARCHIVOS = 200;
const TOPE_BYTES = 100 * 1024 * 1024; // 100 MB
const totalArchivos = CUBETAS.reduce((n, c) => n + datos[`cubeta_${c}`].length, 0);
const totalBytes = CUBETAS.reduce(
  (n, c) => n + datos[`cubeta_${c}`].reduce((m, a) => m + (a.tamano || 0), 0),
  0
);
if (totalArchivos > TOPE_ARCHIVOS || totalBytes > TOPE_BYTES) {
  console.error(
    `[respaldo] las cubetas tienen ${totalArchivos} archivos (${(totalBytes / 1024 / 1024).toFixed(1)} MB), ` +
    `por encima del tope de ${TOPE_ARCHIVOS} archivos / ${TOPE_BYTES / 1024 / 1024} MB.`
  );
  console.error(
    "[respaldo] no se bajo nada. Sube TOPE_ARCHIVOS/TOPE_BYTES en este script si de verdad " +
    "hace falta respaldar todo, o respalda la cubeta aparte (por ejemplo desde el panel de " +
    "Supabase, o replicando el bucket) en vez de meterlo dentro de este respaldo rapido."
  );
  process.exit(1);
}

// Descargar SI es leer -- nada de mover ni borrar del bucket. Se guardan
// junto al JSON, respetando la ruta interna de la cubeta, para que una
// lista de nombres no sea lo unico que quede si hay que recuperar de verdad.
for (const cubeta of CUBETAS) {
  for (const archivo of datos[`cubeta_${cubeta}`]) {
    const { data: blob, error: eDescarga } =
      await supabase.storage.from(cubeta).download(archivo.ruta);
    if (eDescarga) {
      console.error(`[respaldo] descarga ${cubeta}/${archivo.ruta}: ${eDescarga.message}`);
      process.exit(1);
    }
    const destinoArchivo = join(carpetaArchivos, cubeta, archivo.ruta);
    mkdirSync(dirname(destinoArchivo), { recursive: true });
    writeFileSync(destinoArchivo, Buffer.from(await blob.arrayBuffer()));
    archivo.local = destinoArchivo;
  }
  console.log(`  cubeta ${cubeta}: ${datos[`cubeta_${cubeta}`].length} archivos bajados`);
}

writeFileSync(destino, JSON.stringify(datos, null, 1), "utf8");
console.log(`\nRespaldo escrito en:\n  ${destino}`);
console.log(`Archivos de las cubetas en:\n  ${carpetaArchivos}`);
