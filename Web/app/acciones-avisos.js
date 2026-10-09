"use server";

import { exigirSeccion } from "@/lib/permisos-servidor";
import { supabaseSesion } from "@/lib/supabase-sesion";
import { haySupabase, supabaseServidor } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { mandarAvisoServidor, contarDestinatariosServidor } from "@/lib/avisos-servidor";

/**
 * AVISOS A CLIENTES (/admin/avisos): mandar un aviso por correo, al portal
 * y como notificación al teléfono de quien tenga la app.
 *
 * Por qué va en el servidor
 * -------------------------
 * 1. Para saber A QUIÉN le llega hay que leer los correos de todas las
 *    empresas del alcance, y eso se hace con la llave de servicio, que salta
 *    el RLS. Por eso lo primero es leer de la SESIÓN quién llama y pedir que
 *    sea dueño o administrador; la llave no se toca antes.
 * 2. Los correos salen de aquí (Resend) y la bitácora se escribe aquí: desde
 *    el navegador, quien firma el aviso sería quien dijera el navegador.
 *
 * El aviso en sí se INSERTA con la sesión, no con la llave: el RLS
 * (`avisos_personal`, db/023) sigue siendo el guardia, y `enviado_por` sale
 * solo de `auth.uid()`.
 *
 * Las reglas (qué se acepta, a quién le toca) viven en lib/avisos.mjs y el
 * envío en lib/avisos-envio.mjs, los dos con pruebas; aquí solo se comprueba
 * quién llama y se llama.
 */


/** Igual que en acciones-auditadas.js: `sin-verificar` (sin el segundo paso) no pasa. */
async function exigirPersonal(seccion) {
  return exigirSeccion(seccion);
}

/**
 * Vista previa: a cuántos clientes y correos les llegaría, ANTES de mandar.
 * No escribe nada.
 */
export async function contarDestinatarios(datos) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { error: sinPermiso } = await exigirPersonal("avisos");
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  return contarDestinatariosServidor(supabaseServidor(), datos);
}

/**
 * Manda un aviso. Lo que pasa adentro (destinatarios, correos a menos de
 * dos por segundo, push, bitácora) vive en lib/avisos-envio.mjs, la MISMA
 * copia que usa la app (/api/app/avisos/mandar, 6-oct-2026).
 *
 * El aviso se inserta con la SESIÓN: el RLS (`avisos_personal`) sigue
 * siendo el guardia y `enviado_por` sale de `auth.uid()`.
 */
export async function enviarAviso(datos) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { error: sinPermiso } = await exigirPersonal("avisos");
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  return mandarAvisoServidor({
    sbUsuario: await supabaseSesion(),
    sbServicio: supabaseServidor(),
    datos,
    anotar: registrar,
  });
}
