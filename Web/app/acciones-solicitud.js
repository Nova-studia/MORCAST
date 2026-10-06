"use server";

import { usuarioActual } from "@/lib/supabase-sesion";
import { haySupabase, supabaseServidor } from "@/lib/supabase";
import { pasarFreno } from "@/lib/freno";
import { avisarOficinaDeSolicitud } from "@/lib/avisar-solicitud";
import { esFolioRecoleccion } from "@/lib/solicitud-aviso.mjs";

/**
 * El portal pidió una recolección: que se entere la oficina (6-oct-2026).
 *
 * La solicitud ya la guardó el navegador con la sesión del cliente, bajo el
 * RLS (lib/datos-solicitudes.js → pedirRecoleccion). Esto solo AVISA: el
 * correo (la llave de Resend no puede vivir en el navegador) y las
 * notificaciones a la oficina (el cliente no puede leer sus tokens). Las
 * apps hacen lo mismo con /api/app/solicitud-avisada; las dos llaman a
 * lib/avisar-solicitud.js.
 *
 * La empresa sale del PERFIL de la sesión, nunca de lo que mande el
 * navegador: solo se avisa de solicitudes propias, recientes y sin atender.
 */
export async function avisarSolicitudNueva(folio) {
  if (!haySupabase()) return { ok: true, demo: true };
  if (!esFolioRecoleccion(folio)) return { ok: false, motivo: "Falta la solicitud." };

  const quien = await usuarioActual();
  if (!quien || quien.rol !== "cliente" || !quien.cliente_id) {
    return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
  }

  // Cada llamada puede mandar un correo y varias notificaciones.
  const pasa = await pasarFreno(`solicitud-avisada:${quien.id}`, { maximo: 30, minutos: 60, porIp: false });
  if (!pasa) return { ok: false, motivo: "Demasiados avisos seguidos." };

  const r = await avisarOficinaDeSolicitud({
    sb: supabaseServidor(),
    actor: { id: quien.id, correo: quien.correo },
    clienteId: quien.cliente_id,
    folio: folio.trim(),
  });
  return r.ok ? { ok: true } : { ok: false, motivo: r.motivo };
}
