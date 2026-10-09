"use server";

import { exigirSeccion } from "@/lib/permisos-servidor";
import { headers } from "next/headers";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { origenPermitido } from "@/lib/origen.mjs";
import { correoAccesoCliente } from "@/lib/correo";
import { puedeEliminarCliente } from "@/lib/estado-cliente.mjs";
import * as C from "@/lib/clientes-servidor";

/**
 * PUERTAS DEL PANEL PARA CLIENTES (Entrega 1, 8-oct-2026).
 *
 * Aquí se decide QUIÉN; lib/clientes-servidor.js hace el trabajo con la llave
 * de servicio (varias tablas y Auth a la vez). `usuarioActual()` ya exige el
 * segundo paso al personal.
 */


async function exigirPersonal(seccion) {
  return exigirSeccion(seccion);
}

const contexto = (quien) => ({
  sb: supabaseServidor(),
  anotar: registrar,
  actor: { id: quien.id, correo: quien.correo },
});

const demo = { ok: true, demo: true };

export async function fichaClienteAccion(clienteId) {
  if (!haySupabase()) return { ok: false, motivo: "Sin base (modo demostración)." };
  const { quien, error } = await exigirPersonal("clientes");
  if (error) return { ok: false, motivo: error };
  const sb = supabaseServidor();
  const [cli, doms, sols, movs] = await Promise.all([
    sb.from("clientes").select("*").eq("id", clienteId).maybeSingle(),
    sb.from("domicilios")
      .select("id, alias, calle, colonia, cp, referencias, lat, lng, suscripciones ( id, estado, frecuencia, servicios_por_mes, por_llamada, rutas ( id, nombre ) )")
      .eq("cliente_id", clienteId).order("alias"),
    sb.from("solicitudes_recoleccion").select("id, folio, estado, fecha_pedida, fecha_confirmada").eq("cliente_id", clienteId)
      .order("fecha_pedida", { ascending: false }).limit(8),
    sb.from("movimientos_saldo").select("id, folio, tipo, concepto, monto, estado, fecha").eq("cliente_id", clienteId)
      .order("fecha", { ascending: false }).limit(8),
  ]);
  if (cli.error || !cli.data) return { ok: false, motivo: "No encontré ese cliente." };
  const usuarios = await C.usuariosDeClienteCon({ sb }, { clienteId });
  const conteos = await C.conteosClienteCon({ sb }, { clienteId });
  return {
    ok: true,
    cliente: cli.data,
    puntos: doms.data || [],
    solicitudes: sols.data || [],
    movimientos: movs.data || [],
    usuarios: usuarios.ok ? usuarios.usuarios : [],
    conteos,
    puedeEliminar: puedeEliminarCliente({ rol: quien.rol, permisos: quien.permisos }),
  };
}

export async function cambiarEstadoClienteAccion(datos) {
  if (!haySupabase()) return demo;
  const { quien, error } = await exigirPersonal("clientes");
  if (error) return { ok: false, motivo: error };
  return C.cambiarEstadoClienteCon(contexto(quien), datos);
}

export async function editarClienteAccion(datos) {
  if (!haySupabase()) return demo;
  const { quien, error } = await exigirPersonal("clientes");
  if (error) return { ok: false, motivo: error };
  return C.editarClienteCon(contexto(quien), datos);
}

export async function eliminarClienteAccion(datos) {
  if (!haySupabase()) return demo;
  const { quien, error } = await exigirPersonal("clientes");
  if (error) return { ok: false, motivo: error };
  // `quien.permisos` ya trae los del rol y los sueltos (lib/permisos.mjs).
  if (!puedeEliminarCliente({ rol: quien.rol, permisos: quien.permisos })) {
    return { ok: false, motivo: "Solo el dueño (o a quien él le dé el permiso) puede eliminar clientes." };
  }
  return C.eliminarClienteCon(contexto(quien), datos);
}

export async function accesoUsuarioClienteAccion(datos) {
  if (!haySupabase()) return demo;
  const { quien, error } = await exigirPersonal("clientes");
  if (error) return { ok: false, motivo: error };
  return C.quitarAccesoClienteCon(contexto(quien), datos);
}

export async function reenviarAccesoClienteAccion(datos) {
  if (!haySupabase()) return demo;
  const { quien, error } = await exigirPersonal("clientes");
  if (error) return { ok: false, motivo: error };
  return C.reenviarAccesoClienteCon(
    { ...contexto(quien), origen: origenPermitido(await headers()), enviarCorreo: correoAccesoCliente },
    datos
  );
}

export async function agregarPuntoAccion(datos) {
  if (!haySupabase()) return demo;
  const { quien, error } = await exigirPersonal("clientes");
  if (error) return { ok: false, motivo: error };
  return C.agregarPuntoCon(contexto(quien), datos);
}

export async function quitarPuntoAccion(datos) {
  if (!haySupabase()) return demo;
  const { quien, error } = await exigirPersonal("clientes");
  if (error) return { ok: false, motivo: error };
  return C.quitarPuntoCon(contexto(quien), datos);
}

export async function cambiarServicioAccion(datos) {
  if (!haySupabase()) return demo;
  const { quien, error } = await exigirPersonal("clientes");
  if (error) return { ok: false, motivo: error };
  return C.cambiarServicioCon(contexto(quien), datos);
}
