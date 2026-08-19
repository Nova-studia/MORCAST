"use client";

/**
 * Números de los dos paneles (el de Morcast y el del cliente).
 *
 * Todo se calcula a partir de lo que hay en la base. Si un número sale en
 * cero es porque de verdad no hay ese dato todavía, no porque falte
 * conectarlo: es la diferencia entre un sistema honesto y uno bonito.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { ADMIN_KPIS } from "@/lib/admin-datos";

/** Indicadores del panel de administración. */
export async function kpisAdmin() {
  if (!haySupabaseNavegador()) return ADMIN_KPIS;

  const supabase = supabaseNavegador();
  const hoy = new Date();
  const primeroDeMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;

  const [clientes, cotizaciones, servicios, saldos] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("estado", "activo"),
    supabase.from("cotizaciones").select("id", { count: "exact", head: true }).eq("estado", "nueva"),
    supabase
      .from("solicitudes_recoleccion")
      .select("id", { count: "exact", head: true })
      .gte("fecha_pedida", primeroDeMes),
    supabase.from("saldos_clientes").select("cargos, saldo"),
  ]);

  const porCobrar = (saldos.data || []).reduce((t, s) => t + Number(s.cargos || 0), 0);

  return {
    // Los ingresos del mes salen de la facturación, que todavía no vive en el
    // sistema. Se dejan en cero en vez de inventar un número que nadie podría
    // cuadrar contra nada.
    ingresosMes: 0,
    ingresosMesAnterior: 0,
    solicitudesNuevas: cotizaciones.count ?? 0,
    clientesActivos: clientes.count ?? 0,
    serviciosMes: servicios.count ?? 0,
    porCobrar,
  };
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/**
 * Cobranza de los últimos 12 meses: los depósitos que Morcast YA verificó.
 *
 * No es "facturación" —eso todavía no vive en el sistema— sino dinero que de
 * verdad entró y alguien aplicó. Antes esta gráfica pintaba doce meses
 * inventados que sumaban $1,635,100: el dueño veía ingresos que nunca
 * existieron justo al lado de un "Ingresos del mes $0.00".
 *
 * Devuelve `{ serie, hayDatos }` para que la pantalla pueda avisar cuando
 * todavía no hay nada que graficar, en vez de enseñar doce barras en cero sin
 * explicación.
 */
export async function cobranza12Meses() {
  const hoy = new Date();
  const serie = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    serie.push({ periodo: MESES[d.getMonth()], año: d.getFullYear(), mes: d.getMonth(), monto: 0 });
  }

  if (!haySupabaseNavegador()) return { serie, hayDatos: false };

  // La fecha se arma con getFullYear/Month para no pasar por UTC: un
  // `toISOString()` sobre la medianoche local devuelve el día anterior.
  const desde = serie[0];
  const primerDia = `${desde.año}-${String(desde.mes + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabaseNavegador()
    .from("movimientos_saldo")
    .select("fecha, monto, tipo, estado")
    .eq("tipo", "abono")
    .eq("estado", "aplicada")
    .gte("fecha", primerDia);

  if (error) {
    console.error("[cobranza] No se pudo leer:", error.message);
    return { serie, hayDatos: false };
  }

  for (const m of data || []) {
    const [a, mes] = String(m.fecha).split("-").map(Number);
    const casilla = serie.find((s) => s.año === a && s.mes === mes - 1);
    if (casilla) casilla.monto += Number(m.monto || 0);
  }

  return { serie, hayDatos: (data || []).length > 0 };
}

/**
 * Resumen de la cuenta del cliente que tiene la sesión: saldo, movimientos y
 * sus próximas recolecciones.
 */
export async function resumenCliente() {
  if (!haySupabaseNavegador()) return null;

  const supabase = supabaseNavegador();

  const [{ data: saldo }, { data: movs }, { data: cliente }] = await Promise.all([
    supabase.from("saldos_clientes").select("saldo, cargos, por_verificar").limit(1).maybeSingle(),
    supabase
      .from("movimientos_saldo")
      .select("folio, fecha, concepto, tipo, monto, estado")
      .order("fecha", { ascending: false })
      .limit(8),
    supabase.from("clientes").select("empresa, contacto, limite_credito, dias_credito").limit(1).maybeSingle(),
  ]);

  return {
    empresa: cliente?.empresa || "",
    contacto: cliente?.contacto || "",
    cuenta: {
      saldoActual: Number(saldo?.saldo ?? 0),
      porPagar: Number(saldo?.cargos ?? 0),
      porVerificar: Number(saldo?.por_verificar ?? 0),
      limiteCredito: Number(cliente?.limite_credito ?? 0),
      diasCredito: Number(cliente?.dias_credito ?? 0),
    },
    movimientos: (movs || []).map((m) => ({
      fecha: m.fecha,
      concepto: m.concepto,
      tipo: m.tipo,
      monto: Number(m.monto),
      folio: m.folio || "",
      estado: m.estado,
    })),
  };
}
