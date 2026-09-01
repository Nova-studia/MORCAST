/**
 * BORRA LOS 5 CLIENTES DE PRUEBA Y LAS 3 RUTAS DEMO.
 *
 *   node scripts/cuaderno/limpiar.mjs              (ensayo)
 *   node scripts/cuaderno/limpiar.mjs --de-verdad  (borra)
 *
 * ⚠️ NO CORRE SIN RESPALDO. Comprueba que exista un
 * `morcast-respaldo-*.json` de hoy antes de tocar nada.
 *
 * ⚠️ NO SE DESENGANCHA NADA. `perfiles.id` referencia `auth.users(id)` ON
 * DELETE CASCADE: borrar el usuario de Supabase se lleva su perfil solo. Los
 * 5 perfiles de aqui SON de prueba, no gente real atrapada en una empresa que
 * se va a borrar. La proteccion de verdad va ANTES de borrar nada: si alguno
 * de esos perfiles fuera personal de Morcast (`dueno` u `operador`) colgado
 * de una de estas empresas, el script para y sale sin tocar nada — eso si
 * seria una senal de que algo esta mal armado y hay que mirarlo a mano.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DE_VERDAD = process.argv.includes("--de-verdad");
const FOLIOS = ["MOR-2026-0001", "MOR-2026-0002", "MOR-2026-0003", "MOR-2026-0004", "MOR-2026-0005"];
const RUTAS_DEMO = ["RT-CENTRO", "RT-INDUSTRIAL", "RT-NORTE"];

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

// Sin respaldo de HOY, no se borra.
const hoy = new Date().toISOString().slice(0, 10);
const respaldos = readdirSync(join(homedir(), "Downloads"))
  .filter((f) => f.startsWith(`morcast-respaldo-${hoy}`));
if (!respaldos.length) {
  console.error(`No hay respaldo de hoy en Downloads. Corre primero:\n  node scripts/cuaderno/respaldar.mjs`);
  process.exit(1);
}
console.log(`Respaldo encontrado: ${respaldos[respaldos.length - 1]}`);

const { data: cli } = await supabase.from("clientes").select("id, folio, empresa").in("folio", FOLIOS);
const ids = (cli || []).map((c) => c.id);
console.log(`\nClientes a borrar (${cli?.length ?? 0}):`);
for (const c of cli || []) console.log(`  ${c.folio}  ${c.empresa}`);

const { data: perfiles } = await supabase.from("perfiles").select("id, nombre, rol").in("cliente_id", ids);
console.log(`Perfiles a borrar (se van con su usuario, por cascada): ${perfiles?.length ?? 0}`);

// LA PROTECCION DE VERDAD. Si alguno de estos perfiles es personal de
// Morcast (dueno u operador) colgado de una de las empresas de prueba, NO es
// un caso de "borra y ya": significa que alguien que SI necesita entrar
// quedo mal amarrado, y borrar su usuario lo dejaria sin acceso para
// siempre. Los perfiles de rol `cliente` de esta lista, en cambio, son
// exactamente lo que hay que borrar.
const personal = (perfiles || []).filter((p) => p.rol === "dueno" || p.rol === "operador");
if (personal.length) {
  console.error(`\n🔴 HAY PERSONAL DE MORCAST COLGADO DE UNA EMPRESA DE PRUEBA (${personal.length}):`);
  for (const p of personal) console.error(`  ${p.nombre}  (rol: ${p.rol})`);
  console.error(`Esto no se borra solo. Revisalo a mano antes de seguir.`);
  process.exit(1);
}

// ⚠️ SOLO las fotos de los clientes de prueba. Antes esto leia TODAS las
// recolecciones sin filtro. Hoy no haria dano —las 2 que existen son de
// prueba— pero es una bomba de tiempo: si este script se vuelve a correr
// cuando ya haya evidencia real, borraria las fotos de clientes reales y
// dejaria sus filas apuntando a archivos que ya no estan.
const { data: solicitudesPrueba } = await supabase
  .from("solicitudes_recoleccion").select("id").in("cliente_id", ids);
const idsSolicitud = (solicitudesPrueba || []).map((s) => s.id);

const { data: recs } = idsSolicitud.length
  ? await supabase.from("recolecciones")
      .select("id, foto_antes, foto_despues").in("solicitud_id", idsSolicitud)
  : { data: [] };
const fotos = (recs || []).flatMap((r) => [r.foto_antes, r.foto_despues]).filter(Boolean);
console.log(`Fotos en la cubeta a borrar: ${fotos.length}`);

if (!DE_VERDAD) {
  console.log(`\nENSAYO. Para borrar de verdad:  node scripts/cuaderno/limpiar.mjs --de-verdad`);
  process.exit(0);
}

// El orden respeta las llaves foraneas. Las fotos ANTES que las filas: si se
// borran las filas primero, quedan archivos huerfanos que nadie podra
// relacionar con nada.
if (fotos.length) {
  const { error } = await supabase.storage.from("evidencias").remove(fotos);
  if (error) console.error(`[fotos] ${error.message}`);
  else console.log(`Borradas ${fotos.length} fotos`);
}

const borra = async (tabla, columna, valores) => {
  const { data, error } = await supabase.from(tabla).delete().in(columna, valores).select("id");
  if (error) { console.error(`[${tabla}] ${error.message}`); process.exit(1); }
  console.log(`  ${tabla}: ${data.length} filas`);
};

if (idsSolicitud.length) await borra("recolecciones", "solicitud_id", idsSolicitud);
await borra("solicitudes_recoleccion", "cliente_id", ids);
await borra("movimientos_saldo", "cliente_id", ids);
await borra("suscripciones", "cliente_id", ids);
await borra("domicilios", "cliente_id", ids);

// BORRAR LOS USUARIOS DE SUPABASE. Nada de desenganchar `cliente_id` antes:
// `perfiles.id` -> `auth.users(id)` ON DELETE CASCADE se lleva el perfil
// solo, y ya se comprobo arriba que ninguno es personal de Morcast. Si el
// borrado de un usuario falla, se para: seguir dejaria un perfil huerfano
// apuntando a una empresa que esta a punto de borrarse.
for (const p of perfiles || []) {
  const { error } = await supabase.auth.admin.deleteUser(p.id);
  if (error) {
    console.error(`[usuario ${p.id} / ${p.nombre}] ${error.message}`);
    console.error(`SE DETIENE: seguir dejaria un perfil huerfano apuntando a una empresa por borrarse.`);
    process.exit(1);
  }
}
console.log(`  usuarios de Supabase borrados: ${perfiles?.length ?? 0}`);

// COMPROBAR que la cascada de verdad se llevo los perfiles. Si alguno sigue
// ahi, borrar la empresa ahora si se lo llevaria, pero no por la via que se
// penso — mejor enterarse aqui que despues de borrar `clientes`.
const { data: sobrantes } = await supabase.from("perfiles").select("id").in("cliente_id", ids);
if (sobrantes?.length) {
  console.error(`Quedan ${sobrantes.length} perfiles sin borrar tras deleteUser. SE DETIENE.`);
  process.exit(1);
}
console.log(`  perfiles borrados por cascada: confirmado (0 restantes)`);

await borra("clientes", "id", ids);
await borra("rutas", "clave", RUTAS_DEMO);

const { count } = await supabase.from("clientes").select("id", { count: "exact", head: true });
console.log(`\nClientes que quedan en la base: ${count}`);
