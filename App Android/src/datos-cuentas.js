import { supabase, haySupabase } from "./supabase";
import { postAdmin } from "./api-admin";

export * from "./cuentas-admin.js";

/**
 * CUENTAS Y CATÁLOGO DE LA ADMINISTRACIÓN (6-oct-2026, paridad con la web).
 *
 * Altas de clientes, Clientes, Usuarios y roles, Puntos, Zonas pedidas y
 * Unidades. Dos clases de llamadas, como en todo el panel:
 *
 *  · LEER va directo a Supabase con la sesión del admin: el RLS decide qué
 *    ve (las mismas consultas que `Web/lib/datos-*.js`).
 *  · ESCRIBIR va SIEMPRE por la web (`postAdmin` → `/api/app/...`): ahí se
 *    exige rol y segundo paso, se cuentan las filas, se escribe la bitácora y
 *    salen los correos — el MISMO código que usa el panel web. Crear una
 *    cuenta o firmar un enlace necesita la llave de servicio, que no puede
 *    vivir en un teléfono.
 *
 * Todas las escrituras devuelven el `{ ok, motivo, segundoPaso? }` del
 * servidor y nunca lanzan. Con `segundoPaso: true` la pantalla manda a
 * escribir el código otra vez (`piezas-cuentas.js`).
 *
 * Este archivo es IDÉNTICO en las dos apps salvo la línea de `export *`
 * (en iOS los módulos puros son `.mjs`; aquí, en Android, `.js`).
 */

const DEMO = { ok: true, demo: true };

/** Mi id y mi rol (de la base), para decidir qué botones se pintan. */
export async function quienSoy() {
  if (!haySupabase()) return { id: "demo", rol: "dueno" };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("perfiles").select("id, rol, nombre").eq("id", user.id).maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

/* ============================== ALTAS =============================== */

const CAMPOS_ALTA = `
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
  contenido_huella, pdf_ruta,
  correo_confirmado, correo_confirmado_en, correo_confirmado_por
`;

function altaAPantalla(f) {
  return {
    id: f.id,
    folio: f.folio,
    empresa: f.empresa,
    contacto: f.contacto || "",
    telefono: f.telefono || "",
    correo: f.correo || "",
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
    origen: f.origen || "formulario",
    creado: f.creado,
    representanteNombre: f.representante_nombre || "",
    representanteCargo: f.representante_cargo || "",
    facturacionNombre: f.facturacion_nombre || "",
    facturacionCorreo: f.facturacion_correo || "",
    facturacionTelefono: f.facturacion_telefono || "",
    horarioAcceso: f.horario_acceso || "",
    tieneConstancia: Boolean(f.constancia_ruta),
    tienePdf: Boolean(f.pdf_ruta),
    firmada: Boolean(f.firmado_en),
    firmadoEn: f.firmado_en || null,
    firmanteNombre: f.firmante_nombre || "",
    firmanteCargo: f.firmante_cargo || "",
    firmaIp: f.firma_ip || "",
    terminosVersion: f.terminos_version || "",
    contenidoHuella: f.contenido_huella || "",
    correoConfirmado: Boolean(f.correo_confirmado),
    correoConfirmadoEn: f.correo_confirmado_en || null,
    correoConfirmadoPor: f.correo_confirmado_por || null,
  };
}

/** Las solicitudes de alta, la más nueva primero. `null` si la base no contestó. */
export async function listarAltas() {
  if (!haySupabase()) return [];
  const { data, error } = await supabase
    .from("solicitudes_alta")
    .select(CAMPOS_ALTA)
    .order("creado", { ascending: false });
  if (error) return null;
  return (data || []).map(altaAPantalla);
}

export const cambiarEstadoAlta = (solicitudId, estado) =>
  haySupabase() ? postAdmin("altas/estado", { solicitudId, estado }) : Promise.resolve(DEMO);

/** Activa la cuenta de quien se registró con Google. Devuelve la contraseña UNA vez. */
export const activarAlta = (solicitudId) =>
  haySupabase() ? postAdmin("altas/activar", { solicitudId }) : Promise.resolve(DEMO);

/** Enlaces firmados (5 min) al PDF firmado y a la constancia. */
export const archivosAlta = (solicitudId) =>
  haySupabase() ? postAdmin("altas/archivos", { solicitudId }) : Promise.resolve(DEMO);

/* ============================= CLIENTES ============================= */

/**
 * Clientes con lo que necesita la pantalla del panel: si ya tienen acceso
 * (algún perfil ligado), sus sectores (por sus puntos) y su saldo. Las
 * mismas cuatro consultas que `listarClientes()` de la web, juntas.
 * `null` si la base no contestó.
 */
export async function listarClientesAdmin() {
  if (!haySupabase()) return [];
  const [{ data: clientes, error }, { data: saldos }, { data: conAcceso }, { data: puntosConSector }] = await Promise.all([
    supabase.from("clientes").select("id, folio, empresa, contacto, correo, telefono, plan, estado, desde, es_prueba").order("empresa"),
    supabase.from("saldos_clientes").select("cliente_id, saldo, cargos"),
    supabase.from("perfiles").select("cliente_id").not("cliente_id", "is", null),
    supabase.from("domicilios").select("cliente_id, sectores ( clave, nombre, color )").not("sector_id", "is", null),
  ]);
  if (error) return null;

  const porId = Object.fromEntries((saldos || []).map((s) => [s.cliente_id, s]));
  const conAccesoIds = new Set((conAcceso || []).map((p) => p.cliente_id));
  const sectoresPorCliente = {};
  for (const d of puntosConSector || []) {
    if (!d.sectores) continue;
    (sectoresPorCliente[d.cliente_id] ||= new Map()).set(d.sectores.clave, d.sectores);
  }
  return (clientes || []).map((c) => clienteAPantalla(c, {
    saldo: porId[c.id],
    tieneAcceso: conAccesoIds.has(c.id),
    sectores: [...(sectoresPorCliente[c.id]?.values() || [])].sort((a, b) => String(a.clave).localeCompare(String(b.clave))),
  }));
}

function clienteAPantalla(c, { saldo, tieneAcceso = false, sectores = [] } = {}) {
  return {
    id: c.folio,
    uuid: c.id ?? c.uuid,
    empresa: c.empresa,
    contacto: c.contacto || "",
    correo: c.correo || "",
    telefono: c.telefono || "",
    plan: c.plan || "Sin plan",
    estatus: c.estado,
    desde: c.desde,
    saldo: Number(saldo?.saldo ?? 0),
    porPagar: Number(saldo?.cargos ?? 0),
    tieneAcceso,
    // Cuenta de revisión de Apple/Google (db/027): se ve con etiqueta.
    esPrueba: c.es_prueba === true,
    sectores,
  };
}

/** "Nuevo cliente": sólo el expediente. Devuelve el cliente ya en formato de pantalla. */
export async function crearCliente(form) {
  if (!haySupabase()) return DEMO;
  const r = await postAdmin("clientes/crear", form);
  if (!r.ok) return r;
  return { ok: true, cliente: clienteAPantalla(r.cliente) };
}

/** "Dar acceso": el servidor le manda al cliente el correo para escoger su contraseña. */
export const darAccesoCliente = (clienteId) =>
  haySupabase() ? postAdmin("clientes/dar-acceso", { clienteId }) : Promise.resolve(DEMO);

/** Los sectores (A–D) en orden de clave. */
export async function listarSectores() {
  if (!haySupabase()) return [];
  const { data, error } = await supabase.from("sectores").select("id, clave, nombre, color, activo").order("clave");
  if (error) return [];
  return (data || []).map((s) => ({ id: s.id, clave: s.clave, nombre: s.nombre, color: s.color || "#2a6a99", activo: s.activo !== false }));
}

/* ============================== EQUIPO ============================== */

/**
 * El personal: dueño, administradores y choferes. `pendiente` NO va (son los
 * registrados con Google, que se trabajan en Altas). `null` si no contestó.
 */
export async function listarEquipo() {
  if (!haySupabase()) return [];
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, activo, creado, telefono")
    .in("rol", ["dueno", "admin", "operador"])
    .order("creado");
  if (error) return null;
  return (data || []).map((p) => ({
    id: p.id,
    rol: p.rol,
    nombre: p.nombre || "Sin nombre",
    // El correo vive en auth.users, que la app no puede leer: va el teléfono.
    telefono: p.telefono || "",
    activo: Boolean(p.activo),
    desde: (p.creado || "").slice(0, 10),
  }));
}

export const invitarUsuario = ({ nombre, correo, rol }) =>
  haySupabase() ? postAdmin("usuarios/invitar", { nombre, correo, rol }) : Promise.resolve(DEMO);

export const cambiarActivoUsuario = (id, activo) =>
  haySupabase() ? postAdmin("usuarios/activo", { id, activo: Boolean(activo) }) : Promise.resolve(DEMO);

/* ============================== PUNTOS ============================== */

function rutaDeSuscripcion(subs) {
  const s = Array.isArray(subs) ? subs[0] : subs;
  if (!s) return null;
  return {
    clave: s.rutas?.clave || null,
    nombre: s.rutas?.nombre || "",
    serviciosPorMes: s.servicios_por_mes ?? 4,
    porLlamada: Boolean(s.por_llamada),
  };
}

/** Los puntos de recolección con su empresa, su sector y su ruta. `null` si no contestó. */
export async function listarPuntos() {
  if (!haySupabase()) return [];
  const { data, error } = await supabase
    .from("domicilios")
    .select(
      "id, cliente_id, alias, calle, colonia, cp, lat, lng, sector_id, referencias, " +
      "ubicacion_origen, ubicacion_fecha, clientes ( folio, empresa ), " +
      "suscripciones ( servicios_por_mes, por_llamada, rutas ( clave, nombre ) )"
    )
    .order("alias");
  if (error) return null;
  return (data || [])
    .map((f) => ({
      id: f.id,
      clienteId: f.cliente_id,
      clienteFolio: f.clientes?.folio || "",
      empresa: f.clientes?.empresa || "—",
      alias: f.alias || "",
      calle: f.calle || "",
      colonia: f.colonia || "",
      cp: f.cp || "",
      lat: f.lat,
      lng: f.lng,
      sectorId: f.sector_id || null,
      referencias: f.referencias || "",
      origen: f.ubicacion_origen || null,
      fecha: f.ubicacion_fecha || null,
      ruta: rutaDeSuscripcion(f.suscripciones),
    }))
    .sort((a, b) => a.empresa.localeCompare(b.empresa, "es") || a.alias.localeCompare(b.alias, "es"));
}

/** Las rutas, para asignarle una al punto: clave, nombre, días, chofer. */
export async function listarRutasParaPuntos() {
  if (!haySupabase()) return [];
  const { data, error } = await supabase.from("rutas").select("clave, nombre, dias, chofer, activa").order("clave");
  if (error) return [];
  return (data || []).map((r) => ({ id: r.clave, nombre: r.nombre, dias: r.dias || [], chofer: r.chofer || "", activa: r.activa !== false }));
}

/** Guarda pin y/o referencias. `pin` = [lat, lng]; confirmar = mandar el mismo pin. */
export const guardarPunto = (puntoId, { pin, referencias } = {}) =>
  haySupabase() ? postAdmin("puntos/guardar", { puntoId, pin, referencias }) : Promise.resolve(DEMO);

export const asignarRutaAPunto = ({ domicilioId, rutaClave, serviciosPorMes, porLlamada }) =>
  haySupabase()
    ? postAdmin("puntos/ruta", { domicilioId, rutaClave: rutaClave || null, serviciosPorMes: Number(serviciosPorMes), porLlamada: Boolean(porLlamada) })
    : Promise.resolve(DEMO);

/* =========================== SOLICITUDES ============================ */

/** Crea de verdad la empresa, el acceso y el perfil desde una cotización ganada. */
export const activarCuentaCotizacion = (datos) =>
  haySupabase() ? postAdmin("solicitudes/activar", datos) : Promise.resolve({ ...DEMO, password: "Demo1234" });

/** ¿Ya hay una cuenta con este correo? (para no ofrecer activar dos veces) */
export const existeCuenta = (correo) =>
  haySupabase() ? postAdmin("solicitudes/existe-cuenta", { correo }) : Promise.resolve({ ok: true, existe: false });

/* ========================== ZONAS PEDIDAS =========================== */

/** Quien quedó fuera de cobertura y dejó su contacto. `null` si no contestó. */
export async function listarZonasPedidas() {
  if (!haySupabase()) return [];
  const { data, error } = await supabase
    .from("zonas_pedidas")
    .select("id, clave, nombre_contacto, empresa, telefono, correo, colonia, lat, lng, volumen_estimado, estado, fecha")
    .order("fecha", { ascending: false });
  if (error) return null;
  return (data || []).map((z) => ({
    id: z.id,
    clave: z.clave,
    nombreContacto: z.nombre_contacto || "",
    empresa: z.empresa || "",
    telefono: z.telefono || "",
    correo: z.correo || "",
    colonia: z.colonia || "",
    lat: z.lat,
    lng: z.lng,
    volumenEstimado: z.volumen_estimado || "",
    estado: z.estado,
    fecha: z.fecha,
  }));
}

export const cambiarEstadoZona = (id, estado) =>
  haySupabase() ? postAdmin("zonas/estado", { id, estado }) : Promise.resolve(DEMO);

/* ============================= UNIDADES ============================= */

/** Las unidades (camiones) con las rutas que usa cada una. `null` si no contestó. */
export async function listarUnidades() {
  if (!haySupabase()) return [];
  const [{ data, error }, { data: rutas }] = await Promise.all([
    supabase
      .from("unidades")
      .select("id, numero_economico, placas, tipo, marca_modelo, anio, estado, vence_seguro, vence_verificacion, notas")
      .order("numero_economico"),
    supabase.from("rutas").select("nombre, unidad_id").not("unidad_id", "is", null),
  ]);
  if (error) return null;
  const usos = {};
  for (const r of rutas || []) (usos[r.unidad_id] ||= []).push(r.nombre);
  return (data || []).map((u) => ({ ...u, rutas: usos[u.id] || [] }));
}

export const cambiarEstadoUnidad = (id, estado) =>
  haySupabase() ? postAdmin("unidades/estado", { id, estado }) : Promise.resolve(DEMO);
