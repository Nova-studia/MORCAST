"use client";

/**
 * Acceso a VACANTES y SOLICITUDES DE EMPLEO desde el panel.
 *
 * Calcado de `lib/datos-clientes.js`: nada de reglas de seguridad aquí, las
 * pone el RLS de `db/021` dentro de Postgres. Quien llame a esto sin sesión
 * de personal recibe cero filas, sin que este archivo tenga que saberlo.
 *
 * Las formas de VACANTES_SEED y SOLICITUDES_EMPLEO_SEED (`empleo-datos.js`)
 * ya calcan los nombres de columna de `db/021-trabaja-con-nosotros.sql` a
 * propósito: así lo que arma la pantalla en modo demostración es exactamente
 * lo que le llega cuando hay Supabase de verdad, sin un mapeo aparte que se
 * pueda desviar.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { VACANTES_SEED, SOLICITUDES_EMPLEO_SEED } from "@/lib/empleo-datos";
import { puedeBorrarseVacante } from "@/lib/empleo.mjs";

/* ==================================================================== */
/* VACANTES                                                             */
/* ==================================================================== */

const CAMPOS_VACANTE = "id, puesto, area, tipo, descripcion, requisitos, estado, creado";

export async function listarVacantes() {
  if (!haySupabaseNavegador()) return VACANTES_SEED;

  const { data, error } = await supabaseNavegador()
    .from("vacantes")
    .select(CAMPOS_VACANTE)
    .order("creado", { ascending: false });

  if (error) {
    console.error("[empleo] no se pudieron leer las vacantes:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Alta y edición en una sola función: si `v.id` viene, es edición.
 *
 * El estado NO se toca aquí — nace "abierta" y de ahí en adelante lo mueve
 * `cambiarEstadoVacante`, para que "cerrar" y "reabrir" sean un solo camino en
 * vez de un caso especial dentro del formulario.
 */
export async function guardarVacante(v) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const supabase = supabaseNavegador();
  const datos = {
    puesto: String(v?.puesto ?? "").trim(),
    area: v?.area,
    tipo: v?.tipo,
    descripcion: String(v?.descripcion ?? "").trim(),
    requisitos: Array.isArray(v?.requisitos) ? v.requisitos : [],
  };

  if (v?.id) {
    const { data, error } = await supabase
      .from("vacantes")
      .update(datos)
      .eq("id", v.id)
      .select(CAMPOS_VACANTE);

    if (error) return { ok: false, motivo: error.message };
    // Un UPDATE que el RLS bloquea NO da error: cambia CERO filas y responde
    // 200. Se cuentan las filas devueltas en vez de confiar en `error`.
    if (!data?.length) {
      return { ok: false, motivo: "No se guardó nada: el permiso de la base no te deja tocar esa vacante." };
    }
    return { ok: true, vacante: data[0] };
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("vacantes")
    .insert({ ...datos, estado: "abierta", creada_por: user?.id || null })
    .select(CAMPOS_VACANTE)
    .single();

  if (error) return { ok: false, motivo: error.message };
  return { ok: true, vacante: data };
}

/** Cierra o reabre una vacante. Publicarla o no depende sólo de este estado. */
export async function cambiarEstadoVacante(id, estado) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { data, error } = await supabaseNavegador()
    .from("vacantes")
    .update({ estado })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, motivo: error.message };
  // Mismo caso: un UPDATE sin fila que tocar no da error, cambia cero.
  if (!data?.length) {
    return { ok: false, motivo: "No se guardó nada: el permiso de la base no te deja tocar esa vacante." };
  }
  return { ok: true };
}

/**
 * Borra una vacante. Sólo si nadie aplicó a ella — la misma regla que apaga
 * el botón en la pantalla (`puedeBorrarseVacante`, Tarea 1), vive en un solo
 * lugar para que las dos digan siempre lo mismo.
 */
export async function borrarVacante(id) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { count, error: errConteo } = await supabaseNavegador()
    .from("solicitudes_empleo")
    .select("*", { count: "exact", head: true })
    .eq("vacante_id", id);
  if (errConteo) return { ok: false, motivo: errConteo.message };

  const permiso = puedeBorrarseVacante(count || 0);
  if (!permiso.ok) return permiso;

  const { error } = await supabaseNavegador().from("vacantes").delete().eq("id", id);
  if (error) return { ok: false, motivo: error.message };
  return { ok: true };
}

/* ==================================================================== */
/* SOLICITUDES DE EMPLEO                                                */
/* ==================================================================== */

const CAMPOS_SOLICITUD =
  "id, folio, nombre, telefono, correo, puesto, vacante_id, experiencia, cv_ruta, estado, notas, creado";

export async function listarSolicitudesEmpleo() {
  if (!haySupabaseNavegador()) return SOLICITUDES_EMPLEO_SEED;

  const { data, error } = await supabaseNavegador()
    .from("solicitudes_empleo")
    .select(CAMPOS_SOLICITUD)
    .order("creado", { ascending: false });

  if (error) {
    console.error("[empleo] no se pudieron leer las solicitudes:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Cambia el estado de una solicitud (y sus notas, que viajan siempre juntas
 * en la pantalla: se anota por qué se marcó "contactada" o "descartada" en el
 * mismo clic).
 *
 * Se cuentan las filas devueltas: un UPDATE que el RLS bloquea no da error,
 * actualiza cero y responde que todo bien. Sin esta cuenta, la pantalla
 * diría "guardado" sobre algo que nunca cambió — el mismo error que ya
 * mordió al proyecto en `acciones-alta-cliente.js`.
 */
export async function cambiarEstadoSolicitud(id, estado, notas) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { data, error } = await supabaseNavegador()
    .from("solicitudes_empleo")
    .update({ estado, notas: notas ?? "" })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return { ok: false, motivo: "No se guardó nada: el permiso de la base no te deja tocar esa solicitud." };
  }
  return { ok: true };
}

/**
 * Cuántas solicitudes tiene cada vacante, en UNA sola consulta.
 *
 * La usa la pantalla (Tarea 10) para apagar el botón de borrar, y la usa
 * `borrarVacante` para negarse. Es el mismo dato, pedido una vez — no una
 * consulta por cada fila de la tabla de vacantes.
 */
export async function contarSolicitudesPorVacante() {
  if (!haySupabaseNavegador()) {
    return SOLICITUDES_EMPLEO_SEED.reduce((acc, s) => {
      if (s.vacante_id) acc[s.vacante_id] = (acc[s.vacante_id] || 0) + 1;
      return acc;
    }, {});
  }
  const { data, error } = await supabaseNavegador()
    .from("solicitudes_empleo")
    .select("vacante_id")
    .not("vacante_id", "is", null);
  if (error) return {};
  return (data || []).reduce((acc, s) => {
    acc[s.vacante_id] = (acc[s.vacante_id] || 0) + 1;
    return acc;
  }, {});
}
