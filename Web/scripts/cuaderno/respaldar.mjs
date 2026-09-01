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
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

const sello = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const destino = resolve(
  process.env.USERPROFILE || process.env.HOME,
  "Downloads",
  `morcast-respaldo-${sello}.json`
);

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

for (const cubeta of ["comprobantes", "evidencias"]) {
  const { data } = await supabase.storage.from(cubeta).list("", { limit: 1000 });
  datos[`cubeta_${cubeta}`] = data || [];
  console.log(`  cubeta ${cubeta}: ${(data || []).length} entradas`);
}

writeFileSync(destino, JSON.stringify(datos, null, 1), "utf8");
console.log(`\nRespaldo escrito en:\n  ${destino}`);
