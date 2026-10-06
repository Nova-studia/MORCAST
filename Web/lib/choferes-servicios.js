import { mapaDeChoferes, idsDeChoferes } from "./chofer-servicio.mjs";

/**
 * Los choferes de los servicios de UN cliente, por folio (6-oct-2026).
 *
 * Se llama con la LLAVE DE SERVICIO (`supabaseServidor()`) porque el cliente
 * no puede leer perfiles ajenos (RLS `perfiles_ve_el_suyo`) y el nombre de
 * quien hizo su recolección vive ahí. Por eso el filtro por `cliente_id` NO
 * es opcional: es lo único que impide que un cliente vea servicios de otro.
 * El `clienteId` sale SIEMPRE de la sesión (perfil del que llama), nunca de
 * lo que manda el teléfono o el navegador.
 *
 * Solo entrega nombres, la misma información que antes salía del texto de la
 * ruta. Lo usan la acción del portal (`app/acciones-portal.js`) y la ruta de
 * las apps (`/api/app/mis-choferes`): el mismo código para las dos.
 *
 * @returns {Promise<{ok: true, choferes: Record<string,{nombre:string,etiqueta:string}>} | {ok: false, motivo: string}>}
 */
export async function choferesDelCliente(sb, clienteId) {
  if (!clienteId) return { ok: false, motivo: "Tu cuenta no tiene empresa asignada." };

  const { data: filas, error } = await sb
    .from("solicitudes_recoleccion")
    .select("folio, estado, chofer_id, rutas ( chofer, chofer_id ), recolecciones ( operador_id )")
    .eq("cliente_id", clienteId)
    .neq("estado", "rechazada")
    .order("fecha_pedida", { ascending: false })
    .limit(1000);
  if (error) {
    console.error("[choferes] No se pudieron leer los servicios:", error.message);
    return { ok: false, motivo: "No se pudieron leer los choferes." };
  }

  const ids = idsDeChoferes(filas);
  let nombrePorId = {};
  if (ids.length) {
    const { data: perfiles, error: errorPerfiles } = await sb.from("perfiles").select("id, nombre").in("id", ids);
    if (errorPerfiles) {
      console.error("[choferes] No se pudieron leer los perfiles:", errorPerfiles.message);
      return { ok: false, motivo: "No se pudieron leer los choferes." };
    }
    nombrePorId = Object.fromEntries((perfiles || []).map((p) => [p.id, p.nombre || ""]));
  }

  return { ok: true, choferes: mapaDeChoferes(filas, nombrePorId) };
}
