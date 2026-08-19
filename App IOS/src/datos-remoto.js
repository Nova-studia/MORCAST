import { File } from "expo-file-system";
import { supabase, haySupabase } from "./supabase";
import { RUTAS_SEED, nombreTipoRuta } from "./rutas-datos";

/**
 * Consultas de la app contra Supabase.
 *
 * Es el espejo de lo que la web tiene repartido en `lib/datos-*.js`. Como
 * allá, aquí NO hay reglas de seguridad: quién ve qué lo decide el RLS dentro
 * de Postgres, y por eso las mismas funciones sirven para los tres modos.
 *
 * Cuando no hay llaves configuradas, cada función devuelve los datos de
 * ejemplo para que la app siga navegable.
 */

/** Fecha de hoy en YYYY-MM-DD con la hora LOCAL, no en UTC. */
export function hoyISO() {
  const f = new Date();
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return `${f.getFullYear()}-${mes}-${dia}`;
}

const soloHora = (t) => (t ? new Date(t).toTimeString().slice(0, 5) : "—");

/* ==================================================================== */
/* RUTAS Y COBERTURA                                                    */
/* ==================================================================== */

export async function listarRutas() {
  if (!haySupabase()) return RUTAS_SEED;

  const { data, error } = await supabase
    .from("rutas")
    .select("id, clave, nombre, tipo, dias, unidad, chofer, cupo, activa, zona")
    .order("clave");

  if (error) return [];
  return (data || []).map((r) => ({
    id: r.clave,
    uuid: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    dias: r.dias || [],
    unidad: r.unidad || "",
    chofer: r.chofer || "",
    cupo: r.cupo ?? 10,
    activa: r.activa,
    zona: Array.isArray(r.zona) ? r.zona : [],
  }));
}

/* ==================================================================== */
/* AGENDAR RECOLECCIÓN                                                  */
/* ==================================================================== */

export async function miSuscripcion() {
  if (!haySupabase()) return null;

  const { data } = await supabase
    .from("suscripciones")
    .select("id, frecuencia, estado, domicilios ( alias, colonia ), rutas ( clave, nombre, tipo, dias )")
    .eq("estado", "activa")
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    frecuencia: data.frecuencia,
    domicilio: data.domicilios
      ? `${data.domicilios.alias} · ${data.domicilios.colonia || ""}`.trim()
      : "",
    ruta: data.rutas
      ? { clave: data.rutas.clave, nombre: data.rutas.nombre, tipo: data.rutas.tipo, dias: data.rutas.dias || [] }
      : null,
  };
}

export async function misSolicitudes() {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .select("id, folio, origen, fecha_pedida, fecha_confirmada, estado, nota, rutas ( nombre )")
    .order("fecha_pedida", { ascending: false });

  if (error) return [];
  return (data || []).map((s) => ({
    id: s.id,
    folio: s.folio,
    origen: s.origen,
    fechaPedida: s.fecha_pedida,
    fechaConfirmada: s.fecha_confirmada,
    estado: s.estado,
    nota: s.nota || "",
    rutaNombre: s.rutas?.nombre || "Sin ruta",
  }));
}

/**
 * El cliente pide recolección. No manda ni su empresa ni el estado: la
 * empresa sale de su sesión y el estado nace en "solicitada". El RLS lo
 * obliga aunque se manipule la llamada.
 */
export async function pedirRecoleccion({ rutaClave, fecha, nota, origen = "ruta" }) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "No hay sesión." };

  const { data: perfil } = await supabase
    .from("perfiles").select("cliente_id").eq("id", user.id).single();
  if (!perfil?.cliente_id) return { ok: false, motivo: "Tu cuenta no tiene empresa asignada." };

  const { data: dom } = await supabase
    .from("domicilios").select("id").eq("cliente_id", perfil.cliente_id).limit(1).maybeSingle();

  let rutaId = null;
  if (rutaClave) {
    const { data: r } = await supabase.from("rutas").select("id").eq("clave", rutaClave).maybeSingle();
    rutaId = r?.id || null;
  }

  // El folio se calcula del más alto que exista, nunca contando filas: si
  // alguna se borró, contar daría un folio repetido y el folio es único.
  const año = new Date().getFullYear();
  const { data: ultimos } = await supabase
    .from("solicitudes_recoleccion")
    .select("folio").like("folio", `REC-${año}-%`)
    .order("folio", { ascending: false }).limit(1);
  const n = ultimos?.[0]?.folio ? Number(String(ultimos[0].folio).split("-").pop()) : 0;
  const folio = `REC-${año}-${String((Number.isFinite(n) ? n : 0) + 1).padStart(4, "0")}`;

  const { error } = await supabase.from("solicitudes_recoleccion").insert({
    folio,
    cliente_id: perfil.cliente_id,
    domicilio_id: dom?.id || null,
    ruta_id: rutaId,
    origen,
    fecha_pedida: fecha,
    estado: "solicitada",
    nota: nota || "",
  });

  return error ? { ok: false, motivo: error.message } : { ok: true, folio };
}

/* ==================================================================== */
/* SALDO                                                                */
/* ==================================================================== */

export async function miSaldo() {
  if (!haySupabase()) return null;

  const { data } = await supabase
    .from("saldos_clientes").select("saldo, cargos, por_verificar").limit(1).maybeSingle();

  if (!data) return null;
  return {
    saldoActual: Number(data.saldo),
    porPagar: Number(data.cargos),
    porVerificar: Number(data.por_verificar),
  };
}

export async function misMovimientos() {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("movimientos_saldo")
    .select("id, folio, fecha, concepto, tipo, monto, estado, banco, referencia, comprobante_nombre")
    .order("fecha", { ascending: false });

  if (error) return [];
  return (data || []).map((m) => ({
    id: m.id,
    folio: m.folio || "",
    fecha: m.fecha,
    concepto: m.concepto,
    tipo: m.tipo,
    monto: Number(m.monto),
    estado: m.estado,
    banco: m.banco || "",
    referencia: m.referencia || "",
    comprobanteNombre: m.comprobante_nombre || "",
  }));
}

/** El cliente reporta un depósito. Nace "por-verificar": nadie se sube el saldo solo. */
export async function reportarDeposito({ monto, banco, referencia, comprobanteNombre }) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "No hay sesión." };

  const { data: perfil } = await supabase
    .from("perfiles").select("cliente_id").eq("id", user.id).single();
  if (!perfil?.cliente_id) return { ok: false, motivo: "Tu cuenta no tiene empresa asignada." };

  const { error } = await supabase.from("movimientos_saldo").insert({
    cliente_id: perfil.cliente_id,
    tipo: "abono",
    concepto: `Depósito reportado${banco ? ` — ${banco}` : ""}`,
    monto: Number(monto),
    estado: "por-verificar",
    banco: banco || null,
    referencia: referencia || null,
    comprobante_nombre: comprobanteNombre || null,
  });

  return error ? { ok: false, motivo: error.message } : { ok: true };
}

/* ==================================================================== */
/* HISTORIAL DE SERVICIOS (con evidencia)                               */
/* ==================================================================== */

/** Enlace temporal a una foto privada. Caduca: no es una dirección que se reenvíe. */
export async function enlaceEvidencia(ruta) {
  if (!haySupabase() || !ruta) return null;
  const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(ruta, 3600);
  return error ? null : data?.signedUrl || null;
}

/** Cómo se llama cada estado de la base en las pantallas de la app. */
const ESTATUS_PANTALLA = {
  solicitada: "programado",
  confirmada: "programado",
  "en-ruta": "en-ruta",
  completada: "completado",
};

export async function misServicios() {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .select(`
      id, folio, fecha_pedida, fecha_confirmada, origen, estado,
      rutas ( nombre, tipo, unidad, chofer ),
      recolecciones ( qr, peso_kg, foto_antes, foto_despues, hora_antes, hora_despues )
    `)
    // Antes esto pedía SOLO las completadas, y la pantalla de Inicio filtra
    // "las que no están completadas" para armar Próximos servicios: con esa
    // consulta ese bloque no podía mostrar nada nunca, y los filtros
    // "Programados" y "En ruta" del Historial tampoco. Se traen todas menos
    // las rechazadas, que para el cliente no son un servicio.
    .neq("estado", "rechazada")
    .order("fecha_confirmada", { ascending: false, nullsFirst: false });

  if (error) return [];

  return Promise.all(
    (data || []).map(async (s) => {
      const ev = s.recolecciones?.[0] || null;
      const [urlAntes, urlDespues] = ev
        ? await Promise.all([enlaceEvidencia(ev.foto_antes), enlaceEvidencia(ev.foto_despues)])
        : [null, null];

      return {
        folio: s.folio,
        fecha: s.fecha_confirmada || s.fecha_pedida,
        tipo: nombreTipoRuta(s.rutas?.tipo) || "Recolección",
        residuo: s.origen === "extra" ? "Recolección extra" : "Residuos de ruta",
        contenedor: ev?.qr ? `Contenedor ${ev.qr}` : "—",
        volumen: "—",
        peso: ev?.peso_kg ? `${ev.peso_kg} kg` : "—",
        unidad: s.rutas?.unidad || "—",
        operador: s.rutas?.chofer || "—",
        // El estado sale de la base, no fijo: si no, todo se pintaría como
        // completado aunque apenas estuviera programado.
        estatus: ESTATUS_PANTALLA[s.estado] || s.estado,
        manifiesto: `MAN-${s.folio.replace("REC-", "")}`,
        evidencia: ev
          ? {
              contenedor: ev.qr ? `Contenedor ${ev.qr}` : "—",
              gps: "Registrado en la recolección",
              antes: { hora: soloHora(ev.hora_antes), etiqueta: "Contenedor lleno", url: urlAntes },
              despues: {
                hora: soloHora(ev.hora_despues),
                etiqueta: "Contenedor vacío",
                peso: ev.peso_kg ? `${ev.peso_kg} kg` : "—",
                firma: s.rutas?.chofer || "—",
                url: urlDespues,
              },
            }
          : null,
      };
    })
  );
}

/* ==================================================================== */
/* MODO CHOFER                                                          */
/* ==================================================================== */

export async function rutaDelDia(fecha = hoyISO()) {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .select(`
      id, folio, estado, fecha_pedida, fecha_confirmada, nota,
      clientes ( empresa ),
      domicilios ( alias, calle, colonia ),
      rutas ( nombre, unidad ),
      recolecciones ( id, qr, peso_kg )
    `)
    .in("estado", ["confirmada", "en-ruta", "completada"])
    .or(`fecha_confirmada.eq.${fecha},and(fecha_confirmada.is.null,fecha_pedida.eq.${fecha})`)
    .order("folio");

  if (error) return [];

  return (data || []).map((s) => {
    const ev = s.recolecciones?.[0] || null;
    return {
      id: s.id,
      folio: s.folio,
      cliente: s.clientes?.empresa || "—",
      direccion: s.domicilios
        ? [s.domicilios.alias, s.domicilios.calle, s.domicilios.colonia].filter(Boolean).join(" · ")
        : "Sin domicilio registrado",
      unidad: s.rutas?.unidad || "Sin unidad",
      nota: s.nota || "",
      estatus: s.estado === "completada" && ev ? "completado" : "pendiente",
      evidencia: ev,
    };
  });
}

/**
 * Cambia el estado de una parada comprobando que DE VERDAD haya cambiado.
 *
 * ⚠️ Un UPDATE bloqueado por RLS NO da error: no encuentra ninguna fila que
 * le toque al usuario, actualiza cero y responde que todo bien. Sin contar
 * las filas devueltas, la app creería que cerró un servicio que sigue abierto.
 */
async function cambiarEstadoParada(solicitudId, estado) {
  const { data, error } = await supabase
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

export async function marcarEnRuta(solicitudId) {
  if (!haySupabase()) return { ok: true, demo: true };
  return cambiarEstadoParada(solicitudId, "en-ruta");
}

/**
 * Sube una foto de evidencia.
 *
 * ⚠️ En React Native NO sirve pasarle a Supabase lo que devuelve el selector
 * de imágenes, ni un `fetch(uri).arrayBuffer()`: las dos formas suben un
 * archivo de 0 BYTES **sin dar ningún error**. El chofer vería "listo" y la
 * foto no existiría — la peor forma de fallar que hay.
 *
 * Lo que sí funciona es leer el archivo del disco como bytes, que es lo que
 * hace `File(...).bytes()` de expo-file-system.
 */
export async function subirEvidencia(solicitudId, momento, uri, tipoMime = "image/jpeg") {
  if (!haySupabase()) return { ok: true, demo: true };

  const extension = (tipoMime.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const ruta = `${solicitudId}/${momento}-${Date.now()}.${extension}`;

  let binario;
  try {
    binario = await new File(uri).bytes();
  } catch (e) {
    return { ok: false, motivo: "No se pudo leer la foto del teléfono." };
  }

  // Si la lectura sale vacía se corta aquí: más vale decir que falló que
  // guardar una evidencia en blanco.
  if (!binario || binario.length === 0) {
    return { ok: false, motivo: "La foto salió vacía. Tómala de nuevo." };
  }

  const { error } = await supabase.storage
    .from("evidencias")
    .upload(ruta, binario, { contentType: tipoMime, upsert: false });

  return error ? { ok: false, motivo: error.message } : { ok: true, ruta };
}

/**
 * Cierra la recolección. El orden importa: primero las fotos, luego el
 * registro que las apunta, y al final el servicio como completado. Al revés,
 * un fallo a media subida dejaría un servicio "completado" sin evidencia.
 */
export async function cerrarRecoleccion({ solicitudId, qr, pesoKg, uriAntes, uriDespues }) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "No hay sesión." };

  let rutaAntes = null;
  let rutaDespues = null;

  if (uriAntes) {
    const r = await subirEvidencia(solicitudId, "antes", uriAntes);
    if (!r.ok) return { ok: false, motivo: "No se pudo subir la foto de antes." };
    rutaAntes = r.ruta;
  }
  if (uriDespues) {
    const r = await subirEvidencia(solicitudId, "despues", uriDespues);
    if (!r.ok) return { ok: false, motivo: "No se pudo subir la foto de después." };
    rutaDespues = r.ruta;
  }

  const { error } = await supabase.from("recolecciones").insert({
    solicitud_id: solicitudId,
    operador_id: user.id,
    qr: qr || null,
    peso_kg: pesoKg ? Number(pesoKg) : null,
    foto_antes: rutaAntes,
    foto_despues: rutaDespues,
    hora_antes: uriAntes ? new Date().toISOString() : null,
    hora_despues: uriDespues ? new Date().toISOString() : null,
  });

  if (error) return { ok: false, motivo: error.message };

  const cierre = await cambiarEstadoParada(solicitudId, "completada");
  if (!cierre.ok) {
    return {
      ok: false,
      motivo: "Se guardaron las fotos y el peso, pero no se pudo cerrar el servicio. Avisa a la oficina.",
    };
  }
  return { ok: true };
}

/* ==================================================================== */
/* MODO ADMINISTRACIÓN                                                  */
/* ==================================================================== */

export async function listarClientes() {
  if (!haySupabase()) return [];

  const [{ data: clientes, error }, { data: saldos }] = await Promise.all([
    supabase.from("clientes").select("id, folio, empresa, contacto, correo, telefono, plan, estado, desde").order("empresa"),
    supabase.from("saldos_clientes").select("cliente_id, saldo, cargos"),
  ]);

  if (error) return [];
  const porId = Object.fromEntries((saldos || []).map((s) => [s.cliente_id, s]));

  return (clientes || []).map((c) => ({
    id: c.folio,
    empresa: c.empresa,
    contacto: c.contacto || "—",
    correo: c.correo || "",
    telefono: c.telefono || "",
    plan: c.plan || "Sin plan",
    estatus: c.estado,
    desde: c.desde,
    saldo: Number(porId[c.id]?.saldo ?? 0),
    porPagar: Number(porId[c.id]?.cargos ?? 0),
  }));
}

export async function listarCotizaciones() {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, creado_en, nombre, empresa, telefono, correo, tipo_servicio, frecuencia, direccion, mensaje, estado")
    .order("creado_en", { ascending: false });

  if (error) return [];
  return (data || []).map((c) => ({
    id: c.id,
    fecha: (c.creado_en || "").slice(0, 10),
    empresa: c.empresa || c.nombre || "Sin empresa",
    contacto: c.nombre || "",
    telefono: c.telefono || "",
    correo: c.correo || "",
    servicio: c.tipo_servicio || "",
    frecuencia: c.frecuencia || "",
    direccion: c.direccion || "",
    mensaje: c.mensaje || "",
    estado: c.estado || "nueva",
  }));
}

/** Solicitudes de recolección para la bandeja del admin. */
export async function listarSolicitudesRecoleccion() {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .select("id, folio, origen, fecha_pedida, fecha_confirmada, estado, nota, clientes ( empresa ), rutas ( nombre )")
    .order("fecha_pedida", { ascending: false });

  if (error) return [];
  return (data || []).map((s) => ({
    id: s.id,
    folio: s.folio,
    cliente: s.clientes?.empresa || "—",
    rutaNombre: s.rutas?.nombre || "Sin ruta",
    origen: s.origen,
    fechaPedida: s.fecha_pedida,
    fechaConfirmada: s.fecha_confirmada,
    estado: s.estado,
    nota: s.nota || "",
  }));
}

export async function confirmarSolicitud(s) {
  if (!haySupabase()) return { ok: true, demo: true };
  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .update({ estado: "confirmada", fecha_confirmada: s.fechaConfirmada || s.fechaPedida })
    .eq("id", s.id)
    .select("id");
  if (error) return { ok: false, motivo: error.message };
  return data?.length ? { ok: true } : { ok: false, motivo: "No se pudo confirmar." };
}

const ROLES_LEGIBLES = {
  dueno: "Dueño",
  admin: "Administrador",
  operador: "Chofer / Operador",
  cliente: "Cliente",
  pendiente: "Sin asignar",
};

/** Perfiles del personal de Morcast (no los clientes). */
export async function listarUsuarios() {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, activo, creado, telefono")
    .in("rol", ["dueno", "admin", "operador", "pendiente"])
    .order("creado");

  if (error) return [];
  return (data || []).map((p, i) => ({
    id: `U-${String(i + 1).padStart(3, "0")}`,
    nombre: p.nombre || "Sin nombre",
    // El correo vive en auth.users, que no se puede consultar desde la app
    // por seguridad. Se muestra el teléfono, que sí es del perfil.
    correo: p.telefono || "—",
    rol: ROLES_LEGIBLES[p.rol] || p.rol,
    estatus: p.activo ? "activo" : "inactivo",
    ultimo: (p.creado || "").slice(0, 10),
  }));
}

/* ==================================================================== */
/* REPORTES                                                             */
/* ==================================================================== */

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const aFecha = (iso) => { const [a,m,d] = String(iso).split("-").map(Number); return new Date(a,(m||1)-1,d||1); };

/**
 * Rellena con cero los periodos SIN servicios: el hueco es informacion, dice
 * que ese dia no se recogio. Si solo se grafican los dias con recoleccion,
 * una semana floja se ve igual de llena que una buena.
 */
function serie(filas, cuantos, paso) {
  const hoy = new Date();
  const cubos = [];
  for (let i = cuantos - 1; i >= 0; i--) {
    const f = new Date(hoy);
    let clave, etiqueta;
    if (paso === "dia") {
      f.setDate(hoy.getDate() - i);
      clave = `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`;
      etiqueta = `${String(f.getDate()).padStart(2, "0")} ${MESES[f.getMonth()]}`;
    } else if (paso === "mes") {
      f.setMonth(hoy.getMonth() - i, 1);
      clave = `${f.getFullYear()}-${f.getMonth()}`;
      etiqueta = MESES[f.getMonth()];
    } else {
      f.setFullYear(hoy.getFullYear() - i);
      clave = `${f.getFullYear()}`;
      etiqueta = String(f.getFullYear());
    }
    cubos.push({ clave, periodo: etiqueta, volumen: 0, monto: 0 });
  }
  const porClave = Object.fromEntries(cubos.map((c) => [c.clave, c]));
  for (const fila of filas) {
    const f = aFecha(fila.fecha);
    const clave = paso === "dia" ? `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`
      : paso === "mes" ? `${f.getFullYear()}-${f.getMonth()}` : `${f.getFullYear()}`;
    if (porClave[clave]) porClave[clave].volumen += fila.toneladas;
  }
  return cubos.map(({ clave, ...r }) => ({ ...r, volumen: Math.round(r.volumen * 100) / 100 }));
}

/**
 * Reportes de peso recolectado.
 *
 * Se reporta PESO, no volumen: lo que el chofer anota son kilogramos, los
 * metros cubicos nadie los mide. El DINERO va en cero porque sale de la
 * facturacion, que todavia no vive en el sistema.
 */
export async function reportes() {
  if (!haySupabase()) return null;

  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .select("fecha_pedida, fecha_confirmada, rutas ( tipo ), recolecciones ( peso_kg )")
    .eq("estado", "completada");

  if (error) return null;

  const filas = (data || []).map((s) => ({
    fecha: s.fecha_confirmada || s.fecha_pedida,
    toneladas: Number(s.recolecciones?.[0]?.peso_kg || 0) / 1000,
    tipo: s.rutas?.tipo || "otro",
  })).filter((s) => s.fecha);

  return {
    hayDatos: filas.length > 0,
    servicios: filas.length,
    diario: serie(filas, 14, "dia"),
    mensual: serie(filas, 12, "mes"),
    anual: serie(filas, 4, "anio"),
    hayFacturacion: false,
  };
}
