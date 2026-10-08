"use server";

import { aplicarPermiso } from "@/lib/estado-cliente.mjs";
import { supabaseSesion, usuarioActual } from "@/lib/supabase-sesion";
import { haySupabase } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import * as P from "@/lib/precios-servidor";

/** Dueño, o admin con el permiso "precios". `usuarioActual()` ya exige el segundo paso. */
async function exigirPrecios() {
  const quien = await usuarioActual();
  if (!quien) return { error: "Tu sesión se venció. Vuelve a entrar." };
  const sb = await supabaseSesion();
  const { data } = await sb.from("perfiles").select("permisos").eq("id", quien.id).maybeSingle();
  const puede = quien.rol === "dueno" || (quien.rol === "admin" && (data?.permisos || []).includes("precios"));
  if (!puede) return { error: "No tienes permiso para cambiar precios." };
  return { quien, sb };
}

const demo = { ok: true, demo: true };

export async function catalogoAccion() {
  if (!haySupabase()) return { ok: true, conceptos: [], renglones: [] };
  const sb = await supabaseSesion();
  return P.leerCatalogo(sb);
}

export async function preciosDeClienteAccion(clienteId) {
  if (!haySupabase()) return { ok: false, motivo: "Sin base (modo demostración)." };
  return P.preciosDeCliente(await supabaseSesion(), clienteId);
}

export async function crearConceptoAccion(datos) {
  if (!haySupabase()) return demo;
  const { quien, sb, error } = await exigirPrecios();
  if (error) return { ok: false, motivo: error };
  const r = await P.crearConcepto(sb, { datos });
  if (r.ok) await registrar({ accion: "concepto_creado", tabla: "conceptos", registroId: r.id, detalle: { nombre: datos?.nombre } });
  return r;
}

export async function cambiarConceptoAccion(id, cambios) {
  if (!haySupabase()) return demo;
  const { sb, error } = await exigirPrecios();
  if (error) return { ok: false, motivo: error };
  const r = await P.cambiarConcepto(sb, { id, cambios });
  if (r.ok) await registrar({ accion: "concepto_cambiado", tabla: "conceptos", registroId: id, detalle: cambios });
  return r;
}

export async function ponerPrecioAccion({ conceptoId, clienteId = null, texto, antes = null }) {
  if (!haySupabase()) return demo;
  const { quien, sb, error } = await exigirPrecios();
  if (error) return { ok: false, motivo: error };
  const r = await P.ponerPrecio(sb, { actorId: quien.id, conceptoId, clienteId, texto });
  if (r.ok) await registrar({ accion: clienteId ? "precio_especial" : "precio_lista", tabla: "precios", registroId: conceptoId, detalle: { clienteId, antes, despues: r.precio } });
  return r;
}

export async function quitarEspecialAccion({ conceptoId, clienteId }) {
  if (!haySupabase()) return demo;
  const { quien, sb, error } = await exigirPrecios();
  if (error) return { ok: false, motivo: error };
  const r = await P.quitarEspecial(sb, { actorId: quien.id, conceptoId, clienteId });
  if (r.ok) await registrar({ accion: "precio_especial_quitado", tabla: "precios", registroId: conceptoId, detalle: { clienteId } });
  return r;
}

export async function cambiarFacturaAccion({ clienteId, requiereFactura }) {
  if (!haySupabase()) return demo;
  const { sb, error } = await exigirPrecios();
  if (error) return { ok: false, motivo: error };
  const r = await P.cambiarFactura(sb, { clienteId, requiereFactura });
  if (r.ok) await registrar({ accion: "factura_cambiada", tabla: "clientes", registroId: clienteId, detalle: { requiereFactura } });
  return r;
}

export async function cambiarPermisoAccion({ perfilId, precios, permiso = "precios", valor }) {
  // Desde la Entrega 1 hay más de un permiso suelto (precios, eliminar_clientes).
  const quiere = typeof valor === "boolean" ? valor : Boolean(precios);
  if (!haySupabase()) return demo;
  const quien = await usuarioActual();
  if (!quien || quien.rol !== "dueno") return { ok: false, motivo: "Solo el dueño asigna permisos." };
  const sb = await supabaseSesion();
  const { data: actual } = await sb.from("perfiles").select("permisos, rol").eq("id", perfilId).maybeSingle();
  if (!actual || actual.rol !== "admin") return { ok: false, motivo: "Solo a administradores." };
  let nuevos;
  try {
    nuevos = aplicarPermiso(actual.permisos, permiso, quiere);
  } catch (e) {
    return { ok: false, motivo: e.message };
  }
  const { data, error } = await sb.from("perfiles").update({ permisos: nuevos }).eq("id", perfilId).select("id");
  if (error || !data?.length) return { ok: false, motivo: error?.message || "No se guardó." };
  await registrar({ accion: "permiso_cambiado", tabla: "perfiles", registroId: perfilId, detalle: { permiso, valor: quiere } });
  return { ok: true };
}
