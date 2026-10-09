/**
 * POST /api/app/avisos/contar — vista previa de un aviso desde la app de
 * administración: ¿a cuántos clientes y correos les llegaría?
 *
 *   Authorization: Bearer <access_token de dueño o admin>
 *   Body: { pase, alcance, sectorId?, rutaId?, clienteId? }
 *   → 200 { ok: true, resumen: { clientes, correos, sinCorreo } }
 *   → 400 { ok: false, motivo }                    (alcance incompleto)
 *   → 403 { ok: false, segundoPaso: true, motivo } (falta el código por correo)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * Es la misma cuenta que hace el panel web (lib/avisos-envio.mjs). Va por el
 * servidor porque lee los correos de todas las empresas con la llave de
 * servicio; por eso antes se exige el rol y el segundo paso.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { contarDestinatariosServidor } from "@/lib/avisos-servidor";

export async function POST(peticion) {
  // Se pide al cambiar de destino en el formulario: holgado.
  const r = await entrarAppAdmin(peticion, { permiso: "avisos",
    freno: { nombre: "app-avisos-contar", maximo: 120, minutos: 10 },
  });
  if (r.respuesta) return r.respuesta;

  const c = r.cuerpo;
  const res = await contarDestinatariosServidor(r.sb, {
    alcance: c.alcance,
    sectorId: c.sectorId,
    rutaId: c.rutaId,
    clienteId: c.clienteId,
  });
  return responder(res, res.ok ? 200 : 400);
}
