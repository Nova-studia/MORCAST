import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITES, MAX_CV_BYTES, MESES_QUE_SE_GUARDA,
  texto, folioEmpleo, validarSolicitud, validarArchivo,
  fechaDeCorte, puedeBorrarseVacante, nombreDeVacante, fichaDeVacante,
} from "../lib/empleo.mjs";

const buena = {
  nombre: "Juan Pérez",
  telefono: "868 111 2233",
  puesto: "Chofer de roll off",
  experiencia: "Tres años manejando volteo en una constructora.",
  aviso: true,
};

test("recorta el texto al límite en vez de reventar", () => {
  assert.equal(texto("x".repeat(500), LIMITES.nombre).length, LIMITES.nombre);
  assert.equal(texto("  hola  ", 10), "hola");
  assert.equal(texto(null, 10), "");
});

test("una solicitud completa pasa", () => {
  const r = validarSolicitud(buena);
  assert.equal(r.ok, true);
  assert.equal(r.limpia.nombre, "Juan Pérez");
});

test("sin nombre, sin teléfono o sin experiencia no pasa", () => {
  for (const campo of ["nombre", "telefono", "experiencia"]) {
    const r = validarSolicitud({ ...buena, [campo]: "" });
    assert.equal(r.ok, false, `${campo} vacío deberia fallar`);
  }
});

test("el correo es OPCIONAL, pero si viene tiene que parecer correo", () => {
  assert.equal(validarSolicitud({ ...buena, correo: "" }).ok, true);
  assert.equal(validarSolicitud({ ...buena, correo: "no-es-correo" }).ok, false);
  assert.equal(validarSolicitud({ ...buena, correo: "juan@gmail.com" }).ok, true);
});

test("sin aceptar el aviso no pasa, y ese es el punto", () => {
  assert.equal(validarSolicitud({ ...buena, aviso: false }).ok, false);
});

test("el telefono se guarda solo con digitos, para que el tope no se burle", () => {
  // "868 111 2233" y "8681112233" son la misma persona: si se guardaran
  // distinto, mandar la misma solicitud con y sin espacios saltaria el tope.
  assert.equal(validarSolicitud(buena).limpia.telefono, "8681112233");
  assert.equal(
    validarSolicitud({ ...buena, telefono: "(868) 111-2233" }).limpia.telefono,
    "8681112233"
  );
});

test("el folio lleva el año y no se repite", () => {
  const f = folioEmpleo(new Date("2026-09-02T12:00:00Z"));
  assert.match(f, /^EMP-2026-[A-Z0-9]{4}$/);
  const muchos = new Set(Array.from({ length: 500 }, () => folioEmpleo()));
  assert.ok(muchos.size > 490, "500 folios seguidos no deberian chocar casi nunca");
});

test("el archivo: solo PDF, JPG o PNG y hasta 5 MB", () => {
  assert.equal(validarArchivo(null).ok, true, "sin archivo tambien vale");
  assert.equal(validarArchivo({ type: "application/pdf", size: 1000 }).ok, true);
  assert.equal(validarArchivo({ type: "image/jpeg", size: 1000 }).ok, true);
  assert.equal(validarArchivo({ type: "application/zip", size: 1000 }).ok, false);
  assert.equal(validarArchivo({ type: "application/pdf", size: MAX_CV_BYTES + 1 }).ok, false);
});

test("el corte de los 12 meses cuenta bien, incluso en año bisiesto", () => {
  assert.equal(MESES_QUE_SE_GUARDA, 12);
  const corte = fechaDeCorte(new Date("2026-09-02T00:00:00Z"));
  assert.equal(corte.toISOString().slice(0, 10), "2025-09-02");
  // 29 de febrero: al restar 12 meses no existe el 29-feb-2027, y JavaScript
  // se pasaria al 1 de marzo. Se prefiere el ultimo dia del mes: borrar un dia
  // DESPUES es legal; borrar un dia ANTES de tiempo, no.
  const bisiesto = fechaDeCorte(new Date("2028-02-29T00:00:00Z"));
  assert.equal(bisiesto.toISOString().slice(0, 10), "2027-02-28");
});

test("una solicitud sin vacante NO imprime undefined", () => {
  // Es el error exacto que salio en /admin/recolecciones el 2-sep: la pantalla
  // escribia `${s.chofer} (de la ruta)` y sin chofer imprimia la palabra
  // "undefined" en vivo. Aqui la mayoria de las solicitudes van SIN vacante.
  assert.equal(nombreDeVacante(null), "Solicitud general");
  assert.equal(nombreDeVacante(undefined), "Solicitud general");
  assert.equal(nombreDeVacante({ puesto: "Chofer de roll off" }), "Chofer de roll off");
  assert.equal(nombreDeVacante({}), "Solicitud general");
});

test("la ficha se arma sin separadores colgando", () => {
  assert.equal(
    fichaDeVacante({ area: "operacion", tipo: "tiempo-completo" }),
    "Operación · Tiempo completo"
  );
  // Sin tipo NO debe quedar "Operación ·"
  assert.equal(fichaDeVacante({ area: "operacion" }), "Operación");
  assert.equal(fichaDeVacante({}), "");
});

test("una vacante con candidatos no se puede borrar", () => {
  assert.equal(puedeBorrarseVacante(0).ok, true);
  assert.equal(puedeBorrarseVacante(1).ok, false);
  assert.match(puedeBorrarseVacante(3).motivo, /3 candidatos/);
});
