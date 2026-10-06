/**
 * POST /api/app/mis-choferes — el CLIENTE, desde la app, pide quién es el
 * chofer de cada uno de sus servicios (6-oct-2026).
 *
 *   Authorization: Bearer <access_token de Supabase de un cliente>
 *   Body: {} (nada: la empresa sale del perfil de la sesión)
 *   → 200 { ok: true, choferes: { "<folio>": { nombre, etiqueta } } }
 *        etiqueta: "Chofer" (ya se atendió) | "Chofer asignado"
 *   → 400 { ok: false, motivo }        (cuenta sin empresa)
 *   → 500 { ok: false, motivo }        (no se pudo leer)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * Por qué en el servidor: el historial decía el chofer del TEXTO de la ruta
 * y no el que hizo la recolección (Luis lo vio en el iPhone). El nombre real
 * está en `perfiles`, que el cliente no puede leer; aquí se lee con la llave
 * de servicio, SOLO para la empresa del que llama (lib/choferes-servicios.js,
 * el mismo código que usa el portal web).
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { choferesDelCliente } from "@/lib/choferes-servicios";

export async function POST(peticion) {
  // Se pide al abrir Inicio, Historial o Documentos y al jalar para
  // refrescar: 120 por hora sobra para alguien que revisa su historial.
  const r = await entrarApp(peticion, {
    roles: ["cliente"],
    freno: { nombre: "app-mis-choferes", maximo: 120, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const res = await choferesDelCliente(r.sb, r.perfil?.cliente_id || null);
  if (!res.ok) return responder({ ok: false, motivo: res.motivo }, r.perfil?.cliente_id ? 500 : 400);
  return responder({ ok: true, choferes: res.choferes });
}
