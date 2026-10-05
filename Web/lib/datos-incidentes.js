"use client";

/**
 * Acceso a los INCIDENTES que reporta el chofer (db/023), para la bandeja
 * del panel (/admin/incidentes).
 *
 * Como en el resto de lib/datos-*.js, aquí no hay reglas de seguridad: el
 * personal los ve todos y el chofer solo los suyos porque así lo dice el RLS
 * (`incidentes_personal`, `incidentes_lee_operador`). Cerrar un incidente NO
 * vive aquí: va por el servidor (admin/incidentes/acciones.js) para quedar
 * en la bitácora.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { enlaceTemporal } from "@/lib/datos-archivos";

/**
 * Todo lo que enseña la bandeja, en una sola consulta.
 *
 * Los nombres de las llaves a `perfiles` van explícitos: la tabla apunta DOS
 * veces ahí (`operador_id` y `atendido_por`) y con "perfiles (...)" a secas
 * PostgREST responde con un error de relación ambigua — ya pasó con
 * solicitudes_recoleccion (ver lib/datos-solicitudes.js).
 */
const CAMPOS = `
  id, tipo, descripcion, retraso_min, foto, ubicacion, estado,
  atendido_en, nota_atencion, creado,
  chofer:perfiles!incidentes_operador_id_fkey ( nombre, telefono ),
  atendio:perfiles!incidentes_atendido_por_fkey ( nombre ),
  unidades ( numero_economico ),
  rutas ( id, clave, nombre ),
  solicitudes_recoleccion ( folio, clientes ( empresa ), domicilios ( alias, calle, colonia ) ),
  contenedores ( codigo, tipo, medida )
`;

/** Tope de filas: la bandeja enseña lo reciente; lo viejo está en la base. */
const LIMITE = 500;

/** Fila de la base → lo que pinta la pantalla. */
function aFormatoPantalla(f) {
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
    // Solo si de verdad trae coordenadas: un jsonb vacío o a medias no es
    // una ubicación, y "Ver en el mapa" llevaría al océano.
    ubicacion: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    estado: f.estado,
    creado: f.creado,
    atendidoEn: f.atendido_en,
    atendio: f.atendio?.nombre || "",
    notaAtencion: f.nota_atencion || "",
    chofer: f.chofer?.nombre || "Sin nombre",
    telefonoChofer: f.chofer?.telefono || "",
    unidad: f.unidades?.numero_economico || "",
    ruta: f.rutas ? { id: f.rutas.id, clave: f.rutas.clave, nombre: f.rutas.nombre } : null,
    folio: sol?.folio || "",
    cliente: sol?.clientes?.empresa || "",
    parada: dom ? [dom.alias, dom.calle, dom.colonia].filter(Boolean).join(" · ") : "",
    contenedor: f.contenedores
      ? [f.contenedores.codigo, f.contenedores.tipo, f.contenedores.medida].filter(Boolean).join(" · ")
      : "",
  };
}

/** Los incidentes, lo más nuevo primero (el orden de la bandeja lo pone bandeja.mjs). */
export async function listarIncidentes() {
  if (!haySupabaseNavegador()) return incidentesDemo();

  const { data, error } = await supabaseNavegador()
    .from("incidentes")
    .select(CAMPOS)
    .order("creado", { ascending: false })
    .limit(LIMITE);

  if (error) {
    console.error("[incidentes] No se pudieron leer:", error.message);
    return { error: "No se pudieron leer los incidentes. Recarga la página." };
  }
  return (data || []).map(aFormatoPantalla);
}

/**
 * Enlace temporal a la foto (cubeta privada `incidentes`). Se pide al abrir
 * el incidente y no al cargar la lista: con 200 incidentes serían 200 firmas
 * a Storage para fotos que nadie iba a mirar.
 */
export async function enlaceFotoIncidente(incidente) {
  if (!incidente?.foto) return null;
  if (!haySupabaseNavegador()) return incidente.foto; // en el prototipo es una imagen de /public
  return enlaceTemporal("incidentes", incidente.foto);
}

/* ------------------------------------------------------------------ */
/* Modo prototipo (sin Supabase)                                       */
/* ------------------------------------------------------------------ */

/**
 * Ejemplos con las horas relativas a AHORA, para que la bandeja se vea como
 * se vería un día normal. Uno de cada caso que la pantalla tiene que saber
 * pintar: accidente sin atender, retraso con ruta (para el botón de avisar),
 * foto, ubicación, y uno ya atendido con su nota.
 */
function incidentesDemo() {
  const hace = (min) => new Date(Date.now() - min * 60 * 1000).toISOString();
  return [
    {
      id: "demo-inc-1", tipo: "retraso", descripcion: "Tráfico detenido en la Av. Pedro Cárdenas por un tráiler descompuesto.",
      retrasoMin: 45, foto: null, ubicacion: { lat: 25.8513, lng: -97.5112 }, estado: "abierto", creado: hace(25),
      atendidoEn: null, atendio: "", notaAtencion: "", chofer: "José Medina", unidad: "U-07",
      ruta: { id: "RT-NORTE", clave: "RT-NORTE", nombre: "Ruta Norte" }, folio: "", cliente: "", parada: "", contenedor: "",
    },
    {
      id: "demo-inc-2", tipo: "accidente", descripcion: "Golpe leve con la defensa de un auto al salir de la planta. Sin heridos; esperando al seguro.",
      retrasoMin: null, foto: null, ubicacion: { lat: 25.858, lng: -97.452 }, estado: "abierto", creado: hace(190),
      atendidoEn: null, atendio: "", notaAtencion: "", chofer: "Alberto Cruz", telefonoChofer: "868 100 2233", unidad: "U-03",
      ruta: { id: "RT-INDUSTRIAL", clave: "RT-INDUSTRIAL", nombre: "Ruta Industrial" },
      folio: "REC-2026-0142", cliente: "Industrias del Golfo, S.A. de C.V.", parada: "Planta 1 · Av. Industrial 220 · Parque Industrial", contenedor: "",
    },
    {
      id: "demo-inc-3", tipo: "contenedor-danado", descripcion: "La tapa viene rota y una rueda no gira.",
      retrasoMin: null, foto: "/img/cont-naranja.jpg", ubicacion: null, estado: "abierto", creado: hace(60 * 26),
      atendidoEn: null, atendio: "", notaAtencion: "", chofer: "José Medina", unidad: "U-07",
      ruta: { id: "RT-CENTRO", clave: "RT-CENTRO", nombre: "Ruta Centro" },
      folio: "REC-2026-0138", cliente: "Vidriera Matamoros", parada: "Matriz · Zona Centro", contenedor: "MOR-C-0031 · contenedor · 3 m³",
    },
    {
      id: "demo-inc-4", tipo: "falla-mecanica", descripcion: "Se prendió el testigo de temperatura. Lo llevé al taller de la calle 6.",
      retrasoMin: 120, foto: null, ubicacion: null, estado: "atendido", creado: hace(60 * 50),
      atendidoEn: hace(60 * 47), atendio: "Ing. Ramón Cázares", notaAtencion: "Se cambió el termostato; la ruta la terminó la U-05.",
      chofer: "Alberto Cruz", unidad: "U-03", ruta: { id: "RT-INDUSTRIAL", clave: "RT-INDUSTRIAL", nombre: "Ruta Industrial" },
      folio: "", cliente: "", parada: "", contenedor: "",
    },
  ];
}
