"use client";

/**
 * Acceso a RUTAS contra la base de datos.
 *
 * Aquí no hay ni una regla de seguridad: quién puede ver o cambiar qué lo
 * decide el RLS dentro de Postgres (db/002-rls.sql). Si estas funciones se
 * llamaran desde una cuenta de cliente, la base devolvería lo que le toca y
 * rechazaría las escrituras, sin que este archivo tenga que saberlo.
 *
 * Las filas se traducen al mismo formato que ya usaban las pantallas con los
 * datos de ejemplo, para no tener que reescribirlas.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { RUTAS_SEED } from "@/lib/rutas-datos";

/** Fila de la base → el objeto que esperan las pantallas. */
function aFormatoPantalla(fila) {
  return {
    id: fila.clave,
    uuid: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    dias: fila.dias || [],
    unidad: fila.unidad || "",
    chofer: fila.chofer || "",
    cupo: fila.cupo ?? 10,
    activa: fila.activa,
    zona: Array.isArray(fila.zona) ? fila.zona : [],
  };
}

/**
 * Todas las rutas. Si Supabase no está configurado devuelve las de ejemplo,
 * para que el sitio siga navegable en modo prototipo.
 */
export async function listarRutas() {
  if (!haySupabaseNavegador()) return RUTAS_SEED;

  const { data, error } = await supabaseNavegador()
    .from("rutas")
    .select("id, clave, nombre, tipo, dias, unidad, chofer, cupo, activa, zona")
    .order("clave");

  if (error) {
    console.error("[rutas] No se pudieron leer:", error.message);
    return [];
  }
  return (data || []).map(aFormatoPantalla);
}

/** Solo las activas y con zona dibujada. Es lo que sirve para cobertura. */
export async function listarRutasConZona() {
  const rutas = await listarRutas();
  return rutas.filter((r) => r.activa && r.zona.length >= 3);
}

/**
 * Guarda los cambios de una ruta. Recibe el objeto en formato de pantalla.
 * Devuelve `{ ok }` y, si falla, el motivo para poder mostrarlo.
 */
export async function guardarRuta(ruta) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { data, error } = await supabaseNavegador()
    .from("rutas")
    .update({
      nombre: ruta.nombre,
      tipo: ruta.tipo,
      dias: ruta.dias,
      unidad: ruta.unidad,
      chofer: ruta.chofer,
      cupo: Number(ruta.cupo) || 0,
      activa: ruta.activa,
      zona: ruta.zona,
    })
    .eq("clave", ruta.id)
    .select("id");

  if (error) {
    console.error("[rutas] No se pudo guardar:", error.message);
    return { ok: false, motivo: error.message };
  }
  // Un UPDATE que el RLS bloquea NO da error: no encuentra ninguna fila
  // que le toque al usuario, cambia CERO y responde 200. Por eso se
  // cuentan las filas devueltas en vez de confiar en que no hubo error.
  if (!data?.length) {
    return { ok: false, motivo: "No se guardó nada: el permiso de la base no te deja editar esa ruta." };
  }
  return { ok: true };
}

/**
 * Crea una ruta. Nace SIN zona a propósito: hasta que alguien se la dibuje
 * no cubre a nadie, que es lo correcto (más vale no cubrir que prometer de
 * más).
 *
 * La clave se calcula a partir del número más alto que ya exista, nunca por
 * la cantidad de rutas: si alguna se borró, contar daría una clave repetida.
 */
/**
 * Cierra o reabre una ruta sin borrarla.
 *
 * Es lo que casi siempre se quiere en vez de eliminar: una ruta cerrada
 * desaparece del mapa público (quien viva ahí pasa a "fuera de cobertura")
 * pero conserva su historial y se puede reabrir con un clic.
 */
export async function alternarRutaActiva(claveRuta, activa) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { data, error } = await supabaseNavegador()
    .from("rutas")
    .update({ activa })
    .eq("clave", claveRuta)
    .select("clave");

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return { ok: false, motivo: "No se cambió nada: la base no permitió tocar esa ruta." };
  }
  return { ok: true };
}

/**
 * Cuántas cosas dependen de una ruta. Se consulta ANTES de borrar.
 *
 * Importa porque las llaves foráneas están en `on delete set null`: borrar una
 * ruta con historial no falla, deja las suscripciones sin ruta y los servicios
 * pasados sin saber por dónde se hicieron. Se pierde el rastro en silencio,
 * que es la peor forma de perderlo.
 */
export async function dependenciasDeRuta(uuidRuta) {
  if (!haySupabaseNavegador()) return { suscripciones: 0, servicios: 0 };

  const contar = async (tabla) => {
    const { count } = await supabaseNavegador()
      .from(tabla)
      .select("id", { count: "exact", head: true })
      .eq("ruta_id", uuidRuta);
    return count || 0;
  };

  return {
    suscripciones: await contar("suscripciones"),
    servicios: await contar("solicitudes_recoleccion"),
  };
}

/**
 * Borra una ruta, pero solo si nadie depende de ella. Si tiene historial,
 * se niega y sugiere cerrarla, que consigue lo mismo sin romper nada.
 */
export async function borrarRuta(ruta) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const dep = await dependenciasDeRuta(ruta.uuid);
  if (dep.suscripciones || dep.servicios) {
    return {
      ok: false,
      motivo:
        `No se puede borrar: hay ${dep.suscripciones} cliente(s) y ${dep.servicios} ` +
        `servicio(s) amarrados a esta ruta. Ciérrala en vez de borrarla: deja de ` +
        `aparecer en cobertura y no se pierde el historial.`,
    };
  }

  const { data, error } = await supabaseNavegador()
    .from("rutas")
    .delete()
    .eq("clave", ruta.id)
    .select("clave");

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return { ok: false, motivo: "No se borró nada: la base no permitió eliminar esa ruta." };
  }
  return { ok: true };
}

export async function crearRuta(rutasActuales) {
  const numeros = rutasActuales
    .map((r) => Number(String(r.id).replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1;
  const clave = `RT-${String(siguiente).padStart(3, "0")}`;

  const nueva = {
    clave,
    nombre: `Ruta ${rutasActuales.length + 1}`,
    tipo: "manual",
    dias: [],
    unidad: "",
    chofer: "",
    cupo: 10,
    activa: true,
    zona: [],
  };

  if (!haySupabaseNavegador()) return { ok: true, ruta: aFormatoPantalla({ ...nueva, id: clave }) };

  const { data, error } = await supabaseNavegador()
    .from("rutas")
    .insert(nueva)
    .select()
    .single();

  if (error) {
    console.error("[rutas] No se pudo crear:", error.message);
    return { ok: false, motivo: error.message };
  }
  return { ok: true, ruta: aFormatoPantalla(data) };
}
