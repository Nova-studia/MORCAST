/**
 * POST /api/app/gafete/vincular — liga el gafete a ESTE teléfono (27-nov-2026).
 *   Authorization: Bearer <access_token>   (entró con correo; el admin, con su segundo paso)
 *   Body: { codigo, serie, dispositivoId, secreto, aparato, pase? }   (pase: dueño y admins)
 *   → 200 { ok:true, nombre }   → 400 { ok:false, motivo }
 * El gafete tiene que estar ligado a la cuenta de la sesión
 * (`empleados.perfil_id`, lo pone el panel en la ficha del empleado).
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { anotarBitacora } from "@/lib/app-auth.mjs";
import {
  ROLES_GAFETE, TEXTOS_GAFETE, validarPeticion, decidirVinculo, hashSecreto, vinculoExigePase,
} from "@/lib/gafete-acceso.mjs";
import { mfaPanelActivo, secretoPanel, verificarPase } from "@/lib/mfa.mjs";
import { leerParaEntrar, vincular } from "@/lib/gafete-acceso-servidor";

export async function POST(peticion) {
  const r = await entrarApp(peticion, {
    roles: ROLES_GAFETE,
    freno: { nombre: "app-gafete-vincular", maximo: 10, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  // Dueño y administradores: con su segundo paso hecho (el `pase` viaja en el
  // cuerpo, igual que en entrarAppAdmin). Ver `vinculoExigePase`.
  if (vinculoExigePase(r.perfil?.rol) && mfaPanelActivo() &&
      !(await verificarPase(r.cuerpo.pase, { uid: r.usuario.id, sesion: r.sesion }, secretoPanel()))) {
    return responder({ ok: false, segundoPaso: true, motivo: "Primero confirma el código que te llega por correo." }, 403);
  }

  const p = validarPeticion(r.cuerpo);
  if (!p.ok) return responder({ ok: false, motivo: TEXTOS_GAFETE.noEntra }, 400);

  try {
    const { gafete, empleado } = await leerParaEntrar(r.sb, p.codigo, p.dispositivoId);
    const d = decidirVinculo({ gafete, empleado, uid: r.usuario.id, serie: p.serie });
    if (!d.ok) return responder({ ok: false, motivo: TEXTOS_GAFETE[d.motivo] }, 400);

    const par = await vincular(r.sb, {
      gafeteId: gafete.id,
      perfilId: r.usuario.id,
      dispositivoId: p.dispositivoId,
      secretoHash: await hashSecreto(p.secreto),
      aparato: r.cuerpo.aparato,
      exigeSerie: d.exigeSerie,
      guardarSerie: d.guardarSerie,
      serie: p.serie,
      // Con segundo paso: el dueño y los admins lo acaban de pasar (arriba) o
      // el servidor no lo pide. Un chofer, no: si luego lo ascienden, su
      // gafete no le salta el código (`puedeDarPase`).
      conPase: vinculoExigePase(r.perfil?.rol),
    });
    await anotarBitacora(r.sb, {
      usuario: r.usuario,
      accion: "gafete_vincular",
      tabla: "gafetes",
      registroId: gafete.id,
      detalle: { telefono: par.id, aparato: String(r.cuerpo.aparato || "").slice(0, 60), sinSerie: !d.exigeSerie },
    });
    return responder({ ok: true, nombre: empleado.nombre });
  } catch (e) {
    console.error("[gafete/vincular]", e?.message || e);
    return responder({ ok: false, motivo: "No se pudo vincular. Inténtalo otra vez." }, 500);
  }
}
