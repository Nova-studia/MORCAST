/**
 * POST /api/app/saldos/resolver — aplicar o rechazar el depósito de un
 * cliente desde la app de administración (6-oct-2026).
 *
 *   Authorization: Bearer <access_token de dueño o admin>
 *   Body: { pase, id, estado: "aplicada"|"rechazada", notas? }
 *   → 200 { ok: true }
 *   → 200 { ok: true, yaEstaba: true }             (ya tenía ese estado: no se repite nada)
 *   → 400 { ok: false, motivo }                    (datos malos o el RLS no dejó)
 *   → 403 { ok: false, segundoPaso: true, motivo } (falta el código por correo)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * Antes la app hacía el UPDATE directo desde el teléfono: el saldo se movía
 * sin renglón en la bitácora y sin el correo de "saldo resuelto". Ahora pasa
 * por la MISMA función que el panel web (lib/saldos-resolver.mjs): mismo
 * nombre de acción (aplicar_saldo / rechazar_saldo), mismo correo.
 *
 * El UPDATE va con el TOKEN del usuario (lib/supabase-usuario.js): el RLS
 * sigue siendo el guardia, como en la web. `verificado_por` sale del token.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { anotarBitacora } from "@/lib/app-auth.mjs";
import { supabaseDelUsuario } from "@/lib/supabase-usuario";
import { resolverDepositoServidor } from "@/lib/saldos-servidor";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, {
    freno: { nombre: "app-saldos-resolver", maximo: 60, minutos: 10 },
  });
  if (r.respuesta) return r.respuesta;

  const c = r.cuerpo;
  const res = await resolverDepositoServidor({
    sb: supabaseDelUsuario(peticion),
    actorId: r.usuario.id,
    id: c.id,
    estado: c.estado,
    notas: c.notas,
    anotar: (entrada) => anotarBitacora(r.sb, { usuario: r.usuario, ...entrada }),
  });
  return responder(res, res.ok ? 200 : 400);
}
