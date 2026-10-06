/**
 * POST /api/app/altas/archivos — enlaces firmados (5 minutos) al PDF firmado
 * de un alta y a su constancia fiscal, como "Descargar PDF" de /admin/altas.
 *
 *   Body: { solicitudId, pase }
 *   → 200 { ok: true, pdf: url|null, constancia: url|null }
 *   → 200 { ok: false, motivo }
 *   → 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 *
 * `enlacesArchivosAltaCon` (lib/cuentas-servidor.js) es el de la web: las
 * rutas de los archivos salen de la base, nunca de lo que mande el teléfono.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { enlacesArchivosAltaCon } from "@/lib/cuentas-servidor";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, {
    freno: { nombre: "app-altas-archivos", maximo: 60, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const solicitudId = typeof r.cuerpo.solicitudId === "string" ? r.cuerpo.solicitudId.trim().toLowerCase() : "";
  return responder(await enlacesArchivosAltaCon(r.sb, solicitudId));
}
