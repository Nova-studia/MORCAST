/**
 * POST /api/app/avisos/mandar — mandar un aviso a clientes desde la app de
 * administración (paridad con /admin/avisos, 6-oct-2026).
 *
 *   Authorization: Bearer <access_token de dueño o admin>
 *   Body: { pase, idEnvio, alcance, sectorId?, rutaId?, clienteId?,
 *           motivo, titulo, mensaje, vigenteHasta? }
 *   → 200 { ok: true, id, creado, resumen, enviados, fallidos, sinResend, notificaciones }
 *   → 200 { ok: true, yaEnviado: true, id, creado, enviados }   (reintento: no se repite)
 *   → 400 { ok: false, motivo }                    (formulario incompleto)
 *   → 403 { ok: false, segundoPaso: true, motivo } (falta el código por correo)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * Hace LO MISMO que el botón de la web (lib/avisos-envio.mjs): guarda el
 * aviso, un correo por empresa a menos de dos por segundo, notificación a
 * la app de los clientes y renglón en la bitácora (con `origen: "app"`).
 *
 * El aviso se guarda con el TOKEN del usuario (lib/supabase-usuario.js), no
 * con la llave de servicio: el RLS `avisos_personal` sigue siendo el guardia
 * y `enviado_por` = auth.uid(), igual que en la web.
 *
 * `idEnvio`: UUID que la app genera al confirmar. Con 43 clientes esto tarda
 * ~24 s; si la señal se cae a media espera y la app reintenta, el mismo id
 * contesta `yaEnviado` en vez de mandar todo otra vez.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { anotarBitacora } from "@/lib/app-auth.mjs";
import { supabaseDelUsuario } from "@/lib/supabase-usuario";
import { mandarAvisoServidor } from "@/lib/avisos-servidor";

// Un correo cada ~0.55 s: con la operación de hoy son unos 24 segundos, más
// que el tope por omisión de una función en Vercel (igual que avisos/page.js).
export const maxDuration = 60;

export async function POST(peticion) {
  // Un aviso masivo es algo de pocas veces al día; 10 por hora sobra y frena
  // a un teléfono que se quedara reintentando en bucle.
  const r = await entrarAppAdmin(peticion, { permiso: "avisos",
    freno: { nombre: "app-avisos-mandar", maximo: 10, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const c = r.cuerpo;
  if (typeof c.idEnvio !== "string" || !c.idEnvio) {
    return responder({ ok: false, motivo: "El envío llegó incompleto. Actualiza la app y vuelve a intentarlo." }, 400);
  }

  const res = await mandarAvisoServidor({
    sbUsuario: supabaseDelUsuario(peticion),
    sbServicio: r.sb,
    idEnvio: c.idEnvio,
    datos: {
      alcance: c.alcance,
      sectorId: c.sectorId,
      rutaId: c.rutaId,
      clienteId: c.clienteId,
      motivo: c.motivo,
      titulo: c.titulo,
      mensaje: c.mensaje,
      vigenteHasta: c.vigenteHasta,
    },
    anotar: (entrada) => anotarBitacora(r.sb, { usuario: r.usuario, ...entrada }),
  });
  return responder(res, res.ok ? 200 : 400);
}
