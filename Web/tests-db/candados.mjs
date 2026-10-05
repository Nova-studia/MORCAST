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

try {
  await db.exec(fs.readFileSync(path.join(WEB, "db", "022-candados-de-seguridad.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(WEB, "db", "023-operacion-ampliada.sql"), "utf8"));
  console.log("✓ 022 y 023 corren dos veces sin romperse");
} catch (e) { fallas++; console.log("✖ 022/023 no son idempotentes:", e.message); }
console.log(fallas ? `\n✖ ${fallas} FALLAS` : "\n✓ TODO BIEN");
process.exit(fallas ? 1 : 0);
