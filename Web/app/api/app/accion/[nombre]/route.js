/**
 * POST /api/app/accion/<nombre> — las acciones nuevas de las apps por UNA
 * puerta (9-oct-2026, "apps al 100%").
 *
 *   Body: lo que pida cada acción (+ `pase` en las de administración)
 *   → 200 { ok, ... } | 401 / 403 (sin sesión, sin segundo paso o sin la
 *     sección de su rol) / 404 (acción desconocida) / 429 (freno)
 *
 * Quién puede llamar cada una está en lib/app-acciones-mapa.mjs (con
 * pruebas); el trabajo, en lib/app-acciones.js (el mismo de la web).
 */
import { entrarApp, entrarAppAdmin, responder } from "@/lib/app-ruta";
import { anotarBitacora } from "@/lib/app-auth.mjs";
import { origenPermitido } from "@/lib/origen.mjs";
import { ACCIONES_APP, ROLES_ZONA } from "@/lib/app-acciones-mapa.mjs";
import { MANEJADORES } from "@/lib/app-acciones";

export async function POST(peticion, ctx) {
  const { nombre } = await ctx.params;
  const def = Object.hasOwn(ACCIONES_APP, nombre) ? ACCIONES_APP[nombre] : null;
  const fn = def && Object.hasOwn(MANEJADORES, nombre) ? MANEJADORES[nombre] : null;
  if (!def || !fn) return responder({ ok: false, motivo: "Esa acción no existe. Actualiza la app." }, 404);

  const freno = { nombre: `app-accion-${nombre}`, ...def.freno };
  const r = def.zona === "admin"
    ? await entrarAppAdmin(peticion, { permiso: def.permiso || null, freno })
    : await entrarApp(peticion, { roles: ROLES_ZONA[def.zona], freno });
  if (r.respuesta) return r.respuesta;

  try {
    const res = await fn({
      ...r,
      peticion,
      origen: origenPermitido(peticion.headers),
      anotar: (e) => anotarBitacora(r.sb, { usuario: r.usuario, ...e }),
    });
    return responder(res || { ok: false, motivo: "Sin respuesta." });
  } catch (e) {
    console.error(`[app-accion] ${nombre}:`, e?.message || e);
    return responder({ ok: false, motivo: "Algo falló en el servidor. Inténtalo otra vez." }, 500);
  }
}
