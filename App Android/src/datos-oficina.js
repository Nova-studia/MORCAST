import { idsCuentasPrueba } from "./cuentas-prueba-datos";
import { supabase, haySupabase } from "./supabase";
import { postAdmin } from "./api-admin";
import { accionAdmin } from "./accion";
import { consultaRecolecciones } from "./recolecciones-panel.mjs";
import { filtroBusqueda } from "./web/consulta-recolecciones.mjs";
import { puntosParaOficina } from "./rutas-admin.mjs";

/**
 * LA OFICINA EN EL TELÉFONO — datos y acciones (6-oct-2026, paridad con
 * /admin/recolecciones y /admin/incidentes de la web).
 *
 * Leer va directo a Supabase, como en la web: el personal ve todas las
 * recolecciones y todos los incidentes porque así lo dice el RLS, y las
 * fotos privadas se piden como enlaces firmados que caducan.
 *
 * ESCRIBIR va SIEMPRE por el servidor (`postAdmin` → /api/app/...): ahí se
 * exige el segundo paso, se cuenta la fila, se anota en la bitácora con las
 * mismas acciones que la web y salen los correos y las notificaciones al
 * cliente y al chofer. Desde el teléfono no se manda nada de eso.
 *
 * ⚠️ DUPLICADO en `App IOS/src/datos-oficina.js` (misma forma; allá la
 * falta de señal llega como `sinRed` y aquí como `red`).
 */

const VIGENCIA_FOTO_S = 3600;

/** La respuesta del servidor, con un motivo legible siempre. */
function resultado(r, porOmision) {
  if (r?.ok) return r;
  if (r?.segundoPaso) return { ok: false, segundoPaso: true, motivo: r.motivo || "Vuelve a confirmar con el código de tu correo." };
  if (r?.sinRed || r?.red) return { ok: false, sinRed: true, motivo: r.motivo || "No hay conexión con Morcast." };
  if (r?.motivo === "sin_sesion") return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
  return { ok: false, motivo: r?.motivo || porOmision };
}

/* ==================================================================== */
/* RECOLECCIONES                                                        */
/* ==================================================================== */

// La tabla apunta DOS veces a perfiles (`creada_por` y `chofer_id`) y
// `recolecciones` otras dos (`operador_id` y `peso_real_por`): las llaves van
// con nombre o PostgREST responde "relación ambigua".
const CAMPOS_RECOLECCION = `
  id, folio, origen, fecha_pedida, fecha_confirmada, hora_confirmada, chofer_id,
  estado, nota, motivo_rechazo, creado, tipo_residuo, motivo_no_procedio, detalle_no_procedio,
  clientes ( empresa ),
  domicilios ( alias, calle, colonia ),
  rutas ( clave, nombre, dias, chofer, unidad ),
  choferParada:perfiles!solicitudes_recoleccion_chofer_id_fkey ( nombre ),
  recolecciones ( operador:perfiles!recolecciones_operador_id_fkey ( nombre ) )
`;

function aRecoleccion(f) {
  const d = f.domicilios;
  return {
    id: f.id,
    folio: f.folio,
    cliente: f.clientes?.empresa || "—",
    punto: d ? [d.alias, d.calle, d.colonia].filter(Boolean).join(" · ") : "",
    rutaClave: f.rutas?.clave || null,
    rutaNombre: f.rutas?.nombre || "Sin ruta",
    diasRuta: f.rutas?.dias || [],
    unidad: f.rutas?.unidad || "",
    origen: f.origen,
    fechaPedida: f.fecha_pedida,
    fechaConfirmada: f.fecha_confirmada,
    horaConfirmada: f.hora_confirmada || "",
    choferId: f.chofer_id || null,
    choferAsignado: f.choferParada?.nombre || "",
    choferRuta: f.rutas?.chofer || "",
    // Quien la cerró de verdad (ver `choferQueVa` en oficina.js).
    operadorReal: f.recolecciones?.[0]?.operador?.nombre || "",
    estado: f.estado,
    nota: f.nota || "",
    motivoRechazo: f.motivo_rechazo || "",
    tipoResiduo: f.tipo_residuo || "",
    motivoNoProcedio: f.motivo_no_procedio || "",
    detalleNoProcedio: f.detalle_no_procedio || "",
  };
}

/** Todas las recolecciones que el personal puede ver. `null` si no se pudo leer. */
export async function listarRecoleccionesOficina() {
  if (!haySupabase()) return [];
  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .select(CAMPOS_RECOLECCION)
    // Sin las cuentas de revisión de Apple/Google (db/027, 8-oct-2026).
    .not("cliente_id", "in", `(${[...(await idsCuentasPrueba())].join(",") || "00000000-0000-0000-0000-000000000000"})`)
    .order("fecha_pedida", { ascending: false })
    .limit(500);
  if (error) {
    console.warn("[oficina] no se pudieron leer las recolecciones:", error.message);
    return null;
  }
  return (data || []).map(aRecoleccion);
}

/** Lista para `.not("cliente_id","in", …)`; vacía → un id que no existe. */
const sinPruebas = async () => `(${[...(await idsCuentasPrueba())].join(",") || "00000000-0000-0000-0000-000000000000"})`;

/**
 * BUSCAR EN LA BASE (apps al 100%, 9-oct-2026), como `buscarSolicitudesPanel`
 * de la web: folio o empresa, Desde/Hasta por la fecha efectiva y páginas de
 * 50 con el total. Antes se traían las últimas 500 y se filtraba en el
 * teléfono: lo más viejo no aparecía nunca.
 *
 * `{ ok, filas, total }` o `{ ok:false, motivo, sinRed? }`.
 */
export async function buscarRecolecciones({ hoy, q = "", desde, hasta = "", estado = "", pagina = 1 } = {}) {
  if (!haySupabase()) return { ok: true, filas: [], total: 0 };
  const c = consultaRecolecciones({ hoy, q, desde, hasta, estado, pagina });
  try {
    let clienteIds = [];
    if (c.texto) {
      const { data: cs } = await supabase.from("clientes").select("id").or(`empresa.ilike.%${c.texto}%,folio.ilike.%${c.texto}%`).limit(200);
      clienteIds = (cs || []).map((x) => x.id);
    }
    let consulta = supabase
      .from("solicitudes_recoleccion")
      .select(CAMPOS_RECOLECCION, { count: "exact" })
      .not("cliente_id", "in", await sinPruebas());
    if (c.fechas) consulta = consulta.or(c.fechas);
    const busca = filtroBusqueda(c.texto, clienteIds);
    if (busca) consulta = consulta.or(busca);
    if (c.estado) consulta = consulta.eq("estado", c.estado);
    // El id desempata: con solo la fecha, las páginas repetían unas filas y
    // se saltaban otras (muchas el mismo día de ruta).
    const { data, error, count } = await consulta.order("fecha_pedida", { ascending: false }).order("id").range(c.rango[0], c.rango[1]);
    if (error) {
      console.warn("[oficina] no se pudieron buscar las recolecciones:", error.message);
      return { ok: false, motivo: "No se pudieron cargar las recolecciones. Revisa tu conexión." };
    }
    return { ok: true, filas: (data || []).map(aRecoleccion), total: count ?? (data || []).length };
  } catch {
    return { ok: false, sinRed: true, motivo: "Sin conexión. No se pudieron cargar las recolecciones." };
  }
}

/**
 * Lo VENCIDO va aparte y siempre completo, sin importar la búsqueda ni la
 * página: es lo que hay que resolver hoy. Y cuántas esperan confirmación.
 */
export async function pendientesOficina(hoy) {
  if (!haySupabase()) return { ok: true, vencidas: [], porConfirmar: 0 };
  try {
    const excluir = await sinPruebas();
    const [v, c] = await Promise.all([
      supabase
        .from("solicitudes_recoleccion")
        .select(CAMPOS_RECOLECCION)
        .not("cliente_id", "in", excluir)
        .in("estado", ["solicitada", "confirmada", "en-ruta"])
        .or(`fecha_confirmada.lt.${hoy},and(fecha_confirmada.is.null,fecha_pedida.lt.${hoy})`)
        .order("fecha_pedida")
        .limit(500),
      supabase
        .from("solicitudes_recoleccion")
        .select("id", { count: "exact", head: true })
        .not("cliente_id", "in", excluir)
        .eq("estado", "solicitada"),
    ]);
    if (v.error) return { ok: false, vencidas: [], porConfirmar: c.count ?? 0 };
    return { ok: true, vencidas: (v.data || []).map(aRecoleccion), porConfirmar: c.count ?? 0 };
  } catch {
    return { ok: false, sinRed: true, vencidas: [], porConfirmar: 0 };
  }
}

/** Una sola por id (al abrir una notificación o "Cambiar"), o null. */
export async function recoleccionPorId(id) {
  if (!haySupabase() || !id) return null;
  try {
    const { data } = await supabase.from("solicitudes_recoleccion").select(CAMPOS_RECOLECCION).eq("id", id).maybeSingle();
    return data ? aRecoleccion(data) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------ nueva recolección */

/** Clientes para "Nueva recolección": todos menos los de baja. `null` si no se pudo. */
export async function clientesParaRecoleccion() {
  if (!haySupabase()) return [];
  try {
    const { data, error } = await supabase.from("clientes").select("id, folio, empresa, correo, estado").neq("estado", "baja").order("empresa");
    return error ? null : data || [];
  } catch {
    return null;
  }
}

/** Los puntos de un cliente con su ruta y el chofer de la ruta. `null` si no se pudo. */
export async function puntosDeClienteOficina(clienteId) {
  if (!haySupabase() || !clienteId) return [];
  try {
    const { data, error } = await supabase
      .from("domicilios")
      .select("id, alias, colonia, suscripciones ( estado, rutas ( nombre, chofer, chofer_id ) )")
      .eq("cliente_id", clienteId)
      .order("alias");
    return error ? null : puntosParaOficina(data || []);
  } catch {
    return null;
  }
}

/**
 * Crea la recolección por el servidor (`recoleccion-crear`): ahí se valida,
 * nace "solicitada" o ya "confirmada" (y entonces avisa al cliente y al
 * chofer como "Confirmar") y queda en la bitácora.
 */
export async function crearRecoleccion(datos) {
  if (!haySupabase()) return { ok: true, demo: true, folio: "REC-DEMO", estado: datos.confirmar ? "confirmada" : "solicitada" };
  return accionAdmin("recoleccion-crear", datos);
}

/**
 * La foto que dejó el chofer al marcar "No procedió", si la dejó. Vive en
 * la carpeta de evidencias de la solicitud y su nombre dice "no-procedio"
 * (así la nombran la web y la app del chofer). Sin respaldo a "la más
 * reciente": podría ser la foto de "antes" y no es prueba de nada.
 * Devuelve el enlace firmado, o null.
 */
export async function fotoNoProcedio(solicitudId) {
  if (!haySupabase() || !solicitudId) return null;
  const { data, error } = await supabase.storage
    .from("evidencias")
    .list(String(solicitudId), { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error || !data?.length) return null;
  const elegida = data
    .filter((a) => /\.(jpe?g|png|webp|heic)$/i.test(a.name))
    .find((a) => /no.?procedi/i.test(a.name));
  if (!elegida) return null;
  const { data: firmado, error: e2 } = await supabase.storage
    .from("evidencias")
    .createSignedUrl(`${solicitudId}/${elegida.name}`, VIGENCIA_FOTO_S);
  return e2 ? null : firmado?.signedUrl || null;
}

/**
 * Confirmar, reagendar o cambiar: el servidor decide cuál es con la
 * recolección como está en la base y lo anota así en la bitácora.
 */
export async function programarRecoleccion({ id, fecha, hora, choferId }) {
  if (!haySupabase()) return { ok: true, demo: true };
  const r = await postAdmin("recolecciones/confirmar", {
    id,
    fecha,
    hora: hora || "",
    chofer_id: choferId || "",
  });
  return resultado(r, "No se pudo guardar. Inténtalo otra vez.");
}

export async function rechazarRecoleccion(id, motivo) {
  if (!haySupabase()) return { ok: true, demo: true };
  const r = await postAdmin("recolecciones/rechazar", { id, motivo: motivo || "" });
  return resultado(r, "No se pudo rechazar. Inténtalo otra vez.");
}

/* ==================================================================== */
/* INCIDENTES                                                           */
/* ==================================================================== */

// `incidentes` apunta dos veces a perfiles (`operador_id` y `atendido_por`).
const CAMPOS_INCIDENTE = `
  id, tipo, descripcion, retraso_min, foto, ubicacion, estado,
  atendido_en, nota_atencion, creado,
  chofer:perfiles!incidentes_operador_id_fkey ( nombre, telefono ),
  atendio:perfiles!incidentes_atendido_por_fkey ( nombre ),
  unidades ( numero_economico ),
  rutas ( clave, nombre ),
  solicitudes_recoleccion ( id, folio, clientes ( empresa ), domicilios ( alias, calle, colonia ) ),
  contenedores ( codigo, tipo, medida )
`;

function aIncidente(f) {
  const sol = f.solicitudes_recoleccion;
  const dom = sol?.domicilios;
  const lat = Number(f.ubicacion?.lat);
  const lng = Number(f.ubicacion?.lng);
  return {
    id: f.id,
    tipo: f.tipo,
    descripcion: f.descripcion || "",
    retrasoMin: f.retraso_min ?? null,
    foto: f.foto || null,
    ubicacion: f.ubicacion?.lat != null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    estado: f.estado,
    creado: f.creado,
    atendidoEn: f.atendido_en,
    atendio: f.atendio?.nombre || "",
    notaAtencion: f.nota_atencion || "",
    chofer: f.chofer?.nombre || "Sin nombre",
    telefonoChofer: f.chofer?.telefono || "",
    unidad: f.unidades?.numero_economico || "",
    ruta: f.rutas?.nombre || "",
    solicitudId: sol?.id || null,
    folio: sol?.folio || "",
    cliente: sol?.clientes?.empresa || "",
    parada: dom ? [dom.alias, dom.calle, dom.colonia].filter(Boolean).join(" · ") : "",
    contenedor: f.contenedores
      ? [f.contenedores.codigo, f.contenedores.tipo, f.contenedores.medida].filter(Boolean).join(" · ")
      : "",
  };
}

/** Los incidentes, lo más nuevo primero. `null` si no se pudo leer. */
export async function listarIncidentesOficina() {
  if (!haySupabase()) return [];
  const { data, error } = await supabase
    .from("incidentes")
    .select(CAMPOS_INCIDENTE)
    .order("creado", { ascending: false })
    .limit(300);
  if (error) {
    console.warn("[oficina] no se pudieron leer los incidentes:", error.message);
    return null;
  }
  return (data || []).map(aIncidente);
}

/** Enlace temporal a la foto (cubeta privada `incidentes`). Se pide al abrir uno, no por toda la lista. */
export async function fotoIncidente(ruta) {
  if (!haySupabase() || !ruta) return null;
  const { data, error } = await supabase.storage.from("incidentes").createSignedUrl(ruta, VIGENCIA_FOTO_S);
  return error ? null : data?.signedUrl || null;
}

export async function atenderIncidente(id, nota) {
  if (!haySupabase()) return { ok: true, demo: true, atendidoEn: new Date().toISOString(), atendio: "" };
  const r = await postAdmin("incidentes/atender", { id, nota });
  return resultado(r, "No se pudo marcar como atendido. Inténtalo otra vez.");
}
