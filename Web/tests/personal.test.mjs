import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TIPOS_SANGRE,
  claveDeNombre,
  nombreCompleto,
  nombreEnDosLineas,
  normalizarSangre,
  normalizarTelefono,
  telefonoLegible,
  esSi,
  validarEmpleado,
  siguienteNumero,
  estadoPublico,
  fichaPublica,
  fichaEmergencia,
  tieneEmergencia,
  emisionLegible,
  faltantes,
  filtrarPersonal,
  armarOrganigrama,
} from "../lib/personal.mjs";

const JUAN = {
  id: "e1",
  numero: "0024",
  nombre: "Juan Carlos",
  apellido_paterno: "Pérez",
  apellido_materno: "López",
  puesto: "Operador de recolección",
  area: "Ruta Norte",
  tipo: "general",
  estado: "activo",
  foto_ruta: "e1/1.jpg",
  tipo_sangre: "O+",
  alergias: "Penicilina",
  contacto_emergencia: "María López (esposa)",
  telefono_emergencia: "8681234567",
  permiso_emergencia: true,
};
const VIGENTE = { estado: "vigente", codigo: "K7M2X9FDQ4" };

test("nombres: completo, en dos líneas y la clave para comparar", () => {
  assert.equal(nombreCompleto(JUAN), "Juan Carlos Pérez López");
  assert.equal(nombreCompleto({ nombre: " Ana ", apellido_paterno: "Ruiz", apellido_materno: "" }), "Ana Ruiz");
  assert.deepEqual(nombreEnDosLineas(JUAN), ["Juan Carlos", "Pérez López"]);
  assert.equal(claveDeNombre("  JOSÉ   Ángel Núñez "), "jose angel nunez");
});

test("tipo de sangre: se entiende lo que la gente escribe, y lo raro no se adivina", () => {
  assert.equal(normalizarSangre("o positivo"), "O+");
  assert.equal(normalizarSangre("O +"), "O+");
  assert.equal(normalizarSangre("ORH+"), "O+");
  assert.equal(normalizarSangre("0-"), "O-", "el cero por la O");
  assert.equal(normalizarSangre("ab neg"), "AB-");
  assert.equal(normalizarSangre("A Negativo"), "A-");
  assert.equal(normalizarSangre("O"), null, "sin el factor no se sabe");
  assert.equal(normalizarSangre("C+"), null);
  assert.equal(normalizarSangre(""), null);
  for (const t of TIPOS_SANGRE) assert.equal(normalizarSangre(t), t);
});

test("teléfono: diez dígitos, con o sin lada del país", () => {
  assert.equal(normalizarTelefono("868 123 4567"), "8681234567");
  assert.equal(normalizarTelefono("+52 (868) 123-4567"), "8681234567");
  assert.equal(normalizarTelefono("5218681234567"), "8681234567");
  assert.equal(normalizarTelefono("123"), null);
  assert.equal(telefonoLegible("8681234567"), "868 123 4567");
  assert.equal(telefonoLegible("ext. 12"), "ext. 12");
});

test("el permiso firmado no se supone", () => {
  for (const v of ["Sí", "si", "SI", "x", "X", "1", true]) assert.equal(esSi(v), true, String(v));
  for (const v of ["", "no", "No", null, undefined, "pendiente", false, 0]) assert.equal(esSi(v), false, String(v));
});

test("validarEmpleado: limpia y deja listo para guardar", () => {
  const r = validarEmpleado({
    numero: " a-12 ", nombre: "  juan   carlos ", apellido_paterno: "Pérez", apellido_materno: "López",
    puesto: "Chofer", area: "Ruta Norte", tipo: "general", tipo_sangre: "o positivo",
    telefono_emergencia: "868 123 4567", contacto_emergencia: "María (esposa)", permiso_emergencia: "Sí",
  });
  assert.equal(r.ok, true);
  assert.equal(r.datos.numero, "A-12");
  assert.equal(r.datos.nombre, "juan carlos");
  assert.equal(r.datos.tipo_sangre, "O+");
  assert.equal(r.datos.telefono_emergencia, "8681234567");
  assert.equal(r.datos.permiso_emergencia, true);
  assert.equal(r.datos.reporta_a, null);
});

test("validarEmpleado: nombre, apellido y puesto son obligatorios", () => {
  const r = validarEmpleado({ nombre: " ", puesto: "" });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errores).sort(), ["apellido_paterno", "nombre", "puesto"]);
  // Sin número pasa: se le pone el siguiente al guardar.
  assert.equal(validarEmpleado({ nombre: "Ana", apellido_paterno: "Ruiz", puesto: "Contadora" }).ok, true);
});

test("validarEmpleado: lo que no se entiende se dice, no se guarda a medias", () => {
  const base = { nombre: "Ana", apellido_paterno: "Ruiz", puesto: "Contadora" };
  assert.ok(validarEmpleado({ ...base, tipo_sangre: "Z" }).errores.tipo_sangre);
  assert.ok(validarEmpleado({ ...base, telefono_emergencia: "123" }).errores.telefono_emergencia);
  assert.ok(validarEmpleado({ ...base, numero: "12/3" }).errores.numero);
  assert.ok(validarEmpleado({ ...base, numero: "1234567890123" }).errores.numero);
  assert.ok(validarEmpleado({ ...base, nombre: "x".repeat(61) }).errores.nombre);
  assert.ok(validarEmpleado({ ...base, id: "e9", reporta_a: "e9" }).errores.reporta_a);
  // Un tipo desconocido cae en "general", que es el que no sale en el organigrama.
  assert.equal(validarEmpleado({ ...base, tipo: "jefe" }).datos.tipo, "general");
});

test("validarEmpleado: no hay permiso de emergencia sin a quién llamar", () => {
  const base = { nombre: "Ana", apellido_paterno: "Ruiz", puesto: "Contadora", permiso_emergencia: true };
  assert.ok(validarEmpleado(base).errores.permiso_emergencia);
  assert.equal(validarEmpleado({ ...base, telefono_emergencia: "8681234567" }).ok, true);
});

test("siguienteNumero: el más alto más uno, con cuatro cifras", () => {
  assert.equal(siguienteNumero([]), "0001");
  assert.equal(siguienteNumero(["0001", "0024", "0007"]), "0025");
  assert.equal(siguienteNumero(["A-12", "0003", null, ""]), "0004", "los que traen letras no cuentan");
  assert.equal(siguienteNumero(["9999"]), "10000");
});

test("el sello: VIGENTE solo con gafete vigente y persona activa", () => {
  assert.equal(estadoPublico({ gafete: VIGENTE, empleado: JUAN }), "vigente");
  assert.equal(estadoPublico({ gafete: { estado: "repuesto" }, empleado: JUAN }), "no-valido");
  assert.equal(estadoPublico({ gafete: { estado: "anulado" }, empleado: JUAN }), "no-valido");
  assert.equal(estadoPublico({ gafete: VIGENTE, empleado: { ...JUAN, estado: "baja" } }), "no-valido");
  assert.equal(estadoPublico({ gafete: null, empleado: null }), "no-valido", "un código que no existe");
  assert.equal(estadoPublico(), "no-valido");
});

test("nivel 1: solo lo impreso, y nada de la persona si no es vigente", () => {
  assert.deepEqual(fichaPublica({ gafete: VIGENTE, empleado: JUAN }), {
    estado: "vigente",
    nombre: "Juan Carlos Pérez López",
    puesto: "Operador de recolección",
    area: "Ruta Norte",
    numero: "0024",
    hayFoto: true,
    hayEmergencia: true,
  });
  assert.deepEqual(fichaPublica({ gafete: VIGENTE, empleado: { ...JUAN, estado: "baja" } }), { estado: "no-valido" });
  assert.deepEqual(fichaPublica({ gafete: { estado: "repuesto" }, empleado: JUAN }), { estado: "no-valido" });
  // Ningún dato de emergencia se cuela en el nivel 1.
  const texto = JSON.stringify(fichaPublica({ gafete: VIGENTE, empleado: JUAN }));
  for (const secreto of ["O+", "Penicilina", "María", "8681234567", "e1/1.jpg"]) assert.ok(!texto.includes(secreto), secreto);
});

test("nivel 2: solo con permiso firmado, teléfono y gafete vigente", () => {
  assert.deepEqual(fichaEmergencia({ gafete: VIGENTE, empleado: JUAN }), {
    nombre: "Juan Carlos Pérez López",
    tipo_sangre: "O+",
    alergias: "Penicilina",
    contacto: "María López (esposa)",
    telefono: "8681234567",
  });
  assert.equal(fichaEmergencia({ gafete: VIGENTE, empleado: { ...JUAN, permiso_emergencia: false } }), null);
  assert.equal(fichaEmergencia({ gafete: VIGENTE, empleado: { ...JUAN, telefono_emergencia: null } }), null);
  assert.equal(fichaEmergencia({ gafete: { estado: "anulado" }, empleado: JUAN }), null);
  assert.equal(fichaEmergencia({ gafete: VIGENTE, empleado: { ...JUAN, estado: "baja" } }), null);
  assert.equal(tieneEmergencia(JUAN), true);
  assert.equal(fichaPublica({ gafete: VIGENTE, empleado: { ...JUAN, permiso_emergencia: false } }).hayEmergencia, false);
});

test("la emisión se imprime con el mes de Matamoros", () => {
  assert.equal(emisionLegible("2026-10-12T15:00:00Z"), "10/2026");
  // Las 03:00 UTC del 1.º de noviembre todavía son 31 de octubre en Matamoros.
  assert.equal(emisionLegible("2026-11-01T03:00:00Z"), "10/2026");
  assert.equal(emisionLegible("no es fecha"), "");
});

test("faltantes: qué impide mandar el gafete a la imprenta", () => {
  assert.deepEqual(faltantes(JUAN), []);
  assert.deepEqual(faltantes({ ...JUAN, foto_ruta: null, puesto: " " }), ["foto", "puesto"]);
});

test("filtrarPersonal: busca sin acentos y filtra por tipo, estado y chip", () => {
  const lista = [
    { ...JUAN, gafete: { codigo: "K7M2X9FDQ4", chip_grabado_en: null } },
    { id: "e2", nombre: "Ana", apellido_paterno: "Núñez", apellido_materno: "", puesto: "Contadora", area: "Oficina", numero: "0002", tipo: "administrativo", estado: "activo", gafete: { codigo: "ABCDEFGH23", chip_grabado_en: "2026-10-12" } },
    { id: "e3", nombre: "Luis", apellido_paterno: "Soto", apellido_materno: "", puesto: "Ayudante", area: "Ruta Sur", numero: "0003", tipo: "general", estado: "baja", gafete: null },
  ];
  const ids = (f) => filtrarPersonal(lista, f).map((e) => e.id);
  assert.deepEqual(ids({}), ["e1", "e2", "e3"]);
  assert.deepEqual(ids({ texto: "nunez" }), ["e2"]);
  assert.deepEqual(ids({ texto: "PEREZ juan" }), ["e1"], "todas las palabras, en cualquier orden");
  assert.deepEqual(ids({ texto: "k7m2" }), ["e1"], "por el código del gafete");
  assert.deepEqual(ids({ texto: "0003" }), ["e3"]);
  assert.deepEqual(ids({ tipo: "administrativo" }), ["e2"]);
  assert.deepEqual(ids({ estado: "baja" }), ["e3"]);
  assert.deepEqual(ids({ chip: true }), ["e1"], "solo activos con gafete sin grabar");
  assert.deepEqual(filtrarPersonal(null, {}), []);
});

test("organigrama: árbol por «Reporta a», solo administrativos activos", () => {
  const adm = (id, nombre, reporta_a = null, extra = {}) =>
    ({ id, nombre, apellido_paterno: "", apellido_materno: "", tipo: "administrativo", estado: "activo", reporta_a, ...extra });
  const arbol = armarOrganigrama([
    adm("d", "Dora"),
    adm("g", "Gabriel", "d"),
    adm("c", "Carla", "d"),
    adm("a", "Abel", "g"),
    adm("x", "Xavier", "d", { estado: "baja" }),
    adm("h", "Hugo", "x"), // su jefe está de baja: queda arriba
    { ...JUAN, reporta_a: "d" }, // personal general: no sale
  ]);
  assert.deepEqual(arbol.map((n) => n.nombre), ["Dora", "Hugo"]);
  assert.deepEqual(arbol[0].subordinados.map((n) => n.nombre), ["Carla", "Gabriel"], "en orden alfabético");
  assert.deepEqual(arbol[0].subordinados[1].subordinados.map((n) => n.nombre), ["Abel"]);
});

test("organigrama: un ciclo no lo cuelga ni se lleva a los de abajo", () => {
  const adm = (id, reporta_a) =>
    ({ id, nombre: id.toUpperCase(), apellido_paterno: "", apellido_materno: "", tipo: "administrativo", estado: "activo", reporta_a });
  const arbol = armarOrganigrama([adm("a", "b"), adm("b", "a"), adm("c", "a"), adm("s", "s")]);
  assert.deepEqual(arbol.map((n) => n.id), ["a", "b", "s"], "los del ciclo quedan como raíces");
  assert.deepEqual(arbol[0].subordinados.map((n) => n.id), ["c"], "quien reporta a uno del ciclo sigue colgado de él");
  assert.deepEqual(armarOrganigrama(null), []);
});
