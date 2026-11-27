/**
 * POST /api/app/gafete/pase — el pase del segundo paso para quien acaba de
 * entrar con su gafete (dueño y administradores, 27-nov-2026).
 *   Authorization: Bearer <access_token de la sesión recién abierta>
 *   Body: { codigo, serie, dispositivoId, secreto }   (la misma prueba de /entrar)
 *   → 200 { ok:true, pase, vence }   → 401 / 403 { ok:false, motivo }
 *
 * Andrei decidió (27-nov) que gafete + teléfono vinculado cuentan como
 * segundo paso. El pase va atado al `session_id` del token, que solo existe
 * después del verifyOtp: por eso es una llamada aparte, ya con sesión, que
 * vuelve a presentar la prueba completa.
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { anotarBitacora, ROLES_PERSONAL } from "@/lib/app-auth.mjs";
import { firmarPase, secretoPanel, VIGENCIA_PASE_S } from "@/lib/mfa.mjs";
import { validarPeticion, decidirEntrada, respuestaEntrar, hashSecreto } from "@/lib/gafete-acceso.mjs";
import { leerParaEntrar } from "@/lib/gafete-acceso-servidor";

export async function POST(peticion) {
  const r = await entrarApp(peticion, {
    roles: ROLES_PERSONAL,
    freno: { nombre: "app-gafete-pase", maximo: 20, minutos: 15 },
  });
  if (r.respuesta) return r.respuesta;

  const generico = respuestaEntrar({ ok: false, motivo: "noEntra" });
  const p = validarPeticion(r.cuerpo);
  if (!p.ok || !r.sesion) return responder(generico.cuerpo, generico.status);

  try {
    const datos = await leerParaEntrar(r.sb, p.codigo, p.dispositivoId);
    const decision = decidirEntrada({ ...datos, serie: p.serie, hashRecibido: await hashSecreto(p.secreto) });
    if (!decision.ok || datos.par.perfil_id !== r.usuario.id) return responder(generico.cuerpo, generico.status);

    const secreto = secretoPanel();
    if (!secreto) return responder({ ok: false, motivo: "El segundo paso no está configurado en el servidor." }, 500);
    const vence = Math.floor(Date.now() / 1000) + VIGENCIA_PASE_S;
    const pase = await firmarPase({ uid: r.usuario.id, sesion: r.sesion, vence }, secreto);
    await anotarBitacora(r.sb, {
      usuario: r.usuario,
      accion: "entrar_panel",
      tabla: "perfiles",
      registroId: r.usuario.id,
      detalle: { metodo: "gafete" },
    });
    return responder({ ok: true, pase, vence });
  } catch (e) {
    console.error("[gafete/pase]", e?.message || e);
    return responder({ ok: false, motivo: "No se pudo completar. Inténtalo otra vez." }, 500);
  }
}
