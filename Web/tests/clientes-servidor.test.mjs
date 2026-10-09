import { test } from "node:test";
import assert from "node:assert/strict";
import { cambiarEstadoClienteCon, eliminarClienteCon, conteosClienteCon, editarClienteCon } from "../lib/clientes-servidor.js";

/**
 * Supabase falso: anota cada operación en `ops` como "tabla:op[:campo=valor]".
 * Las lecturas devuelven lo que diga `datos[tabla]`.
 */
function falso(datos = {}) {
  const ops = [];
  const cadena = (tabla, op, valor) => {
    const q = {
      _tabla: tabla, _op: op, _valor: valor, _filtros: [],
      eq(c, v) { this._filtros.push(`${c}=${v}`); return this; },
      in(c, v) { this._filtros.push(`${c} in ${v.length}`); return this; },
      neq(c, v) { this._filtros.push(`${c}!=${v}`); return this; },
      gte(c, v) { this._filtros.push(`${c}>=${v}`); return this; },
      not() { return this; },
      order() { return this; },
      limit() { return this; },
      select() { return this; },
      maybeSingle() { this._uno = true; return this; },
      single() { this._uno = true; return this; },
      then(ok, mal) {
        ops.push(`${tabla}:${op}${this._filtros.length ? `[${this._filtros.join(",")}]` : ""}`);
        const filas = op === "select" ? (datos[tabla] || []) : [{ id: "x" }];
        const data = this._uno ? (filas[0] ?? null) : filas;
        return Promise.resolve({ data, error: null, count: filas.length }).then(ok, mal);
      },
    };
    return q;
  };
  return {
    ops,
    from: (t) => ({
      select: (c, o) => cadena(t, "select", o),
      update: (v) => cadena(t, "update", v),
      delete: () => cadena(t, "delete"),
      insert: (v) => cadena(t, "insert", v),
    }),
    storage: {
      from: (b) => ({
        list: async (p) => { ops.push(`storage:${b}:list:${p}`); return { data: (datos[`storage:${b}:${p}`] || []).map((n) => ({ name: n, id: n })), error: null }; },
        remove: async (r) => { ops.push(`storage:${b}:remove:${r.length}`); return { data: r, error: null }; },
      }),
    },
    auth: { admin: {
      updateUserById: async (id, c) => { ops.push(`auth:update:${id}:${c.ban_duration}`); return { data: {}, error: null }; },
      deleteUser: async (id) => { ops.push(`auth:delete:${id}`); return { data: {}, error: null }; },
    } },
  };
}

const actor = { id: "yo", correo: "d@t.mx" };
const anotar = async () => {};

test("suspender: pide motivo, cambia estado y pausa servicios, NO toca usuarios", async () => {
  const sb = falso({ clientes: [{ id: "c1", estado: "activo", folio: "MOR-1", empresa: "Uno" }] });
  assert.equal((await cambiarEstadoClienteCon({ sb, anotar, actor }, { clienteId: "c1", estado: "suspendido", motivo: "" })).ok, false);
  const r = await cambiarEstadoClienteCon({ sb, anotar, actor }, { clienteId: "c1", estado: "suspendido", motivo: "Adeudo" });
  assert.equal(r.ok, true);
  assert.ok(sb.ops.includes("clientes:update[id=c1]"));
  assert.ok(sb.ops.some((o) => o.startsWith("suscripciones:update")));
  assert.ok(!sb.ops.some((o) => o.startsWith("auth:")), "suspendido no bloquea usuarios");
});

test("baja: bloquea a todos sus usuarios, cancela servicios y solicitudes futuras, libera contenedores", async () => {
  const sb = falso({
    clientes: [{ id: "c1", estado: "activo", folio: "MOR-1", empresa: "Uno" }],
    perfiles: [{ id: "u1" }, { id: "u2" }],
    domicilios: [{ id: "d1" }],
    solicitudes_recoleccion: [{ id: "s1", estado: "solicitada", fecha_pedida: "2026-10-20" }],
  });
  const r = await cambiarEstadoClienteCon({ sb, anotar, actor }, { clienteId: "c1", estado: "baja", motivo: "Ya no contrata" });
  assert.equal(r.ok, true);
  assert.ok(sb.ops.includes("auth:update:u1:876000h"));
  assert.ok(sb.ops.includes("auth:update:u2:876000h"));
  assert.ok(sb.ops.some((o) => o.startsWith("perfiles:update")));
  assert.ok(sb.ops.some((o) => o.startsWith("suscripciones:update")));
  assert.ok(sb.ops.some((o) => o.startsWith("solicitudes_recoleccion:update")));
  assert.ok(sb.ops.some((o) => o.startsWith("contenedores:update")));
  assert.ok(sb.ops.some((o) => o.startsWith("push_tokens:delete")));
});

test("reactivar: desbloquea a sus usuarios", async () => {
  const sb = falso({ clientes: [{ id: "c1", estado: "baja", folio: "MOR-1", empresa: "Uno", bloqueados_por_baja: ["u1"] }], perfiles: [{ id: "u1" }] });
  const r = await cambiarEstadoClienteCon({ sb, anotar, actor }, { clienteId: "c1", estado: "activo", motivo: "" });
  assert.equal(r.ok, true);
  assert.ok(sb.ops.includes("auth:update:u1:none"));
});

test("eliminar: borra en orden (hijos antes que la empresa) y los usuarios de Auth", async () => {
  const sb = falso({
    clientes: [{ id: "c1", folio: "MOR-1", empresa: "Prueba real" }],
    solicitudes_recoleccion: [{ id: "s1" }],
    perfiles: [{ id: "u1" }],
    "storage:evidencias:s1": ["a.jpg"],
    "storage:comprobantes:c1": ["r.pdf"],
  });
  assert.equal((await eliminarClienteCon({ sb, anotar, actor }, { clienteId: "c1", confirmacion: "otra" })).ok, false,
    "pide escribir el nombre exacto");
  const r = await eliminarClienteCon({ sb, anotar, actor }, { clienteId: "c1", confirmacion: "  prueba REAL " });
  assert.equal(r.ok, true);
  const i = (pref) => sb.ops.findIndex((o) => o.startsWith(pref));
  for (const hijo of ["solicitudes_recoleccion:delete", "movimientos_saldo:delete", "precios:delete", "domicilios:delete", "auth:delete:u1"]) {
    assert.ok(i(hijo) >= 0, `falta ${hijo}`);
    assert.ok(i(hijo) < i("clientes:delete"), `${hijo} va antes que la empresa`);
  }
  assert.ok(sb.ops.includes("storage:evidencias:remove:1"));
  assert.ok(sb.ops.includes("storage:comprobantes:remove:1"));
});

test("conteos para la confirmación", async () => {
  const sb = falso({ solicitudes_recoleccion: [{ id: "s1" }], recolecciones: [{ id: 1 }, { id: 2 }], movimientos_saldo: [{ monto: 100 }, { monto: 50 }] });
  const c = await conteosClienteCon({ sb }, { clienteId: "c1" });
  assert.equal(c.recolecciones, 2);
  assert.equal(c.movimientos, 2);
  assert.equal(c.montoMovimientos, 150);
});

test("editar: solo campos permitidos, y si queda completo pasa de pendiente-info a activo", async () => {
  const sb = falso({ clientes: [{ id: "c1", estado: "pendiente-info", empresa: "Uno", contacto: "", correo: "", telefono: "" }] });
  const r = await editarClienteCon({ sb, anotar, actor }, { clienteId: "c1", cambios: { contacto: "Ana", correo: "a@x.mx", telefono: "8681234567", estado: "baja", folio: "X" } });
  assert.equal(r.ok, true);
  assert.equal(r.cambios.estado, "activo");
  assert.equal(r.cambios.folio, undefined);
});

// ---- Revisión final de la Entrega 1 ----
test("revisión: pasar de suspendido a activo NO toca el acceso de nadie", async () => {
  const sb = falso({ clientes: [{ id: "c1", estado: "suspendido", folio: "MOR-1", empresa: "Uno" }], perfiles: [{ id: "u1" }] });
  const r = await cambiarEstadoClienteCon({ sb, anotar, actor }, { clienteId: "c1", estado: "activo", motivo: "" });
  assert.equal(r.ok, true);
  assert.ok(!sb.ops.some((o) => o.startsWith("auth:")), "suspendido nunca bloqueó a nadie");
});

test("revisión: reactivar una baja desbloquea SOLO a los que bloqueó la baja", async () => {
  const sb = falso({
    clientes: [{ id: "c1", estado: "baja", folio: "MOR-1", empresa: "Uno", bloqueados_por_baja: ["u1"] }],
    perfiles: [{ id: "u1" }, { id: "u2" }],
  });
  const r = await cambiarEstadoClienteCon({ sb, anotar, actor }, { clienteId: "c1", estado: "activo", motivo: "" });
  assert.equal(r.ok, true);
  assert.ok(sb.ops.includes("auth:update:u1:none"));
  assert.ok(!sb.ops.includes("auth:update:u2:none"), "u2 ya no tenía acceso antes de la baja");
});

test("revisión: la baja bloquea solo a los usuarios CLIENTE que estaban activos, y lo anota", async () => {
  const sb = falso({ clientes: [{ id: "c1", estado: "activo", folio: "MOR-1", empresa: "Uno" }], perfiles: [{ id: "u1" }] });
  await cambiarEstadoClienteCon({ sb, anotar, actor }, { clienteId: "c1", estado: "baja", motivo: "x" });
  assert.ok(sb.ops.some((o) => o.startsWith("perfiles:select") && o.includes("rol=cliente") && o.includes("activo=true")));
});

test("revisión: los efectos van ANTES de guardar el estado (si fallan, se puede reintentar)", async () => {
  const sb = falso({ clientes: [{ id: "c1", estado: "activo", folio: "MOR-1", empresa: "Uno" }], perfiles: [{ id: "u1" }], domicilios: [{ id: "d1" }], solicitudes_recoleccion: [{ id: "s1", estado: "confirmada" }] });
  await cambiarEstadoClienteCon({ sb, anotar, actor }, { clienteId: "c1", estado: "baja", motivo: "x" });
  const i = (p) => sb.ops.findIndex((o) => o.startsWith(p));
  const estado = sb.ops.lastIndexOf("clientes:update[id=c1]");
  for (const e of ["auth:update", "suscripciones:update", "solicitudes_recoleccion:update", "contenedores:update"]) {
    assert.ok(i(e) >= 0 && i(e) < estado, `${e} va antes del estado`);
  }
});

test("revisión: eliminar NO borra perfiles del personal y no usa listas gigantes de ids", async () => {
  const sb = falso({ clientes: [{ id: "c1", folio: "MOR-1", empresa: "X" }], solicitudes_recoleccion: [{ id: "s1" }], perfiles: [{ id: "u1" }] });
  await eliminarClienteCon({ sb, anotar, actor }, { clienteId: "c1", confirmacion: "X" });
  assert.ok(sb.ops.some((o) => o.startsWith("perfiles:select") && o.includes("rol=cliente")));
  assert.ok(!sb.ops.some((o) => o.startsWith("recolecciones:delete")), "las recolecciones se van en cascada con sus solicitudes");
});

// ---- Entrega 3: lo que deja abierto una baja ----
test("baja: rechaza TODAS las abiertas (también en-ruta y las confirmadas a otra fecha) y avisa a sus choferes", async () => {
  const sb = falso({
    clientes: [{ id: "c1", estado: "activo", folio: "MOR-1", empresa: "Uno" }],
    perfiles: [],
    solicitudes_recoleccion: [
      { id: "s1", folio: "REC-1", estado: "confirmada", chofer_id: "ch1", fecha_pedida: "2026-09-01", fecha_confirmada: "2026-10-20", hora_confirmada: null, rutas: { chofer_id: "ch9" } },
      { id: "s2", folio: "REC-2", estado: "en-ruta", chofer_id: null, fecha_pedida: "2026-10-09", fecha_confirmada: "2026-10-09", rutas: { chofer_id: "ch2" } },
      { id: "s3", folio: "REC-3", estado: "solicitada", chofer_id: null, fecha_pedida: "2026-10-30", rutas: null },
    ],
  });
  const avisados = [];
  const r = await cambiarEstadoClienteCon(
    { sb, anotar, actor, avisarChoferes: async (lista) => avisados.push(...lista) },
    { clienteId: "c1", estado: "baja", motivo: "Ya no contrata" });
  assert.equal(r.ok, true);
  assert.ok(sb.ops.some((o) => o.startsWith("solicitudes_recoleccion:update") && o.includes("id in 3")),
    "rechaza las tres por id, sin filtrar por fecha_pedida");
  assert.deepEqual(avisados.map((a) => a.uid).sort(), ["ch1", "ch2"], "al chofer de la parada o, si no, al de la ruta");
  assert.equal(avisados.find((a) => a.uid === "ch1").parada.folio, "REC-1");
});
