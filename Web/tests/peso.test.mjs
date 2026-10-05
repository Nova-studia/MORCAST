import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kgValido,
  leerKg,
  fuenteDePeso,
  aportesConMejorDato,
  cuadreDeViaje,
  candidatasParaViaje,
  cambiosDeRecolecciones,
  textoPeso,
  textoDiferencia,
} from "../lib/peso.mjs";

test("kgValido solo deja pasar números positivos", () => {
  assert.equal(kgValido("850.5"), 850.5);
  assert.equal(kgValido(0), null);
  assert.equal(kgValido(-3), null);
  assert.equal(kgValido(""), null);
  assert.equal(kgValido(null), null);
  assert.equal(kgValido("abc"), null);
});

test("leerKg entiende comas de miles y rechaza lo absurdo", () => {
  assert.deepEqual(leerKg("1,250"), { kg: 1250 });
  assert.deepEqual(leerKg(" 980.5 "), { kg: 980.5 });
  assert.ok(leerKg("").error);
  assert.ok(leerKg("0").error);
  assert.ok(leerKg("12kg").error);
  assert.ok(leerKg("125000").error, "más de 60 t es un punto mal puesto");
  assert.ok(leerKg("1.234").error, "más de dos decimales no es un peso de báscula");
});

test("la fuente de una recolección: viaje > real propio > estimado", () => {
  const viajes = { V1: { pesoRealKg: 6000 } };
  assert.deepEqual(fuenteDePeso({ estimadoKg: 800, realKg: 750, viajeId: "V1" }, viajes), { fuente: "viaje", kg: 6000 });
  assert.deepEqual(fuenteDePeso({ estimadoKg: 800, realKg: 750 }, viajes), { fuente: "real", kg: 750 });
  assert.deepEqual(fuenteDePeso({ estimadoKg: 800 }, viajes), { fuente: "estimado", kg: 800 });
  assert.deepEqual(fuenteDePeso({}, viajes), { fuente: "sin-peso", kg: null });
  // Un viaje que la sesión no ve (el cliente) no cuenta: cae a lo propio.
  assert.deepEqual(fuenteDePeso({ estimadoKg: 800, viajeId: "V9" }, viajes), { fuente: "estimado", kg: 800 });
});

test("un viaje cuenta UNA vez con su peso real, no la suma de sus estimados", () => {
  const recs = [
    { fecha: "2026-10-04", tipo: "manual", estimadoKg: 1000, viajeId: "V1" },
    { fecha: "2026-10-04", tipo: "manual", estimadoKg: 1200, viajeId: "V1" },
    { fecha: "2026-10-04", tipo: "roll-off", estimadoKg: 900, viajeId: "V1" },
  ];
  const r = aportesConMejorDato(recs, [{ id: "V1", fecha: "2026-10-04", pesoRealKg: 3500 }]);
  assert.equal(r.kgTotal, 3500);
  assert.equal(r.kgReal, 3500);
  assert.equal(r.kgEstimado, 0);
  assert.equal(r.servicios, 3, "los servicios se siguen contando uno por uno");
  assert.equal(r.aportes.length, 1);
  assert.equal(r.aportes[0].tipo, "manual", "el tipo del viaje es el que más se repite");
});

test("el peso real propio de una recolección DENTRO de un viaje no se suma aparte", () => {
  const recs = [
    { fecha: "2026-10-04", estimadoKg: 1000, realKg: 1100, viajeId: "V1" },
    { fecha: "2026-10-04", estimadoKg: 900, viajeId: "V1" },
  ];
  const r = aportesConMejorDato(recs, [{ id: "V1", fecha: "2026-10-04", pesoRealKg: 2100 }]);
  assert.equal(r.kgTotal, 2100);
  assert.equal(r.kgRealSuelto, 0);
});

test("mezcla: viaje + real suelto + estimado + sin peso, sin contar doble", () => {
  const recs = [
    { fecha: "2026-10-01", tipo: "manual", estimadoKg: 500, viajeId: "V1" },
    { fecha: "2026-10-01", tipo: "manual", estimadoKg: 700, viajeId: "V1" },
    { fecha: "2026-10-02", tipo: "roll-off", estimadoKg: 4000, realKg: 4300 },
    { fecha: "2026-10-03", tipo: "manual", estimadoKg: 250 },
    { fecha: "2026-10-03", tipo: "manual" },
  ];
  const r = aportesConMejorDato(recs, [{ id: "V1", fecha: "2026-10-01", pesoRealKg: 1300 }]);
  assert.equal(r.kgViajes, 1300);
  assert.equal(r.kgRealSuelto, 4300);
  assert.equal(r.kgReal, 5600);
  assert.equal(r.kgEstimado, 250);
  assert.equal(r.kgTotal, 5850);
  assert.equal(r.servicios, 5);
  assert.equal(r.serviciosConReal, 3);
  assert.equal(r.serviciosSinPeso, 1);
});

test("un viaje sin peso o que no se puede leer deja a sus recolecciones con su propio dato", () => {
  const recs = [
    { fecha: "2026-10-01", estimadoKg: 500, viajeId: "V1" },
    { fecha: "2026-10-01", estimadoKg: 700, viajeId: "V2" },
  ];
  const r = aportesConMejorDato(recs, [{ id: "V1", fecha: "2026-10-01", pesoRealKg: 0 }]);
  assert.equal(r.kgTotal, 1200);
  assert.equal(r.kgReal, 0);
});

test("un viaje sin recolecciones amarradas no suma (si sumara, contaría doble)", () => {
  const r = aportesConMejorDato(
    [{ fecha: "2026-10-01", estimadoKg: 500 }],
    [{ id: "V1", fecha: "2026-10-01", pesoRealKg: 6000 }]
  );
  assert.equal(r.kgTotal, 500);
});

test("el cuadre del viaje: real contra la suma de estimados", () => {
  const c = cuadreDeViaje({ pesoRealKg: 3500 }, [{ estimadoKg: 1000 }, { estimadoKg: 2000 }, {}]);
  assert.equal(c.recolecciones, 3);
  assert.equal(c.sinEstimado, 1);
  assert.equal(c.estimadoKg, 3000);
  assert.equal(c.diferenciaKg, 500);
  assert.equal(c.diferenciaPct, 17);
  const vacio = cuadreDeViaje({ pesoRealKg: 3500 }, []);
  assert.equal(vacio.diferenciaKg, null, "sin estimados no hay contra qué comparar");
});

test("candidatas: misma fecha, filtros, y las de otro viaje aparte", () => {
  const recs = [
    { id: "a", fecha: "2026-10-04", operadorId: "c1", rutaClave: "RT-1", unidadId: "u1" },
    { id: "b", fecha: "2026-10-04", operadorId: "c2", rutaClave: "RT-2", unidadId: "u2" },
    { id: "c", fecha: "2026-10-03", operadorId: "c1", rutaClave: "RT-1", unidadId: "u1" },
    { id: "d", fecha: "2026-10-04", operadorId: "c1", rutaClave: "RT-1", unidadId: "u1", viajeId: "V9" },
    { id: "e", fecha: "2026-10-04", operadorId: "c1", rutaClave: "RT-1", unidadId: "u1", viajeId: "V1" },
  ];
  const todas = candidatasParaViaje(recs, { fecha: "2026-10-04", viajeId: "V1" });
  assert.deepEqual(todas.libres.map((r) => r.id), ["a", "b", "e"]);
  assert.deepEqual(todas.enOtroViaje.map((r) => r.id), ["d"]);
  assert.deepEqual(candidatasParaViaje(recs, { fecha: "2026-10-04", choferId: "c2" }).libres.map((r) => r.id), ["b"]);
  assert.deepEqual(candidatasParaViaje(recs, { fecha: "2026-10-04", rutaClave: "RT-1" }).libres.map((r) => r.id), ["a"]);
  assert.deepEqual(candidatasParaViaje(recs, { fecha: "2026-10-04", unidadId: "u2" }).libres.map((r) => r.id), ["b"]);
});

test("cambios de recolecciones: solo lo que entra y lo que sale", () => {
  assert.deepEqual(cambiosDeRecolecciones(["a", "b"], ["b", "c"]), { agregar: ["c"], quitar: ["a"] });
  assert.deepEqual(cambiosDeRecolecciones([], []), { agregar: [], quitar: [] });
});

test("textos de peso", () => {
  assert.equal(textoPeso(6240), "6.24 t");
  assert.equal(textoPeso(80), "80 kg");
  assert.equal(textoDiferencia(320), "+320 kg");
  assert.equal(textoDiferencia(-1500), "−1.5 t");
  assert.equal(textoDiferencia(null), "—");
});
