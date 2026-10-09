// Apps al 100% (9-oct-2026), administración: Recolecciones en la base
// (búsqueda, fechas, páginas), avisos a clientes elegidos, ficha del
// cliente, rutas y el puente al panel web.
import { test } from "node:test";
import assert from "node:assert/strict";
import { consultaRecolecciones, textoPaginacion, totalPaginas } from "../src/recolecciones-panel.mjs";
import { filtrarClientes, alternarId, marcarVisibles, textoMarcados } from "../src/elegir-clientes.mjs";
import {
  botonesDeEstado,
  cambiosDeEdicion,
  servicioDelPunto,
  lineaUsuarioCliente,
  formularioDeCliente,
} from "../src/ficha-cliente.mjs";
import { puntosParaOficina, textoDiasRuta } from "../src/rutas-admin.mjs";
import { HERRAMIENTAS_WEB, herramientasVisibles, resultadoPuenteAdmin } from "../src/puente-admin.mjs";
import { pestanasAdmin } from "../src/menu-admin.mjs";
import { DESTINOS_PANEL } from "../../Web/lib/app-acciones-mapa.mjs";
import { PERMISOS_DE_ROL } from "../src/web/permisos.mjs";

test("recolecciones: por omisión desde hace 30 días, página 1, sin búsqueda", () => {
  const c = consultaRecolecciones({ hoy: "2026-10-09" });
  assert.equal(c.desde, "2026-09-09");
  assert.equal(c.hasta, "");
  assert.equal(c.texto, "");
  assert.deepEqual(c.rango, [0, 49]);
  assert.match(c.fechas, /fecha_confirmada\.gte\.2026-09-09/);
});

test("recolecciones: la búsqueda se limpia y las páginas avanzan de 50 en 50", () => {
  const c = consultaRecolecciones({ hoy: "2026-10-09", q: " REC-2026,(0012) ", desde: "", hasta: "", pagina: 3 });
  assert.equal(c.texto, "REC-20260012");
  assert.deepEqual(c.rango, [100, 149]);
  assert.equal(c.fechas, null, "Desde vacío a propósito: sin rango");
  assert.equal(totalPaginas(0), 1);
  assert.equal(totalPaginas(50), 1);
  assert.equal(totalPaginas(51), 2);
  assert.equal(textoPaginacion({ pagina: 2, total: 120 }), "Página 2 de 3 · 120 recolecciones");
  assert.equal(textoPaginacion({ pagina: 1, total: 1 }), "1 recolección");
  assert.equal(textoPaginacion({ pagina: 1, total: 0 }), "Ninguna recolección");
});

test("avisos a clientes elegidos: buscar, marcar, marcar los que se ven y quitar", () => {
  const cs = [
    { id: "1", empresa: "Plásticos del Golfo", folio: "MOR-1", correo: "a@x.mx" },
    { id: "2", empresa: "Aceros Norte", folio: "MOR-2", correo: "" },
    { id: "3", empresa: "Panadería Sur", folio: "MOR-3", correo: "pan@x.mx" },
  ];
  assert.deepEqual(filtrarClientes(cs, "plasticos").map((c) => c.id), ["1"]);
  assert.deepEqual(filtrarClientes(cs, "mor-2").map((c) => c.id), ["2"]);
  assert.equal(filtrarClientes(cs, "").length, 3);
  assert.deepEqual(alternarId(["1"], "2"), ["1", "2"]);
  assert.deepEqual(alternarId(["1", "2"], "1"), ["2"]);
  assert.deepEqual(marcarVisibles(["1"], filtrarClientes(cs, "sur")), ["1", "3"]);
  assert.deepEqual(marcarVisibles(["1"], cs), ["1", "2", "3"]);
  assert.equal(textoMarcados(1), "1 marcado");
  assert.equal(textoMarcados(3), "3 marcados");
});

test("ficha: los botones de estado según el estado de la cuenta", () => {
  assert.deepEqual(botonesDeEstado("activo"), ["suspendido", "baja"]);
  assert.deepEqual(botonesDeEstado("pendiente-info"), ["suspendido", "baja"]);
  assert.deepEqual(botonesDeEstado("suspendido"), ["baja", "activo"]);
  assert.deepEqual(botonesDeEstado("baja"), ["activo"]);
});

test("ficha: editar manda números donde van números", () => {
  const f = formularioDeCliente({ empresa: "Acme", contacto: null, dias_credito: 45, limite_credito: "1000.5", plan: "Por evento" });
  assert.equal(f.contacto, "");
  assert.equal(f.dias_credito, "45");
  const c = cambiosDeEdicion({ ...f, dias_credito: "abc", limite_credito: "2500.50" });
  assert.equal(c.dias_credito, 0);
  assert.equal(c.limite_credito, 2500.5);
  assert.equal(c.empresa, "Acme");
});

test("ficha: el servicio de un punto y la línea de un usuario", () => {
  assert.equal(servicioDelPunto({ suscripciones: [{ id: "s", estado: "pausada" }] }).id, "s");
  assert.equal(servicioDelPunto({ suscripciones: { id: "t", estado: "activa" } }).id, "t");
  assert.equal(servicioDelPunto({ suscripciones: [] }), null);
  const fecha = (iso) => `F(${iso})`;
  assert.equal(lineaUsuarioCliente({ correo: "a@x.mx", proveedor: "email", ultimoAcceso: "2026-10-01T10:00:00Z" }, fecha),
    "a@x.mx · entra con correo · último acceso F(2026-10-01)");
  assert.equal(lineaUsuarioCliente({ correo: "a@x.mx", proveedor: "google", ultimoAcceso: null }, fecha),
    "a@x.mx · entra con google · nunca ha entrado");
});

test("nueva recolección: los puntos del cliente con su ruta y el chofer de la ruta", () => {
  const filas = [
    { id: "d1", alias: "Planta", colonia: "Sur", suscripciones: [{ estado: "cancelada", rutas: { nombre: "Vieja", chofer: "X", chofer_id: "x" } }, { estado: "activa", rutas: { nombre: "Ruta Sur", chofer: "Beto", chofer_id: "c1" } }] },
    { id: "d2", alias: "", colonia: "", suscripciones: [] },
  ];
  assert.deepEqual(puntosParaOficina(filas), [
    { id: "d1", texto: "Planta · Sur", ruta: "Ruta Sur", rutaChoferId: "c1", rutaChofer: "Beto" },
    { id: "d2", texto: "Punto sin nombre", ruta: "", rutaChoferId: null, rutaChofer: "" },
  ]);
  assert.equal(textoDiasRuta(["lunes", "jueves"]), "lunes, jueves");
  assert.equal(textoDiasRuta([]), "Sin días");
});

test("puente al panel web: solo destinos que la web acepta y con su sección", () => {
  for (const h of HERRAMIENTAS_WEB) {
    assert.ok(DESTINOS_PANEL.includes(h.destino), h.destino);
    assert.ok(PERMISOS_DE_ROL.includes(h.seccion), h.seccion);
  }
  const caja = { rol: "admin", permisos: ["precios", "bitacora"] };
  assert.deepEqual(herramientasVisibles(caja).map((h) => h.destino), ["/admin/precios", "/admin/bitacora"]);
  assert.equal(herramientasVisibles({ rol: "dueno", permisos: [] }).length, HERRAMIENTAS_WEB.length);
  assert.equal(herramientasVisibles(null).length, 0);
});

test("puente al panel web: solo se abre un enlace https; si no, el motivo", () => {
  assert.deepEqual(resultadoPuenteAdmin({ ok: true, url: "https://morcast.mx/admin/entrar?th=1&pp=2&a=%2Fadmin" }), { abrir: "https://morcast.mx/admin/entrar?th=1&pp=2&a=%2Fadmin" });
  assert.equal(resultadoPuenteAdmin({ ok: false, motivo: "Tu rol no incluye esta sección." }).motivo, "Tu rol no incluye esta sección.");
  assert.equal(resultadoPuenteAdmin({ ok: false, sinRed: true, motivo: "x" }).sinRed, true);
  assert.match(resultadoPuenteAdmin({ ok: true, url: "http://malo" }).motivo, /No se pudo abrir/);
});

test("pestañas del admin según su rol: Panel y Más siempre", () => {
  assert.deepEqual(pestanasAdmin({ rol: "dueno", permisos: [] }), ["Panel", "Solicitudes", "Saldos", "MasA"]);
  assert.deepEqual(pestanasAdmin({ rol: "admin", permisos: ["saldos"] }), ["Panel", "Saldos", "MasA"]);
  assert.deepEqual(pestanasAdmin(null), ["Panel", "MasA"]);
});
