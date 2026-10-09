import { test } from "node:test";
import assert from "node:assert/strict";
import { cambiarSolicitudClienteCon } from "../lib/solicitud-cliente-servidor.mjs";

const QUIEN = { id: "u1", cliente_id: "c1", correo: "a@x.mx" };
function falso(fila, { filasActualizadas = 1 } = {}) {
  const hechos = { updates: [] };
  return {
    hechos,
    from: () => {
      const q = {
        _f: [], _upd: null,
        select() { return q; }, eq(c, v) { q._f.push([c, v]); return q; }, in(c, v) { q._f.push([c, v]); return q; },
        update(v) { q._upd = v; return q; },
        maybeSingle: async () => ({ data: fila, error: null }),
        then(ok) {
          if (q._upd) { hechos.updates.push({ cambios: q._upd, filtros: q._f }); return ok({ data: Array(filasActualizadas).fill({ id: "s1" }), error: null }); }
          return ok({ data: [], error: null });
        },
      };
      return q;
    },
  };
}
const deps = () => {
  const d = { oficina: [], chofer: [], notas: [] };
  return { d, anotar: async (e) => d.notas.push(e), avisarOficina: async (e) => d.oficina.push(e), avisarChofer: async (e) => d.chofer.push(e) };
};
const FILA = { id: "s1", folio: "REC-2026-0001", estado: "confirmada", cliente_id: "c1", chofer_id: null, fecha_pedida: "2026-10-12", fecha_confirmada: "2026-10-13", hora_confirmada: null, rutas: { chofer_id: "ch1" }, clientes: { empresa: "Acme" } };

test("cancelar una confirmada: la rechaza con motivo de cliente, avisa a la oficina y al chofer", async () => {
  const sb = falso({ ...FILA }); const { d, ...x } = deps();
  const r = await cambiarSolicitudClienteCon({ sb, quien: QUIEN, ...x }, { id: "s1", accion: "cancelar", motivo: "ya no hay", hoy: "2026-10-09" });
  assert.equal(r.ok, true);
  assert.equal(sb.hechos.updates[0].cambios.estado, "rechazada");
  assert.match(sb.hechos.updates[0].cambios.motivo_rechazo, /^Cancelada por el cliente: ya no hay/);
  assert.deepEqual(sb.hechos.updates[0].filtros.find(([c]) => c === "estado")[1], ["solicitada", "confirmada"], "solo si sigue cancelable");
  assert.equal(d.oficina.length, 1);
  assert.equal(d.chofer[0].uid, "ch1");
  assert.equal(d.notas[0].accion, "cliente_cancela_recoleccion");
});

test("la solicitud de OTRA empresa: no se toca", async () => {
  const sb = falso({ ...FILA, cliente_id: "c2" }); const { d, ...x } = deps();
  const r = await cambiarSolicitudClienteCon({ sb, quien: QUIEN, ...x }, { id: "s1", accion: "cancelar", hoy: "2026-10-09" });
  assert.equal(r.ok, false);
  assert.equal(sb.hechos.updates.length, 0);
  assert.equal(d.oficina.length, 0);
});

test("en ruta: no se cancela y se dice por qué", async () => {
  const sb = falso({ ...FILA, estado: "en-ruta" }); const { d, ...x } = deps();
  const r = await cambiarSolicitudClienteCon({ sb, quien: QUIEN, ...x }, { id: "s1", accion: "cancelar", hoy: "2026-10-09" });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /camino/);
  assert.equal(sb.hechos.updates.length, 0);
});

test("doble clic: si el UPDATE ya no encuentra la fila, no se avisa otra vez", async () => {
  const sb = falso({ ...FILA }, { filasActualizadas: 0 }); const { d, ...x } = deps();
  const r = await cambiarSolicitudClienteCon({ sb, quien: QUIEN, ...x }, { id: "s1", accion: "cancelar", hoy: "2026-10-09" });
  assert.equal(r.ok, false);
  assert.equal(d.oficina.length, 0);
});

test("reagendar una solicitada: cambia la fecha pedida y avisa a la oficina (sin chofer)", async () => {
  const sb = falso({ ...FILA, estado: "solicitada", fecha_confirmada: null }); const { d, ...x } = deps();
  const r = await cambiarSolicitudClienteCon({ sb, quien: QUIEN, ...x }, { id: "s1", accion: "reagendar", fecha: "2026-10-20", hoy: "2026-10-09" });
  assert.equal(r.ok, true);
  assert.deepEqual(sb.hechos.updates[0].cambios, { fecha_pedida: "2026-10-20" });
  assert.equal(d.oficina.length, 1);
  assert.equal(d.chofer.length, 0);
});

test("reagendar una confirmada: no (eso lo mueve la oficina)", async () => {
  const sb = falso({ ...FILA }); const { ...x } = deps();
  const r = await cambiarSolicitudClienteCon({ sb, quien: QUIEN, anotar: x.anotar, avisarOficina: x.avisarOficina, avisarChofer: x.avisarChofer }, { id: "s1", accion: "reagendar", fecha: "2026-10-20", hoy: "2026-10-09" });
  assert.equal(r.ok, false);
});
