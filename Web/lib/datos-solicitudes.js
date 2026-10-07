"use client";

/**
 * Acceso a las SOLICITUDES DE RECOLECCIÓN.
 *
 * Es el circuito central del negocio: el cliente pide, Morcast confirma, el
 * chofer ejecuta. Las mismas funciones sirven para el panel y para el portal
 * porque quién ve qué lo decide el RLS dentro de Postgres, no este archivo.
 */

import { sinPruebasEnConsulta } from "@/lib/cuentas-prueba.mjs";
import { idsCuentasPrueba } from "@/lib/cuentas-prueba-datos";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { SOLICITUDES_SEED, nombreTipoRuta } from "@/lib/rutas-datos";
import { enlaceEvidencia } from "@/lib/datos-archivos";
import { TIPOS_RESIDUO } from "@/lib/cotizar-whatsapp";
import { demoPeso } from "@/lib/datos-viajes";
import { mezclarChoferes } from "@/lib/chofer-servicio.mjs";
import { choferesDeMisServicios } from "@/app/acciones-portal";
import { avisarSolicitudNueva } from "@/app/acciones-solicitud";

/**
 * Se piden de una vez los datos de la empresa y de la ruta, en lugar de una
 * consulta por fila. Con 200 solicitudes, lo segundo serían 401 viajes a la
 * base para pintar una sola tabla.
 */
const CAMPOS_BASE = `
  id, folio, origen, fecha_pedida, fecha_confirmada, hora_confirmada, chofer_id,
  estado, nota, motivo_rechazo, creado, tipo_residuo, motivo_no_procedio, detalle_no_procedio,
  clientes ( folio, empresa ),
  domicilios ( alias, colonia ),
  rutas ( clave, nombre, tipo, unidad, chofer ),
  choferParada:perfiles!solicitudes_recoleccion_chofer_id_fkey ( nombre )
`;

/**
 * Quién la HIZO de verdad: el chofer que cerró la recolección
 * (`recolecciones.operador_id`). Luis lo encontró el 6-oct-2026: una
 * completada decía "Marco Antonio" (el chofer de la ruta) y la había hecho
 * José Medina. `recolecciones` apunta DOS veces a perfiles (`operador_id` y
 * `peso_real_por`), así que la llave va con nombre. El personal puede leer
 * perfiles; al cliente el RLS se lo devuelve vacío y se queda lo de antes.
 */
const OPERADOR_REAL = "operador:perfiles!recolecciones_operador_id_fkey ( nombre )";
const CAMPOS = `${CAMPOS_BASE},
  hecha:recolecciones ( ${OPERADOR_REAL} )
`;
// El nombre de la llave va explícito a propósito: esta tabla apunta DOS veces
// a perfiles (`creada_por` y `chofer_id`). Con solo "perfiles (...)" PostgREST
// no sabe cuál de las dos quieres y responde con un error de relación ambigua.

/** El chofer que cerró la recolección, o "" si no hay evidencia o no se puede leer. */
function operadorReal(f) {
  const ev = (f.hecha || f.recolecciones || [])[0];
  return ev?.operador?.nombre || "";
}

/** Fila de la base → el formato que ya usaban las pantallas. */
function aFormatoPantalla(f) {
  return {
    id: f.id,
    folio: f.folio,
    cliente: f.clientes?.empresa || "—",
    clienteFolio: f.clientes?.folio || "",
    // Un punto sin colonia dejaba el separador colgando ("MATRIZ ·"): `.trim()`
    // solo quita espacios de las orillas, el "·" se quedaba. Se unen las
    // piezas que existen.
    domicilio: f.domicilios
      ? [f.domicilios.alias, f.domicilios.colonia].filter(Boolean).join(" · ")
      : "—",
    rutaId: f.rutas?.clave || null,
    rutaNombre: f.rutas?.nombre || "Sin ruta",
    unidad: f.rutas?.unidad || "Sin asignar",
    chofer: f.rutas?.chofer || "Sin asignar",
    origen: f.origen,
    fechaPedida: f.fecha_pedida,
    fechaConfirmada: f.fecha_confirmada,
    horaConfirmada: f.hora_confirmada || "",
    // Chofer de ESTA parada. Si no hay asignación directa manda el de la
    // ruta, que es como funcionó siempre.
    choferId: f.chofer_id || null,
    choferAsignado: f.choferParada?.nombre || "",
    // Completada: manda quien la cerró (ver OPERADOR_REAL). Si no, el
    // asignado a la parada y, al final, el de la ruta.
    operadorReal: operadorReal(f),
    choferEfectivo:
      (f.estado === "completada" && operadorReal(f)) || f.choferParada?.nombre || f.rutas?.chofer || "Sin asignar",
    estado: f.estado,
    nota: f.nota || "",
    motivoRechazo: f.motivo_rechazo || "",
    // Lo que el cliente dijo que iba a entregar (db/023). Las solicitudes
    // de antes no lo traen: queda vacío y la pantalla dice "sin especificar".
    tipoResiduo: f.tipo_residuo || "",
    // Si el chofer la marcó "No procedió", el porqué. Es lo que el cliente
    // necesita leer para entender por qué no se le recogió (y no se cobró).
    motivoNoProcedio: f.motivo_no_procedio || "",
    detalleNoProcedio: f.detalle_no_procedio || "",
  };
}

/**
 * En el modo prototipo las solicitudes de muestra no traían tipo de
 * residuo, y la pantalla se veía como si nadie lo hubiera pedido nunca.
 */
const RESIDUOS_DEMO = [TIPOS_RESIDUO[1], TIPOS_RESIDUO[0], TIPOS_RESIDUO[6]];

/**
 * Todas las que la sesión tenga permitido ver.
 * El admin las ve todas; un cliente, solo las suyas. La consulta es la misma:
 * la diferencia la pone el RLS.
 */
export async function listarSolicitudes({ sinPruebas = false } = {}) {
  if (!haySupabaseNavegador()) {
    return SOLICITUDES_SEED.map((s, i) => ({
      tipoResiduo: RESIDUOS_DEMO[i % RESIDUOS_DEMO.length],
      ...s,
    }));
  }

  // Desde el panel no cuentan las cuentas de revisión (db/027); el cliente
  // ve lo suyo siempre.
  const ids = sinPruebas ? await idsCuentasPrueba() : null;
  const { data, error } = await sinPruebasEnConsulta(
    supabaseNavegador().from("solicitudes_recoleccion").select(CAMPOS),
    ids
  ).order("fecha_pedida", { ascending: false });

  if (error) {
    console.error("[solicitudes] No se pudieron leer:", error.message);
    return [];
  }
  return (data || []).map(aFormatoPantalla);
}

/**
 * Lo mismo que `listarSolicitudes`, más lo que solo le sirve al PANEL
 * (db/023): el tipo de residuo que pidió el cliente, el motivo de un "No
 * procedió", y el peso de su recolección —el estimado del chofer, el real si
 * ya se puso, y el viaje al relleno en que iba—.
 *
 * Va aparte y no dentro de `listarSolicitudes` porque ésa también la usa el
 * portal del cliente, y al cliente no le toca la pregunta "¿en qué viaje del
 * camión iba mi basura?": el ticket del viaje es del camión completo, con
 * residuo de otras empresas. Además el RLS no le deja leer `viajes_relleno`.
 */
const CAMPOS_PANEL = `${CAMPOS_BASE},
  recolecciones (
    id, peso_kg, peso_real_kg, peso_real_en, viaje_id, ${OPERADOR_REAL},
    viajes_relleno ( id, fecha, peso_real_kg, folio_ticket )
  )
`;

const numero = (v) => (v === null || v === undefined ? null : Number(v));

export async function listarSolicitudesPanel() {
  if (!haySupabaseNavegador()) {
    // Las de siempre, más completadas con peso y una que no procedió, para
    // que en la demo se vea cómo se pinta cada caso.
    return [...SOLICITUDES_SEED, ...demoPeso().solicitudes.map((s) => ({ ...s }))];
  }

  // Las cuentas de revisión (Apple/Google) no aparecen en el panel (db/027).
  const { data, error } = await sinPruebasEnConsulta(
    supabaseNavegador().from("solicitudes_recoleccion").select(CAMPOS_PANEL),
    await idsCuentasPrueba()
  ).order("fecha_pedida", { ascending: false });

  if (error) {
    console.error("[solicitudes] No se pudieron leer (panel):", error.message);
    return [];
  }
  return (data || []).map((f) => {
    // Una recolección por servicio (así la levanta el chofer). Si hubiera
    // dos, manda la primera, igual que en el historial del cliente.
    const ev = f.recolecciones?.[0] || null;
    const v = ev?.viajes_relleno || null;
    return {
      ...aFormatoPantalla(f),
      tipoResiduo: f.tipo_residuo || "",
      motivoNoProcedio: f.motivo_no_procedio || "",
      detalleNoProcedio: f.detalle_no_procedio || "",
      evidencia: ev
        ? {
            id: ev.id,
            estimadoKg: numero(ev.peso_kg),
            realKg: numero(ev.peso_real_kg),
            realEn: ev.peso_real_en || null,
            viajeId: ev.viaje_id || null,
            viaje: v
              ? { id: v.id, fecha: v.fecha, pesoRealKg: numero(v.peso_real_kg), folioTicket: v.folio_ticket || "" }
              : null,
          }
        : null,
    };
  });
}

/**
 * La foto que dejó el chofer al marcar "No procedió", si la dejó.
 *
 * No hay columna para ella: vive en la carpeta de evidencias de la solicitud
 * (`evidencias/<id>/…`), que es la única donde la política de la cubeta le
 * deja subir al chofer. Se prefiere un archivo cuyo nombre diga
 * "no-procedio" (así la nombra la web del chofer). Si no hay, null: mejor
 * "sin foto" que enseñar otra foto de la carpeta. Devuelve el enlace firmado
 * o null.
 */
export async function fotoNoProcedio(solicitudId) {
  if (!haySupabaseNavegador() || !solicitudId) return null;

  const { data, error } = await supabaseNavegador()
    .storage.from("evidencias")
    .list(String(solicitudId), { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error || !data?.length) return null;

  const fotos = data.filter((a) => /\.(jpe?g|png|webp|heic)$/i.test(a.name));
  // Solo la que el chofer subió AL MARCAR "No procedió" (se llama así). Sin
  // respaldo a "la más reciente": podría ser la foto de "antes" de esa misma
  // visita, y el panel la enseñaría como prueba de algo que no es.
  const elegida = fotos.find((a) => /no.?procedi/i.test(a.name));
  return elegida ? enlaceEvidencia(`${solicitudId}/${elegida.name}`) : null;
}

/**
 * La suscripción del cliente que tiene la sesión, con su ruta y su domicilio.
 * Es lo que dice en qué días puede pedir recolección.
 *
 * Devuelve null si todavía no lo han dado de alta en una ruta, que es un
 * estado legítimo: un cliente puede existir antes de tener servicio asignado.
 */
export async function miSuscripcion() {
  if (!haySupabaseNavegador()) return null;

  const { data, error } = await supabaseNavegador()
    .from("suscripciones")
    .select(`
      id, frecuencia, estado, equipo,
      domicilios ( alias, colonia ),
      rutas ( clave, nombre, tipo, dias )
    `)
    .eq("estado", "activa")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    frecuencia: data.frecuencia,
    domicilio: data.domicilios
      ? `${data.domicilios.alias} · ${data.domicilios.colonia || ""}`.trim()
      : "",
    ruta: data.rutas
      ? {
          clave: data.rutas.clave,
          nombre: data.rutas.nombre,
          tipo: data.rutas.tipo,
          dias: data.rutas.dias || [],
        }
      : null,
  };
}

/**
 * Siguiente folio, a partir del número más alto que ya exista.
 * Nunca por la cantidad de filas: si alguna se borra, contar da un folio
 * repetido y el folio es único en la base.
 */
export async function siguienteFolio() {
  const año = new Date().getFullYear();
  if (!haySupabaseNavegador()) return `REC-${año}-0001`;

  const { data } = await supabaseNavegador()
    .from("solicitudes_recoleccion")
    .select("folio")
    .like("folio", `REC-${año}-%`)
    .order("folio", { ascending: false })
    .limit(1);

  const ultimo = data?.[0]?.folio;
  const n = ultimo ? Number(String(ultimo).split("-").pop()) : 0;
  return `REC-${año}-${String((Number.isFinite(n) ? n : 0) + 1).padStart(4, "0")}`;
}

/**
 * El cliente pide una recolección.
 *
 * No recibe ni el cliente ni el estado: el cliente sale de su propia sesión y
 * el estado nace siempre en "solicitada". Aunque alguien manipulara esta
 * llamada, la política de RLS solo acepta insertar a nombre propio y en ese
 * estado; nadie puede darse por confirmado a sí mismo.
 *
 * El tipo de residuo es OBLIGATORIO (pedido de los dueños, 4-oct-2026): con
 * él el chofer sabe qué va a recoger, y si al llegar es otra cosa lo marca
 * "No procedió". Tiene que ser uno del catálogo (TIPOS_RESIDUO), que es el
 * mismo que usa el cotizador de WhatsApp.
 */
export async function pedirRecoleccion({ rutaClave, fecha, nota, origen = "ruta", tipoResiduo }) {
  if (!TIPOS_RESIDUO.includes(tipoResiduo)) {
    return { ok: false, motivo: "Elige qué tipo de residuo vamos a recoger." };
  }
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const supabase = supabaseNavegador();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "No hay sesión." };

  const { data: perfil } = await supabase
    .from("perfiles").select("cliente_id").eq("id", user.id).single();
  if (!perfil?.cliente_id) return { ok: false, motivo: "Tu cuenta no tiene empresa asignada." };

  const { data: domicilio } = await supabase
    .from("domicilios").select("id").eq("cliente_id", perfil.cliente_id).limit(1).single();

  let rutaId = null;
  if (rutaClave) {
    const { data: ruta } = await supabase
      .from("rutas").select("id").eq("clave", rutaClave).single();
    rutaId = ruta?.id || null;
  }

  const folio = await siguienteFolio();
  const { error } = await supabase.from("solicitudes_recoleccion").insert({
    folio,
    cliente_id: perfil.cliente_id,
    domicilio_id: domicilio?.id || null,
    ruta_id: rutaId,
    origen,
    fecha_pedida: fecha,
    estado: "solicitada",
    nota: nota || "",
    tipo_residuo: tipoResiduo,
  });

  if (error) {
    console.error("[solicitudes] No se pudo pedir:", error.message);
    // La política de la base (db/013) rechaza fechas del pasado y las
    // disparatadas. Ese rechazo llega como un error de permisos, que no le
    // dice nada a quien solo se equivocó de día.
    const esFecha = /row-level security|violates|policy/i.test(error.message || "");
    return {
      ok: false,
      motivo: esFecha
        ? "Esa fecha no se puede: elige un día de hoy en adelante."
        : error.message,
    };
  }

  // Que se entere la oficina (6-oct-2026): antes nadie avisaba y la
  // solicitud esperaba a que alguien abriera Recolecciones. No se espera: la
  // solicitud ya quedó guardada, que es lo importante, y un fallo del aviso
  // no le puede decir al cliente que no se pidió.
  avisarSolicitudNueva(folio).catch((e) =>
    console.warn("[solicitudes] no se pudo avisar a la oficina:", e?.message || e)
  );
  return { ok: true, folio };
}

/**
 * Historial de servicios del cliente, con su evidencia.
 *
 * Solo las completadas: un servicio sin hacer no es historial. Las fotos se
 * piden como enlaces firmados que caducan, no como direcciones fijas — de eso
 * se encarga `enlaceEvidencia`.
 */
/**
 * @param {{conFotos?: boolean, conChoferes?: boolean}} opciones
 *   `conFotos: false` trae los servicios SIN pedir los enlaces de las fotos.
 *
 *   `conChoferes` (6-oct-2026): el chofer de cada servicio lo dice el
 *   SERVIDOR (quien levantó la evidencia; `app/acciones-portal.js`), no el
 *   texto libre de la ruta, que decía otro nombre. Solo sirve con sesión de
 *   cliente; la agenda del admin pasa `false` y se queda como estaba.
 *
 *   Cada servicio con evidencia cuesta DOS llamadas más a Storage para firmar
 *   sus dos fotos. El panel y la pantalla de Documentos no enseñan fotos —solo
 *   fechas, pesos y manifiestos— y aun así las pedían: un cliente con 50
 *   recolecciones disparaba 100 peticiones que nadie iba a mirar. Solo el
 *   Historial y la agenda del admin abren el comprobante.
 */
export async function misServicios({ conFotos = true, conChoferes = true, sinPruebas = false } = {}) {
  if (!haySupabaseNavegador()) return [];

  const ids = sinPruebas ? await idsCuentasPrueba() : null;
  const { data, error } = await sinPruebasEnConsulta(supabaseNavegador()
    .from("solicitudes_recoleccion")
    .select(`
      id, folio, estado, fecha_pedida, fecha_confirmada, origen,
      clientes ( empresa ),
      rutas ( nombre, tipo, unidad, chofer ),
      recolecciones ( qr, peso_kg, foto_antes, foto_despues, hora_antes, hora_despues, ubicacion )
    `), ids)
    .eq("estado", "completada")
    .order("fecha_confirmada", { ascending: false });

  if (error) {
    console.error("[servicios] No se pudieron leer:", error.message);
    return [];
  }

  const soloHora = (t) => (t ? new Date(t).toTimeString().slice(0, 5) : "—");

  // El chofer de verdad, en paralelo con las fotos. Si falla, "—" (ver
  // `mezclarChoferes`): nunca detiene la lista.
  const choferes = conChoferes
    ? choferesDeMisServicios().then((r) => (r?.ok ? r.choferes : null)).catch(() => null)
    : null;

  const lista = await Promise.all(
    (data || []).map(async (s) => {
      const ev = s.recolecciones?.[0] || null;
      const [urlAntes, urlDespues] = ev && conFotos
        ? await Promise.all([enlaceEvidencia(ev.foto_antes), enlaceEvidencia(ev.foto_despues)])
        : [null, null];

      return {
        folio: s.folio,
        fecha: s.fecha_confirmada || s.fecha_pedida,
        // El nombre de la empresa solo lo entrega la base a quien le toca: al
        // propio cliente y al personal de Morcast. Aquí sirve para que el
        // admin vea de quién es cada servicio.
        cliente: s.clientes?.empresa || "—",
        tipo: nombreTipoRuta(s.rutas?.tipo) || "Recolección",
        residuo: s.origen === "extra" ? "Recolección extra" : "Residuos de ruta",
        contenedor: ev?.qr ? `Contenedor ${ev.qr}` : "Sin contenedor registrado",
        // Nadie mide metros cúbicos: lo que el chofer anota es PESO. El
        // campo se queda porque los PDF viejos lo nombran, pero las
        // pantallas enseñan `peso`, que es el que trae dato.
        volumen: "—",
        peso: ev?.peso_kg ? `${ev.peso_kg} kg` : "—",
        unidad: s.rutas?.unidad || "—",
        operador: s.rutas?.chofer || "—",
        estatus: "completado",
        // El manifiesto se arma con el folio del servicio mientras no exista
        // el trámite formal ante SEMARNAT.
        manifiesto: `MAN-${s.folio.replace("REC-", "")}`,
        evidencia: ev
          ? {
              contenedor: ev.qr ? `Contenedor ${ev.qr}` : "—",
              // La ubicación viaja PEGADA a su foto, no suelta en el objeto.
              // Antes había un campo `gps` con el texto fijo "Registrado en la
              // recolección" que no salía de ningún lado — el sello de la
              // pantalla decía "GPS" sin nada atrás. Ahora, si la llave falta,
              // la pantalla enseña "sin ubicación" en vez de disimularlo.
              antes: {
                hora: soloHora(ev.hora_antes),
                etiqueta: "Contenedor lleno",
                url: urlAntes,
                ubicacion: ev.ubicacion?.antes || null,
              },
              despues: {
                hora: soloHora(ev.hora_despues),
                etiqueta: "Contenedor vacío",
                peso: ev.peso_kg ? `${ev.peso_kg} kg` : "—",
                firma: s.rutas?.chofer || "—",
                url: urlDespues,
                ubicacion: ev.ubicacion?.despues || null,
              },
            }
          : null,
      };
    })
  );

  return conChoferes ? mezclarChoferes(lista, await choferes) : lista;
}

/** Morcast confirma la recolección para la fecha que pidió el cliente. */
export async function confirmarSolicitud(solicitud) {
  return cambiarEstado(solicitud.id, {
    estado: "confirmada",
    fecha_confirmada: solicitud.fechaConfirmada || solicitud.fechaPedida,
  });
}

/** Morcast la rechaza, dejando dicho por qué. */
export async function rechazarSolicitud(solicitud, motivo) {
  return cambiarEstado(solicitud.id, {
    estado: "rechazada",
    motivo_rechazo: motivo || "Sin cupo en la ruta.",
  });
}

/** Cambio de estado genérico (en-ruta, completada…). */
export async function cambiarEstado(id, cambios) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { data, error } = await supabaseNavegador()
    .from("solicitudes_recoleccion")
    .update(cambios)
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[solicitudes] No se pudo actualizar:", error.message);
    return { ok: false, motivo: error.message };
  }
  // Un UPDATE que el RLS bloquea NO da error: cambia CERO filas y responde
  // 200. Se cuentan las filas devueltas en vez de confiar en `error`.
  if (!data?.length) {
    return { ok: false, motivo: "No se cambió nada: el permiso de la base no te deja tocar esa solicitud." };
  }
  return { ok: true };
}
