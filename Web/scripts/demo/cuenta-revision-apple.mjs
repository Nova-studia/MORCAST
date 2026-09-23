/**
 * LA CUENTA DEL REVISOR DE LA APP STORE (revision.apple@morcast.mx)
 *
 * POR QUÉ EXISTE
 * El sistema está en modo Hold (`Web/lib/estado-sistema.js`): del lado del
 * cliente todas las cifras salen como "—" y la app dice "Sistema en
 * preparación". Apple puede leer eso como una app incompleta (guía 2.1) y
 * rechazarla. Luis decidió (23-sep-2026) NO apagar el Hold global: los 43
 * clientes reales y el cotizador público siguen igual. En su lugar, esta
 * cuenta de muestra — y SÓLO ella — ve la app completa.
 *
 * CÓMO LA RECONOCE LA APP (App IOS / App Android, `src/cuenta-muestra.js`)
 * Hacen falta las dos cosas, y este script pone las dos:
 *   · `app_metadata.demo = true` en el usuario (sólo la llave de servicio
 *     puede escribirlo; el usuario no puede ponérselo solo),
 *   · la empresa con folio `MOR-DEMO-…`.
 * ⚠️ Hace falta un build de la app que ya traiga `cuenta-muestra.js`. Con un
 * build anterior esta cuenta se ve en Hold como cualquier otra.
 *
 * LO QUE ESCRIBE (todo colgado de la empresa MOR-DEMO-0002)
 *   1. la empresa "Demo Apple Review" en `clientes`,
 *   2. el usuario en Supabase Auth (rol cliente + demo) y su perfil,
 *   3. una ruta propia, RT-DEMO, INACTIVA, sin chofer y sin zona: no sale en
 *      el mapa de cobertura, no se ofrece en las altas y ningún chofer real
 *      la recibe en su día,
 *   4. dos puntos de recolección y sus suscripciones,
 *   5. ~10 servicios COMPLETADOS en las últimas semanas, cada uno con su
 *      evidencia (peso, contenedor, horas y las dos fotos en la cubeta
 *      `evidencias`), y 2 servicios CONFIRMADOS para los próximos días.
 * NO escribe dinero: ni `movimientos_saldo` ni comprobantes. Los montos que
 * ve el revisor son de muestra y salen de la app. Si se sembraran aquí, el
 * panel de Morcast los sumaría en "Por cobrar" y "Cobranza", que hoy son
 * cifras reales.
 *
 * LO QUE SÍ VERÁ MORCAST EN SU PANEL mientras exista la cuenta: la empresa
 * "Demo Apple Review" en Clientes (+1 activo), la ruta RT-DEMO (inactiva) y
 * sus servicios en la agenda y en los reportes de peso. Todo lleva "DEMO" en
 * el folio. Se quita entera con --quitar.
 *
 * LA CONTRASEÑA NO VIVE AQUÍ (el repo es PÚBLICO). Se lee de la variable
 * APPLE_DEMO_PASSWORD o del archivo `Web/.env.revision-apple`
 * (`APPLE_DEMO_PASSWORD=...`), que `.gitignore` deja fuera por `.env*`.
 *
 * CÓMO SE USA (desde la carpeta Web)
 *   node scripts/demo/cuenta-revision-apple.mjs --plan      → sólo imprime lo que sembraría; NO se conecta
 *   node scripts/demo/cuenta-revision-apple.mjs             → ensayo contra la base: lee, no escribe
 *   node scripts/demo/cuenta-revision-apple.mjs --de-verdad → crea / repone
 *   node scripts/demo/cuenta-revision-apple.mjs --quitar    → ensayo del borrado
 *   node scripts/demo/cuenta-revision-apple.mjs --quitar --de-verdad
 *
 * Es idempotente: volver a correrlo con --de-verdad NO duplica nada; rehace
 * los servicios con fechas nuevas (útil si Apple tarda y los "próximos" ya
 * quedaron en el pasado).
 *
 * 🔴 CUÁNDO SE BORRA: cuando Apple apruebe la app, o cuando se apague el Hold
 * con precios reales. El borrado sólo toca lo que cuelga del folio de abajo;
 * si alguien le cambió el nombre a la empresa, el script se detiene antes que
 * adivinar.
 */
import fs from "node:fs";

const DEMO = {
  folio: "MOR-DEMO-0002",
  empresa: "Demo Apple Review",
  // El saludo usa la ÚLTIMA palabra del contacto: "Hola, Demo 👋".
  contacto: "Cuenta Demo",
  correo: "revision.apple@morcast.mx",
  telefono: "868 000 0002",
  // RFC genérico del SAT para "público en general": no es de nadie.
  rfc: "XAXX010101000",
  regimen: "601 · General de Ley Personas Morales",
  uso_cfdi: "G03 · Gastos en general",
  domicilio_fiscal: "Av. del Parque Industrial 1450, Parque Industrial del Norte, Matamoros, Tamps.",
  codigo_postal: "87316",
  plan: "Servicio industrial · Ruta semanal",
  nota_interna:
    "CUENTA DE DEMOSTRACIÓN para la revisión de Apple App Store. NO es un cliente real. " +
    "Se crea y se borra con Web/scripts/demo/cuenta-revision-apple.mjs.",
};

const RUTA = {
  clave: "RT-DEMO",
  nombre: "Ruta de demostración",
  tipo: "roll-off",
  dias: ["lunes", "jueves"],
  unidad: "Unidad 07 · Roll-off",
  chofer: "Operador de demostración",
  cupo: 10,
  // INACTIVA y sin zona a propósito: ver el encabezado.
  activa: false,
  zona: [],
};

const PUNTOS = [
  {
    alias: "Planta Norte",
    calle: "Av. del Parque Industrial 1450",
    colonia: "Parque Industrial del Norte",
    cp: "87316",
    qr: "CONT-DEMO-06A",
    // `frecuencia` queda en "mensual" como en la operación real (db/010: lo
    // que manda es `servicios_por_mes`).
    suscripcion: {
      frecuencia: "mensual",
      servicios_por_mes: 8,
      dias: ["lunes", "jueves"],
      equipo: [{ tipo: "Contenedor", medida: "6 m³", cantidad: 2 }],
    },
  },
  {
    alias: "Almacén Sur",
    calle: "Blvd. de las Industrias 220",
    colonia: "Ciudad Industrial",
    cp: "87499",
    qr: "CONT-DEMO-03B",
    suscripcion: {
      frecuencia: "mensual",
      servicios_por_mes: 2,
      dias: ["lunes", "jueves"],
      equipo: [{ tipo: "Contenedor", medida: "3 m³", cantidad: 1 }],
    },
  },
];

// Las dos fotos de muestra salen de las imágenes públicas de la web.
const FOTO_ANTES = "public/img/cont-bolsas.jpg"; // contenedor lleno
const FOTO_DESPUES = "public/img/cont-verde.jpg"; // contenedor vacío

// Pesos de muestra, en kg, para los servicios completados (del más reciente
// al más viejo). Fijos: correr dos veces da los mismos reportes.
const PESOS_KG = [640, 712, 588, 805, 690, 735, 610, 842, 668, 720];
const CUANTOS_COMPLETADOS = PESOS_KG.length;
const CUANTOS_PROXIMOS = 2;

const argumentos = process.argv.slice(2);
const DE_VERDAD = argumentos.includes("--de-verdad");
const QUITAR = argumentos.includes("--quitar");
const SOLO_PLAN = argumentos.includes("--plan");

/* ------------------------------------------------------------------ */
/* Fechas                                                              */
/* ------------------------------------------------------------------ */

const DIA_JS = { domingo: 0, lunes: 1, martes: 2, "miércoles": 3, jueves: 4, viernes: 5, "sábado": 6 };

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Matamoros sigue el horario de verano de EE.UU. (franja fronteriza):
 * -05:00 del 2º domingo de marzo al 1er domingo de noviembre, -06:00 el resto.
 */
function desfaseMatamoros(fecha) {
  const a = fecha.getFullYear();
  const domingo = (mes, n) => {
    const d = new Date(a, mes, 1);
    d.setDate(1 + ((7 - d.getDay()) % 7) + 7 * (n - 1));
    return d;
  };
  const verano = fecha >= domingo(2, 2) && fecha < domingo(10, 1);
  return verano ? "-05:00" : "-06:00";
}

function marcaDeTiempo(fecha, hora) {
  return `${iso(fecha)}T${hora}:00${desfaseMatamoros(fecha)}`;
}

/** Los días de ruta hacia atrás (desde ayer) o hacia adelante (desde mañana). */
function diasDeRuta(cuantos, sentido) {
  const dias = new Set(RUTA.dias.map((d) => DIA_JS[d]));
  const out = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (out.length < cuantos) {
    d.setDate(d.getDate() + sentido);
    if (dias.has(d.getDay())) out.push(new Date(d));
  }
  return out;
}

/** Los servicios que se sembrarían hoy, sin ids (esos los pone la base). */
function planDeServicios() {
  const pasados = diasDeRuta(CUANTOS_COMPLETADOS, -1);
  const proximos = diasDeRuta(CUANTOS_PROXIMOS, +1);
  const servicios = [];
  let n = 0;

  // Del más viejo al más reciente, para que el folio crezca con la fecha.
  pasados.reverse().forEach((fecha, i) => {
    n += 1;
    // El Almacén Sur va cada tercer servicio, y uno de ellos es un "extra".
    const punto = i % 3 === 2 ? PUNTOS[1] : PUNTOS[0];
    servicios.push({
      folio: `REC-DEMO-${String(n).padStart(4, "0")}`,
      alias: punto.alias,
      origen: i === 4 ? "extra" : "ruta",
      fecha: iso(fecha),
      estado: "completada",
      hora_confirmada: "09:30",
      evidencia: {
        qr: punto.qr,
        peso_kg: PESOS_KG[PESOS_KG.length - 1 - i],
        hora_antes: marcaDeTiempo(fecha, "09:41"),
        hora_despues: marcaDeTiempo(fecha, "09:53"),
      },
    });
  });
  proximos.forEach((fecha) => {
    n += 1;
    servicios.push({
      folio: `REC-DEMO-${String(n).padStart(4, "0")}`,
      alias: PUNTOS[0].alias,
      origen: "ruta",
      fecha: iso(fecha),
      estado: "confirmada",
      hora_confirmada: "09:30",
      evidencia: null,
    });
  });
  return servicios;
}

function imprimirPlan() {
  console.log(`Empresa  : ${DEMO.folio} · ${DEMO.empresa} (contacto "${DEMO.contacto}", ${DEMO.correo})`);
  console.log(`Usuario  : ${DEMO.correo} · app_metadata { rol: "cliente", demo: true, cliente_id }`);
  console.log(`Ruta     : ${RUTA.clave} · ${RUTA.nombre} · ${RUTA.dias.join("/")} · activa=${RUTA.activa} · sin chofer`);
  for (const p of PUNTOS) {
    console.log(`Punto    : ${p.alias} · ${p.calle}, ${p.colonia} · ${p.suscripcion.servicios_por_mes} servicios/mes`);
  }
  const plan = planDeServicios();
  for (const s of plan) {
    const ev = s.evidencia ? ` · ${s.evidencia.peso_kg} kg · ${s.evidencia.qr} · fotos antes/después` : "";
    console.log(`Servicio : ${s.folio} · ${s.fecha} · ${s.estado.padEnd(10)} · ${s.origen.padEnd(5)} · ${s.alias}${ev}`);
  }
  const kg = plan.reduce((t, s) => t + (s.evidencia?.peso_kg || 0), 0);
  console.log(`Total    : ${plan.length} servicios (${CUANTOS_COMPLETADOS} completados, ${CUANTOS_PROXIMOS} próximos), ${kg} kg recolectados`);
  console.log("Dinero   : NADA en la base (los montos de muestra salen de la app)");
}

if (SOLO_PLAN) {
  console.log("PLAN (no se conecta a ninguna base)\n");
  imprimirPlan();
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* Conexión                                                            */
/* ------------------------------------------------------------------ */

function leerArchivoEnv(ruta) {
  if (!fs.existsSync(ruta)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(ruta, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const env = leerArchivoEnv(".env.local");
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local (corre esto desde la carpeta Web).");
  process.exit(1);
}
const PASSWORD =
  process.env.APPLE_DEMO_PASSWORD || leerArchivoEnv(".env.revision-apple").APPLE_DEMO_PASSWORD || "";

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function alto(mensaje, error) {
  console.error(`ALTO: ${mensaje}${error ? ` — ${error.message || error}` : ""}`);
  process.exit(1);
}

async function buscarUsuario() {
  // Se recorren todas las páginas: con `perPage` fijo, un usuario de la
  // segunda página "no existiría" y se intentaría crear otra vez.
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => (x.email || "").toLowerCase() === DEMO.correo);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function buscarEmpresa() {
  const { data, error } = await sb
    .from("clientes")
    .select("id, folio, empresa, estado")
    .eq("folio", DEMO.folio)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function buscarRuta() {
  const { data, error } = await sb
    .from("rutas")
    .select("id, clave, nombre, chofer_id")
    .eq("clave", RUTA.clave)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Borra los servicios de la empresa demo y las fotos de sus carpetas. */
async function borrarServicios(clienteId) {
  const { data: previos, error } = await sb
    .from("solicitudes_recoleccion")
    .select("id")
    .eq("cliente_id", clienteId);
  if (error) alto("no se pudieron leer los servicios previos", error);

  for (const s of previos || []) {
    const { data: archivos } = await sb.storage.from("evidencias").list(s.id);
    const rutas = (archivos || []).map((a) => `${s.id}/${a.name}`);
    if (rutas.length) {
      const { error: e } = await sb.storage.from("evidencias").remove(rutas);
      if (e) alto(`no se pudieron borrar las fotos de ${s.id}`, e);
    }
  }
  if (previos?.length) {
    // Las `recolecciones` se van solas: cuelgan del servicio con ON DELETE CASCADE.
    const { error: e } = await sb.from("solicitudes_recoleccion").delete().eq("cliente_id", clienteId);
    if (e) alto("no se pudieron borrar los servicios previos", e);
  }
  return previos?.length || 0;
}

/* ------------------------------------------------------------------ */
/* Crear / reponer                                                     */
/* ------------------------------------------------------------------ */

async function crear() {
  const usuarioPrevio = await buscarUsuario();
  const empresaPrevia = await buscarEmpresa();
  const rutaPrevia = await buscarRuta();

  console.log("Estado de hoy:");
  console.log(`  usuario ${DEMO.correo} : ${usuarioPrevio ? "YA EXISTE" : "no existe"}`);
  console.log(`  empresa ${DEMO.folio}          : ${empresaPrevia ? `YA EXISTE (${empresaPrevia.empresa})` : "no existe"}`);
  console.log(`  ruta ${RUTA.clave}                : ${rutaPrevia ? "YA EXISTE" : "no existe"}`);
  console.log("");
  console.log("Lo que va a sembrar:");
  imprimirPlan();
  console.log("");

  if (empresaPrevia && empresaPrevia.empresa !== DEMO.empresa) {
    alto(`${DEMO.folio} existe pero se llama "${empresaPrevia.empresa}", no "${DEMO.empresa}". Revísalo a mano.`);
  }
  if (rutaPrevia && rutaPrevia.chofer_id) {
    alto(`${RUTA.clave} tiene un chofer asignado: alguien la está usando. Revísalo a mano.`);
  }
  const sinClave = PASSWORD.length < 14;
  if (sinClave) {
    console.log("⚠ Falta la contraseña (APPLE_DEMO_PASSWORD en el entorno o en Web/.env.revision-apple), o tiene menos de 14 caracteres.");
    if (DE_VERDAD) alto("sin contraseña no se crea el usuario.");
  }

  if (!DE_VERDAD) {
    console.log("ENSAYO. No se escribió nada. Para hacerlo: --de-verdad");
    return;
  }

  // 1) La empresa.
  const filaEmpresa = {
    folio: DEMO.folio,
    empresa: DEMO.empresa,
    contacto: DEMO.contacto,
    correo: DEMO.correo,
    telefono: DEMO.telefono,
    rfc: DEMO.rfc,
    regimen: DEMO.regimen,
    uso_cfdi: DEMO.uso_cfdi,
    domicilio_fiscal: DEMO.domicilio_fiscal,
    codigo_postal: DEMO.codigo_postal,
    plan: DEMO.plan,
    nota_interna: DEMO.nota_interna,
    estado: "activo",
  };
  let empresa = empresaPrevia;
  if (empresa) {
    const { error } = await sb.from("clientes").update(filaEmpresa).eq("id", empresa.id);
    if (error) alto("no se pudo reponer la empresa", error);
    console.log(`✓ empresa repuesta: ${DEMO.folio}`);
  } else {
    const { data, error } = await sb.from("clientes").insert(filaEmpresa).select("id, folio, empresa").single();
    if (error) alto("no se pudo crear la empresa", error);
    empresa = data;
    console.log(`✓ empresa creada: ${DEMO.folio} · ${DEMO.empresa}`);
  }

  // 2) El usuario. `demo: true` va en app_metadata: es lo que lee la app, y
  //    el usuario no lo puede editar.
  const appMetadata = { rol: "cliente", cliente_id: empresa.id, demo: true };
  let uid = usuarioPrevio?.id;
  if (!uid) {
    const { data, error } = await sb.auth.admin.createUser({
      email: DEMO.correo,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: { nombre: DEMO.contacto },
    });
    if (error || !data?.user) {
      if (!empresaPrevia) await sb.from("clientes").delete().eq("id", empresa.id);
      alto("no se pudo crear el usuario", error || "error desconocido");
    }
    uid = data.user.id;
    console.log(`✓ usuario creado: ${DEMO.correo}`);
  } else {
    const { error } = await sb.auth.admin.updateUserById(uid, {
      password: PASSWORD,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (error) alto("no se pudo actualizar el usuario", error);
    console.log(`✓ usuario repuesto: ${DEMO.correo}`);
  }

  // 3) El perfil (el disparador lo crea al nacer el usuario; aquí se amarra).
  const { data: previo } = await sb.from("perfiles").select("id").eq("id", uid).maybeSingle();
  const filaPerfil = { nombre: DEMO.contacto, rol: "cliente", cliente_id: empresa.id, telefono: DEMO.telefono, activo: true };
  const { data: perfil, error: errPerfil } = previo
    ? await sb.from("perfiles").update(filaPerfil).eq("id", uid).select("id")
    : await sb.from("perfiles").insert({ id: uid, ...filaPerfil }).select("id");
  if (errPerfil || !perfil?.length) alto("no se pudo amarrar el perfil", errPerfil || "no cambió ninguna fila");
  console.log(`✓ perfil amarrado a ${DEMO.folio}`);

  // 4) La ruta de demostración.
  let rutaId = rutaPrevia?.id;
  const filaRuta = { ...RUTA, chofer_id: null };
  if (rutaId) {
    const { error } = await sb.from("rutas").update(filaRuta).eq("id", rutaId);
    if (error) alto("no se pudo reponer la ruta", error);
  } else {
    const { data, error } = await sb.from("rutas").insert(filaRuta).select("id").single();
    if (error) alto("no se pudo crear la ruta", error);
    rutaId = data.id;
  }
  console.log(`✓ ruta ${RUTA.clave} (inactiva, sin chofer)`);

  // 5) Los puntos y sus suscripciones. Llave natural: (cliente, alias) y
  //    (cliente, domicilio), las mismas de db/020.
  const idPorAlias = {};
  for (const p of PUNTOS) {
    const filaDom = { cliente_id: empresa.id, alias: p.alias, calle: p.calle, colonia: p.colonia, cp: p.cp };
    const { data: dom } = await sb
      .from("domicilios").select("id").eq("cliente_id", empresa.id).eq("alias", p.alias).maybeSingle();
    let domId = dom?.id;
    if (domId) {
      const { error } = await sb.from("domicilios").update(filaDom).eq("id", domId);
      if (error) alto(`no se pudo reponer el punto ${p.alias}`, error);
    } else {
      const { data, error } = await sb.from("domicilios").insert(filaDom).select("id").single();
      if (error) alto(`no se pudo crear el punto ${p.alias}`, error);
      domId = data.id;
    }
    idPorAlias[p.alias] = domId;

    const filaSus = {
      cliente_id: empresa.id,
      domicilio_id: domId,
      ruta_id: rutaId,
      estado: "activa",
      ...p.suscripcion,
    };
    const { data: sus } = await sb
      .from("suscripciones").select("id").eq("cliente_id", empresa.id).eq("domicilio_id", domId).maybeSingle();
    const { error: eSus } = sus
      ? await sb.from("suscripciones").update(filaSus).eq("id", sus.id)
      : await sb.from("suscripciones").insert(filaSus);
    if (eSus) alto(`no se pudo guardar la suscripción de ${p.alias}`, eSus);
    console.log(`✓ punto ${p.alias} + suscripción`);
  }

  // 6) Los servicios: se borran los de una corrida anterior y se siembran
  //    con fechas de hoy.
  const borrados = await borrarServicios(empresa.id);
  if (borrados) console.log(`✓ ${borrados} servicios de la corrida anterior borrados (con sus fotos)`);

  const bytesAntes = fs.readFileSync(FOTO_ANTES);
  const bytesDespues = fs.readFileSync(FOTO_DESPUES);

  for (const s of planDeServicios()) {
    const { data: sol, error } = await sb
      .from("solicitudes_recoleccion")
      .insert({
        folio: s.folio,
        cliente_id: empresa.id,
        domicilio_id: idPorAlias[s.alias],
        ruta_id: rutaId,
        origen: s.origen,
        fecha_pedida: s.fecha,
        fecha_confirmada: s.fecha,
        hora_confirmada: s.hora_confirmada,
        estado: s.estado,
        nota: s.origen === "extra" ? "Recolección extra por inventario de fin de mes." : "",
      })
      .select("id")
      .single();
    if (error) alto(`no se pudo crear el servicio ${s.folio}`, error);

    if (s.evidencia) {
      // Misma forma de ruta que usa la app del chofer: <id-servicio>/<momento>-<n>.jpg.
      // La carpeta ES el candado: la política de la cubeta deja ver al
      // cliente sólo las carpetas de SUS servicios.
      const antes = `${sol.id}/antes-demo.jpg`;
      const despues = `${sol.id}/despues-demo.jpg`;
      for (const [ruta, bytes] of [[antes, bytesAntes], [despues, bytesDespues]]) {
        const { error: e } = await sb.storage
          .from("evidencias")
          .upload(ruta, bytes, { contentType: "image/jpeg", upsert: true });
        if (e) alto(`no se pudo subir la foto ${ruta}`, e);
      }
      const { error: eRec } = await sb.from("recolecciones").insert({
        solicitud_id: sol.id,
        operador_id: null,
        qr: s.evidencia.qr,
        peso_kg: s.evidencia.peso_kg,
        foto_antes: antes,
        foto_despues: despues,
        hora_antes: s.evidencia.hora_antes,
        hora_despues: s.evidencia.hora_despues,
      });
      if (eRec) alto(`no se pudo guardar la evidencia de ${s.folio}`, eRec);
    }
  }
  console.log(`✓ ${CUANTOS_COMPLETADOS} servicios completados con evidencia + ${CUANTOS_PROXIMOS} próximos`);

  console.log("");
  console.log("LISTO. Datos para App Store Connect → App Review Information → Sign-in required:");
  console.log(`  User name: ${DEMO.correo}`);
  console.log("  Password : (la de APPLE_DEMO_PASSWORD)");
  console.log("  Entrar por \"Portal de clientes\" en la app.");
}

/* ------------------------------------------------------------------ */
/* Quitar                                                              */
/* ------------------------------------------------------------------ */

async function quitar() {
  const usuario = await buscarUsuario();
  const empresa = await buscarEmpresa();
  const ruta = await buscarRuta();

  if (empresa && empresa.empresa !== DEMO.empresa) {
    alto(`${DEMO.folio} existe pero se llama "${empresa.empresa}", no "${DEMO.empresa}". No se borra nada.`);
  }
  if (ruta && ruta.chofer_id) {
    alto(`${RUTA.clave} tiene un chofer asignado: no se borra nada. Revísalo a mano.`);
  }
  let otrosEnRuta = 0;
  if (ruta) {
    const { count } = await sb
      .from("suscripciones")
      .select("id", { count: "exact", head: true })
      .eq("ruta_id", ruta.id)
      .neq("cliente_id", empresa?.id || "00000000-0000-0000-0000-000000000000");
    otrosEnRuta = count || 0;
  }
  if (otrosEnRuta) alto(`${RUTA.clave} tiene ${otrosEnRuta} suscripciones de OTROS clientes. No se borra nada.`);

  console.log("Lo que va a pasar:");
  console.log(`  ${usuario ? "- borrar" : "= no está"} el usuario ${DEMO.correo}`);
  console.log(`  ${empresa ? "- borrar" : "= no está"} la empresa ${DEMO.folio} (y en cascada sus puntos, suscripciones, servicios y evidencias)`);
  console.log(`  ${empresa ? "- borrar" : "= no hay"} las fotos de sus servicios en la cubeta "evidencias"`);
  console.log(`  ${ruta ? "- borrar" : "= no está"} la ruta ${RUTA.clave}`);
  console.log("");

  if (!DE_VERDAD) {
    console.log("ENSAYO. No se borró nada. Para hacerlo: --quitar --de-verdad");
    return;
  }

  if (empresa) {
    const n = await borrarServicios(empresa.id);
    console.log(`✓ ${n} servicios y sus fotos borrados`);
  }
  if (usuario) {
    const { error } = await sb.auth.admin.deleteUser(usuario.id);
    if (error) alto("no se pudo borrar el usuario", error);
    console.log("✓ usuario borrado");
  }
  if (empresa) {
    const { error } = await sb.from("clientes").delete().eq("id", empresa.id);
    if (error) alto("no se pudo borrar la empresa", error);
    console.log("✓ empresa borrada (con sus puntos y suscripciones)");
  }
  if (ruta) {
    const { error } = await sb.from("rutas").delete().eq("id", ruta.id);
    if (error) alto("no se pudo borrar la ruta", error);
    console.log("✓ ruta borrada");
  }
  console.log("\nLISTO. No queda nada de la cuenta del revisor.");
}

await (QUITAR ? quitar() : crear());
