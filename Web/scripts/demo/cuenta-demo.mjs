/**
 * LA CUENTA DE DEMOSTRACIÓN DEL PORTAL (cliente@demo.com)
 *
 * POR QUÉ EXISTE ESTE SCRIPT
 * El 1-sep-2026, al cargar la operación real, se borraron los 5 clientes de
 * prueba — y con ellos se fue el usuario `cliente@demo.com` entero, no sólo su
 * empresa. Esa es **la cuenta que usa el revisor de Google Play**, y está
 * publicada en el README del repo (que es público). Sin ella, una revisión de
 * la app se queda fuera en la primera pantalla.
 *
 * POR QUÉ NO SE CUELGA DE UN CLIENTE REAL
 * La contraseña es pública. Todo lo que esta cuenta vea, lo ve cualquiera que
 * lea el README: nombre de la empresa, domicilios, servicios, saldos. Colgarla
 * de uno de los 43 clientes reales sería publicar sus datos. Por eso se le crea
 * su PROPIA empresa ficticia, marcada para que nadie la confunda con un cliente.
 *
 * LO QUE ESCRIBE — exactamente tres filas, ni una más:
 *   1. el usuario en Supabase Auth (con `app_metadata.rol = "cliente"`, que es
 *      de donde `proxy.js` lee el rol; en `user_metadata` NO, que eso lo puede
 *      editar el propio usuario desde su navegador),
 *   2. la empresa ficticia en `clientes`,
 *   3. el perfil en `perfiles`, amarrado a esa empresa.
 * NO toca domicilios, suscripciones, rutas ni recolecciones: el portal de esta
 * cuenta se ve con sus estados vacíos, que es la verdad de hoy.
 *
 * CÓMO SE USA
 *   node scripts/demo/cuenta-demo.mjs                 → ensayo, no escribe
 *   node scripts/demo/cuenta-demo.mjs --de-verdad     → crea
 *   node scripts/demo/cuenta-demo.mjs --quitar        → ensayo del borrado
 *   node scripts/demo/cuenta-demo.mjs --quitar --de-verdad
 *
 * Es idempotente: correrlo dos veces no duplica nada.
 *
 * 🔴 CUÁNDO SE BORRA: cuando la empresa lance la web y la app de verdad. El
 * borrado sólo toca lo que lleva el folio de abajo; si alguien le cambia el
 * nombre a la empresa, el script se detiene antes que adivinar.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

/** La identidad de la cuenta. El folio NO sigue el patrón MOR-<año>-<n> a
 *  propósito: así salta a la vista en cualquier lista ordenada por folio. */
const DEMO = {
  folio: "MOR-DEMO-0001",
  empresa: "DEMOSTRACIÓN · No es un cliente real",
  // El portal saluda con la ULTIMA palabra del contacto ("Hola, X 👋"), asi
  // que esta se escoge para que se lea bien sola y con mayuscula.
  contacto: "Cuenta Demo",
  correo: "cliente@demo.com",
  telefono: "868 000 0000",
  // La que está publicada en el README. Cambiarla aquí sin cambiarla allá deja
  // al revisor de Google Play afuera.
  password: "0011002",
};

const argumentos = process.argv.slice(2);
const DE_VERDAD = argumentos.includes("--de-verdad");
const QUITAR = argumentos.includes("--quitar");

function leerEnv() {
  const texto = fs.readFileSync(".env.local", "utf8");
  return Object.fromEntries(
    texto
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const env = leerEnv();
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** El usuario de auth con ese correo, o null. */
async function buscarUsuario() {
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => (u.email || "").toLowerCase() === DEMO.correo) || null;
}

/** La empresa ficticia, buscada por FOLIO (no por nombre: el nombre se edita). */
async function buscarEmpresa() {
  const { data, error } = await sb
    .from("clientes")
    .select("id, folio, empresa, estado")
    .eq("folio", DEMO.folio)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function crear() {
  const usuarioPrevio = await buscarUsuario();
  const empresaPrevia = await buscarEmpresa();
  const { count: totalAntes } = await sb
    .from("clientes")
    .select("*", { count: "exact", head: true });

  console.log("Estado de hoy:");
  console.log(`  clientes en la base : ${totalAntes}`);
  console.log(`  usuario ${DEMO.correo} : ${usuarioPrevio ? "YA EXISTE" : "no existe"}`);
  console.log(`  empresa ${DEMO.folio}  : ${empresaPrevia ? `YA EXISTE (${empresaPrevia.empresa})` : "no existe"}`);
  console.log("");
  console.log("Lo que va a pasar:");
  if (!usuarioPrevio) console.log(`  + crear el usuario ${DEMO.correo}`);
  else console.log(`  = el usuario ya está; sólo se le repone la contraseña y el rol`);
  if (!empresaPrevia) console.log(`  + crear la empresa "${DEMO.empresa}" con folio ${DEMO.folio}`);
  else console.log(`  = la empresa ya está`);
  console.log(`  + amarrar el perfil a esa empresa, con rol cliente`);
  console.log(`  → el padrón queda en ${totalAntes + (empresaPrevia ? 0 : 1)} clientes`);
  console.log("");

  if (!DE_VERDAD) {
    console.log("ENSAYO. No se escribió nada. Para hacerlo: --de-verdad");
    return;
  }

  // 1) La empresa primero: el usuario necesita su id para el sello.
  let empresa = empresaPrevia;
  if (empresa) {
    // Ya estaba: se le reponen los campos por si alguien los movio. Solo esta
    // fila, buscada por folio.
    const { error } = await sb
      .from("clientes")
      .update({
        empresa: DEMO.empresa,
        contacto: DEMO.contacto,
        correo: DEMO.correo,
        telefono: DEMO.telefono,
        estado: "activo",
      })
      .eq("id", empresa.id);
    if (error) {
      console.error("No se pudo reponer la empresa:", error.message);
      process.exit(1);
    }
    console.log(`✓ empresa repuesta: ${empresa.folio}`);
  }
  if (!empresa) {
    const { data, error } = await sb
      .from("clientes")
      .insert({
        folio: DEMO.folio,
        empresa: DEMO.empresa,
        contacto: DEMO.contacto,
        correo: DEMO.correo,
        telefono: DEMO.telefono,
        estado: "activo",
      })
      .select("id, folio, empresa")
      .single();
    if (error) {
      console.error("No se pudo crear la empresa:", error.message);
      process.exit(1);
    }
    empresa = data;
    console.log(`✓ empresa creada: ${empresa.folio} · ${empresa.empresa}`);
  }

  // 2) El usuario. El rol y la empresa van en `app_metadata`: es lo que lee
  //    `proxy.js` del token, y es lo único que el propio usuario no puede
  //    editar desde su navegador.
  let uid = usuarioPrevio?.id;
  if (!uid) {
    const { data, error } = await sb.auth.admin.createUser({
      email: DEMO.correo,
      password: DEMO.password,
      email_confirm: true,
      app_metadata: { rol: "cliente", cliente_id: empresa.id },
      user_metadata: { nombre: DEMO.contacto },
    });
    if (error || !data?.user) {
      // Si acabamos de crear la empresa y el usuario falla, se deshace: dejar
      // una empresa huérfana en el padrón es peor que no hacer nada.
      if (!empresaPrevia) await sb.from("clientes").delete().eq("id", empresa.id);
      console.error("No se pudo crear el usuario:", error?.message || "error desconocido");
      process.exit(1);
    }
    uid = data.user.id;
    console.log(`✓ usuario creado: ${DEMO.correo}`);
  } else {
    const { error } = await sb.auth.admin.updateUserById(uid, {
      password: DEMO.password,
      email_confirm: true,
      app_metadata: { rol: "cliente", cliente_id: empresa.id },
    });
    if (error) {
      console.error("No se pudo actualizar el usuario:", error.message);
      process.exit(1);
    }
    console.log(`✓ usuario repuesto: ${DEMO.correo}`);
  }

  // 3) El perfil. Un disparador de la base (db/003) lo crea al nacer el
  //    usuario, con `cliente_id` nulo; aquí se completa. El UPDATE que no
  //    encuentra fila NO da error, así que se cuentan las filas.
  const { data: previo } = await sb.from("perfiles").select("id").eq("id", uid).maybeSingle();
  const fila = {
    nombre: DEMO.contacto,
    rol: "cliente",
    cliente_id: empresa.id,
    telefono: DEMO.telefono,
    activo: true,
  };
  const { data: perfil, error: errPerfil } = previo
    ? await sb.from("perfiles").update(fila).eq("id", uid).select("id")
    : await sb.from("perfiles").insert({ id: uid, ...fila }).select("id");
  if (errPerfil || !perfil?.length) {
    console.error("No se pudo amarrar el perfil:", errPerfil?.message || "no cambió ninguna fila");
    process.exit(1);
  }
  console.log(`✓ perfil amarrado a ${empresa.folio}`);
  console.log("");
  console.log(`LISTO. Entra en https://morcast.mx/portal/login con ${DEMO.correo} / ${DEMO.password}`);
}

async function quitar() {
  const usuario = await buscarUsuario();
  const empresa = await buscarEmpresa();

  console.log("Lo que va a pasar:");
  console.log(`  ${usuario ? "- borrar" : "= no está"} el usuario ${DEMO.correo}`);
  console.log(`  ${empresa ? `- borrar` : "= no está"} la empresa ${DEMO.folio}${empresa ? ` ("${empresa.empresa}")` : ""}`);
  console.log("  (el perfil se va solo: cuelga del usuario con ON DELETE CASCADE)");
  console.log("");

  // Guardia: si el folio existe pero con otro nombre, alguien lo editó a mano
  // o lo reusó. No se adivina.
  if (empresa && empresa.empresa !== DEMO.empresa) {
    console.error(`ALTO: ${DEMO.folio} existe pero se llama "${empresa.empresa}", no "${DEMO.empresa}".`);
    console.error("No se borra nada. Revísalo a mano antes de seguir.");
    process.exit(1);
  }

  if (!DE_VERDAD) {
    console.log("ENSAYO. No se borró nada. Para hacerlo: --quitar --de-verdad");
    return;
  }

  if (usuario) {
    const { error } = await sb.auth.admin.deleteUser(usuario.id);
    if (error) { console.error("No se pudo borrar el usuario:", error.message); process.exit(1); }
    console.log("✓ usuario borrado");
  }
  if (empresa) {
    const { error } = await sb.from("clientes").delete().eq("id", empresa.id);
    if (error) { console.error("No se pudo borrar la empresa:", error.message); process.exit(1); }
    console.log("✓ empresa borrada");
  }
  console.log("\nLISTO. El padrón vuelve a quedar sólo con los clientes reales.");
}

await (QUITAR ? quitar() : crear());
