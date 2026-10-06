/**
 * POST /api/app/puntos/ruta — la RUTA de un punto de recolección (ruta,
 * recolecciones al mes y "por llamada"), como la sección Ruta del detalle de
 * un punto en la web (RutaDelPunto.js).
 *
 *   Body: { domicilioId, rutaClave: "RT-…"|null, serviciosPorMes, porLlamada, pase }
 *   → 200 { ok: true, suscripcion: { rutaClave, serviciosPorMes, porLlamada, rutaNombre } }
 *   → 200 { ok: false, motivo }
 *   → 400 / 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 *
 * Es `asignarRutaAPuntoCon` (lib/puntos-servidor.js), el mismo de la web,
 * con el token del usuario: RLS `suscripciones_personal` de guardia, filas
 * contadas y la bitácora con el antes y el después.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { anotarBitacora } from "@/lib/app-auth.mjs";
import { supabaseComoUsuario } from "@/lib/app-sesion-usuario";
import { asignarRutaAPuntoCon } from "@/lib/puntos-servidor";
import { esId } from "@/lib/admin-app.mjs";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, {
    freno: { nombre: "app-puntos-ruta", maximo: 120, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const { domicilioId, rutaClave, serviciosPorMes, porLlamada } = r.cuerpo;
  if (!esId(domicilioId)) return responder({ ok: false, motivo: "No se encontró ese punto de recolección." }, 400);
  if (rutaClave != null && typeof rutaClave !== "string") {
    return responder({ ok: false, motivo: "No se encontró esa ruta." }, 400);
  }

  const res = await asignarRutaAPuntoCon(
    { sb: supabaseComoUsuario(peticion), anotar: (e) => anotarBitacora(r.sb, { usuario: r.usuario, ...e }) },
    { domicilioId, rutaClave: rutaClave || null, serviciosPorMes, porLlamada: porLlamada === true }
  );
  return responder(res);
}
