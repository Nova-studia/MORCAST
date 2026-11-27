import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_FALLOS_TELEFONO,
  TEXTOS_GAFETE,
  ROLES_GAFETE,
  normalizarSerie,
  hashSecreto,
  validarPeticion,
  decidirEntrada,
  decidirVinculo,
  respuestaEntrar,
} from "../lib/gafete-acceso.mjs";

// Todo inventado: ningún código, serie ni secreto real.
const UID = "00000000-0000-4000-8000-0000000000c1";
const OTRO = "00000000-0000-4000-8000-0000000000c2";
const SERIE = "04A1B2C3D4E5F6";
const HASH = "f".repeat(64);
const base = () => ({
  gafete: { id: "g1", estado: "vigente", chip_serie: SERIE },
  empleado: { estado: "activo", perfil_id: UID },
  perfil: { id: UID, rol: "operador", activo: true },
  par: { id: "p1", perfil_id: UID, exige_serie: true, fallos: 0, desvinculado_en: null, secreto_hash: HASH },
  serie: SERIE,
  hashRecibido: HASH,
});
const NO_ENTRA_CONTANDO = { ok: false, motivo: "noEntra", contarFallo: true };

test("el tope es el 4.º fallo y los textos son los del diseño", () => {
  assert.equal(MAX_FALLOS_TELEFONO, 4);
  assert.equal(TEXTOS_GAFETE.noEntra, "Este gafete no puede entrar en este teléfono.");
  assert.equal(TEXTOS_GAFETE.usaCorreo, "Demasiados intentos con el gafete. Entra con tu correo.");
  assert.equal(TEXTOS_GAFETE.sinCuenta, "Este gafete no está ligado a tu cuenta. Pídele a un administrador que lo ligue.");
  assert.deepEqual(ROLES_GAFETE, ["dueno", "admin", "operador"]);
});

test("con todo correcto, entra", () => {
  assert.deepEqual(decidirEntrada(base()), { ok: true });
});

test("gafete repuesto o empleado de baja: no entra y cuenta el fallo", () => {
  const a = base(); a.gafete.estado = "repuesto";
  assert.deepEqual(decidirEntrada(a), NO_ENTRA_CONTANDO);
  const b = base(); b.empleado.estado = "baja";
  assert.deepEqual(decidirEntrada(b), NO_ENTRA_CONTANDO);
});

test("si el empleado se ligó a otra cuenta, el teléfono viejo ya no entra", () => {
  const a = base(); a.empleado.perfil_id = OTRO;
  assert.deepEqual(decidirEntrada(a), NO_ENTRA_CONTANDO);
});

test("cuenta desactivada o de cliente: no entra", () => {
  const a = base(); a.perfil.activo = false;
  assert.equal(decidirEntrada(a).ok, false);
  const b = base(); b.perfil.rol = "cliente";
  assert.equal(decidirEntrada(b).ok, false);
});

test("teléfono que no está vinculado: no entra y NO cuenta (no se bloquea a nadie)", () => {
  const a = base(); a.par = null;
  assert.deepEqual(decidirEntrada(a), { ok: false, motivo: "noEntra", contarFallo: false });
  const b = base(); b.par.desvinculado_en = "2026-11-27T10:00:00Z";
  assert.deepEqual(decidirEntrada(b), { ok: false, motivo: "noEntra", contarFallo: false });
});

test("al 4.º fallo pide correo aunque lo demás esté bien; con 3 todavía entra", () => {
  const a = base(); a.par.fallos = 4;
  assert.deepEqual(decidirEntrada(a), { ok: false, motivo: "usaCorreo", contarFallo: false });
  const b = base(); b.par.fallos = 3;
  assert.deepEqual(decidirEntrada(b), { ok: true });
});

test("serie distinta: no entra si el vínculo exige serie; sin exigirla entra sin serie", () => {
  const a = base(); a.serie = "04FFFFFFFFFFFF";
  assert.deepEqual(decidirEntrada(a), NO_ENTRA_CONTANDO);
  const b = base(); b.par.exige_serie = false; b.serie = null;
  assert.deepEqual(decidirEntrada(b), { ok: true });
});

test("secreto equivocado: no entra y cuenta", () => {
  const a = base(); a.hashRecibido = "0".repeat(64);
  assert.deepEqual(decidirEntrada(a), NO_ENTRA_CONTANDO);
});

test("vincular: gafete de otra cuenta → sinCuenta", () => {
  const { gafete, empleado } = base();
  assert.deepEqual(decidirVinculo({ gafete, empleado, uid: OTRO, serie: SERIE }), { ok: false, motivo: "sinCuenta" });
});

test("vincular: gafete sin serie guardada la guarda; serie distinta a la guardada → serieOtra", () => {
  const { gafete, empleado } = base();
  assert.deepEqual(
    decidirVinculo({ gafete: { ...gafete, chip_serie: null }, empleado, uid: UID, serie: SERIE }),
    { ok: true, guardarSerie: true, exigeSerie: true },
  );
  assert.deepEqual(
    decidirVinculo({ gafete, empleado, uid: UID, serie: "04FFFFFFFFFFFF" }),
    { ok: false, motivo: "serieOtra" },
  );
  assert.deepEqual(decidirVinculo({ gafete, empleado, uid: UID, serie: SERIE }), { ok: true, guardarSerie: false, exigeSerie: true });
});

test("vincular sin serie (iPhone que no la lee) no exige serie", () => {
  const { gafete, empleado } = base();
  assert.deepEqual(decidirVinculo({ gafete, empleado, uid: UID, serie: null }), { ok: true, guardarSerie: false, exigeSerie: false });
});

test("vincular un gafete que ya no vale → noEntra", () => {
  const { empleado } = base();
  assert.deepEqual(
    decidirVinculo({ gafete: { estado: "anulado", chip_serie: null }, empleado, uid: UID, serie: SERIE }),
    { ok: false, motivo: "noEntra" },
  );
});

test("la serie se normaliza a hexadecimal en mayúsculas", () => {
  assert.equal(normalizarSerie("04:a1:b2:c3:d4:e5:f6"), SERIE);
  assert.equal(normalizarSerie("04 A1-B2C3D4E5F6"), SERIE);
  assert.equal(normalizarSerie("zz"), null);
  assert.equal(normalizarSerie(null), null);
});

test("el hash del secreto es SHA-256 en hexadecimal", async () => {
  assert.equal(await hashSecreto("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("la petición acepta el enlace completo del chip como código", () => {
  const r = validarPeticion({
    codigo: "https://morcast.mx/g/MNPQRS2345",
    serie: "04:a1:b2:c3:d4:e5:f6",
    dispositivoId: "11111111-1111-4111-8111-111111111111",
    secreto: "A".repeat(43),
  });
  assert.equal(r.ok, true);
  assert.equal(r.codigo, "MNPQRS2345");
  assert.equal(r.serie, SERIE);
});

test("la petición rechaza teléfono sin uuid, secreto corto o código ajeno", () => {
  const buena = { codigo: "MNPQRS2345", serie: null, dispositivoId: "11111111-1111-4111-8111-111111111111", secreto: "A".repeat(43) };
  assert.equal(validarPeticion(buena).ok, true);
  assert.equal(validarPeticion(buena).serie, null);
  assert.equal(validarPeticion({ ...buena, dispositivoId: "x" }).ok, false);
  assert.equal(validarPeticion({ ...buena, secreto: "corto" }).ok, false);
  assert.equal(validarPeticion({ ...buena, codigo: "https://otro.mx/g/MNPQRS2345" }).ok, false);
});

test("respuesta de entrar: 401 genérico, 423 pide correo, 200 ok", () => {
  assert.deepEqual(respuestaEntrar(NO_ENTRA_CONTANDO), { status: 401, cuerpo: { ok: false, motivo: TEXTOS_GAFETE.noEntra } });
  assert.deepEqual(
    respuestaEntrar({ ok: false, motivo: "usaCorreo", contarFallo: false }),
    { status: 423, cuerpo: { ok: false, motivo: TEXTOS_GAFETE.usaCorreo, usaCorreo: true } },
  );
  assert.deepEqual(respuestaEntrar({ ok: true }), { status: 200, cuerpo: { ok: true } });
});

test("ligar cuenta: solo personal activo y que no sea de otro empleado activo", async () => {
  const { puedeLigarse } = await import("../lib/gafete-acceso.mjs");
  const chofer = { id: UID, rol: "operador", activo: true };
  assert.equal(puedeLigarse({ perfil: { ...chofer, rol: "cliente" }, ligadoA: null, empleadoId: "e1" }), false);
  assert.equal(puedeLigarse({ perfil: { ...chofer, activo: false }, ligadoA: null, empleadoId: "e1" }), false);
  assert.equal(puedeLigarse({ perfil: chofer, ligadoA: "e2", empleadoId: "e1" }), false);
  assert.equal(puedeLigarse({ perfil: chofer, ligadoA: null, empleadoId: "e1" }), true);
  assert.equal(puedeLigarse({ perfil: chofer, ligadoA: "e1", empleadoId: "e1" }), true);
  assert.equal(puedeLigarse({ perfil: null, ligadoA: null, empleadoId: "e1" }), false);
});

test("vincular: el dueño y los administradores necesitan su segundo paso; el chofer no", async () => {
  const { vinculoExigePase } = await import("../lib/gafete-acceso.mjs");
  assert.equal(vinculoExigePase("dueno"), true);
  assert.equal(vinculoExigePase("admin"), true);
  assert.equal(vinculoExigePase("operador"), false);
});

test("revisión: el freno por gafete va con el teléfono; uno inventado no frena al dueño", async () => {
  const { clavesFreno } = await import("../lib/gafete-acceso.mjs");
  const dueno = clavesFreno({ codigo: "MNPQRS2345", dispositivoId: "11111111-1111-4111-8111-111111111111" });
  const atacante = clavesFreno({ codigo: "MNPQRS2345", dispositivoId: "22222222-2222-4222-8222-222222222222" });
  assert.ok(dueno.length > 0);
  for (const clave of dueno) assert.ok(!atacante.includes(clave), `el atacante comparte la clave ${clave}`);
});

test("revisión: el pase solo sale si el vínculo se hizo con segundo paso y es de esa cuenta", async () => {
  const { puedeDarPase } = await import("../lib/gafete-acceso.mjs");
  assert.equal(puedeDarPase({ par: { perfil_id: UID, con_pase: true }, uid: UID }), true);
  assert.equal(puedeDarPase({ par: { perfil_id: UID, con_pase: false }, uid: UID }), false); // era chofer al vincular
  assert.equal(puedeDarPase({ par: { perfil_id: OTRO, con_pase: true }, uid: UID }), false);
  assert.equal(puedeDarPase({ par: null, uid: UID }), false);
});
