"use client";

/**
 * Datos del MODO CHOFER.
 *
 * El chofer ve las paradas de las rutas que trae asignadas, y solo esas. Eso
 * no se decide aquí: la política de RLS `solicitudes_del_operador` ya filtra
 * por `rutas.chofer_id = auth.uid()`.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { subirEvidencia } from "@/lib/datos-archivos";
import { direccionDe } from "@/lib/mapas.mjs";

/** Fecha de hoy en YYYY-MM-DD con la hora LOCAL, no en UTC. */
export function hoyISO() {
  const f = new Date();
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return `${f.getFullYear()}-${mes}-${dia}`;
}

/**
 * PARADAS DE DEMOSTRACIÓN, para el modo prototipo (sin Supabase).
 *
 * Antes el modo prototipo devolvía una ruta vacía y la pantalla del chofer
 * no se podía revisar sin una base. Son tres casos a propósito: un punto con
 * pin exacto, uno SIN ubicación (para ver el botón de guardarla) y uno ya
 * hecho. Los ids tienen forma de uuid porque la validación de los reportes
 * descarta lo que no la tenga.
 */
const DEMO_DOM = {
  golfo: "d0000000-0000-4000-8000-0000000000a1",
  puerta: "d0000000-0000-4000-8000-0000000000a2",
  vidriera: "d0000000-0000-4000-8000-0000000000a3",
};
function paradasDemo(fecha) {
  const ruta = { nombre: "Ruta Industrial", unidad: "U-07", unidades: { numero_economico: "U-07" } };
  return [
    {
      id: "d0000000-0000-4000-8000-000000000001",
      folio: "REC-2026-0142",
      estado: "confirmada",
      fecha_confirmada: fecha,
      nota: "Pasar por la caseta de vigilancia y pedir a Ramiro.",
      tipo_residuo: "Residuos de Manejo Especial",
      clientes: { empresa: "Industrias del Golfo, S.A. de C.V." },
      domicilios: {
        id: DEMO_DOM.golfo, alias: "Planta 1", calle: "Av. Uniones #1700",
        colonia: "Parque Industrial del Norte", cp: "87316", lat: 25.8436, lng: -97.5243,
        referencias: "Portón azul junto a la báscula; los camiones entran por la calle lateral.",
      },
      rutas: ruta,
      recolecciones: [],
    },
    {
      id: "d0000000-0000-4000-8000-000000000002",
      folio: "REC-2026-0141",
      estado: "confirmada",
      fecha_confirmada: fecha,
      nota: "",
      tipo_residuo: "Residuos Sólidos Urbanos (RSU)",
      clientes: { empresa: "Centro Comercial Puerta Norte" },
      domicilios: {
        id: DEMO_DOM.puerta, alias: "Anexo", calle: "Calle Sexta #85", colonia: "Zona Centro",
        cp: "87300", lat: null, lng: null, referencias: "",
      },
      rutas: ruta,
      recolecciones: [],
    },
    {
      id: "d0000000-0000-4000-8000-000000000003",
      folio: "REC-2026-0138",
      estado: "completada",
      fecha_confirmada: fecha,
      nota: "",
      tipo_residuo: "Reciclables (cartón, metal, plástico…)",
      clientes: { empresa: "Vidriera Matamoros" },
      domicilios: {
        id: DEMO_DOM.vidriera, alias: "Matriz", calle: "Av. Pedro Cárdenas #2200",
        colonia: "Treviño Zapata", cp: "87390", lat: 25.8571, lng: -97.4939, referencias: "",
      },
      rutas: ruta,
      recolecciones: [{ id: "demo-ev-3", qr: "MOR-C-0108", peso_kg: 340 }],
    },
  ];
}

const CONTENEDORES_DEMO = [
  { id: "d0000000-0000-4000-8000-0000000000c1", codigo: "MOR-C-0421", tipo: "contenedor", medida: "3 m³", estado: "en-servicio", domicilio_id: DEMO_DOM.golfo },
  { id: "d0000000-0000-4000-8000-0000000000c2", codigo: "MOR-C-0422", tipo: "tolva", medida: "30 m³", estado: "en-servicio", domicilio_id: DEMO_DOM.golfo },
  { id: "d0000000-0000-4000-8000-0000000000c3", codigo: "MOR-C-0310", tipo: "contenedor", medida: "1.5 m³", estado: "en-servicio", domicilio_id: DEMO_DOM.puerta },
];

/** Fila de la base → lo que usan las pantallas del chofer. */
function aParada(s) {
  const ev = s.recolecciones?.[0] || null;
  const d = s.domicilios || null;
  return {
    id: s.id,
    folio: s.folio,
    estado: s.estado,
    cliente: s.clientes?.empresa || "—",
    direccion: d
      ? [d.alias, d.calle, d.colonia].filter(Boolean).join(" · ")
      : "Sin domicilio registrado",
    // El punto completo, para "Cómo llegar" (lib/mapas.mjs) y para decir la
    // dirección entera: con alias y calle no basta para dar con un portón
    // en un parque industrial.
    punto: d
      ? { id: d.id, alias: d.alias, calle: d.calle, colonia: d.colonia, cp: d.cp, lat: d.lat, lng: d.lng }
      : null,
    direccionCompleta: d ? direccionDe(d) : "",
    referencias: d?.referencias || "",
    // Lo que pidió el cliente al agendar. Las solicitudes viejas no lo
    // traen: se enseña "sin especificar", no se adivina.
    tipoResiduo: s.tipo_residuo || "",
    // La unidad del inventario (db/023) si la ruta ya la tiene; si no, el
    // texto viejo de la ruta, que es lo que había antes del inventario.
    unidad: s.rutas?.unidades?.numero_economico || s.rutas?.unidad || "Sin unidad",
    ruta: s.rutas?.nombre || "",
    nota: s.nota || "",
    motivoNoProcedio: s.motivo_no_procedio || "",
    // "Completado" es que ya se levantó la evidencia, no solo que el estado
    // diga completada: el chofer necesita ver lo que le falta POR HACER.
    // "No procedió" también sale de los pendientes: ya quedó resuelta.
    estatus:
      s.estado === "no-procedio"
        ? "no-procedio"
        : s.estado === "completada" && ev
          ? "completado"
          : "pendiente",
    evidencia: ev,
  };
}

/**
 * Las paradas del chofer para una fecha.
 *
 * Se traen las confirmadas, las que ya están en ruta y las ya resueltas
 * (completadas o "no procedió"). Una "solicitada" no aparece a propósito: si
 * Morcast no la ha confirmado, el chofer no debería ir por ella.
 */
export async function rutaDelDia(fecha = hoyISO()) {
  if (!haySupabaseNavegador()) return paradasDemo(fecha).map(aParada);

  const { data, error } = await supabaseNavegador()
    .from("solicitudes_recoleccion")
    .select(`
      id, folio, estado, fecha_pedida, fecha_confirmada, nota, tipo_residuo, motivo_no_procedio,
      clientes ( empresa ),
      domicilios ( id, alias, calle, colonia, cp, lat, lng, referencias ),
      rutas ( nombre, unidad, unidades ( numero_economico ) ),
      recolecciones ( id, qr, peso_kg, foto_antes, foto_despues, hora_antes, hora_despues, ubicacion )
    `)
    .in("estado", ["confirmada", "en-ruta", "completada", "no-procedio"])
    .or(`fecha_confirmada.eq.${fecha},and(fecha_confirmada.is.null,fecha_pedida.eq.${fecha})`)
    .order("folio");

  if (error) {
    console.error("[chofer] No se pudo leer la ruta:", error.message);
    return [];
  }

  return (data || []).map(aParada);
}

/**
 * Guarda la ubicación del punto con el GPS del chofer, parado en la entrada.
 *
 * Va por la función `fijar_ubicacion_punto` (db/023) y no por un UPDATE:
 * el chofer no edita domicilios. La función solo acepta puntos de SUS
 * paradas, solo coordenadas dentro de Matamoros, y nunca pisa una ubicación
 * que puso la oficina. En ese caso devuelve `false`, y se dice: el chofer
 * tiene que saber que su lectura no se usó.
 */
export async function fijarUbicacionPunto(solicitudId, lectura) {
  if (!lectura || typeof lectura.lat !== "number") {
    return { ok: false, motivo: "Todavía no hay una lectura de GPS." };
  }
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { data, error } = await supabaseNavegador().rpc("fijar_ubicacion_punto", {
    p_solicitud: solicitudId,
    p_lat: lectura.lat,
    p_lng: lectura.lng,
  });
  if (error) return { ok: false, motivo: error.message };
  if (data !== true) {
    return {
      ok: false,
      motivo: "Este punto ya tiene la ubicación que puso la oficina; no se cambió.",
    };
  }
  return { ok: true };
}

/**
 * Los contenedores de un punto, para que el chofer diga CUÁL se dañó o no
 * está. El RLS (`contenedores_lee_operador`) solo le deja ver los de los
 * puntos de sus paradas.
 */
export async function contenedoresDelPunto(domicilioId) {
  if (!domicilioId) return [];
  if (!haySupabaseNavegador()) {
    return CONTENEDORES_DEMO.filter((c) => c.domicilio_id === domicilioId);
  }
  const { data, error } = await supabaseNavegador()
    .from("contenedores")
    .select("id, codigo, tipo, medida, estado")
    .eq("domicilio_id", domicilioId)
    .order("codigo");
  if (error) {
    console.error("[chofer] No se pudieron leer los contenedores:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Sube la foto de un incidente a `incidentes/<uid del chofer>/…`.
 *
 * La carpeta no es decorativa: la política de la cubeta (db/023) solo deja
 * subir a la carpeta que se llama como quien sube. Se sube ANTES de mandar
 * el reporte y al reporte solo viaja la ruta: una foto de celular no tiene
 * por qué pasar por la acción del servidor.
 */
export async function subirFotoIncidente(archivo) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true, ruta: null };
  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };

  const extension =
    (archivo.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const ruta = `${user.id}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from("incidentes")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (error) {
    console.error("[chofer] No se pudo subir la foto del incidente:", error.message);
    return { ok: false, motivo: error.message };
  }
  return { ok: true, ruta };
}

/**
 * Cambia el estado de una parada comprobando que DE VERDAD haya cambiado.
 *
 * ⚠️ Un UPDATE bloqueado por RLS **no da error**: Postgres no encuentra
 * ninguna fila que le toque a este usuario, actualiza cero y responde que
 * todo bien. Por eso se pide `.select()` y se cuentan las filas devueltas.
 * Sin esto, el sistema cree que cerró un servicio que sigue abierto.
 */
async function cambiarEstadoParada(solicitudId, estado) {
  const { data, error } = await supabaseNavegador()
    .from("solicitudes_recoleccion")
    .update({ estado })
    .eq("id", solicitudId)
    .select("id");

  if (error) return { ok: false, motivo: error.message };
  if (!data || data.length === 0) {
    return { ok: false, motivo: "No tienes permiso para cambiar esta parada." };
  }
  return { ok: true };
}

/** Marca que el chofer va en camino. */
export async function marcarEnRuta(solicitudId) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };
  return cambiarEstadoParada(solicitudId, "en-ruta");
}

/**
 * Cierra la recolección: guarda la evidencia y da el servicio por completado.
 *
 * El orden importa. Primero suben las fotos, luego se guarda el registro que
 * las apunta, y hasta el final se marca completada la solicitud. Al revés, un
 * fallo a media subida dejaría un servicio "completado" sin evidencia, que es
 * justo lo que no puede pasar: la evidencia es el comprobante ambiental del
 * cliente.
 */
export async function cerrarRecoleccion({
  solicitudId, qr, pesoKg, horaAntes, horaDespues,
  // Una lectura de GPS POR FOTO, o null. El antes y el después ocurren con
  // media hora de diferencia y el sello se enseña en cada una, así que no
  // sirve una sola lectura para las dos.
  //
  // ⚠️ Que falte NO es un error: significa que no hubo señal o que el chofer
  // no dio el permiso, y eso se enseña como "sin ubicación". La ubicación
  // NUNCA detiene el cierre de la parada; el trabajo del chofer es vaciar el
  // contenedor, no pelearse con un permiso del navegador en la calle.
  ubicacionAntes = null, ubicacionDespues = null,
  // Las fotos llegan YA SUBIDAS, como rutas. La pantalla las sube en cuanto
  // se toman: si el chofer recarga o pierde señal a media parada, no pierde
  // lo que ya hizo. Se aceptan también los archivos sueltos por si alguna
  // pantalla vieja todavía los manda.
  rutaAntes = null, rutaDespues = null, fotoAntes, fotoDespues,
}) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "No hay sesión." };

  let antes = rutaAntes;
  let despues = rutaDespues;

  if (!antes && fotoAntes) {
    const r = await subirEvidencia(solicitudId, "antes", fotoAntes);
    if (!r.ok) return { ok: false, motivo: "No se pudo subir la foto de antes." };
    antes = r.ruta;
  }
  if (!despues && fotoDespues) {
    const r = await subirEvidencia(solicitudId, "despues", fotoDespues);
    if (!r.ok) return { ok: false, motivo: "No se pudo subir la foto de después." };
    despues = r.ruta;
  }

  const { error: errorEv } = await supabase.from("recolecciones").insert({
    solicitud_id: solicitudId,
    operador_id: user.id,
    qr: qr || null,
    peso_kg: pesoKg ? Number(pesoKg) : null,
    foto_antes: antes,
    foto_despues: despues,
    hora_antes: horaAntes || null,
    hora_despues: horaDespues || null,
    // Si no hay ninguna de las dos se guarda null en vez de `{}`: un objeto
    // vacío se lee como "aquí hay algo" cuando no lo hay.
    ubicacion:
      ubicacionAntes || ubicacionDespues
        ? { antes: ubicacionAntes || null, despues: ubicacionDespues || null }
        : null,
  });

  if (errorEv) {
    console.error("[chofer] No se pudo guardar la evidencia:", errorEv.message);
    return { ok: false, motivo: errorEv.message };
  }

  const cierre = await cambiarEstadoParada(solicitudId, "completada");
  if (!cierre.ok) {
    // La evidencia sí quedó guardada; solo falló el último paso. Se avisa en
    // vez de callarlo, porque el servicio seguiría apareciendo como pendiente
    // y nadie sabría por qué.
    return {
      ok: false,
      motivo: "Se guardaron las fotos y el peso, pero no se pudo cerrar el servicio. Avisa a la oficina.",
    };
  }

  return { ok: true };
}
