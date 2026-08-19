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
  en_cobertura, rutas_que_cubren, estado, notas, creado
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
    creado: f.creado,
  };
}

export async function listarAltas() {
  if (!haySupabaseNavegador()) return [];

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
