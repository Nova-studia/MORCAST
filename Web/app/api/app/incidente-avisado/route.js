/**
 * POST /api/app/incidente-avisado — la app del chofer ya guardó un incidente
 * y pide que se avise a la oficina.
 *
 *   Authorization: Bearer <access_token de Supabase de un chofer (operador)>
 *   Body: { incidente_id }
 *   → 200 { ok: true, correo: bool, notificaciones: n }
 *   → 200 { ok: true, yaAvisado: true }      (reintento: no se repite)
 *   → 400 { ok: false, motivo }              (id malo o reporte viejo)
 *   → 404 { ok: false, motivo }              (no existe o no es suyo)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * Por qué en dos pasos (la app inserta y luego llama aquí) y no todo aquí:
 * el incidente se guarda directo con la sesión del chofer, bajo el RLS
 * (`incidentes_reporta_operador`, db/023 y 026), que es el guardia de qué
 * puede reportar. Esta ruta solo AVISA: el correo sale de aquí (la llave de
 * Resend no puede vivir en el teléfono) y las notificaciones también (la app
 * del chofer no puede leer los tokens de la oficina).
 *
 * Solo avisa de incidentes del propio chofer y recientes
 * (lib/incidente-aviso.mjs); uno solo por incidente (`avisado_en`).
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { esUuid, anotarBitacora } from "@/lib/app-auth.mjs";
import { decidirAvisoIncidente } from "@/lib/incidente-aviso.mjs";
import { cargarIncidente, avisarOficina } from "@/lib/avisar-incidente";

export async function POST(peticion) {
  // Cada llamada puede mandar un correo y varias notificaciones: 20 por hora
  // es mucho más de lo que un chofer reporta en un día malo.
  const r = await entrarApp(peticion, {
    roles: ["operador"],
    freno: { nombre: "app-incidente-avisado", maximo: 20, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const id = typeof r.cuerpo.incidente_id === "string" ? r.cuerpo.incidente_id.trim().toLowerCase() : "";
  if (!esUuid(id)) return responder({ ok: false, motivo: "Falta el reporte del que hay que avisar." }, 400);

  const incidente = await cargarIncidente(r.sb, id);
  const decision = decidirAvisoIncidente(incidente, { uid: r.usuario.id });
  if (!decision.ok) return responder({ ok: false, motivo: decision.motivo }, decision.status);
  if (decision.yaAvisado) return responder({ ok: true, yaAvisado: true });

  const res = await avisarOficina({
    sb: r.sb,
    incidente,
    chofer: r.perfil.nombre || r.usuario.email,
  });
  if (res.yaAvisado) return responder({ ok: true, yaAvisado: true });

  await anotarBitacora(r.sb, {
    usuario: r.usuario,
    accion: "reportar_incidente",
    tabla: "incidentes",
    registroId: id,
    detalle: { tipo: incidente.tipo, correo: res.correo, notificaciones: res.notificaciones },
  });

  return responder({ ok: true, correo: res.correo, notificaciones: res.notificaciones });
}
