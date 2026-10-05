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
  if (f.startsWith("022")) {
    // Supabase da por defecto todos los permisos a anon/authenticated: se
    // simula ANTES de 022, que es la que tiene que quitar lo que sobra.
    await db.exec(`grant all on all tables in schema public to anon, authenticated, service_role;
                   grant all on all sequences in schema public to anon, authenticated, service_role;
                   grant all on all tables in schema storage to anon, authenticated, service_role;`);
  }
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
let AAL = "aal2"; // el panel ya exige el segundo paso; 023 lo hará exigir también a la base
async function como(quien, sql, params = []) {
  const claims = quien === "anon" ? { role: "anon" } : { sub: U[quien], role: "authenticated", email: `${quien}@t.mx`, aal: AAL };
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

console.log("\n8 · 023 (pendiente): la base exige el segundo paso");
await db.exec(fs.readFileSync(path.join(WEB, "db", "pendientes", "023-la-base-exige-dos-pasos.sql"), "utf8"));
AAL = "aal1";
await debeFallar("admin con solo contraseña NO lee prospectos", "admin", `select * from public.cotizaciones_pendientes`);
await debeFallar("admin con solo contraseña NO lee clientes", "admin", `select * from public.clientes`);
await debePasar("el chofer sigue viendo su parada sin segundo paso", "chofer",
  `select id from public.solicitudes_recoleccion where id=$1`, [sol.id], 1);
await debePasar("el cliente sigue viendo su empresa", "cliente", `select id from public.clientes`, [], 1);
AAL = "aal2";
await debePasar("admin con el segundo paso sí lee prospectos", "admin", `select * from public.cotizaciones_pendientes`, [], 1);

try {
  await db.exec(fs.readFileSync(path.join(WEB, "db", "022-candados-de-seguridad.sql"), "utf8"));
  console.log("✓ 022 corre dos veces sin romperse");
} catch (e) { fallas++; console.log("✖ 022 no es idempotente:", e.message); }
console.log(fallas ? `\n✖ ${fallas} FALLAS` : "\n✓ TODO BIEN");
process.exit(fallas ? 1 : 0);
