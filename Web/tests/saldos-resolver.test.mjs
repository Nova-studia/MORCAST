import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDepositoCon, validarResolucion } from "../lib/saldos-resolver.mjs";

const ID = "11111111-2222-4333-8444-555555555555";
const callado = { error() {}, warn() {} };

/** Un Supabase de mentira con una tabla movimientos_saldo y su "RLS". */
function sbFalso({ fila, rlsDeja = true }) {
  return {
    from() {
      const q = { filtros: [], cambios: null };
      q.update = (c) => { q.cambios = c; return q; };
      q.select = () => q;
      q.eq = (c, v) => { q.filtros.push(["eq", c, v]); return q; };
      q.neq = (c, v) => { q.filtros.push(["neq", c, v]); return q; };
      q.maybeSingle = async () => ({ data: rlsDeja && fila ? { id: fila.id, estado: fila.estado } : null });
      q.then = (res) => {
        const pasa = rlsDeja && fila && q.filtros.every(([op, c, v]) => (op === "eq" ? fila[c] === v : fila[c] !== v));
        if (pasa) {
          Object.assign(fila, q.cambios);
          res({ data: [{ ...fila, clientes: { empresa: "Vidriera", correo: "v@x.mx" } }], error: null });
        } else res({ data: [], error: null });
      };
      return q;
    },
  };
}

function piezas() {
  const anotadas = [];
  const correos = [];
  return {
    anotadas,
    correos,
    anotar: async (e) => { anotadas.push(e); },
    deps: { hayResend: () => true, correoSaldoResuelto: async (d) => { correos.push(d); }, log: callado },
  };
}

test("aplicar: actualiza, anota aplicar_saldo y manda el correo", async () => {
  const fila = { id: ID, estado: "por-verificar", folio: "DEP-7", monto: "1200", cliente_id: "c1" };
  const p = piezas();
  const r = await resolverDepositoCon({ sb: sbFalso({ fila }), actorId: "u1", id: ID, estado: "aplicada", anotar: p.anotar, deps: p.deps });
  assert.deepEqual(r, { ok: true });
  assert.equal(fila.estado, "aplicada");
  assert.equal(fila.verificado_por, "u1");
  assert.equal(p.anotadas[0].accion, "aplicar_saldo");
  assert.equal(p.anotadas[0].detalle.monto, 1200);
  assert.equal(p.correos.length, 1);
  assert.equal(p.correos[0].aplicado, true);
});

test("el reintento de lo mismo no vuelve a anotar ni a mandar correo", async () => {
  const fila = { id: ID, estado: "aplicada", folio: "DEP-7", monto: 1200 };
  const p = piezas();
  const r = await resolverDepositoCon({ sb: sbFalso({ fila }), actorId: "u1", id: ID, estado: "aplicada", anotar: p.anotar, deps: p.deps });
  assert.deepEqual(r, { ok: true, yaEstaba: true });
  assert.equal(p.anotadas.length, 0);
  assert.equal(p.correos.length, 0);
});

test("si el RLS no deja, se dice que no pasó", async () => {
  const fila = { id: ID, estado: "por-verificar" };
  const p = piezas();
  const r = await resolverDepositoCon({ sb: sbFalso({ fila, rlsDeja: false }), actorId: "u1", id: ID, estado: "rechazada", anotar: p.anotar, deps: p.deps });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /permiso de la base/);
  assert.equal(p.anotadas.length, 0);
});

test("sin Resend se aplica igual y no se tumba nada", async () => {
  const fila = { id: ID, estado: "por-verificar", monto: 5 };
  const p = piezas();
  p.deps.hayResend = () => false;
  const r = await resolverDepositoCon({ sb: sbFalso({ fila }), actorId: "u1", id: ID, estado: "rechazada", anotar: p.anotar, deps: p.deps });
  assert.equal(r.ok, true);
  assert.equal(p.anotadas[0].accion, "rechazar_saldo");
  assert.equal(p.correos.length, 0);
});

test("validación: id, estado y notas", () => {
  assert.equal(validarResolucion({ id: "x", estado: "aplicada" }).ok, false);
  assert.equal(validarResolucion({ id: ID, estado: "borrada" }).ok, false);
  assert.equal(validarResolucion({ id: ID, estado: "aplicada", notas: "a".repeat(501) }).ok, false);
  assert.deepEqual(validarResolucion({ id: ID, estado: "rechazada", notas: "  " }), {
    ok: true, limpio: { id: ID, estado: "rechazada", notas: null },
  });
});
