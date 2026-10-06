/**
 * POST /api/app/usuarios/activo — desactivar o reactivar a alguien del equipo.
 *
 *   Body: { id (uuid del perfil), activo: true|false, pase }
 *   → 200 { ok: true, activo } | { ok: false, motivo }
 *   → 400 / 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 *
 * `cambiarActivoUsuarioCon` (lib/equipo-servidor.js) es el de la web: nunca
 * al dueño ni a uno mismo, y a un administrador sólo lo toca el dueño
 * (`puedeCambiarActivo`, lib/equipo.mjs, con el rol que dice la base). Los
 * dos candados a la vez: `perfiles.activo` y el bloqueo en Auth.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { anotarBitacora } from "@/lib/app-auth.mjs";
import { cambiarActivoUsuarioCon } from "@/lib/equipo-servidor";
import { esId } from "@/lib/admin-app.mjs";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, {
    freno: { nombre: "app-usuarios-activo", maximo: 30, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const { id, activo } = r.cuerpo;
  if (!esId(id)) return responder({ ok: false, motivo: "No se encontró a esa persona." }, 400);
  if (typeof activo !== "boolean") {
    return responder({ ok: false, motivo: "Falta decir si se activa o se desactiva." }, 400);
  }

  const res = await cambiarActivoUsuarioCon(
    {
      sb: r.sb,
      quien: { id: r.usuario.id, rol: r.perfil.rol, nombre: r.perfil.nombre },
      anotar: (e) => anotarBitacora(r.sb, { usuario: r.usuario, ...e }),
    },
    { id, activo }
  );
  return responder(res);
}
