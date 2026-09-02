/**
 * Comprueba si la migración 021 quedó aplicada de verdad:
 * las tres tablas, la función del freno, la cubeta privada, y que lo que ya
 * existia sigue intacto.
 *
 * OJO: NO es de solo lectura. Comprobar el freno exige llamarlo, y llamarlo
 * escribe. Se usa un telefono imposible y se borra su rastro al final.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Telefono imposible, para no chocar nunca con el de una persona real. */
const TELEFONO_DE_PRUEBA = "0000000000";

let fallos = 0;
const ok = (b, texto, extra = "") => {
  if (!b) fallos++;
  console.log(`${b ? "OK  " : "FALTA"} ${texto}${extra ? " — " + extra : ""}`);
};

console.log("=== LAS TRES TABLAS NUEVAS ===");
for (const t of ["vacantes", "solicitudes_empleo", "intentos_empleo"]) {
  // OJO: con `head: true` una tabla inexistente puede NO devolver error y
  // dejar `count` en null. Se exige que el conteo sea un numero de verdad.
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  ok(!error && typeof count === "number", t, error ? error.message.slice(0, 60) : `${count} filas`);
}

console.log("\n=== LAS COLUMNAS QUE LA APLICACION ESCRIBE ===");
// Un select de las columnas exactas: si falta una, Postgres lo dice por nombre.
const { error: eV } = await sb
  .from("vacantes")
  .select("id, puesto, area, tipo, descripcion, requisitos, estado, creada_por, creado")
  .limit(1);
ok(!eV, "vacantes tiene sus 9 columnas", eV?.message.slice(0, 70));

const { error: eS } = await sb
  .from("solicitudes_empleo")
  .select("id, folio, nombre, telefono, correo, puesto, vacante_id, experiencia, cv_ruta, estado, notas, aviso_aceptado_en, aviso_version, creado")
  .limit(1);
ok(!eS, "solicitudes_empleo tiene sus 14 columnas", eS?.message.slice(0, 70));

console.log("\n=== LAS DOS FUNCIONES DEL FRENO ===");
const { data: freno, error: eF } = await sb.rpc("puede_solicitar_empleo", {
  p_telefono: TELEFONO_DE_PRUEBA,
});
ok(!eF, "puede_solicitar_empleo responde", eF ? eF.message.slice(0, 60) : `devolvio ${freno}`);

const { error: eD } = await sb.rpc("devolver_intento_empleo", { p_telefono: TELEFONO_DE_PRUEBA });
ok(!eD, "devolver_intento_empleo responde", eD?.message.slice(0, 60));

console.log("\n=== LA CUBETA ===");
const { data: cubetas, error: eB } = await sb.storage.listBuckets();
const cur = (cubetas || []).find((b) => b.name === "curriculums");
ok(!eB && Boolean(cur), "existe la cubeta curriculums", eB?.message);
if (cur) ok(cur.public === false, "la cubeta es PRIVADA", cur.public ? "🔴 ESTA PUBLICA" : "");

console.log("\n=== LO QUE YA EXISTIA, INTACTO ===");
const { count: nCli } = await sb.from("clientes").select("*", { count: "exact", head: true });
const { count: nPer } = await sb.from("perfiles").select("*", { count: "exact", head: true });
const { count: nSus } = await sb.from("suscripciones").select("*", { count: "exact", head: true });
const { count: nRut } = await sb.from("rutas").select("*", { count: "exact", head: true });
console.log(`     clientes: ${nCli} · perfiles: ${nPer} · suscripciones: ${nSus} · rutas: ${nRut}`);
ok(nCli >= 43, "los clientes siguen ahi", `${nCli} (43 reales + la cuenta de demostracion)`);

// Se limpia lo que esta misma comprobacion escribio: para saber si el freno
// responde hay que LLAMARLO, y llamarlo escribe un renglon. Un verificador
// que deja residuo acaba ensuciando justo lo que vigila.
await sb.from("intentos_empleo").delete().eq("telefono", TELEFONO_DE_PRUEBA);

console.log("\n=== RESULTADO ===");
console.log(fallos === 0 ? "TODO LISTO. La migracion quedo aplicada." : `FALTAN ${fallos} cosas.`);
process.exit(fallos === 0 ? 0 : 1);
