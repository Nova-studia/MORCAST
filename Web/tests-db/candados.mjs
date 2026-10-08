/**
 * PRUEBA DE LOS PERMISOS DE LA BASE (npm run test:db)
 *
 * Corre TODAS las migraciones de db/ en un Postgres de verdad que vive dentro
 * de Node (PGlite), con un "Supabase" mínimo simulado (auth.uid(), auth.jwt(),
 * los roles anon/authenticated/service_role), y después intenta lo que un
 * atacante intentaría con cada rol: ascenderse, leer prospectos sin sesión,
 * meterse dinero, pedir a nombre de otra empresa…
 *
 * No toca producción ni necesita internet. Se escribió el 5-oct-2026 con la
 * migración 022, y ya en la primera corrida encontró un error que en
 * producción habría tumbado el "agendar recolección" de todos los clientes
 * (recursión infinita entre políticas).
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite();

const STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage; create schema extensions;
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text,
  raw_app_meta_data jsonb default '{}'::jsonb, raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anon') $$;
create table storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text,
  name text, owner uuid, metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql as $$
  select string_to_array(name, '/') $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
-- Como Supabase: toda tabla nueva nace con todos los permisos para anon,
-- authenticated y service_role (el RLS es el que filtra). Así un "revoke"
-- dentro de una migración se prueba de verdad.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
`;

async function correr(nombre, sql) {
  try {
    await db.exec(sql);
  } catch (e) {
    console.error(`✖ ${nombre}: ${e.message}`);
    throw e;
  }
}

await correr("stub", STUB);
await correr("schema.sql", fs.readFileSync(path.join(WEB, "supabase/schema.sql"), "utf8"));
const migraciones = fs.readdirSync(path.join(WEB, "db")).filter((f) => /^\d{3}-.*\.sql$/.test(f)).sort();
for (const f of migraciones) {
  await correr(f, fs.readFileSync(path.join(WEB, "db", f), "utf8"));
  console.log(`✓ ${f}`);
}

// ---------------------------------------------------------------- datos
const U = {
  dueno: "00000000-0000-0000-0000-00000000000d",
  admin: "00000000-0000-0000-0000-00000000000a",
  chofer: "00000000-0000-0000-0000-00000000000c",
  cliente: "00000000-0000-0000-0000-0000000000c1",
  otro: "00000000-0000-0000-0000-0000000000c2",
};
const { rows: [cli1] } = await db.query(`insert into public.clientes (folio, empresa) values ('MOR-T-1','Uno') returning id`);
const { rows: [cli2] } = await db.query(`insert into public.clientes (folio, empresa) values ('MOR-T-2','Dos') returning id`);
const alta = async (id, correo, meta) =>
  db.query(`insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, $3)`, [id, correo, meta]);
await alta(U.dueno, "d@t.mx", { rol: "dueno" });
await alta(U.admin, "a@t.mx", { rol: "admin" });
await alta(U.chofer, "c@t.mx", { rol: "operador" });
await alta(U.cliente, "cl@t.mx", { rol: "cliente", cliente_id: cli1.id });
await alta(U.otro, "o@t.mx", { rol: "cliente", cliente_id: cli2.id });
const { rows: [dom1] } = await db.query(`insert into public.domicilios (cliente_id, alias, calle) values ($1,'P1','c') returning id`, [cli1.id]);
const { rows: [dom2] } = await db.query(`insert into public.domicilios (cliente_id, alias, calle) values ($1,'P2','c') returning id`, [cli2.id]);
const { rows: [ruta] } = await db.query(`insert into public.rutas (clave, nombre, tipo, chofer_id) values ('R-T','Ruta T','manual',$1) returning id`, [U.chofer]);
const { rows: [sol] } = await db.query(
  `insert into public.solicitudes_recoleccion (folio, cliente_id, domicilio_id, ruta_id, fecha_pedida, estado)
   values ('REC-T-1',$1,$2,$3,current_date,'confirmada') returning id`, [cli1.id, dom1.id, ruta.id]);
const perfiles = (await db.query(`select id, rol from public.perfiles order by rol`)).rows;
console.log("perfiles:", perfiles.map((p) => p.rol).join(", "));

// ---------------------------------------------------------------- pruebas
let fallas = 0;

async function como(quien, sql, params = []) {
  const claims = quien === "anon" ? { role: "anon" } : { sub: U[quien], role: "authenticated", email: `${quien}@t.mx` };
  await db.exec("reset role");
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`,
    [claims.sub || "", JSON.stringify(claims)]);
  await db.exec(`set role ${quien === "anon" ? "anon" : "authenticated"}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
    await db.query(`select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false)`);
  }
}
async function debePasar(titulo, quien, sql, params, filas) {
  try {
    const r = await como(quien, sql, params);
    const n = r.fields?.length ? r.rows.length : r.affectedRows;
    if (filas !== undefined && n !== filas) throw new Error(`esperaba ${filas} filas, hubo ${n}`);
    console.log(`  ✓ ${titulo}`);
  } catch (e) {
    fallas++; console.log(`  ✖ ${titulo} — ${e.message}`);
  }
}
async function debeFallar(titulo, quien, sql, params = []) {
  try {
    const r = await como(quien, sql, params);
    const n = r.fields?.length ? r.rows.length : r.affectedRows;
    if (n === 0) { console.log(`  ✓ ${titulo} (0 filas)`); return; }
    fallas++; console.log(`  ✖ ${titulo} — PASÓ y no debía (${n} filas)`);
  } catch (e) {
    console.log(`  ✓ ${titulo} → ${e.message}`);
  }
}

await db.query(`insert into public.cotizaciones (nombre, telefono, correo, tipo_servicio, frecuencia, estado) values ('Pro','8680000000','p@x.mx','x','y','nueva')`).catch((e) => console.log("(cotización de prueba:", e.message, ")"));

console.log("\n1 · prospectos");
await debeFallar("anónimo NO lee cotizaciones_pendientes", "anon", `select * from public.cotizaciones_pendientes`);
await debeFallar("cliente NO lee cotizaciones_pendientes", "cliente", `select * from public.cotizaciones_pendientes`);
await debePasar("el admin SÍ las lee", "admin", `select * from public.cotizaciones_pendientes`, [], 1);

console.log("\n2 · roles");
await debeFallar("admin NO se asciende a dueño", "admin", `update public.perfiles set rol='dueno' where id=$1`, [U.admin]);
await debeFallar("admin NO da rol de admin a un chofer", "admin", `update public.perfiles set rol='admin' where id=$1`, [U.chofer]);
await debeFallar("admin NO desactiva al dueño", "admin", `update public.perfiles set activo=false where id=$1`, [U.dueno]);
await debeFallar("admin NO borra al dueño", "admin", `delete from public.perfiles where id=$1`, [U.dueno]);
await debePasar("admin SÍ corrige su propio nombre", "admin", `update public.perfiles set nombre='Ana' where id=$1`, [U.admin], 1);
await debePasar("admin SÍ desactiva a un chofer", "admin", `update public.perfiles set activo=false where id=$1`, [U.chofer], 1);
await db.query(`update public.perfiles set activo=true where id=$1`, [U.chofer]);
await debeFallar("cliente NO se cambia de empresa", "cliente", `update public.perfiles set cliente_id=$2 where id=$1`, [U.cliente, cli2.id]);
await debePasar("el dueño SÍ hace admin a alguien", "dueno", `update public.perfiles set rol='admin' where id=$1`, [U.chofer], 1);
await db.query(`update public.perfiles set rol='operador' where id=$1`, [U.chofer]);
await db.query(`update public.perfiles set nombre='Sistema' where id=$1`, [U.dueno]); // sin claims = servicio

console.log("\n3 · dinero");
await debeFallar("admin NO mete un abono ya aplicado", "admin",
  `insert into public.movimientos_saldo (cliente_id, tipo, monto, estado, concepto) values ($1,'abono',1000,'aplicada','x')`, [cli1.id]);
await debePasar("admin SÍ registra un abono por verificar", "admin",
  `insert into public.movimientos_saldo (cliente_id, tipo, monto, estado, concepto) values ($1,'abono',1000,'por-verificar','x')`, [cli1.id], 1);
await debePasar("el dueño SÍ mete uno aplicado", "dueno",
  `insert into public.movimientos_saldo (cliente_id, tipo, monto, estado, concepto) values ($1,'abono',10,'aplicada','x')`, [cli1.id], 1);
await debeFallar("admin NO aplica un depósito (update)", "admin",
  `update public.movimientos_saldo set estado='aplicada' where estado='por-verificar'`);

console.log("\n4 · el cliente pide");
await debePasar("pedido normal en su domicilio", "cliente",
  `insert into public.solicitudes_recoleccion (folio, cliente_id, domicilio_id, fecha_pedida, estado) values ('REC-T-2',$1,$2,current_date+1,'solicitada')`, [cli1.id, dom1.id], 1);
await debeFallar("NO en el domicilio de otra empresa", "cliente",
  `insert into public.solicitudes_recoleccion (folio, cliente_id, domicilio_id, fecha_pedida, estado) values ('REC-T-3',$1,$2,current_date+1,'solicitada')`, [cli1.id, dom2.id]);
await debeFallar("NO con chofer puesto por él", "cliente",
  `insert into public.solicitudes_recoleccion (folio, cliente_id, domicilio_id, fecha_pedida, estado, chofer_id) values ('REC-T-4',$1,$2,current_date+1,'solicitada',$3)`, [cli1.id, dom1.id, U.chofer]);
await debeFallar("NO con fecha confirmada", "cliente",
  `insert into public.solicitudes_recoleccion (folio, cliente_id, domicilio_id, fecha_pedida, estado, fecha_confirmada) values ('REC-T-5',$1,$2,current_date+1,'solicitada',current_date+1)`, [cli1.id, dom1.id]);

console.log("\n5 · el chofer");
await debePasar("cambia el estado de su parada", "chofer",
  `update public.solicitudes_recoleccion set estado='en-ruta' where id=$1`, [sol.id], 1);
await debeFallar("NO cambia la nota", "chofer",
  `update public.solicitudes_recoleccion set nota='hola', estado='completada' where id=$1`, [sol.id]);
await debeFallar("NO cambia el cliente", "chofer",
  `update public.solicitudes_recoleccion set cliente_id=$2 where id=$1`, [sol.id, cli2.id]);
await debePasar("el admin sí cambia la nota", "admin",
  `update public.solicitudes_recoleccion set nota='ok' where id=$1`, [sol.id], 1);

console.log("\n6 · bitácora");
const bit = (await db.query(`select accion, tabla, actor_correo, detalle from public.bitacora order by id`)).rows;
for (const b of bit) console.log(`   ${b.accion} ${b.tabla} por ${b.actor_correo} ${JSON.stringify(b.detalle).slice(0, 110)}`);
if (!bit.some((b) => b.tabla === "movimientos_saldo" && b.actor_correo === "admin@t.mx")) { fallas++; console.log("  ✖ falta el movimiento del admin"); }
if (!bit.some((b) => b.tabla === "perfiles" && b.accion === "db_update")) { fallas++; console.log("  ✖ falta el cambio de rol"); }

console.log("\n7 · freno");
await db.exec("set role service_role");
const r = [];
for (let i = 0; i < 4; i++) r.push((await db.query(`select public.pasar_freno('cotizar:1.2.3.4', 3, '10 minutes') as ok`)).rows[0].ok);
await db.exec("reset role");
console.log("   resultados:", r.join(", "));
if (r.join() !== "true,true,true,false") { fallas++; console.log("  ✖ el freno no frenó en el cuarto"); }
await debeFallar("un anónimo NO puede llamar al freno", "anon", `select public.pasar_freno('x', 3, '10 minutes')`);

console.log("\n8 · códigos del segundo paso");
await db.query(`insert into public.codigos_panel (usuario_id, huella, vence) values ($1, 'h', now() + interval '10 minutes')`, [U.admin]);
await debeFallar("el admin NO lee la tabla de códigos", "admin", `select * from public.codigos_panel`);
await debeFallar("el admin NO borra su código", "admin", `delete from public.codigos_panel`);
await debeFallar("un anónimo NO lee la tabla de códigos", "anon", `select * from public.codigos_panel`);

// ================================================================ 023
console.log("\n9 · 023: sectores y ubicación de los puntos");
const sectorA = (await db.query(`select id from public.sectores where clave='A'`)).rows[0];
await db.query(`update public.domicilios set sector_id=$1 where id=$2`, [sectorA.id, dom1.id]);
await debePasar("el cliente ve los sectores", "cliente", `select id from public.sectores`, [], 4);
await debeFallar("el cliente NO dibuja sectores", "cliente", `update public.sectores set zona='[[1,1]]'`);
await debePasar("el admin dibuja un sector", "admin", `update public.sectores set zona='[[25.8,-97.5],[25.9,-97.5],[25.9,-97.4]]' where clave='A'`, [], 1);
const { rows: [sol2] } = await db.query(
  `insert into public.solicitudes_recoleccion (folio, cliente_id, domicilio_id, ruta_id, fecha_pedida, estado)
   values ('REC-T-9',$1,$2,$3,current_date,'confirmada') returning id`, [cli1.id, dom1.id, ruta.id]);
await debeFallar("el chofer NO fija una ubicación fuera de Matamoros", "chofer",
  `select public.fijar_ubicacion_punto($1, 19.4, -99.1)`, [sol2.id]);
await debePasar("el chofer fija la ubicación del punto de su parada", "chofer",
  `select public.fijar_ubicacion_punto($1, 25.87, -97.50) as ok`, [sol2.id], 1);
const ub = (await db.query(`select lat, ubicacion_origen from public.domicilios where id=$1`, [dom1.id])).rows[0];
if (ub.lat !== 25.87 || ub.ubicacion_origen !== "chofer") { fallas++; console.log("  ✖ la ubicación no quedó guardada", ub); }
const sec = (await db.query(`select s.clave from public.domicilios d left join public.sectores s on s.id = d.sector_id where d.id=$1`, [dom1.id])).rows[0];
if (sec.clave !== "A") { fallas++; console.log("  ✖ el sector no se calculó al guardar la ubicación del chofer", sec); }
else console.log("  ✓ y la base le calcula su sector (A) al momento");
const fuera = (await db.query(`select public.sector_de_punto(25.70, -97.30) as s`)).rows[0];
if (fuera.s !== null) { fallas++; console.log("  ✖ un punto fuera de todo sector recibió sector"); }
else console.log("  ✓ un punto fuera de los sectores queda sin sector");
await db.query(`update public.domicilios set lat=25.88, lng=-97.51, ubicacion_origen='panel' where id=$1`, [dom1.id]);
await debePasar("pero NO pisa la que puso el panel", "chofer", `select public.fijar_ubicacion_punto($1, 25.86, -97.49) as ok`, [sol2.id], 1);
const ub2 = (await db.query(`select lat from public.domicilios where id=$1`, [dom1.id])).rows[0];
if (ub2.lat !== 25.88) { fallas++; console.log("  ✖ el chofer pisó la ubicación del panel", ub2); }
const { rows: [sol3] } = await db.query(
  `insert into public.solicitudes_recoleccion (folio, cliente_id, domicilio_id, fecha_pedida, estado)
   values ('REC-T-10',$1,$2,current_date,'confirmada') returning id`, [cli2.id, dom2.id]);
await debeFallar("el chofer NO toca el punto de una parada ajena", "chofer",
  `select public.fijar_ubicacion_punto($1, 25.87, -97.50)`, [sol3.id]);

console.log("\n10 · 023: unidades y contenedores");
await debePasar("el admin da de alta una unidad", "admin",
  `insert into public.unidades (numero_economico, placas, tipo) values ('U-01','TAM-001','compactador')`, [], 1);
await debePasar("el chofer ve las unidades", "chofer", `select id from public.unidades`, [], 1);
await debeFallar("el cliente NO ve las unidades", "cliente", `select id from public.unidades`);
await debeFallar("el chofer NO da de alta unidades", "chofer",
  `insert into public.unidades (numero_economico) values ('U-99')`);
await db.query(`insert into public.contenedores (codigo, medida, domicilio_id) values ('MOR-C-0001','3 m³',$1), ('MOR-C-0002','3 m³',$2)`, [dom1.id, dom2.id]);
await debePasar("el chofer ve el contenedor del punto que visita", "chofer", `select codigo from public.contenedores`, [], 1);
await debePasar("el cliente ve SOLO su contenedor", "cliente", `select codigo from public.contenedores`, [], 1);
await debeFallar("el chofer NO cambia un contenedor", "chofer", `update public.contenedores set estado='baja'`);

console.log("\n11 · 023: \"No procedió\" y tipo de residuo");
await debeFallar("NO se marca \"No procedió\" sin motivo", "chofer",
  `update public.solicitudes_recoleccion set estado='no-procedio' where id=$1`, [sol2.id]);
await debeFallar("con el motivo tampoco puede cambiar la nota", "chofer",
  `update public.solicitudes_recoleccion set estado='no-procedio', motivo_no_procedio='otro residuo', nota='x' where id=$1`, [sol2.id]);
await debePasar("el chofer marca \"No procedió\" con su motivo", "chofer",
  `update public.solicitudes_recoleccion set estado='no-procedio', motivo_no_procedio='El residuo no es el que se agendó', detalle_no_procedio='Era cascajo' where id=$1`, [sol2.id], 1);
await debePasar("el cliente pide con tipo de residuo", "cliente",
  `insert into public.solicitudes_recoleccion (folio, cliente_id, domicilio_id, fecha_pedida, estado, tipo_residuo) values ('REC-T-11',$1,$2,current_date+1,'solicitada','Residuos de Manejo Especial')`, [cli1.id, dom1.id], 1);

console.log("\n12 · 023: incidentes");
await debePasar("el chofer reporta un retraso", "chofer",
  `insert into public.incidentes (tipo, retraso_min, operador_id) values ('retraso', 30, $1)`, [U.chofer], 1);
await debeFallar("NO lo reporta a nombre de otro", "chofer",
  `insert into public.incidentes (tipo, operador_id) values ('accidente', $1)`, [U.admin]);
await debeFallar("NO lo mete ya atendido", "chofer",
  `insert into public.incidentes (tipo, operador_id, estado) values ('otro', $1, 'atendido')`, [U.chofer]);
await debeFallar("NO lo amarra a una parada ajena", "chofer",
  `insert into public.incidentes (tipo, operador_id, solicitud_id) values ('otro', $1, $2)`, [U.chofer, sol3.id]);
await debeFallar("el cliente NO ve incidentes", "cliente", `select id from public.incidentes`);
await debePasar("el admin los ve y los atiende", "admin",
  `update public.incidentes set estado='atendido', atendido_por=$1, atendido_en=now()`, [U.admin], 1);

console.log("\n13 · 023: peso real");
const { rows: [rec] } = await db.query(
  `insert into public.recolecciones (solicitud_id, operador_id, peso_kg) values ($1,$2,500) returning id`, [sol.id, U.chofer]);
await debePasar("el chofer corrige su peso estimado", "chofer",
  `update public.recolecciones set peso_kg=520 where id=$1`, [rec.id], 1);
await debeFallar("el chofer NO pone el peso real", "chofer",
  `update public.recolecciones set peso_real_kg=480 where id=$1`, [rec.id]);
await debePasar("el admin registra un viaje al relleno", "admin",
  `insert into public.viajes_relleno (peso_real_kg, folio_ticket) values (8250, 'T-123')`, [], 1);
const viaje = (await db.query(`select id from public.viajes_relleno limit 1`)).rows[0];
await debePasar("y amarra la recolección a ese viaje con su peso real", "admin",
  `update public.recolecciones set viaje_id=$2, peso_real_kg=480, peso_real_por=$3, peso_real_en=now() where id=$1`, [rec.id, viaje.id, U.admin], 1);
await debeFallar("el chofer NO ve los viajes", "chofer", `select id from public.viajes_relleno`);

console.log("\n14 · 023: avisos a clientes");
await db.query(`insert into public.suscripciones (cliente_id, domicilio_id, ruta_id) values ($1,$2,$3)`, [cli1.id, dom1.id, ruta.id]);
await debePasar("el admin manda avisos", "admin",
  `insert into public.avisos (titulo, mensaje, alcance) values ('Día festivo','No hay ruta','todos')`, [], 1);
await db.query(`insert into public.avisos (titulo, mensaje, alcance, ruta_id) values ('Retraso','Ruta T va tarde','ruta',$1)`, [ruta.id]);
await db.query(`insert into public.avisos (titulo, mensaje, alcance, sector_id) values ('Sector A','Cambio de horario','sector',$1)`, [sectorA.id]);
await db.query(`insert into public.avisos (titulo, mensaje, alcance, cliente_id) values ('Solo Dos','Para la otra empresa','cliente',$1)`, [cli2.id]);
await debePasar("el cliente ve: todos + su ruta + su sector (3), NO el de otra empresa", "cliente", `select titulo from public.avisos`, [], 3);
await debePasar("la otra empresa ve: todos + el suyo (2)", "otro", `select titulo from public.avisos`, [], 2);
await debeFallar("un aviso 'sector' sin sector no entra", "admin",
  `insert into public.avisos (titulo, mensaje, alcance) values ('x','y','sector')`);
await debeFallar("el cliente NO manda avisos", "cliente",
  `insert into public.avisos (titulo, mensaje, alcance) values ('x','y','todos')`);

console.log("\n15 · 023: precio del servicio");
await debePasar("el admin pone el precio de un servicio", "admin",
  `update public.suscripciones set precio=904.80, modalidad='por-recoleccion', incluye_iva=true`, [], 1);
await debeFallar("una modalidad inventada no entra", "admin", `update public.suscripciones set modalidad='quincenal'`);

console.log("\n16 · 024: ajustes de la revisión");
const { rows: [sol4] } = await db.query(
  `insert into public.solicitudes_recoleccion (folio, cliente_id, domicilio_id, ruta_id, fecha_pedida, estado)
   values ('REC-T-12',$1,$2,$3,current_date,'confirmada') returning id`, [cli2.id, dom2.id, ruta.id]);
await debePasar("el chofer marca \"No procedió\" en la parada de la otra empresa", "chofer",
  `update public.solicitudes_recoleccion set estado='no-procedio', motivo_no_procedio='Cerrado o sin acceso' where id=$1`, [sol4.id], 1);
await debePasar("y SIGUE viendo a qué empresa era", "chofer", `select empresa from public.clientes where id=$1`, [cli2.id], 1);
await debePasar("y su domicilio", "chofer", `select alias from public.domicilios where id=$1`, [dom2.id], 1);
await db.query(`update public.suscripciones set estado='pausada' where cliente_id=$1`, [cli1.id]);
await debePasar("con su suscripción pausada, el cliente sigue viendo su ruta", "cliente", `select id from public.rutas`, [], 1);
await debePasar("pero ya no los avisos de esa ruta (todos + sector = 2)", "cliente", `select titulo from public.avisos`, [], 2);
await db.query(`update public.suscripciones set estado='activa' where cliente_id=$1`, [cli1.id]);

console.log("\n17 · 025: alta con firma electrónica");
// El servidor (llave de servicio = sin sesión) guarda un alta firmada con su evidencia.
const H = (c) => c.repeat(64);
const { rows: [altaF] } = await db.query(
  `insert into public.solicitudes_alta
     (folio, empresa, contacto, telefono, correo, servicios_por_mes,
      firmado_en, firmante_nombre, terminos_version, contenido_firmado, contenido_huella,
      pdf_ruta, pdf_huella, confirmacion_huella, confirmacion_vence)
   values ('ALTA-T-1','Golfo','Ana','8680000000','ana@golfo.mx', 4,
      now(), 'Ana Pérez', '2026-10-v1-borrador', '{"folio":"ALTA-T-1"}', $1,
      'x/solicitud.pdf', $2, $3, now() + interval '7 days') returning id`, [H("a"), H("b"), H("c")]);
await debeFallar("un anónimo NO lee las altas", "anon", `select id from public.solicitudes_alta`);
await debeFallar("un cliente NO lee las altas", "cliente", `select id from public.solicitudes_alta`);
await debeFallar("un chofer NO lee las altas", "chofer", `select id from public.solicitudes_alta`);
await debePasar("el admin SÍ las lee", "admin", `select id from public.solicitudes_alta where id=$1`, [altaF.id], 1);
await debeFallar("un anónimo NO mete altas directo a la tabla", "anon",
  `insert into public.solicitudes_alta (folio, empresa, contacto, telefono, correo) values ('ALTA-X','x','x','x','x@x.mx')`);
await debePasar("el admin cambia el estado y las notas", "admin",
  `update public.solicitudes_alta set estado='contactada', notas='llamar el lunes' where id=$1`, [altaF.id], 1);
await debeFallar("el admin NO marca el correo como confirmado", "admin",
  `update public.solicitudes_alta set correo_confirmado=true, correo_confirmado_en=now(), correo_confirmado_por='enlace', confirmacion_huella=null where id=$1`, [altaF.id]);
await debeFallar("el admin NO cambia la huella de lo firmado", "admin",
  `update public.solicitudes_alta set contenido_huella=$2 where id=$1`, [altaF.id, H("d")]);
await debeFallar("el admin NO cambia los datos firmados (la empresa)", "admin",
  `update public.solicitudes_alta set empresa='Otra' where id=$1`, [altaF.id]);
await debeFallar("el admin NO cambia quién firmó", "admin",
  `update public.solicitudes_alta set firmante_nombre='Otro' where id=$1`, [altaF.id]);
await debeFallar("el admin NO borra un alta firmada", "admin", `delete from public.solicitudes_alta where id=$1`, [altaF.id]);
// La confirmación la hace el servidor: borra la huella del token (un solo uso).
try {
  await db.query(`update public.solicitudes_alta set correo_confirmado=true, correo_confirmado_en=now(),
    correo_confirmado_por='enlace', confirmacion_huella=null, confirmacion_vence=null where id=$1`, [altaF.id]);
  console.log("  ✓ el servidor confirma el correo");
} catch (e) { fallas++; console.log("  ✖ el servidor no pudo confirmar el correo —", e.message); }
const sinCandado = async (titulo, sql, params) => {
  try { await db.query(sql, params); fallas++; console.log(`  ✖ ${titulo} — PASÓ y no debía`); }
  catch (e) { console.log(`  ✓ ${titulo} → ${e.message}`); }
};
await sinCandado("NI el servidor guarda un token en claro (no tiene forma de huella)",
  `insert into public.solicitudes_alta (folio, empresa, contacto, telefono, correo, confirmacion_huella, confirmacion_vence)
   values ('ALTA-T-3','x','x','x','x@x.mx','AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE', now())`);
await sinCandado("un correo confirmado no conserva un token vivo",
  `update public.solicitudes_alta set confirmacion_huella=$2 where id=$1`, [altaF.id, H("e")]);
await sinCandado("una firma sin huella no entra",
  `insert into public.solicitudes_alta (folio, empresa, contacto, telefono, correo, firmado_en, firmante_nombre, terminos_version)
   values ('ALTA-T-2','x','x','x','x@x.mx', now(), 'X Y', 'v1')`);
await sinCandado("un modo de confirmación inventado no entra",
  `update public.solicitudes_alta set correo_confirmado_por='whatsapp' where id=$1`, [altaF.id]);

const cubeta = (await db.query(`select public, file_size_limit from storage.buckets where id='altas'`)).rows[0];
if (!cubeta || cubeta.public !== false) { fallas++; console.log("  ✖ la cubeta altas no existe o es pública", cubeta); }
else console.log(`  ✓ la cubeta altas es privada (tope ${cubeta.file_size_limit} bytes)`);
await db.exec("set role service_role");
await db.query(`insert into storage.objects (bucket_id, name) values ('altas', $1)`, [`${altaF.id}/firma.png`]);
await db.exec("reset role");
console.log("  ✓ el servidor (service_role) sube la firma");
await debeFallar("el admin con sesión TAMPOCO lee la cubeta (los enlaces los firma el servidor tras el segundo paso)", "admin",
  `select name from storage.objects where bucket_id='altas'`);
await debeFallar("ni el dueño con sesión", "dueno", `select name from storage.objects where bucket_id='altas'`);
const enCubeta = (await db.query(`select count(*)::int as n from storage.objects where bucket_id='altas'`)).rows[0].n;
if (enCubeta !== 1) { fallas++; console.log("  ✖ la firma no quedó en la cubeta", enCubeta); }
else console.log("  ✓ y la firma sí está ahí (la ve sólo la llave de servicio)");
await debeFallar("un cliente NO ve archivos de altas", "cliente", `select name from storage.objects where bucket_id='altas'`);
await debeFallar("un chofer NO ve archivos de altas", "chofer", `select name from storage.objects where bucket_id='altas'`);
await debeFallar("un anónimo NO ve archivos de altas", "anon", `select name from storage.objects where bucket_id='altas'`);
await debeFallar("un anónimo NO sube a altas", "anon",
  `insert into storage.objects (bucket_id, name) values ('altas', $1)`, [`${altaF.id}/otra.png`]);
await debeFallar("el admin NO sube ni reemplaza archivos de altas", "admin",
  `insert into storage.objects (bucket_id, name) values ('altas', $1)`, [`${altaF.id}/firma2.png`]);
await debeFallar("el admin NO cambia un archivo de altas", "admin",
  `update storage.objects set name='x/firma.png' where bucket_id='altas'`);
await debeFallar("el admin NO borra la firma", "admin", `delete from storage.objects where bucket_id='altas'`);

// ================================================================ 026
console.log("\n18 · 026: tokens de notificaciones");
const TK = (s) => `ExponentPushToken[${s}]`;
await debePasar("el cliente registra su teléfono por la función", "cliente",
  `select public.registrar_push_token($1, 'ios') as ok`, [TK("tel-compartido")], 1);
await debePasar("y el upsert directo de la app también sirve con un token nuevo", "cliente",
  `insert into public.push_tokens (token, plataforma) values ($1, 'android')
   on conflict (token) do update set plataforma = excluded.plataforma, actualizado = now()`, [TK("tel-del-cliente")], 1);
await debePasar("y repetirlo (mismo token, suyo) no falla", "cliente",
  `insert into public.push_tokens (token, plataforma) values ($1, 'android')
   on conflict (token) do update set plataforma = excluded.plataforma, actualizado = now()`, [TK("tel-del-cliente")], 1);
await debePasar("el cliente ve sus 2 tokens", "cliente", `select token from public.push_tokens`, [], 2);
await debeFallar("la otra empresa NO se queda el token por upsert directo (RLS)", "otro",
  `insert into public.push_tokens (token, plataforma) values ($1, 'ios')
   on conflict (token) do update set usuario_id = auth.uid()`, [TK("tel-compartido")]);
await debePasar("pero SÍ por la función (teléfono compartido: entra otra persona)", "otro",
  `select public.registrar_push_token($1, 'ios') as ok`, [TK("tel-compartido")], 1);
const dueTk = (await db.query(`select usuario_id from public.push_tokens where token=$1`, [TK("tel-compartido")])).rows[0];
if (dueTk?.usuario_id !== U.otro) { fallas++; console.log("  ✖ el token no cambió de dueño", dueTk); }
else console.log("  ✓ y el token ya es de quien entró al final");
await debePasar("el cliente anterior ya no lo ve (le queda 1)", "cliente", `select token from public.push_tokens`, [], 1);
await debeFallar("nadie mete un token a nombre de otro", "cliente",
  `insert into public.push_tokens (usuario_id, token, plataforma) values ($1, $2, 'ios')`, [U.otro, TK("ajeno")]);
await debeFallar("nadie se pasa un token ajeno cambiando el dueño", "cliente",
  `update public.push_tokens set usuario_id=$1`, [U.otro]);
await debeFallar("un token con otro formato no entra", "cliente",
  `select public.registrar_push_token('<script>alert(1)</script>', 'ios')`);
await debeFallar("una plataforma inventada no entra", "cliente",
  `select public.registrar_push_token($1, 'windows')`, [TK("x")]);
await debeFallar("un anónimo NO registra tokens", "anon", `select public.registrar_push_token($1, 'ios')`, [TK("anon")]);
await debeFallar("un anónimo NO lee tokens", "anon", `select token from public.push_tokens`);
await debeFallar("el admin con sesión NO lee los tokens de los clientes", "admin", `select token from public.push_tokens`);
const borroAjeno = (await como("cliente", `select public.borrar_push_token($1) as ok`, [TK("tel-compartido")])).rows[0].ok;
const sigue = (await db.query(`select count(*)::int as n from public.push_tokens where token=$1`, [TK("tel-compartido")])).rows[0].n;
if (borroAjeno !== false || sigue !== 1) { fallas++; console.log("  ✖ borrar_push_token borró un token ajeno", borroAjeno, sigue); }
else console.log("  ✓ borrar_push_token NO borra el token de otro");
await debePasar("al cerrar sesión borra el suyo", "otro", `select public.borrar_push_token($1) as ok`, [TK("tel-compartido")], 1);
const quedan = (await db.query(`select count(*)::int as n from public.push_tokens where token=$1`, [TK("tel-compartido")])).rows[0].n;
if (quedan !== 0) { fallas++; console.log("  ✖ el token no se borró al cerrar sesión"); }
else console.log("  ✓ y ya no está");
await db.exec("set role service_role");
const tkServ = (await db.query(`select count(*)::int as n from public.push_tokens`)).rows[0].n;
await db.exec("reset role");
if (tkServ < 1) { fallas++; console.log("  ✖ el servidor no ve los tokens"); }
else console.log(`  ✓ el servidor (service_role) ve todos los tokens (${tkServ})`);

console.log("\n19 · 026: \"Enterado\" en los avisos");
const idAviso = async (titulo) => (await db.query(`select id from public.avisos where titulo=$1`, [titulo])).rows[0].id;
const avTodos = await idAviso("Día festivo");
const avDos = await idAviso("Solo Dos");
await debePasar("el cliente marca \"Enterado\" en un aviso que ve", "cliente",
  `insert into public.avisos_lecturas (aviso_id, leido) values ($1, '2000-01-01')`, [avTodos], 1);
const lect = (await db.query(`select cliente_id, leido from public.avisos_lecturas where aviso_id=$1 and usuario_id=$2`, [avTodos, U.cliente])).rows[0];
if (lect?.cliente_id !== cli1.id) { fallas++; console.log("  ✖ la lectura no quedó con su empresa", lect); }
else console.log("  ✓ y queda a nombre de su empresa sin que la app la mande");
if (new Date(lect.leido).getFullYear() < 2026) { fallas++; console.log("  ✖ la app pudo poner la hora de lectura", lect.leido); }
else console.log("  ✓ la hora la pone la base, no el teléfono");
await debeFallar("dos veces el mismo aviso no entra (la app ignora el duplicado)", "cliente",
  `insert into public.avisos_lecturas (aviso_id) values ($1)`, [avTodos]);
await debePasar("…o, con upsert({ignoreDuplicates:true}), pasa sin error y sin duplicar", "cliente",
  `insert into public.avisos_lecturas (aviso_id) values ($1) on conflict do nothing`, [avTodos], 0);
await debeFallar("NO marca leído un aviso de otra empresa", "cliente",
  `insert into public.avisos_lecturas (aviso_id) values ($1)`, [avDos]);
await debeFallar("NO a nombre de otra empresa", "cliente",
  `insert into public.avisos_lecturas (aviso_id, cliente_id) values ($1, $2)`, [await idAviso("Retraso"), cli2.id]);
await debeFallar("NO a nombre de otro usuario", "cliente",
  `insert into public.avisos_lecturas (aviso_id, usuario_id) values ($1, $2)`, [await idAviso("Retraso"), U.otro]);
await debeFallar("el chofer NO anota lecturas", "chofer", `insert into public.avisos_lecturas (aviso_id) values ($1)`, [avTodos]);
await debeFallar("el admin NO anota lecturas", "admin", `insert into public.avisos_lecturas (aviso_id) values ($1)`, [avTodos]);
await debeFallar("un anónimo NO anota lecturas", "anon", `insert into public.avisos_lecturas (aviso_id) values ($1)`, [avTodos]);
await debePasar("la otra empresa marca el suyo", "otro", `insert into public.avisos_lecturas (aviso_id) values ($1)`, [avDos], 1);
await debePasar("y el general", "otro", `insert into public.avisos_lecturas (aviso_id) values ($1)`, [avTodos], 1);
await debePasar("cada cliente lee SOLO sus lecturas", "cliente", `select aviso_id from public.avisos_lecturas`, [], 1);
await debePasar("el personal lee todas", "admin", `select aviso_id from public.avisos_lecturas`, [], 3);
await debePasar("y las cuenta por aviso", "admin",
  `select aviso_id, count(*)::int as n from public.avisos_lecturas where aviso_id=$1 group by aviso_id`, [avTodos], 1);
await debeFallar("el chofer NO las lee", "chofer", `select aviso_id from public.avisos_lecturas`);
await debeFallar("un anónimo NO las lee", "anon", `select aviso_id from public.avisos_lecturas`);
await debeFallar("el cliente NO cambia la hora después", "cliente", `update public.avisos_lecturas set leido = now() - interval '9 days'`);
await debeFallar("el cliente NO borra su lectura", "cliente", `delete from public.avisos_lecturas`);
await debePasar("el admin guarda cuántas notificaciones salieron", "admin",
  `update public.avisos set notificaciones_enviadas=2, usuarios_destino=3 where id=$1`, [avTodos], 1);

console.log("\n20 · 026: un aviso por incidente");
await debeFallar("el chofer NO mete un incidente ya \"avisado\"", "chofer",
  `insert into public.incidentes (tipo, operador_id, avisado_en) values ('otro', $1, now())`, [U.chofer]);
await debePasar("sin eso, sigue reportando normal", "chofer",
  `insert into public.incidentes (tipo, operador_id) values ('otro', $1)`, [U.chofer], 1);
await debeFallar("y NO lo marca como avisado después", "chofer", `update public.incidentes set avisado_en = now()`);

console.log("\n21 · 027: precios");
// El admin de prueba NO tiene el permiso; se crea otro que sí.
const U_PREC = "00000000-0000-0000-0000-0000000000a2";
await alta(U_PREC, "ap@t.mx", { rol: "admin" });
await db.query(`update public.perfiles set permisos = '{precios}' where id = $1`, [U_PREC]);
U.adminPrecios = U_PREC;
const { rows: [con] } = await db.query(
  `insert into public.conceptos (clave, nombre, unidad, modalidad, orden)
   values ('cont-3m3','Contenedor 3 m³','por recolección','por-recoleccion',1) returning id`);
const { rows: [con2] } = await db.query(
  `insert into public.conceptos (clave, nombre, unidad, modalidad, orden)
   values ('renta','Renta mensual','mensual','mensual',2) returning id`);

await debePasar("el dueño pone precio de lista", "dueno",
  `insert into public.precios (concepto_id, precio, creado_por) values ($1, 1000, $2)`, [con.id, U.dueno], 1);
await debeFallar("un admin SIN permiso NO pone precios", "admin",
  `insert into public.precios (concepto_id, precio, creado_por) values ($1, 900, $2)`, [con.id, U.admin]);
await debePasar("un admin CON permiso sí", "adminPrecios",
  `insert into public.precios (concepto_id, cliente_id, precio, creado_por) values ($1, $2, 800, $3)`,
  [con.id, cli1.id, U.adminPrecios], 1);
await debeFallar("NO se firma a nombre de otro", "adminPrecios",
  `insert into public.precios (concepto_id, precio, creado_por) values ($1, 950, $2)`, [con.id, U.dueno]);
await debeFallar("NO se ponen precios con fecha pasada", "dueno",
  `insert into public.precios (concepto_id, precio, creado_por, vale_desde) values ($1, 1, $2, now() - interval '2 days')`,
  [con.id, U.dueno]);
await debeFallar("NADIE edita un precio (ni el dueño)", "dueno", `update public.precios set precio = 1`);
await debeFallar("NADIE borra un precio (ni el dueño)", "dueno", `delete from public.precios`);
await debeFallar("el cliente NO pone precios", "cliente",
  `insert into public.precios (concepto_id, precio, creado_por) values ($1, 1, $2)`, [con.id, U.cliente]);
await debePasar("el cliente ve la lista y SU especial (2 renglones)", "cliente",
  `select * from public.precios`, [], 2);
await debePasar("la otra empresa NO ve el especial ajeno (1 renglón)", "otro",
  `select * from public.precios`, [], 1);
await debeFallar("el chofer NO ve precios", "chofer", `select * from public.precios`);

const precioDe = async (cliente, concepto) =>
  (await db.query(`select public.precio_de($1, $2) as p`, [cliente, concepto])).rows[0].p;
const igual = (titulo, real, esperado) => {
  if (String(real) === String(esperado)) console.log(`  ✓ ${titulo}`);
  else { fallas++; console.log(`  ✖ ${titulo} — esperaba ${esperado}, salió ${real}`); }
};
igual("precio_de: cliente con especial → 800", await precioDe(cli1.id, con.id), "800.00");
igual("precio_de: cliente sin especial → lista 1000", await precioDe(cli2.id, con.id), "1000.00");
igual("precio_de: concepto sin precio → null", await precioDe(cli1.id, con2.id), "null");
await db.query(`insert into public.precios (concepto_id, cliente_id, quitado, creado_por) values ($1, $2, true, $3)`,
  [con.id, cli1.id, U.dueno]);
igual("precio_de: especial quitado → vuelve a lista 1000", await precioDe(cli1.id, con.id), "1000.00");
await db.query(`insert into public.precios (concepto_id, precio, creado_por, vale_desde) values ($1, 1200, $2, now() + interval '1 day')`,
  [con.id, U.dueno]);
igual("precio_de: un cambio futuro NO cuenta hoy", await precioDe(cli2.id, con.id), "1000.00");
igual("precio_de: …y sí cuenta en su fecha",
  (await db.query(`select public.precio_de($1, $2, now() + interval '2 days') as p`, [cli2.id, con.id])).rows[0].p, "1200.00");

// Las funciones son security definer: sin candado, un cliente vería el precio ajeno.
await db.query(`insert into public.precios (concepto_id, cliente_id, precio, creado_por) values ($1, $2, 500, $3)`,
  [con.id, cli2.id, U.dueno]);
const comoCliente = async (sql, params) => (await como("cliente", sql, params)).rows[0];
igual("el cliente NO ve el precio especial de otra empresa (le sale el de lista)",
  (await comoCliente(`select public.precio_de($1, $2) as p`, [cli2.id, con.id])).p, "1000.00");
igual("…pero sí el suyo", (await comoCliente(`select public.precio_de($1, $2) as p`, [cli1.id, con.id])).p, "1000.00");
igual("el cliente NO sabe si otra empresa factura",
  (await comoCliente(`select public.iva_de_cliente($1) as i`, [cli2.id])).i, "null");
// Revisión final (7-oct): las funciones no se abren a anónimos ni a quien no es cliente.
await debeFallar("un anónimo NO consulta precio_de", "anon",
  `select public.precio_de($1, $2) as p`, [cli2.id, con.id]);
await debeFallar("un anónimo NO consulta iva_de_cliente", "anon",
  `select public.iva_de_cliente($1) as i`, [cli1.id]);
igual("el chofer NO sabe si una empresa factura",
  (await como("chofer", `select public.iva_de_cliente($1) as i`, [cli1.id])).rows[0].i, "null");
igual("el chofer NO ve el precio especial de una empresa (le sale el de lista)",
  (await como("chofer", `select public.precio_de($1, $2) as p`, [cli2.id, con.id])).rows[0].p, "1000.00");
await debeFallar("un admin SIN permiso NO crea un cliente marcado de prueba", "admin",
  `insert into public.clientes (folio, empresa, es_prueba) values ('MOR-T-9','Nueve', true)`);
await debeFallar("un admin SIN permiso NO crea un cliente con factura", "admin",
  `insert into public.clientes (folio, empresa, requiere_factura) values ('MOR-T-8','Ocho', true)`);
await debePasar("un admin SIN permiso sí crea un cliente normal", "admin",
  `insert into public.clientes (folio, empresa) values ('MOR-T-7','Siete')`, [], 1);
// Borrar un cliente (o la cuenta de quien capturó precios) no debe trabarse
// por el candado de "los precios no se tocan": el FK hace su trabajo.
const { rows: [cli3] } = await db.query(`insert into public.clientes (folio, empresa) values ('MOR-T-3','Tres') returning id`);
await db.query(`insert into public.precios (concepto_id, cliente_id, precio, creado_por) values ($1, $2, 700, $3)`,
  [con.id, cli3.id, U.adminPrecios]);
// Desde la 028 ya no hay cascada: el servidor borra primero sus precios.
try {
  await db.query(`delete from public.precios where cliente_id = $1`, [cli3.id]);
  await db.query(`delete from public.clientes where id = $1`, [cli3.id]);
  console.log("  ✓ se puede borrar un cliente con precio especial (el servidor borra antes sus precios)");
} catch (e) { fallas++; console.log("  ✖ borrar un cliente con precio especial falló —", e.message); }
await debeFallar("un admin NO se da permisos a sí mismo", "admin",
  `update public.perfiles set permisos = '{precios}' where id = $1`, [U.admin]);
await debeFallar("el admin con permiso NO se lo da a otro", "adminPrecios",
  `update public.perfiles set permisos = '{precios}' where id = $1`, [U.admin]);
await debePasar("el dueño SÍ da el permiso", "dueno",
  `update public.perfiles set permisos = '{precios}' where id = $1`, [U.admin], 1);
await debeFallar("permiso inventado NO entra", "dueno",
  `update public.perfiles set permisos = '{todo}' where id = $1`, [U.admin]);
await db.query(`update public.perfiles set permisos = '{}' where id = $1`, [U.admin]);

await debeFallar("un admin SIN permiso NO cambia requiere_factura", "admin",
  `update public.clientes set requiere_factura = true where id = $1`, [cli1.id]);
await debePasar("un admin CON permiso sí", "adminPrecios",
  `update public.clientes set requiere_factura = true where id = $1`, [cli1.id], 1);
igual("iva_de_cliente con factura → 0.16",
  (await db.query(`select public.iva_de_cliente($1) as i`, [cli1.id])).rows[0].i, "0.16");
igual("iva_de_cliente sin factura → 0",
  (await db.query(`select public.iva_de_cliente($1) as i`, [cli2.id])).rows[0].i, "0");
await debeFallar("NADIE marca es_prueba desde la sesión (ni el dueño)", "dueno",
  `update public.clientes set es_prueba = true where id = $1`, [cli2.id]);
const b = (await db.query(`select count(*)::int n from public.bitacora where tabla in ('precios','clientes')`)).rows[0].n;
if (b > 0) console.log("  ✓ los cambios de precios y factura quedan en la bitácora");
else { fallas++; console.log("  ✖ la bitácora no anotó precios/factura"); }

console.log("\n22 · 028: estados del cliente y borrado");
const ponerEstado = (id, est) => db.query(`update public.clientes set estado = $2 where id = $1`, [id, est]);
const pedir = (fecha = "current_date") =>
  `insert into public.solicitudes_recoleccion (folio, cliente_id, domicilio_id, fecha_pedida, estado)
   values ('REC-T-' || floor(random()*1e9)::text, $1, $2, ${fecha}, 'solicitada')`;
const abono = `insert into public.movimientos_saldo (cliente_id, tipo, concepto, monto, estado)
   values ($1, 'abono', 'Depósito', 100, 'por-verificar')`;

await ponerEstado(cli1.id, "suspendido");
await debeFallar("suspendido: NO agenda", "cliente", pedir(), [cli1.id, dom1.id]);
await debePasar("suspendido: SÍ reporta un depósito (falta de pago)", "cliente", abono, [cli1.id], 1);
await ponerEstado(cli1.id, "baja");
await debeFallar("baja: NO agenda", "cliente", pedir(), [cli1.id, dom1.id]);
await debeFallar("baja: NO reporta depósitos", "cliente", abono, [cli1.id]);
await ponerEstado(cli1.id, "pendiente-info");
await debePasar("pendiente-info: sí agenda (opera normal)", "cliente", pedir(), [cli1.id, dom1.id], 1);
await ponerEstado(cli1.id, "activo");
await debePasar("activo: agenda", "cliente", pedir(), [cli1.id, dom1.id], 1);

const { rows: [cliB] } = await db.query(`insert into public.clientes (folio, empresa) values ('MOR-T-B','Borrable') returning id`);
await db.query(abono, [cliB.id]);
await debeFallar("un admin NO borra clientes", "admin", `delete from public.clientes where id = $1`, [cliB.id]);
try {
  await db.query(`delete from public.clientes where id = $1`, [cliB.id]);
  fallas++; console.log("  ✖ con movimientos, el borrado en cascada NO debía pasar (restrict)");
} catch (e) { console.log(`  ✓ con movimientos no se borra en cascada → ${e.message.slice(0, 70)}`); }
await db.query(`delete from public.movimientos_saldo where cliente_id = $1`, [cliB.id]);
await debePasar("el dueño SÍ borra (ya sin dinero colgando)", "dueno", `delete from public.clientes where id = $1`, [cliB.id], 1);

const { rows: [cliC] } = await db.query(`insert into public.clientes (folio, empresa) values ('MOR-T-C','Borrable 2') returning id`);
await db.query(`update public.perfiles set permisos = '{eliminar_clientes}' where id = $1`, [U.adminPrecios]);
await debePasar("un admin CON permiso eliminar_clientes sí borra", "adminPrecios", `delete from public.clientes where id = $1`, [cliC.id], 1);
await db.query(`update public.perfiles set permisos = '{precios}' where id = $1`, [U.adminPrecios]);

const { rows: [cliD] } = await db.query(`insert into public.clientes (folio, empresa) values ('MOR-T-D','Con precio') returning id`);
await db.query(`insert into public.precios (concepto_id, cliente_id, precio, creado_por) values ($1, $2, 10, $3)`, [con.id, cliD.id, U.dueno]);
await debeFallar("con sesión, nadie borra precios", "dueno", `delete from public.precios where cliente_id = $1`, [cliD.id]);
try {
  await db.query(`delete from public.precios where cliente_id = $1`, [cliD.id]);
  console.log("  ✓ el servidor (llave de servicio) sí borra los precios de un cliente que se elimina");
} catch (e) { fallas++; console.log("  ✖ el servidor no pudo borrar precios —", e.message); }
await db.query(`delete from public.clientes where id = $1`, [cliD.id]);

try {
  await db.exec(fs.readFileSync(path.join(WEB, "db", "022-candados-de-seguridad.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(WEB, "db", "023-operacion-ampliada.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(WEB, "db", "024-ajustes-de-la-revision.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(WEB, "db", "025-alta-con-firma.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(WEB, "db", "026-app-1-1.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(WEB, "db", "027-precios.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(WEB, "db", "028-clientes-estados.sql"), "utf8"));
  console.log("✓ 022 a 028 corren dos veces sin romperse");
} catch (e) { fallas++; console.log("✖ 022 a 028 no son idempotentes:", e.message); }
console.log(fallas ? `\n✖ ${fallas} FALLAS` : "\n✓ TODO BIEN");
process.exit(fallas ? 1 : 0);
