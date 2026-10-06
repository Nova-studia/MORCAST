import { test } from "node:test";
import assert from "node:assert/strict";
import { mandarAvisoCon, contarDestinatariosCon } from "../lib/avisos-envio.mjs";

const callado = { error() {}, warn() {} };
const C1 = "aaaaaaaa-0000-4000-8000-000000000001";
const C2 = "aaaaaaaa-0000-4000-8000-000000000002";
const ID_ENVIO = "bbbbbbbb-0000-4000-8000-000000000009";

/** Supabase de mentira: clientes para el alcance y una tabla `avisos`. */
function base() {
  const avisos = new Map();
  const clientes = [
    { id: C1, empresa: "Uno", correo: "uno@x.mx", estado: "activo" },
    { id: C2, empresa: "Dos", correo: "", estado: "activo" },
  ];
  return {
    avisos,
    from(tabla) {
      const q = { filtros: [], fila: null, cambios: null };
      q.select = () => q;
      q.eq = (c, v) => { q.filtros.push([c, v]); return q; };
      q.insert = (fila) => { q.fila = fila; return q; };
      q.update = (c) => { q.cambios = c; return q; };
      const idFiltro = () => q.filtros.find(([c]) => c === "id")?.[1];
      q.maybeSingle = async () => ({ data: avisos.get(idFiltro()) || null });
      q.single = async () => {
        const id = q.fila.id || `gen-${avisos.size + 1}`;
        if (avisos.has(id)) return { data: null, error: { code: "23505", message: "duplicate key" } };
        const f = { ...q.fila, id, creado: "2026-10-06T15:00:00Z", correos_enviados: 0 };
        avisos.set(id, f);
        return { data: { id, creado: f.creado }, error: null };
      };
      q.then = (res) => {
        if (tabla === "clientes") return res({ data: clientes, error: null });
        if (tabla === "avisos" && q.cambios) {
          Object.assign(avisos.get(idFiltro()), q.cambios);
          return res({ data: [{ id: idFiltro() }], error: null });
        }
        return res({ data: [], error: null });
      };
      return q;
    },
  };
}

function deps() {
  const correos = [];
  const pushes = [];
  return {
    correos,
    pushes,
    hayResend: () => true,
    mandarCorreo: async (d) => { correos.push(d.correo); },
    push: {
      usuariosClienteDe: async () => ["u1", "u2"],
      tokensDeUsuarios: async () => ["ExponentPushToken[a]"],
      enviarPush: async (_t, m) => { pushes.push(m); return { enviadas: 1 }; },
    },
    espera: async () => {},
    log: callado,
    hoy: "2026-10-06",
  };
}

const DATOS = { alcance: "todos", motivo: "retraso", titulo: "Retraso hoy", mensaje: "La ruta va tarde." };

test("manda: guarda, correo a quien tiene, push y bitácora", async () => {
  const sb = base();
  const d = deps();
  const anotadas = [];
  const r = await mandarAvisoCon({ sbUsuario: sb, sbServicio: sb, datos: DATOS, idEnvio: ID_ENVIO, anotar: async (e) => { anotadas.push(e); }, deps: d });
  assert.equal(r.ok, true);
  assert.equal(r.id, ID_ENVIO);
  assert.equal(r.enviados, 1);
  assert.deepEqual(r.resumen, { clientes: 2, correos: 1, sinCorreo: 1 });
  assert.deepEqual(d.correos, ["uno@x.mx"]);
  assert.equal(d.pushes[0].datos.id, ID_ENVIO);
  assert.equal(anotadas[0].accion, "enviar_aviso");
  assert.equal(sb.avisos.get(ID_ENVIO).correos_enviados, 1);
  assert.equal(sb.avisos.get(ID_ENVIO).usuarios_destino, 2);
});

test("un reintento con el mismo id de envío NO vuelve a mandar", async () => {
  const sb = base();
  const d = deps();
  const anotadas = [];
  const p = { sbUsuario: sb, sbServicio: sb, datos: DATOS, idEnvio: ID_ENVIO, anotar: async (e) => { anotadas.push(e); }, deps: d };
  await mandarAvisoCon(p);
  const r2 = await mandarAvisoCon(p);
  assert.equal(r2.ok, true);
  assert.equal(r2.yaEnviado, true);
  assert.equal(r2.enviados, 1);
  assert.equal(d.correos.length, 1);
  assert.equal(d.pushes.length, 1);
  assert.equal(anotadas.length, 1);
});

test("dos peticiones a la vez: la llave primaria deja pasar solo una", async () => {
  const sb = base();
  const d = deps();
  const p = { sbUsuario: sb, sbServicio: sb, datos: DATOS, idEnvio: ID_ENVIO, anotar: async () => {}, deps: d };
  const [a, b] = await Promise.all([mandarAvisoCon(p), mandarAvisoCon(p)]);
  assert.equal([a, b].filter((x) => x.yaEnviado).length, 1);
  assert.equal(d.correos.length, 1);
});

test("sin id de envío (la web) cada envío es uno nuevo; un id malo se rechaza", async () => {
  const sb = base();
  const r = await mandarAvisoCon({ sbUsuario: sb, sbServicio: sb, datos: DATOS, anotar: async () => {}, deps: deps() });
  assert.equal(r.ok, true);
  assert.notEqual(r.id, ID_ENVIO);
  const malo = await mandarAvisoCon({ sbUsuario: sb, sbServicio: sb, datos: DATOS, idEnvio: "123", anotar: async () => {}, deps: deps() });
  assert.equal(malo.ok, false);
});

test("formulario incompleto: no se guarda nada", async () => {
  const sb = base();
  const r = await mandarAvisoCon({ sbUsuario: sb, sbServicio: sb, datos: { ...DATOS, titulo: "" }, idEnvio: ID_ENVIO, anotar: async () => {}, deps: deps() });
  assert.equal(r.ok, false);
  assert.equal(sb.avisos.size, 0);
});

test("contar: la misma cuenta que la vista previa de la web", async () => {
  const r = await contarDestinatariosCon(base(), { alcance: "todos" }, { log: callado });
  assert.deepEqual(r, { ok: true, resumen: { clientes: 2, correos: 1, sinCorreo: 1 } });
  const falta = await contarDestinatariosCon(base(), { alcance: "ruta" }, { log: callado });
  assert.equal(falta.ok, false);
});
