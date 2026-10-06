import { supabase, haySupabase } from "./supabase";
import { postAdmin } from "./api-admin";
import { rangoDelDia } from "./bitacora-vista.js";
import { aportesConMejorDato, filasDeAportes, serieMensual } from "./reportes-negocio.js";

/**
 * COMUNICACIÓN Y COBRANZA DE LA ADMINISTRACIÓN en la app (6-oct-2026,
 * paridad con la web): avisos a clientes, bitácora y reportes del negocio.
 *
 * Igual que en la web (Web/lib/datos-avisos.js y compañía): las LECTURAS van
 * directo a Supabase con la sesión y el RLS decide (el personal ve todos los
 * avisos, la bitácora y los reportes). Lo que ESCRIBE o necesita la llave de
 * servicio (contar destinatarios, mandar un aviso) va por el servidor
 * (/api/app/avisos/*) con `postAdmin`, que manda el pase del segundo paso.
 *
 * Archivo gemelo en las dos apps; solo cambia la extensión de los módulos
 * puros (.mjs en iPhone, .js en Android).
 */

/** ¿Fue falta de señal? Cada app lo dice con su nombre (`sinRed` / `red`). */
export const fueSinRed = (r) => Boolean(r?.sinRed || r?.red);

/* ==================================================================== */
/* AVISOS A CLIENTES                                                    */
/* ==================================================================== */

/** Los sectores activos (A-D), en orden de clave. */
export async function listarSectoresAviso() {
  if (!haySupabase()) return [];
  const { data, error } = await supabase
    .from("sectores")
    .select("id, clave, nombre, color")
    .eq("activo", true)
    .order("clave");
  return error ? [] : data || [];
}

/** Rutas con su UUID en `id` (el aviso necesita el UUID, no la clave). */
export async function listarRutasAviso() {
  if (!haySupabase()) return [];
  const { data, error } = await supabase.from("rutas").select("id, clave, nombre, activa").order("clave");
  return error ? [] : data || [];
}

/** Clientes para el buscador de "un cliente". */
export async function listarClientesAviso() {
  if (!haySupabase()) return [];
  const { data, error } = await supabase
    .from("clientes")
    .select("id, folio, empresa, correo, estado")
    .order("empresa");
  return error ? [] : data || [];
}

const CAMPOS_HISTORIAL = `
  id, titulo, mensaje, motivo, alcance, vigente_hasta, correos_enviados, creado,
  sectores ( clave, nombre ), rutas ( clave, nombre ), clientes ( empresa ),
  perfiles ( nombre )
`;

/**
 * Lo último que se mandó, con su destino y cuántos lo marcaron "Enterado"
 * (`avisos_lecturas ( count )`: PostgREST da solo la cuenta, no las filas).
 * Misma consulta que la web. `null` = no se pudo leer (sin señal).
 */
export async function listarAvisosEnviados({ limite = 50 } = {}) {
  if (!haySupabase()) return [];
  let { data, error } = await supabase
    .from("avisos")
    .select(`${CAMPOS_HISTORIAL}, notificaciones_enviadas, usuarios_destino, avisos_lecturas ( count )`)
    .order("creado", { ascending: false })
    .limit(limite);
  if (error) {
    // Sin la migración 026 esas columnas no existen: el historial va igual.
    ({ data, error } = await supabase
      .from("avisos")
      .select(CAMPOS_HISTORIAL)
      .order("creado", { ascending: false })
      .limit(limite));
  }
  if (error) return null;
  return (data || []).map((a) => ({
    ...a,
    leidos: Array.isArray(a.avisos_lecturas) ? Number(a.avisos_lecturas[0]?.count ?? 0) : null,
  }));
}

/** Quién marcó "Enterado" y cuándo, lo más reciente primero. */
export async function lectoresDeAviso(avisoId) {
  if (!haySupabase()) return { ok: true, lectores: [] };
  const { data: lecturas, error } = await supabase
    .from("avisos_lecturas")
    .select("usuario_id, cliente_id, leido")
    .eq("aviso_id", avisoId)
    .order("leido", { ascending: false });
  if (error) return { ok: false, lectores: [] };
  if (!lecturas?.length) return { ok: true, lectores: [] };

  const usuarios = [...new Set(lecturas.map((l) => l.usuario_id))];
  const empresas = [...new Set(lecturas.map((l) => l.cliente_id).filter(Boolean))];
  const [p, c] = await Promise.all([
    supabase.from("perfiles").select("id, nombre").in("id", usuarios),
    empresas.length ? supabase.from("clientes").select("id, empresa").in("id", empresas) : { data: [] },
  ]);
  const nombre = new Map((p.data || []).map((x) => [x.id, x.nombre]));
  const empresa = new Map((c.data || []).map((x) => [x.id, x.empresa]));
  return {
    ok: true,
    lectores: lecturas.map((l) => ({
      usuarioId: l.usuario_id,
      nombre: nombre.get(l.usuario_id) || "Cuenta eliminada",
      empresa: empresa.get(l.cliente_id) || "",
      leido: l.leido,
    })),
  };
}

/** Vista previa: a cuántos clientes y correos les llega (lo calcula el servidor). */
export async function contarDestinatarios({ alcance, sectorId, rutaId, clienteId }) {
  if (!haySupabase()) return { ok: true, demo: true, resumen: { clientes: 0, correos: 0, sinCorreo: 0 } };
  return postAdmin("avisos/contar", { alcance, sectorId, rutaId, clienteId }, { espera: 15000 });
}

/**
 * Manda el aviso por el servidor: la MISMA lógica que el botón de la web
 * (correos, push, bitácora). Tarda: con 43 clientes ~24 s. Por eso la
 * espera es larga (el servidor corta a los 60 s) y viaja `idEnvio`: si la
 * señal se cae y se reintenta con el mismo, el servidor no lo manda dos veces.
 */
export async function mandarAviso(datos, idEnvio) {
  if (!haySupabase()) return { ok: true, demo: true, resumen: { clientes: 0, correos: 0, sinCorreo: 0 }, enviados: 0, notificaciones: 0 };
  return postAdmin(
    "avisos/mandar",
    {
      idEnvio,
      alcance: datos.alcance,
      sectorId: datos.sectorId,
      rutaId: datos.rutaId,
      clienteId: datos.clienteId,
      motivo: datos.motivo,
      titulo: datos.titulo,
      mensaje: datos.mensaje,
      vigenteHasta: datos.vigenteHasta || null,
    },
    { espera: 75000 }
  );
}

/* ==================================================================== */
/* BITÁCORA (solo lectura)                                              */
/* ==================================================================== */

/**
 * Los movimientos de UN día de Matamoros (pedido de Luis, 6-oct-2026), con
 * el filtro de acción dentro del día. El filtro va en la CONSULTA: el día se
 * vuelve rango de instantes (`bitacora-vista`) y se pide `creado >= desde` y
 * `< hasta`. `total` es la cuenta exacta del día aunque pase del límite.
 *
 * @returns {Promise<{ ok: true, filas: object[], total: number } | { ok: false }>}
 */
export async function bitacoraDelDia({ dia, accion = "", limite = 300 }) {
  if (!haySupabase()) return { ok: true, filas: [], total: 0 };
  const rango = rangoDelDia(dia);
  if (!rango) return { ok: false };

  let consulta = supabase
    .from("bitacora")
    .select("id, actor_correo, accion, tabla, registro_id, detalle, creado", { count: "exact" })
    .gte("creado", rango.desde)
    .lt("creado", rango.hasta)
    .order("creado", { ascending: false })
    .limit(limite);
  if (accion) consulta = consulta.eq("accion", accion);

  const { data, error, count } = await consulta;
  if (error) return { ok: false };
  return { ok: true, filas: data || [], total: count ?? (data || []).length };
}

/* ==================================================================== */
/* REPORTES DEL NEGOCIO                                                 */
/* ==================================================================== */

/**
 * Lo mismo que lee /admin/reportes: los servicios completados con su peso
 * (el mejor dato de cada uno, sin contar doble: `reportes-negocio`) y las
 * cotizaciones del sitio para la conversión. `null` = no se pudo leer.
 */
export async function reportesNegocio() {
  if (!haySupabase()) return { mensual: serieMensual([]), cotizaciones: [], servicios: 0 };

  const [solicitudes, viajes, cotizaciones] = await Promise.all([
    supabase
      .from("solicitudes_recoleccion")
      .select("fecha_pedida, fecha_confirmada, rutas ( tipo ), recolecciones ( peso_kg, peso_real_kg, viaje_id )")
      .eq("estado", "completada"),
    supabase.from("viajes_relleno").select("id, fecha, peso_real_kg"),
    supabase.from("cotizaciones").select("id, estado"),
  ]);
  if (solicitudes.error) return null;

  const recolecciones = (solicitudes.data || [])
    .map((s) => {
      const ev = s.recolecciones?.[0] || null;
      return {
        fecha: s.fecha_confirmada || s.fecha_pedida,
        tipo: s.rutas?.tipo || "otro",
        estimadoKg: ev?.peso_kg,
        realKg: ev?.peso_real_kg,
        viajeId: ev?.viaje_id || null,
      };
    })
    .filter((r) => r.fecha);

  // Sin viajes (error o sin permiso) se sigue: cada recolección cuenta lo suyo.
  const totales = aportesConMejorDato(
    recolecciones,
    (viajes.error ? [] : viajes.data || []).map((v) => ({ id: v.id, fecha: v.fecha, pesoRealKg: v.peso_real_kg }))
  );

  return {
    mensual: serieMensual(filasDeAportes(totales)),
    servicios: totales.servicios,
    cotizaciones: cotizaciones.error ? [] : (cotizaciones.data || []).map((c) => ({ id: c.id, estado: c.estado || "nueva" })),
  };
}
