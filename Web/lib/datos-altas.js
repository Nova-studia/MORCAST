import { supabaseNavegador, haySupabaseNavegador } from "./supabase-navegador";

/**
 * Las solicitudes de alta que llegan desde /portal/alta.
 *
 * Se leen con la sesión del usuario: el RLS solo se las entrega al personal.
 * Si un cliente llegara a /admin/altas escribiendo la dirección, la consulta
 * le devuelve cero filas.
 */

const CAMPOS = `
  id, folio, empresa, contacto, telefono, correo,
  alias, calle, colonia, cp, referencias, lat, lng,
  residuos, equipo, servicios_por_mes,
  razon_social, rfc, domicilio_fiscal, uso_cfdi, forma_pago,
  en_cobertura, rutas_que_cubren, estado, notas, creado,
  origen, usuario_id,
  representante_nombre, representante_cargo,
  facturacion_nombre, facturacion_correo, facturacion_telefono,
  horario_acceso, constancia_ruta,
  firmado_en, firmante_nombre, firmante_cargo, firma_ip, terminos_version,
  contenido_huella, pdf_ruta, pdf_huella,
  correo_confirmado, correo_confirmado_en, correo_confirmado_por
`;

function aPantalla(f) {
  return {
    id: f.id,
    folio: f.folio,
    empresa: f.empresa,
    contacto: f.contacto,
    telefono: f.telefono,
    correo: f.correo,
    alias: f.alias || "",
    calle: f.calle || "",
    colonia: f.colonia || "",
    cp: f.cp || "",
    referencias: f.referencias || "",
    lat: f.lat,
    lng: f.lng,
    residuos: f.residuos || [],
    equipo: f.equipo || [],
    serviciosPorMes: f.servicios_por_mes,
    razonSocial: f.razon_social || "",
    rfc: f.rfc || "",
    domicilioFiscal: f.domicilio_fiscal || "",
    usoCFDI: f.uso_cfdi || "",
    formaPago: f.forma_pago || "",
    enCobertura: f.en_cobertura,
    rutasQueCubren: f.rutas_que_cubren || [],
    estado: f.estado,
    notas: f.notas || "",
    origen: f.origen || "formulario",
    usuarioId: f.usuario_id || null,
    creado: f.creado,
    // Alta amplia y firma electrónica (db/025). Las altas de antes de la
    // firma traen todo esto vacío y el panel las enseña como "Sin firma".
    representanteNombre: f.representante_nombre || "",
    representanteCargo: f.representante_cargo || "",
    facturacionNombre: f.facturacion_nombre || "",
    facturacionCorreo: f.facturacion_correo || "",
    facturacionTelefono: f.facturacion_telefono || "",
    horarioAcceso: f.horario_acceso || "",
    tieneConstancia: Boolean(f.constancia_ruta),
    firmada: Boolean(f.firmado_en),
    firmadoEn: f.firmado_en || null,
    firmanteNombre: f.firmante_nombre || "",
    firmanteCargo: f.firmante_cargo || "",
    firmaIp: f.firma_ip || "",
    terminosVersion: f.terminos_version || "",
    contenidoHuella: f.contenido_huella || "",
    tienePdf: Boolean(f.pdf_ruta),
    pdfHuella: f.pdf_huella || "",
    correoConfirmado: Boolean(f.correo_confirmado),
    correoConfirmadoEn: f.correo_confirmado_en || null,
    correoConfirmadoPor: f.correo_confirmado_por || null,
  };
}

/**
 * Altas de MUESTRA para el modo prototipo (sin Supabase), como las demás
 * pantallas del panel: así se ve cómo lucen una firmada por confirmar, una
 * de Google (confirmada desde el inicio) y una de antes de la firma.
 */
function altasDemo() {
  const hace = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
  const base = {
    residuos: ["Residuos de Manejo Especial"], equipo: [{ tipo: "Tolvas", medida: "30", cantidad: 1 }],
    usoCFDI: "G03 — Gastos en general", formaPago: "Transferencia", notas: "", usuarioId: null,
    lat: 25.8722, lng: -97.5041, enCobertura: true, rutasQueCubren: ["RT-NORTE"], referencias: "",
    representanteNombre: "", representanteCargo: "", facturacionNombre: "", facturacionCorreo: "",
    facturacionTelefono: "", horarioAcceso: "", tieneConstancia: false, firmada: false, firmadoEn: null,
    firmanteNombre: "", firmanteCargo: "", firmaIp: "", terminosVersion: "", contenidoHuella: "",
    tienePdf: false, pdfHuella: "", correoConfirmado: false, correoConfirmadoEn: null, correoConfirmadoPor: null,
  };
  return [
    {
      ...base, id: "demo-alta-1", folio: "ALTA-2026-7KQM", creado: hace(2), estado: "nueva", origen: "formulario",
      empresa: "Industrias del Golfo", contacto: "Ana Pérez", telefono: "868 384 9478", correo: "ana@golfo.mx",
      alias: "Planta 1", calle: "Av. Industrial 100", colonia: "Parque Industrial", cp: "87499",
      serviciosPorMes: 8, razonSocial: "Industrias del Golfo, S.A. de C.V.", rfc: "IGO010101AB1",
      domicilioFiscal: "Av. Industrial 100, Matamoros",
      representanteNombre: "Luis Gómez", representanteCargo: "Apoderado legal",
      facturacionNombre: "Cuentas por pagar", facturacionCorreo: "cxp@golfo.mx", facturacionTelefono: "868 111 2222",
      horarioAcceso: "L-V 8:00 a 17:00, portón 3", tieneConstancia: true,
      firmada: true, firmadoEn: hace(2), firmanteNombre: "Ana Pérez López", firmanteCargo: "Gerente de planta",
      firmaIp: "201.150.10.20", terminosVersion: "2026-10-v1-borrador",
      contenidoHuella: "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881",
      tienePdf: true, pdfHuella: "9b1c0e6f3a2d47c8b5e4f7a6d3c2b1a09f8e7d6c5b4a3928170f6e5d4c3b2a19",
    },
    {
      ...base, id: "demo-alta-2", folio: "REG-2026-H3TW", creado: hace(26), estado: "contactada", origen: "google",
      empresa: "Maquiladora Río Bravo", contacto: "Jorge Salinas", telefono: "868 222 3344", correo: "jorge@riobravo.mx",
      alias: "Nave 2", calle: "Calle Acero 45", colonia: "Ciudad Industrial", cp: "87493",
      serviciosPorMes: 12, razonSocial: "Maquiladora Río Bravo, S. de R.L. de C.V.", rfc: "MRB0505051Z3",
      domicilioFiscal: "Calle Acero 45, Matamoros", enCobertura: false, rutasQueCubren: [],
      firmada: true, firmadoEn: hace(26), firmanteNombre: "Jorge Salinas Treviño", firmanteCargo: "Compras",
      firmaIp: "189.203.4.11", terminosVersion: "2026-10-v1-borrador",
      contenidoHuella: "77c0a1e2b3d4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8",
      tienePdf: true, pdfHuella: "1f2e3d4c5b6a79880f1e2d3c4b5a69788f9e0d1c2b3a49586f7e8d9c0b1a2938",
      correoConfirmado: true, correoConfirmadoEn: hace(26), correoConfirmadoPor: "google",
    },
    {
      ...base, id: "demo-alta-3", folio: "ALTA-2026-2B9X", creado: hace(24 * 9), estado: "aprobada", origen: "formulario",
      empresa: "Taller Hernández", contacto: "Rosa Hernández", telefono: "868 555 0101", correo: "rosa@tallerh.mx",
      alias: "Matriz", calle: "Calle 6 #210", colonia: "Zona Centro", cp: "87300",
      serviciosPorMes: 4, razonSocial: "Rosa Hernández Cantú", rfc: "HECR800101AB2", domicilioFiscal: "Calle 6 #210",
    },
  ];
}

export async function listarAltas() {
  if (!haySupabaseNavegador()) return altasDemo();

  const { data, error } = await supabaseNavegador()
    .from("solicitudes_alta")
    .select(CAMPOS)
    .order("creado", { ascending: false });

  if (error) {
    console.error("[altas] no se pudieron leer:", error.message);
    return [];
  }
  return (data || []).map(aPantalla);
}

/**
 * Cambia el estado de una solicitud de alta.
 *
 * Se cuentan las filas devueltas: un UPDATE que el RLS bloquea no da error,
 * actualiza cero y responde que todo bien. Sin esta cuenta, la pantalla diría
 * "aprobada" sobre algo que nunca cambió.
 */
export async function cambiarEstadoAlta(id, estado) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { data, error } = await supabaseNavegador()
    .from("solicitudes_alta")
    .update({ estado })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return { ok: false, motivo: "No se cambió nada: el permiso de la base no te deja tocar esa solicitud." };
  }
  return { ok: true };
}
