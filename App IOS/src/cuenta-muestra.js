/**
 * LA CUENTA DE MUESTRA — la que usa el revisor de la App Store.
 *
 * POR QUÉ EXISTE
 * Mientras el Hold esté encendido (ver `estado-sistema.js`), del lado del
 * cliente todas las cifras salen como "—" y la app dice "Sistema en
 * preparación". Para un cliente real eso es la verdad. Para quien revisa la
 * app en Apple parece una app a medias (guía 2.1, App Completeness), y es
 * motivo de rechazo.
 *
 * Luis decidió (23-sep-2026) NO apagar el Hold: el cotizador público y los 43
 * clientes reales siguen sin cifras. En su lugar, UNA cuenta marcada como de
 * muestra ve la app completa con montos de muestra.
 *
 * CÓMO SE RECONOCE — hacen falta las DOS cosas:
 *   1. `app_metadata.demo === true` en su usuario de Supabase. `app_metadata`
 *      sólo se escribe con la llave de servicio: el usuario no puede
 *      ponérselo solo desde la app.
 *   2. Su empresa tiene un folio `MOR-DEMO-…`. Si alguien marcara por error a
 *      un cliente real, su folio (`MOR-2026-…`) lo deja fuera igual.
 * La cuenta se crea con `Web/scripts/demo/cuenta-revision-apple.mjs`.
 *
 * LO QUE CAMBIA PARA ESA CUENTA (y sólo para ella)
 *   · `enHold()` responde false: se ven saldo, movimientos y cotizador.
 *   · El DINERO sale de aquí, no de la base. A propósito: `saldos_clientes`
 *     y `movimientos_saldo` los suma el panel de Morcast ("Por cobrar",
 *     "Cobranza 12 meses"). Montos de muestra en la base ensuciarían las
 *     cifras reales del dueño.
 *   · Lo que el revisor mande (un depósito, una recolección) se queda en la
 *     memoria del teléfono y NO llega a la base: no ensucia la bandeja de
 *     Solicitudes ni la de depósitos por verificar de Morcast.
 * Los servicios, las evidencias y los reportes de peso SÍ son filas de la
 * base (las siembra el script), en una ruta de demostración inactiva y sin
 * chofer, para que ningún chofer real las reciba.
 */

let activa = false;

// Lo que el revisor manda durante la sesión. Vive en memoria: al cerrar
// sesión o cerrar la app desaparece, que es lo que se quiere.
let depositosReportados = [];
let solicitudesPedidas = [];

/** El prefijo de folio que llevan las empresas de demostración. */
export const PREFIJO_FOLIO_MUESTRA = "MOR-DEMO-";

/**
 * Decide si la sesión que acaba de entrar es la de muestra. La llama
 * `sesion.js` con el usuario y el folio de su empresa; nadie más.
 */
export function marcarCuentaDeMuestra(usuario, folioEmpresa) {
  const nueva =
    usuario?.app_metadata?.demo === true &&
    String(folioEmpresa || "").startsWith(PREFIJO_FOLIO_MUESTRA);
  // Cada entrada empieza limpia: lo reportado en otra sesión no se arrastra.
  depositosReportados = [];
  solicitudesPedidas = [];
  activa = nueva;
}

/** Se llama al salir, y al entrar por admin o chofer. */
export function olvidarCuentaDeMuestra() {
  activa = false;
  depositosReportados = [];
  solicitudesPedidas = [];
}

export function esCuentaDeMuestra() {
  return activa;
}

/* -------------------------------------------------------------------- */
/* Fechas relativas a HOY, para que la muestra nunca se vea vieja        */
/* -------------------------------------------------------------------- */

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Día `dia` del mes que está `atras` meses antes del actual. */
function diaDelMes(atras, dia) {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - atras, 1);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  // Nunca en el futuro: un movimiento de "mañana" no existe todavía.
  return d > hoy ? hoy : d;
}

function haceDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/* -------------------------------------------------------------------- */
/* Los montos de muestra                                                */
/* -------------------------------------------------------------------- */

// Tarifas de muestra, las mismas del catálogo del cotizador: la cuenta de
// muestra y el cotizador cuentan la misma historia.
const POR_SERVICIO = 2450; // Recolección de RSU, por evento
const RENTA_CONTENEDOR = 3400; // Contenedor 6 m³, mensual

function movimientosBase() {
  const lista = [];
  let n = 0;
  const mov = (fecha, tipo, concepto, monto, extra = {}) => {
    n += 1;
    const folio = tipo === "abono"
      ? `PAG-DEMO-${String(n).padStart(3, "0")}`
      : `FAC-DEMO-${String(n).padStart(3, "0")}`;
    lista.push({
      id: `muestra-${n}`,
      folio,
      fecha: iso(fecha),
      concepto,
      tipo,
      monto,
      estado: "aplicada",
      banco: tipo === "abono" ? "BBVA" : "",
      referencia: tipo === "abono" ? "MOR-DEMO-0002" : "",
      comprobanteNombre: tipo === "abono" ? "comprobante-spei.pdf" : "",
      ...extra,
    });
  };

  // Dos meses cerrados y el que corre. Cada mes: servicios + renta, y un
  // pago por transferencia a principios del siguiente.
  // Los pagos cubren el mes anterior y dejan saldo a favor.
  const pagos = { 2: 25000, 1: 30000 };
  for (const atras of [2, 1]) {
    const mesNombre = MESES[diaDelMes(atras, 1).getMonth()];
    mov(diaDelMes(atras, 28), "cargo", `Recolección de RSU — 8 servicios (${mesNombre})`, 8 * POR_SERVICIO);
    mov(diaDelMes(atras, 28), "cargo", `Renta de contenedor 6 m³ (${mesNombre})`, RENTA_CONTENEDOR);
    mov(diaDelMes(atras - 1, 5), "abono", "Pago recibido — transferencia SPEI", pagos[atras]);
  }
  mov(haceDias(10), "abono", "Anticipo — transferencia SPEI", 10000);
  // El mes en curso: lo que va del periodo, todavía sin pagar.
  mov(diaDelMes(0, Math.max(1, new Date().getDate() - 3)), "cargo", `Recolección de RSU — 4 servicios (${MESES[new Date().getMonth()]}, a la fecha)`, 4 * POR_SERVICIO);
  // Y un depósito que Morcast todavía no verifica, para que se vea el flujo.
  mov(haceDias(1), "abono", "Depósito reportado — BBVA", 5000, { estado: "por-verificar" });

  return lista.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/** Movimientos de la cuenta de muestra, con lo que el revisor reportó hoy. */
export function movimientosDeMuestra() {
  return [...depositosReportados, ...movimientosBase()];
}

/**
 * El saldo, calculado de los mismos movimientos (igual que la vista
 * `saldos_clientes`): sólo cuentan los abonos aplicados.
 */
export function saldoDeMuestra() {
  const movs = movimientosDeMuestra();
  const suma = (f) => movs.filter(f).reduce((t, m) => t + m.monto, 0);
  const abonos = suma((m) => m.tipo === "abono" && m.estado === "aplicada");
  const cargos = suma((m) => m.tipo === "cargo");
  const mesActual = iso(new Date()).slice(0, 7);
  return {
    saldoActual: abonos - cargos,
    // "Por pagar" = lo que va del periodo en curso.
    porPagar: movs
      .filter((m) => m.tipo === "cargo" && m.fecha.slice(0, 7) === mesActual)
      .reduce((t, m) => t + m.monto, 0),
    porVerificar: suma((m) => m.tipo === "abono" && m.estado === "por-verificar"),
    limiteCredito: 30000,
    diasCredito: 15,
  };
}

/** El revisor reporta un depósito: se queda en memoria, no va a la base. */
export function reportarDepositoDeMuestra({ monto, banco, referencia, comprobante }) {
  const yaEsta = depositosReportados.some(
    (d) => d.monto === Number(monto) && d.referencia === (referencia || "")
  );
  if (yaEsta) {
    return {
      ok: false,
      duplicado: true,
      motivo:
        "Ya tienes un deposito por el mismo monto y la misma referencia esperando verificacion. " +
        "Si es otro pago distinto, cambiale la referencia.",
    };
  }
  depositosReportados.unshift({
    id: `muestra-dep-${depositosReportados.length + 1}`,
    folio: "",
    fecha: iso(new Date()),
    concepto: "Deposito reportado" + (banco ? " — " + banco : ""),
    tipo: "abono",
    monto: Number(monto),
    estado: "por-verificar",
    banco: banco || "",
    referencia: referencia || "",
    comprobanteNombre: comprobante?.fileName || comprobante?.nombre || "",
  });
  return { ok: true };
}

/** El revisor pide una recolección: se queda en memoria, no va a la base. */
export function pedirRecoleccionDeMuestra({ fecha, nota, origen = "ruta" }, rutaNombre) {
  const folio = `REC-DEMO-S${String(solicitudesPedidas.length + 1).padStart(2, "0")}`;
  solicitudesPedidas.unshift({
    id: `muestra-sol-${solicitudesPedidas.length + 1}`,
    folio,
    origen,
    fechaPedida: fecha,
    fechaConfirmada: null,
    estado: "solicitada",
    nota: nota || "",
    rutaNombre: rutaNombre || "Sin ruta",
    unidad: "",
  });
  return { ok: true, folio };
}

/** Las solicitudes que el revisor pidió en esta sesión. */
export function solicitudesDeMuestra() {
  return [...solicitudesPedidas];
}
