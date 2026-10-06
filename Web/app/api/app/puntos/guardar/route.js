/**
 * POST /api/app/puntos/guardar — la ubicación y las referencias de un punto
 * de recolección, desde la pantalla Puntos de la app (6-oct-2026).
 *
 *   Body: { puntoId, pin?: [lat, lng], referencias?: string, pase }
 *   → 200 { ok: true, punto: { id, lat, lng, referencias, sector_id,
 *           ubicacion_origen, ubicacion_fecha }, sector: {…}|null }
 *   → 200 { ok: false, motivo }          (fuera de Matamoros, sin permiso…)
 *   → 400 / 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 *
 * Tres botones de la app llegan aquí: "Confirmar ubicación" (el MISMO pin
 * que puso el cliente), "Usar mi ubicación actual aquí" (el GPS del
 * teléfono) y guardar las referencias. Con pin, el origen queda 'panel' y el
 * sector se recalcula, como "Guardar" de la pestaña Puntos de la web
 * (`guardarPuntoCon`, lib/puntos-servidor.js). Va con el token del usuario:
 * RLS de guardia y la bitácora de la base a su nombre.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { supabaseComoUsuario } from "@/lib/app-sesion-usuario";
import { guardarPuntoCon } from "@/lib/puntos-servidor";
import { esId } from "@/lib/admin-app.mjs";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, {
    freno: { nombre: "app-puntos-guardar", maximo: 120, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const { puntoId, pin, referencias } = r.cuerpo;
  if (!esId(puntoId)) return responder({ ok: false, motivo: "No se encontró ese punto de recolección." }, 400);

  return responder(await guardarPuntoCon(supabaseComoUsuario(peticion), { puntoId, pin, referencias }));
}
