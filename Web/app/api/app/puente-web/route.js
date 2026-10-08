/**
 * POST /api/app/puente-web — enlace de un solo uso para abrir morcast.mx con
 * la misma sesión de la app (8-oct-2026). Ver lib/puente-web.mjs.
 *   Authorization: Bearer <access_token>   Body: { a?: "registro" | "portal" }
 *   → 200 { ok:true, url }   → 403 personal   → 500 no se pudo
 * El correo sale del TOKEN, nunca del cuerpo. generateLink NO manda correo.
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { destinoPuente, urlPuente, puedeUsarPuente } from "@/lib/puente-web.mjs";
import { EMPRESA } from "@/lib/datos";

const SITIO = EMPRESA.sitio;

export async function POST(peticion) {
  const r = await entrarApp(peticion, {
    roles: ["pendiente", "cliente"],
    freno: { nombre: "app-puente-web", maximo: 10, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;
  if (!puedeUsarPuente(r.perfil?.rol)) {
    return responder({ ok: false, motivo: "Esta cuenta entra al panel, no al portal." }, 403);
  }
  const correo = r.usuario?.email;
  if (!correo) return responder({ ok: false, motivo: "Tu cuenta no tiene correo." }, 400);

  const { data, error } = await r.sb.auth.admin.generateLink({ type: "magiclink", email: correo });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) {
    console.error("[puente-web] no se pudo generar el enlace:", error?.message);
    return responder({ ok: false, motivo: "No se pudo abrir la página. Inténtalo otra vez." }, 500);
  }
  return responder({ ok: true, url: urlPuente({ sitio: SITIO, hashedToken: hashed, destino: destinoPuente(r.cuerpo?.a) }) });
}
