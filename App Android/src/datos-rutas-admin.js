import { Linking } from "react-native";
import { supabase, haySupabase } from "./supabase";
import { accionAdmin } from "./accion";
import { RUTAS_SEED } from "./rutas-datos";
import { elegirChoferRuta } from "./web/rutas-chofer.mjs";
import { resultadoPuenteAdmin } from "./puente-admin.mjs";

/**
 * RUTAS Y CHOFERES PARA LA OFICINA, y el PUENTE AL PANEL WEB (apps al 100%,
 * fases C y D). Nunca lanzan.
 */

/** Las rutas con su chofer de la lista (`chofer_id`). `null` si no se pudo. */
export async function listarRutasAdmin() {
  if (!haySupabase()) {
    return RUTAS_SEED.map((r) => ({ id: r.id, clave: r.id, nombre: r.nombre, dias: r.dias || [], chofer: r.chofer || "", choferId: null, activa: r.activa !== false }));
  }
  try {
    const { data, error } = await supabase
      .from("rutas")
      .select("id, clave, nombre, dias, chofer, chofer_id, activa")
      .order("clave");
    if (error) return null;
    return (data || []).map((r) => ({
      id: r.id,
      clave: r.clave,
      nombre: r.nombre,
      dias: r.dias || [],
      chofer: r.chofer || "",
      choferId: r.chofer_id || null,
      activa: r.activa !== false,
    }));
  } catch {
    return null;
  }
}

/**
 * El chofer de una ruta: se guardan JUNTOS `chofer_id` (del que dependen
 * las paradas que ve cada chofer y sus avisos, db/013) y `chofer` (el nombre
 * que se enseña), con `elegirChoferRuta` de la web. Directo con la sesión:
 * el RLS de `rutas` decide quién puede.
 */
export async function asignarChoferRuta(rutaId, choferId, choferes) {
  const cambios = elegirChoferRuta(choferId, choferes);
  if (!haySupabase()) return { ok: true, demo: true, cambios };
  try {
    const { data, error } = await supabase.from("rutas").update(cambios).eq("id", rutaId).select("id");
    if (error) {
      return /network|fetch/i.test(error.message || "")
        ? { ok: false, sinRed: true, motivo: "Sin conexión. No se guardó el chofer." }
        : { ok: false, motivo: `No se guardó: ${error.message}` };
    }
    if (!data?.length) return { ok: false, motivo: "No se guardó: tu rol no puede cambiar las rutas." };
    return { ok: true, cambios };
  } catch {
    return { ok: false, sinRed: true, motivo: "Sin conexión. No se guardó el chofer." };
  }
}

/**
 * "Abrir en la web": pide el enlace de un solo uso (`puente-admin`) y lo
 * abre en el navegador del teléfono, ya con la sesión iniciada en el panel.
 * Devuelve `{ ok }` o `{ ok:false, motivo, sinRed? }` para enseñarlo.
 */
export async function abrirPanelWeb(destino) {
  if (!haySupabase()) return { ok: false, motivo: "En la demostración no hay panel web que abrir." };
  const r = resultadoPuenteAdmin(await accionAdmin("puente-admin", { destino }));
  if (!r.abrir) return { ok: false, motivo: r.motivo, sinRed: Boolean(r.sinRed) };
  try {
    await Linking.openURL(r.abrir);
    return { ok: true };
  } catch {
    return { ok: false, motivo: "No se pudo abrir el navegador del teléfono." };
  }
}

/** Los choferes activos para la hoja de la ruta. `null` si no se pudo leer (no `[]`). */
export async function listarChoferesRuta() {
  if (!haySupabase()) return [];
  try {
    const { data, error } = await supabase.from("perfiles").select("id, nombre").eq("rol", "operador").eq("activo", true).order("nombre");
    return error ? null : data || [];
  } catch {
    return null;
  }
}
