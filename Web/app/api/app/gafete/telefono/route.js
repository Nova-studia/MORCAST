/**
 * POST /api/app/gafete/telefono — lo que la persona hace con SU teléfono (27-nov-2026).
 *   Authorization: Bearer <access_token>
 *   Body: { dispositivoId, accion: "reiniciar" | "desvincular" }
 *   "reiniciar": entró con correo en este teléfono → vuelve a aceptar el gafete
 *                (se llama tras CUALQUIER login con correo/Google/Apple).
 *   "desvincular": quita los vínculos de ESTA cuenta en este teléfono.
 *   → 200 { ok:true }   → 400 { ok:false, motivo }
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { anotarBitacora, esUuid } from "@/lib/app-auth.mjs";
import { ROLES_GAFETE } from "@/lib/gafete-acceso.mjs";
import { reiniciarFallos, desvincular } from "@/lib/gafete-acceso-servidor";

export async function POST(peticion) {
  const r = await entrarApp(peticion, {
    roles: ROLES_GAFETE,
    freno: { nombre: "app-gafete-telefono", maximo: 30, minutos: 15 },
  });
  if (r.respuesta) return r.respuesta;

  const { dispositivoId, accion } = r.cuerpo;
  if (!esUuid(dispositivoId) || !["reiniciar", "desvincular"].includes(accion)) {
    return responder({ ok: false, motivo: "Petición incompleta." }, 400);
  }
  try {
    if (accion === "reiniciar") {
      await reiniciarFallos(r.sb, dispositivoId);
    } else {
      const n = await desvincular(r.sb, { dispositivoId, perfilId: r.usuario.id, por: r.usuario.id });
      if (n) {
        await anotarBitacora(r.sb, {
          usuario: r.usuario, accion: "gafete_desvincular", tabla: "perfiles", registroId: r.usuario.id,
          detalle: { quien: "la persona", vinculos: n },
        });
      }
    }
    return responder({ ok: true });
  } catch (e) {
    console.error("[gafete/telefono]", e?.message || e);
    return responder({ ok: false, motivo: "No se pudo completar. Inténtalo otra vez." }, 500);
  }
}
