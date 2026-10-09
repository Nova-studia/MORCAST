"use server";

import { exigirSeccion } from "@/lib/permisos-servidor";
import { headers } from "next/headers";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { origenPermitido } from "@/lib/origen.mjs";
import { correoAccesoCliente } from "@/lib/correo";
import { puedeEliminarCliente } from "@/lib/estado-cliente.mjs";
import * as C from "@/lib/clientes-servidor";
import { fichaClienteCon } from "@/lib/apps-servidor";
import { enviarPush, tokensDeUsuarios } from "@/lib/push.mjs";
import { mensajePushParada } from "@/lib/oficina-recolecciones.mjs";

/**
 * "Te quitaron una parada" al teléfono de cada chofer que traía en su ruta
 * una recolección del cliente dado de baja (Entrega 3). Lo mismo que manda
 * Recolecciones al rechazar una parada ya confirmada.
 */
async function avisarChoferesBaja(sb, lista) {
  for (const { uid, parada } of lista) {
    const tokens = await tokensDeUsuarios(sb, [uid]);
    if (tokens.length) await enviarPush(tokens, mensajePushParada("quitada", parada), { sb });
  }
}

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
  // El trabajo vive en lib/apps-servidor.js: el mismo que usa la app.
  return fichaClienteCon(supabaseServidor(), { clienteId, rol: quien.rol, permisos: quien.permisos });
}

export async function cambiarEstadoClienteAccion(datos) {
  if (!haySupabase()) return demo;
  const { quien, error } = await exigirPersonal("clientes");
  if (error) return { ok: false, motivo: error };
  const ctx = contexto(quien);
  return C.cambiarEstadoClienteCon({ ...ctx, avisarChoferes: (lista) => avisarChoferesBaja(ctx.sb, lista) }, datos);
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
