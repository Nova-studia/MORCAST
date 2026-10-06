/**
 * POST /api/app/solicitud-avisada — el cliente, desde la app, ya guardó su
 * solicitud de recolección y pide que se avise a la OFICINA (6-oct-2026).
 *
 *   Authorization: Bearer <access_token de Supabase de un cliente>
 *   Body: { folio: "REC-AAAA-NNNN" }
 *   → 200 { ok: true, correo, notificaciones }
 *   → 200 { ok: true, yaAvisado: true }      (reintento: no se repite)
 *   → 200 { ok: true, nada: true }           (la oficina ya la atendió)
 *   → 400 { ok: false, motivo }              (folio malo o solicitud vieja)
 *   → 404 { ok: false, motivo }              (no existe o no es de su empresa)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * Por qué en dos pasos (la app inserta y luego llama aquí), igual que
 * /api/app/incidente-avisado: la solicitud se guarda con la sesión del
 * cliente bajo el RLS, que es el guardia de qué puede pedir. Esta ruta solo
 * AVISA: el correo (la llave de Resend no vive en el teléfono) y las
 * notificaciones de la oficina (el cliente no puede leer sus tokens). El
 * portal web hace lo mismo con app/acciones-solicitud.js; las dos llaman a
 * lib/avisar-solicitud.js.
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { avisarOficinaDeSolicitud } from "@/lib/avisar-solicitud";
import { esFolioRecoleccion } from "@/lib/solicitud-aviso.mjs";

export async function POST(peticion) {
  // Cada llamada puede mandar un correo y varias notificaciones.
  const r = await entrarApp(peticion, {
    roles: ["cliente"],
    freno: { nombre: "app-solicitud-avisada", maximo: 30, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const folio = typeof r.cuerpo.folio === "string" ? r.cuerpo.folio.trim() : "";
  if (!esFolioRecoleccion(folio)) return responder({ ok: false, motivo: "Falta la solicitud." }, 400);
  if (!r.perfil.cliente_id) return responder({ ok: false, motivo: "Tu cuenta no tiene empresa asignada." }, 403);

  const res = await avisarOficinaDeSolicitud({
    sb: r.sb,
    actor: { id: r.usuario.id, correo: r.usuario.email, origen: "app" },
    clienteId: r.perfil.cliente_id,
    folio,
  });
  if (!res.ok) return responder({ ok: false, motivo: res.motivo }, res.status || 400);
  return responder({
    ok: true,
    ...(res.yaAvisado ? { yaAvisado: true } : {}),
    ...(res.nada ? { nada: true } : {}),
    correo: Boolean(res.correo),
    notificaciones: res.notificaciones || 0,
  });
}
