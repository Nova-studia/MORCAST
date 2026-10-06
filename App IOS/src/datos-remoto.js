import { File } from "expo-file-system";
import { supabase, haySupabase } from "./supabase";
import { RUTAS_SEED, nombreTipoRuta } from "./rutas-datos";
import { ZONA_MATAMOROS } from "./zona-matamoros";
import {
  esCuentaDeMuestra,
  saldoDeMuestra,
  movimientosDeMuestra,
  reportarDepositoDeMuestra,
  pedirRecoleccionDeMuestra,
  solicitudesDeMuestra,
} from "./cuenta-muestra";
import { estatusDePantalla } from "./estado-servicio.mjs";
import { avisosPorEnseñar, esLecturaDuplicada, DIAS_EN_PORTAL } from "./avisos.mjs";
import { validarNoProcedio, validarReporte } from "./chofer-reportes.mjs";
import { direccionDe } from "./mapas.mjs";
import { postWeb } from "./api-web";

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

/**
 * Folio corto y legible a partir de un uuid.
 *
 * Un uuid de 36 caracteres no se dicta por telefono ni se busca a simple
 * vista. Se usa igual que en la web: mismos 8 caracteres, mismo prefijo.
 */
export function folioCorto(id, prefijo = "SOL") {
  if (!id) return "—";
  return prefijo + "-" + String(id).replace(/-/g, "").slice(0, 8).toUpperCase();
}

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

/**
 * Las zonas de cobertura: TODAS, no solo la de la ruta del cliente.
 *
 * `listarRutas()` ya no sirve para el mapa. Desde db/014 la tabla `rutas`
 * solo le entrega al cliente su propia ruta —para que no vea quien maneja
 * que— y con eso el mapa de cobertura se encogio de toda la ciudad a un
 * pedazo. La zona no es un secreto, es justo lo que se le presume; lo que no
 * debe salir es el chofer y la unidad.
 *
 * db/015 crea `zonas_cobertura()`, que devuelve solo lo que el mapa dibuja.
 * Si la funcion todavia no esta aplicada en la base, se cae de vuelta a
 * `listarRutas()`: se vera la cobertura corta, pero la pantalla no se rompe.
 *
 * Y si al final no hay NINGUNA zona dibujable, va el contorno de Matamoros
 * (`zona-matamoros.js`), igual que en la web. Pasa en dos casos:
 *  · las 5 rutas reales no traen poligono, asi que `zonas_cobertura()`
 *    contesta una lista vacia y el mapa le decia "todavia no llegamos ahi"
 *    a TODOS los clientes;
 *  · en "Explorar sin cuenta" no hay sesion, y la funcion solo se le
 *    entrega a usuarios con sesion (`grant ... to authenticated`).
 */
export async function zonasDeCobertura() {
  if (!haySupabase()) return RUTAS_SEED;

  const zonas = await zonasDeLaBase();
  const dibujables = zonas.filter((r) => r.activa && r.zona.length >= 3);
  if (dibujables.length) return dibujables;

  return [{
    id: ZONA_MATAMOROS.clave,
    nombre: ZONA_MATAMOROS.nombre,
    // Sin tipo ni dias: es la cobertura de la EMPRESA, no una ruta. La
    // pantalla no pinta esos renglones cuando vienen vacios.
    tipo: "",
    dias: [],
    zona: ZONA_MATAMOROS.zona,
    activa: true,
    unidad: "",
    chofer: "",
    cupo: null,
  }];
}

async function zonasDeLaBase() {
  let respuesta;
  try {
    respuesta = await supabase.rpc("zonas_cobertura");
  } catch {
    return [];
  }
  const { data, error } = respuesta;

  if (error || !data) return listarRutas();

  return (data || []).map((r) => ({
    id: r.clave,
    uuid: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    dias: r.dias || [],
    zona: Array.isArray(r.zona) ? r.zona : [],
    activa: true,
    // El mapa no los usa y la funcion no los entrega, a proposito.
    unidad: "",
    chofer: "",
    cupo: null,
  }));
}

/* ==================================================================== */
/* AGENDAR RECOLECCIÓN                                                  */
/* ==================================================================== */

export async function miSuscripcion() {
  if (!haySupabase()) return null;

  const { data } = await supabase
    .from("suscripciones")
    .select("id, frecuencia, estado, domicilio_id, domicilios ( alias, colonia ), rutas ( clave, nombre, tipo, dias )")
    .eq("estado", "activa")
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    frecuencia: data.frecuencia,
    // El domicilio de LA suscripción: es donde pasa la ruta y donde debe
    // caer la recolección que se pida desde aquí.
    domicilioId: data.domicilio_id || null,
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
    .select("id, folio, origen, fecha_pedida, fecha_confirmada, estado, nota, tipo_residuo, motivo_no_procedio, detalle_no_procedio, rutas ( nombre )")
    .order("fecha_pedida", { ascending: false });

  // Cuenta de muestra: lo que el revisor pidió en esta sesión va arriba (no
  // se guardó en la base, ver pedirRecoleccion).
  const pedidasAqui = esCuentaDeMuestra() ? solicitudesDeMuestra() : [];

  if (error) return pedidasAqui;
  return pedidasAqui.concat((data || []).map((s) => ({
    id: s.id,
    folio: s.folio,
    origen: s.origen,
    fechaPedida: s.fecha_pedida,
    fechaConfirmada: s.fecha_confirmada,
    estado: s.estado,
    nota: s.nota || "",
    tipoResiduo: s.tipo_residuo || "",
    motivoNoProcedio: s.motivo_no_procedio || "",
    detalleNoProcedio: s.detalle_no_procedio || "",
    rutaNombre: s.rutas?.nombre || "Sin ruta",
    unidad: s.rutas?.unidad || "",
  })));
}

/**
 * El cliente pide recolección. No manda ni su empresa ni el estado: la
 * empresa sale de su sesión y el estado nace en "solicitada". El RLS lo
 * obliga aunque se manipule la llamada.
 */
export async function pedirRecoleccion({ rutaClave, fecha, nota, origen = "ruta", domicilioId = null, tipoResiduo = null }) {
  if (!haySupabase()) return { ok: true, demo: true };

  // La cuenta de muestra del revisor NO escribe en la base: su solicitud le
  // llegaría a la bandeja de Morcast como si fuera de un cliente.
  if (esCuentaDeMuestra()) {
    const su = await miSuscripcion();
    return pedirRecoleccionDeMuestra({ fecha, nota, origen, tipoResiduo }, su?.ruta?.nombre);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "No hay sesión." };

  const { data: perfil } = await supabase
    .from("perfiles").select("cliente_id").eq("id", user.id).single();
  if (!perfil?.cliente_id) return { ok: false, motivo: "Tu cuenta no tiene empresa asignada." };

  // El domicilio es el de la suscripción cuando se conoce. Antes se tomaba
  // el PRIMERO del cliente: con varios puntos (23 de 70 en la operación
  // real) la recolección se registraba en un domicilio cualquiera y el
  // chofer recibía esa dirección.
  let domId = domicilioId;
  if (!domId) {
    const { data: dom } = await supabase
      .from("domicilios").select("id").eq("cliente_id", perfil.cliente_id).limit(1).maybeSingle();
    domId = dom?.id || null;
  }

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
    domicilio_id: domId,
    ruta_id: rutaId,
    origen,
    fecha_pedida: fecha,
    estado: "solicitada",
    nota: nota || "",
    // Obligatorio desde la 1.1 (db/023): con él sabe el chofer con qué ir,
    // y respalda un "No procedió" si al llegar el residuo es otro.
    tipo_residuo: tipoResiduo || null,
  });

  if (error) {
    // La politica de la base (db/013) rechaza fechas del pasado y las
    // disparatadas. Ese rechazo llega como un error de permisos, que no le
    // dice nada a quien solo se equivoco de dia. Solo "row-level security":
    // el patron viejo (|violates|policy) tambien atrapaba "duplicate key
    // value violates unique constraint" y lo vendia como error de fecha.
    const msg = error.message || "";
    const esFecha = /row-level security/i.test(msg);
    const esFolio = /duplicate key/i.test(msg);
    return {
      ok: false,
      motivo: esFecha
        ? "Esa fecha no se puede: elige un dia de hoy en adelante."
        : esFolio
          ? "Se cruzó con otra solicitud al mismo tiempo. Inténtalo de nuevo."
          : msg,
    };
  }
  return { ok: true, folio };
}

/* ==================================================================== */
/* AVISOS DE MORCAST (retrasos, reagendas)                              */
/* ==================================================================== */

// Los que se marcaron "Enterado" y la base no pudo guardar porque la tabla
// de lecturas aún no existe (antes de la 026), y los de la cuenta del
// revisor de Apple, que no escribe en la base. Viven en memoria: la tarjeta
// se va al tocarla y no vuelve hasta reabrir la app.
let leidosEnEstaSesion = [];

/**
 * Los avisos vigentes que este cliente todavía no marca como "Enterado".
 *
 * Cuáles le tocan (a todos, a su sector, a su ruta o a su empresa) lo decide
 * la base con `avisos_lee_cliente` (db/023-024): aquí no se filtra por
 * alcance. Se piden solo los de los últimos 30 días, que es lo más viejo que
 * puede seguir vigente (`avisos.mjs`), para no bajar el historial completo.
 *
 * Las lecturas (`avisos_lecturas`, db/026) devuelven solo las propias. Si la
 * tabla todavía no existe en la base, se sigue sin ellas: se enseñan todos
 * los vigentes, que es lo que hace la web.
 */
export async function avisosParaMi() {
  if (!haySupabase()) return [];

  const desde = new Date(Date.now() - DIAS_EN_PORTAL * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: avisos, error }, lecturas] = await Promise.all([
    supabase
      .from("avisos")
      .select("id, titulo, mensaje, motivo, vigente_hasta, creado")
      .gte("creado", desde)
      .order("creado", { ascending: false })
      .limit(20),
    supabase.from("avisos_lecturas").select("aviso_id"),
  ]);

  if (error) return [];
  const leidos = lecturas?.error ? [] : (lecturas?.data || []).map((l) => l.aviso_id);
  return avisosPorEnseñar(avisos || [], leidos.concat(leidosEnEstaSesion));
}

/**
 * "Enterado": guarda la lectura. Devuelve `{ ok }` o `{ ok:false, motivo }`.
 *
 * Un duplicado (lo tocó en otro teléfono, o dos veces con mala señal) cuenta
 * como bien: para él el aviso YA está leído. El usuario lo pone la base
 * (`default auth.uid()`): desde aquí solo viaja el aviso.
 */
export async function marcarAvisoLeido(avisoId) {
  if (!haySupabase() || !avisoId) return { ok: true, demo: true };
  // La cuenta del revisor de Apple no escribe en la base (ver cuenta-muestra.js).
  if (esCuentaDeMuestra()) {
    leidosEnEstaSesion = leidosEnEstaSesion.concat(avisoId);
    return { ok: true, simulado: true };
  }

  const { error } = await supabase.from("avisos_lecturas").insert({ aviso_id: avisoId });
  if (!error || esLecturaDuplicada(error)) return { ok: true };

  // La tabla todavía no existe (la 026 no se ha corrido): no se castiga al
  // cliente con una tarjeta que no se puede quitar.
  const msg = String(error.message || "");
  if (error.code === "42P01" || error.code === "PGRST205" || /could not find the table|does not exist/i.test(msg)) {
    leidosEnEstaSesion = leidosEnEstaSesion.concat(avisoId);
    return { ok: true, sinTabla: true };
  }
  return { ok: false, motivo: "No se pudo guardar. Revisa tu señal e inténtalo de nuevo." };
}

/* ==================================================================== */
/* SALDO                                                                */
/* ==================================================================== */

export async function miSaldo() {
  if (!haySupabase()) return null;
  // Montos de muestra: la cuenta del revisor no tiene dinero en la base (ver
  // cuenta-muestra.js, "El DINERO sale de aquí").
  if (esCuentaDeMuestra()) return saldoDeMuestra();

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
  if (esCuentaDeMuestra()) return movimientosDeMuestra();

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

/**
 * Sube el comprobante de pago de un cliente a su propia carpeta.
 *
 * Mismo cuidado que con la evidencia del chofer: en React Native hay que leer
 * los bytes del archivo con `File(...).bytes()`. Pasarle a Supabase lo que
 * devuelve el selector de imagenes sube un archivo de 0 bytes SIN dar error,
 * y el comprobante quedaria en blanco.
 */
export async function subirComprobante(clienteUuid, comprobante) {
  if (!haySupabase()) return { ok: true, demo: true };
  if (!clienteUuid) return { ok: false, motivo: "Falta la empresa." };

  const tipoMime = comprobante.mimeType || "image/jpeg";
  const extension = (tipoMime.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const ruta = clienteUuid + "/" + Date.now() + "-comprobante." + extension;

  let binario;
  try {
    binario = await new File(comprobante.uri).bytes();
  } catch (e) {
    return { ok: false, motivo: "No se pudo leer el comprobante del telefono." };
  }
  if (!binario || binario.length === 0) {
    return { ok: false, motivo: "El comprobante salio vacio. Vuelve a elegirlo." };
  }

  const { error } = await supabase.storage
    .from("comprobantes")
    .upload(ruta, binario, { contentType: tipoMime, upsert: false });

  return error ? { ok: false, motivo: error.message } : { ok: true, ruta };
}

/** Enlace temporal para ver un comprobante privado. Caduca en una hora. */
export async function enlaceComprobante(ruta) {
  if (!haySupabase() || !ruta) return null;
  const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(ruta, 3600);
  return error ? null : data?.signedUrl || null;
}

/**
 * El cliente reporta un deposito. Nace "por-verificar": nadie se sube el
 * saldo solo.
 *
 * Antes esta funcion solo mandaba el NOMBRE del archivo y la imagen no se
 * subia a ningun lado: la cubeta quedaba vacia y quien aprobaba el dinero lo
 * hacia a ciegas. Igual que en la web, ahora se sube el archivo de verdad.
 */
export async function reportarDeposito({ monto, banco, referencia, comprobante, notas }) {
  if (!haySupabase()) return { ok: true, demo: true };
  // El depósito del revisor no sube comprobante ni entra a la bandeja de
  // depósitos por verificar de Morcast: se queda en la memoria de la sesión.
  if (esCuentaDeMuestra()) return reportarDepositoDeMuestra({ monto, banco, referencia, comprobante });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "No hay sesion." };

  const { data: perfil } = await supabase
    .from("perfiles").select("cliente_id").eq("id", user.id).single();
  if (!perfil?.cliente_id) return { ok: false, motivo: "Tu cuenta no tiene empresa asignada." };

  // Un deposito repetido es dinero repetido. Sin esto se podia mandar el
  // mismo comprobante N veces y el panel los listaba uno debajo del otro sin
  // avisar que eran el mismo.
  const { data: iguales } = await supabase
    .from("movimientos_saldo")
    .select("id")
    .eq("cliente_id", perfil.cliente_id)
    .eq("estado", "por-verificar")
    .eq("monto", Number(monto))
    .eq("referencia", referencia || null)
    .limit(1);

  if (iguales?.length) {
    return {
      ok: false,
      duplicado: true,
      motivo:
        "Ya tienes un deposito por el mismo monto y la misma referencia esperando verificacion. " +
        "Si es otro pago distinto, cambiale la referencia.",
    };
  }

  let rutaComprobante = null;
  if (comprobante?.uri) {
    const subida = await subirComprobante(perfil.cliente_id, comprobante);
    if (!subida.ok) return { ok: false, motivo: subida.motivo };
    rutaComprobante = subida.ruta;
  }

  const { data, error } = await supabase.from("movimientos_saldo").insert({
    cliente_id: perfil.cliente_id,
    tipo: "abono",
    concepto: "Deposito reportado" + (banco ? " — " + banco : ""),
    monto: Number(monto),
    estado: "por-verificar",
    banco: banco || null,
    referencia: referencia || null,
    comprobante: rutaComprobante,
    comprobante_nombre: comprobante?.fileName || comprobante?.nombre || null,
    notas: notas || null,
  }).select("id");

  if (error) return { ok: false, motivo: error.message };
  // Un INSERT bloqueado por el RLS tampoco da error: no inserta nada y
  // responde 200. Se cuentan las filas devueltas.
  if (!data?.length) {
    return { ok: false, motivo: "No se guardo nada: el permiso de la base no dejo registrar el deposito." };
  }
  return { ok: true };
}

/** Todos los movimientos de saldo, para el panel. El RLS decide cuales llegan. */
export async function listarMovimientos() {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("movimientos_saldo")
    .select("id, folio, tipo, concepto, monto, estado, fecha, banco, referencia, comprobante, comprobante_nombre, notas, clientes ( folio, empresa )")
    .order("fecha", { ascending: false });

  if (error) return [];
  return (data || []).map((m) => ({
    id: m.id,
    folio: m.folio || "",
    fecha: m.fecha,
    tipo: m.tipo,
    concepto: m.concepto,
    monto: Number(m.monto),
    estado: m.estado,
    banco: m.banco || "",
    referencia: m.referencia || "",
    comprobante: m.comprobante || null,
    comprobanteNombre: m.comprobante_nombre || "",
    notas: m.notas || "",
    clienteId: m.clientes?.folio || "",
    cliente: m.clientes?.empresa || "—",
  }));
}

/**
 * Morcast aplica o rechaza un deposito.
 *
 * Antes la pantalla solo cambiaba el color del renglon: el dinero NUNCA se
 * aplicaba en la base. Se veia aprobado y el saldo del cliente no se movia.
 */
export async function resolverDeposito(id, estado, notas) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("movimientos_saldo")
    .update({ estado, notas: notas || null, verificado_por: user?.id || null })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, motivo: error.message };
  // Un UPDATE que el RLS bloquea NO da error: cambia CERO filas y responde
  // 200. Se cuentan las filas devueltas en vez de confiar en `error`.
  if (!data?.length) {
    return { ok: false, motivo: "No se aplico nada: el permiso de la base no te deja tocar ese movimiento." };
  }
  return { ok: true };
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

export async function misServicios() {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .select(`
      id, folio, fecha_pedida, fecha_confirmada, origen, estado,
      tipo_residuo, motivo_no_procedio, detalle_no_procedio,
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
        // Lo que el cliente dijo al agendar (db/023). Las viejas no lo traen.
        residuo: s.tipo_residuo || (s.origen === "extra" ? "Recolección extra" : "Residuos de ruta"),
        contenedor: ev?.qr ? `Contenedor ${ev.qr}` : "—",
        peso: ev?.peso_kg ? `${ev.peso_kg} kg` : "—",
        unidad: s.rutas?.unidad || "—",
        operador: s.rutas?.chofer || "—",
        // El estado sale de la base, no fijo: si no, todo se pintaría como
        // completado aunque apenas estuviera programado.
        //
        // "no-procedio" (db/023) tiene su propio estado: antes caía crudo y,
        // como "no está completado", el Inicio lo contaba entre los PRÓXIMOS
        // servicios. Ver `estado-servicio.mjs`.
        estatus: estatusDePantalla(s.estado),
        motivoNoProcedio: s.motivo_no_procedio || "",
        detalleNoProcedio: s.detalle_no_procedio || "",
        // El manifiesto se firma con la recolección hecha. Antes se ofrecía
        // para TODOS los servicios, también los programados: el cliente podía
        // bajar un manifiesto de algo que todavía no pasaba. La pantalla ya
        // sabía decir "Manifiesto pendiente"; sólo faltaba que aquí fuera null.
        manifiesto: s.estado === "completada" ? `MAN-${s.folio.replace("REC-", "")}` : null,
        evidencia: ev
          ? {
              contenedor: ev.qr ? `Contenedor ${ev.qr}` : "—",
              // La app todavía no manda `ubicacion` al cerrar la parada;
              // decir "Registrado" era mentira.
              gps: "Sin ubicación registrada",
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

/**
 * Fila de la base → parada del chofer. Igual que `aParada` de
 * `Web/lib/datos-chofer.js`, para que la app y la web digan lo mismo.
 */
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
    // El punto completo, para "Cómo llegar" y para decir la dirección
    // entera: con alias y calle no basta para dar con un portón en un
    // parque industrial (pedido de los dueños, 4-oct-2026).
    punto: d
      ? { id: d.id, alias: d.alias, calle: d.calle, colonia: d.colonia, cp: d.cp, lat: d.lat, lng: d.lng }
      : null,
    direccionCompleta: d ? direccionDe(d) : "",
    referencias: d?.referencias || "",
    // Lo que pidió el cliente al agendar. Las solicitudes viejas no lo
    // traen: se dice "sin especificar", no se adivina.
    tipoResiduo: s.tipo_residuo || "",
    tipo: s.tipo_residuo || "Residuo sin especificar",
    contenedor: ev?.qr ? `Contenedor ${ev.qr}` : "Contenedor",
    // La tarjeta de la ruta tiene una casilla para la hora y con datos reales
    // salía vacía: la hora confirmada existe desde db/013.
    hora: s.hora_confirmada ? String(s.hora_confirmada).slice(0, 5) : "—",
    // La unidad del inventario (db/023) si la ruta ya la tiene; si no, el
    // texto viejo de la ruta.
    unidad: s.rutas?.unidades?.numero_economico || s.rutas?.unidad || "Sin unidad",
    nota: s.nota || "",
    motivoNoProcedio: s.motivo_no_procedio || "",
    // "Completado" es que ya se levantó la evidencia, no solo que el estado
    // diga completada. "No procedió" también sale de los pendientes: ya
    // quedó resuelta, no hay que volver.
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
 * Las paradas del chofer para una fecha: las confirmadas, las que ya van en
 * ruta y las ya resueltas (completadas o "no procedió"). Una "solicitada" no
 * aparece a propósito: si Morcast no la confirmó, el chofer no va por ella.
 */
export async function rutaDelDia(fecha = hoyISO()) {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .select(`
      id, folio, estado, fecha_pedida, fecha_confirmada, hora_confirmada, nota,
      tipo_residuo, motivo_no_procedio,
      clientes ( empresa ),
      domicilios ( id, alias, calle, colonia, cp, lat, lng, referencias ),
      rutas ( nombre, unidad, unidades ( numero_economico ) ),
      recolecciones ( id, qr, peso_kg )
    `)
    .in("estado", ["confirmada", "en-ruta", "completada", "no-procedio"])
    .or(`fecha_confirmada.eq.${fecha},and(fecha_confirmada.is.null,fecha_pedida.eq.${fecha})`)
    .order("folio");

  if (error) return [];
  return (data || []).map(aParada);
}

/**
 * Guarda la ubicación del punto con el GPS del chofer, parado en la entrada.
 *
 * Va por la función `fijar_ubicacion_punto` (db/023) y no por un UPDATE: el
 * chofer no edita domicilios. La función solo acepta puntos de SUS paradas,
 * solo coordenadas dentro de Matamoros, y nunca pisa una ubicación que puso
 * la oficina. En ese caso devuelve `false`, y se dice: el chofer tiene que
 * saber que su lectura no se usó.
 */
export async function fijarUbicacionPunto(solicitudId, lectura) {
  if (!lectura || typeof lectura.lat !== "number") {
    return { ok: false, motivo: "Todavía no hay una lectura de GPS." };
  }
  if (!haySupabase()) return { ok: true, demo: true };

  const { data, error } = await supabase.rpc("fijar_ubicacion_punto", {
    p_solicitud: solicitudId,
    p_lat: lectura.lat,
    p_lng: lectura.lng,
  });
  if (error) return { ok: false, motivo: error.message };
  if (data !== true) {
    return { ok: false, motivo: "Este punto ya tiene la ubicación que puso la oficina; no se cambió." };
  }
  return { ok: true };
}

/**
 * Los contenedores de un punto: para validar el QR que se escanea y para
 * decir CUÁL se dañó o no está. El RLS (`contenedores_lee_operador`) solo le
 * deja ver los de los puntos de sus paradas. Devuelve `null` si no se pudo
 * leer, que no es lo mismo que "no tiene ninguno" (`[]`).
 */
export async function contenedoresDelPunto(domicilioId) {
  if (!domicilioId || !haySupabase()) return [];
  const { data, error } = await supabase
    .from("contenedores")
    .select("id, codigo, tipo, medida, estado")
    .eq("domicilio_id", domicilioId)
    .order("codigo");
  if (error) return null;
  return data || [];
}

/**
 * "No procedió": el chofer llegó y no se pudo recoger. La parada se cierra
 * sin cobro, con el motivo (obligatorio: también lo exige el trigger de la
 * base, db/023). Solo en paradas `confirmada` o `en-ruta`: la política
 * `solicitudes_cierra_operador` no deja tocar las demás.
 *
 * La foto, si la hay, ya subió a `evidencias/<solicitud>/no-procedio-…`
 * (mismo camino que la evidencia). La tabla no tiene columna para ella; la
 * oficina la encuentra en la carpeta de la parada.
 */
export async function marcarNoProcedio(solicitudId, { motivo, detalle } = {}) {
  const v = validarNoProcedio({ motivo, detalle });
  if (!v.ok) return { ok: false, motivo: v.mensaje, campo: v.campo };
  if (!haySupabase()) return { ok: true, demo: true };

  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .update({ estado: "no-procedio", ...v.datos })
    .eq("id", solicitudId)
    .select("id");

  // El trigger responde en español ("hay que decir el motivo"): tal cual.
  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return {
      ok: false,
      motivo: "No se cambió nada: esa parada ya no está abierta o no es de tu ruta. Avisa a la oficina.",
    };
  }
  return { ok: true };
}

/**
 * Sube la foto de un incidente a `incidentes/<uid del chofer>/…`. La carpeta
 * no es decorativa: la política de la cubeta (db/023) solo deja subir a la
 * que se llama como quien sube. Misma lectura de bytes que la evidencia
 * (ver `subirEvidencia`: sin `File(...).bytes()` sube 0 bytes sin avisar).
 */
export async function subirFotoIncidente(uri, tipoMime = "image/jpeg") {
  if (!haySupabase()) return { ok: true, demo: true, ruta: null };
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };

  const extension = (tipoMime.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const ruta = `${user.id}/${Date.now()}.${extension}`;

  let binario;
  try {
    binario = await new File(uri).bytes();
  } catch {
    return { ok: false, motivo: "No se pudo leer la foto del teléfono." };
  }
  if (!binario || binario.length === 0) return { ok: false, motivo: "La foto salió vacía. Tómala de nuevo." };

  const { error } = await supabase.storage
    .from("incidentes")
    .upload(ruta, binario, { contentType: tipoMime, upsert: false });
  return error ? { ok: false, motivo: error.message } : { ok: true, ruta };
}

/**
 * El chofer reporta un incidente. Se GUARDA primero y después se le pide a
 * la web que avise a la oficina (push y correo, `POST /api/app/incidente-avisado`):
 * si el aviso falla, el reporte no se pierde y la oficina lo ve en el panel.
 *
 * La unidad y la ruta no las escribe el chofer: salen de la parada o de la
 * ruta que maneja, igual que en `Web/app/acciones-chofer.js`. Así el panel
 * sabe qué camión fue aunque con las prisas nadie lo haya dicho.
 *
 * Devuelve `{ ok, avisado }` o `{ ok:false, motivo, campo? }`.
 */
export async function reportarIncidente(entrada = {}) {
  const v = validarReporte(entrada);
  if (!v.ok) return { ok: false, motivo: v.mensaje, campo: v.campo };
  if (!haySupabase()) return { ok: true, demo: true, avisado: false };

  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };

  const datos = v.datos;
  let ruta = null;
  if (datos.solicitud_id) {
    const { data } = await supabase
      .from("solicitudes_recoleccion")
      .select("id, rutas ( id, unidad_id )")
      .eq("id", datos.solicitud_id)
      .maybeSingle();
    if (!data) return { ok: false, motivo: "Esa parada no está en tu ruta." };
    ruta = data.rutas || null;
  }
  if (!ruta) {
    // Sin parada (o parada sin ruta): la ruta activa que maneja. Si tiene
    // varias, primero la que ya tiene unidad asignada.
    const { data } = await supabase
      .from("rutas")
      .select("id, unidad_id")
      .eq("chofer_id", user.id)
      .eq("activa", true)
      .order("unidad_id", { ascending: true, nullsFirst: false })
      .limit(1);
    ruta = data?.[0] || null;
  }

  // La foto solo se acepta si está en SU carpeta. La arma
  // `subirFotoIncidente`, pero no cuesta nada asegurarlo: la columna apunta
  // a un archivo y no debe poder apuntar al de otro.
  const foto = entrada.foto && String(entrada.foto).startsWith(`${user.id}/`) ? String(entrada.foto) : null;

  const { data: filas, error } = await supabase
    .from("incidentes")
    .insert({
      ...datos,
      foto,
      operador_id: user.id,
      unidad_id: ruta?.unidad_id || null,
      ruta_id: ruta?.id || null,
    })
    .select("id");

  if (error) return { ok: false, motivo: error.message };
  // Un INSERT bloqueado por el RLS no da error: no inserta nada.
  if (!filas?.length) return { ok: false, motivo: "No se guardó el reporte: el permiso de la base no lo dejó pasar." };

  const aviso = await postWeb("/api/app/incidente-avisado", { incidente_id: filas[0].id });
  return { ok: true, id: filas[0].id, avisado: aviso?.ok === true };
}

/**
 * La ruta (o rutas) del chofer con sesión: nombre y unidad.
 *
 * Desde db/014 la tabla `rutas` le enseña al operador sólo las suyas
 * (`chofer_id = auth.uid()`), así que no hace falta filtrar aquí. Devuelve
 * `{ unidad, ruta }` o null si no tiene ninguna asignada.
 */
export async function miRutaDeChofer() {
  if (!haySupabase()) return null;

  const { data, error } = await supabase
    .from("rutas")
    .select("nombre, unidad, activa")
    .eq("activa", true)
    .order("clave");

  if (error || !data || !data.length) return null;
  return {
    ruta: data.map((r) => r.nombre).filter(Boolean).join(" · "),
    unidad: data.map((r) => r.unidad).filter(Boolean).join(" · "),
  };
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
 * Le avisa al CLIENTE de su recolección (`POST /api/app/parada-aviso`,
 * 6-oct-2026): "en-camino", "completada" o "no-procedio". El correo y los
 * tokens del cliente no se leen desde el teléfono: los manda la web.
 *
 *   · "en-camino" además pasa la parada de `confirmada` a `en-ruta` en el
 *     servidor (en vez de `marcarEnRuta`): cambio y aviso van juntos.
 *   · "completada" y "no-procedio" ya los guardó la app; el servidor solo
 *     comprueba que la base diga lo mismo y avisa.
 *
 * Un reintento no le manda un segundo aviso al cliente: lo cuida el servidor.
 * Nunca lanza: devuelve `{ ok, estado?, avisado?, motivo? }`.
 */
export async function avisarParada(solicitudId, evento) {
  if (!haySupabase()) return { ok: true, demo: true, avisado: false };
  if (!solicitudId) return { ok: false, motivo: "Falta la parada." };

  const r = await postWeb("/api/app/parada-aviso", { solicitud_id: solicitudId, evento });
  if (r.ok) return r;
  // Ya estaba en camino (otro toque que no alcanzó a contestar, o la web):
  // para el chofer es lo mismo que si acabara de salir.
  if (evento === "en-camino" && r.estado === "en-ruta") return { ...r, ok: true };
  if (r.motivo === "sin_sesion") return { ...r, motivo: "Tu sesión se venció. Vuelve a entrar." };
  return r;
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
export async function cerrarRecoleccion({ solicitudId, qr, pesoKg, uriAntes, uriDespues, rutaAntes: yaAntes, rutaDespues: yaDespues }) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "No hay sesión." };

  // Lo normal es que las fotos ya estén arriba: la pantalla las sube en
  // cuanto el chofer las toma, para no jugarse las dos al final con la señal
  // que haya en ese momento. Si por lo que sea no lo están, se suben aquí.
  let rutaAntes = yaAntes || null;
  let rutaDespues = yaDespues || null;

  if (!rutaAntes && uriAntes) {
    const r = await subirEvidencia(solicitudId, "antes", uriAntes);
    if (!r.ok) return { ok: false, motivo: "No se pudo subir la foto de antes." };
    rutaAntes = r.ruta;
  }
  if (!rutaDespues && uriDespues) {
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

/**
 * Las solicitudes del formulario del sitio.
 *
 * Devuelve `null` si la base no contesta, y `[]` solo cuando de verdad no ha
 * llegado ninguna. Antes las dos cosas eran `[]`: una bandeja vacía por falta
 * de señal se leía como "no hay prospectos".
 */
export async function listarCotizaciones() {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, creado_en, nombre, empresa, telefono, correo, tipo_servicio, frecuencia, direccion, mensaje, estado")
    .order("creado_en", { ascending: false });

  if (error) return null;
  return (data || []).map((c) => ({
    id: c.id,
    // El id es un UUID y la tarjeta lo enseñaba entero. Mismo folio corto
    // que la web (`folioCorto(s.id)`): SOL-D8F54AC7.
    folio: folioCorto(c.id),
    fecha: (c.creado_en || "").slice(0, 10),
    empresa: c.empresa || c.nombre || "Sin empresa",
    // La ficha lee `nombre`, igual que la web. Solo venía como `contacto`, así
    // que el nombre salía en blanco y el WhatsApp empezaba "Hola undefined".
    nombre: c.nombre || "",
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
    // El nombre de la restriccion NO sobra: esta tabla apunta DOS veces a
    // perfiles (`creada_por` y `chofer_id`). Con solo "perfiles (...)"
    // PostgREST no sabe cual de las dos quiere y responde con un error de
    // relacion ambigua.
    .select(`
      id, folio, origen, fecha_pedida, fecha_confirmada, hora_confirmada, chofer_id,
      estado, nota,
      clientes ( empresa ),
      rutas ( nombre, chofer, unidad ),
      choferParada:perfiles!solicitudes_recoleccion_chofer_id_fkey ( nombre )
    `)
    .order("fecha_pedida", { ascending: false });

  if (error) return [];
  return (data || []).map((s) => ({
    id: s.id,
    folio: s.folio,
    cliente: s.clientes?.empresa || "—",
    rutaNombre: s.rutas?.nombre || "Sin ruta",
    unidad: s.rutas?.unidad || "",
    origen: s.origen,
    fechaPedida: s.fecha_pedida,
    fechaConfirmada: s.fecha_confirmada,
    horaConfirmada: s.hora_confirmada || "",
    choferId: s.chofer_id || null,
    choferAsignado: s.choferParada?.nombre || "",
    // El de la ruta es el de siempre; el asignado a la parada manda sobre el.
    choferEfectivo: s.choferParada?.nombre || s.rutas?.chofer || "",
    estado: s.estado,
    nota: s.nota || "",
  }));
}

/** Los choferes, con su id REAL: es el que la base usa para asignar la parada. */
export async function listarOperadores() {
  if (!haySupabase()) return [];

  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre")
    .eq("rol", "operador")
    .eq("activo", true)
    .order("nombre");

  return error ? [] : data || [];
}

/**
 * Morcast confirma la recoleccion.
 *
 * Se confirma con los TRES datos, no solo con el dia: sin hora ni chofer, el
 * cliente no sabe cuando esperar el camion y el chofer no sabe que es suyo.
 */
export async function confirmarSolicitud(s) {
  return cambiarEstadoSolicitud(s.id, {
    estado: "confirmada",
    fecha_confirmada: s.fechaConfirmada || s.fechaPedida,
    hora_confirmada: s.horaConfirmada || null,
    chofer_id: s.choferId || null,
  });
}

/** Morcast la rechaza, dejando dicho por que. */
export async function rechazarSolicitud(s, motivo) {
  return cambiarEstadoSolicitud(s.id, {
    estado: "rechazada",
    motivo_rechazo: motivo || "Sin cupo en la ruta.",
  });
}

/** Cambio de estado generico de una parada. */
export async function cambiarEstadoSolicitud(id, cambios) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .update(cambios)
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, motivo: error.message };
  // Un UPDATE que el RLS bloquea NO da error: cambia CERO filas y responde
  // 200. Se cuentan las filas devueltas.
  if (!data?.length) {
    return { ok: false, motivo: "No se cambio nada: el permiso de la base no te deja tocar esa solicitud." };
  }
  return { ok: true };
}

/**
 * Mueve una cotizacion por el embudo (nueva -> contactada -> ganada/perdida).
 *
 * Antes la pantalla solo cambiaba el renglon en memoria: al salir y volver
 * seguia en el estado viejo, porque nunca se escribio en la base.
 */
export async function cambiarEstadoCotizacion(id, estado, notas) {
  if (!haySupabase()) return { ok: true, demo: true };

  const cambios = { estado };
  if (notas !== undefined) cambios.notas = notas;

  const { data, error } = await supabase
    .from("cotizaciones")
    .update(cambios)
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return { ok: false, motivo: "No se cambio nada: el permiso de la base no te deja tocar esa solicitud." };
  }
  return { ok: true };
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
    // por seguridad. Lo que hay es el teléfono, y se rotula como tal.
    correo: "",
    telefono: p.telefono || "",
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
    composicion: composicion(filas),
    hayFacturacion: false,
  };
}

/**
 * Qué parte del total es cada tipo de residuo, para la tarjeta de
 * "Composición". Va por PESO cuando el chofer lo anotó; si ningún servicio
 * trae peso, por número de servicios, que es lo único que hay.
 *
 * Antes la tarjeta pintaba cuatro porcentajes escritos a mano (46/24/18/12),
 * los mismos para cualquier cliente que entrara.
 */
function composicion(filas) {
  const ultimoAnio = new Date();
  ultimoAnio.setFullYear(ultimoAnio.getFullYear() - 1);
  const recientes = filas.filter((f) => aFecha(f.fecha) >= ultimoAnio);
  const hayPeso = recientes.some((f) => f.toneladas > 0);
  const porTipo = {};
  for (const f of recientes) {
    const nombre = nombreTipoRuta(f.tipo) || "Otros";
    porTipo[nombre] = (porTipo[nombre] || 0) + (hayPeso ? f.toneladas : 1);
  }
  const total = Object.values(porTipo).reduce((a, b) => a + b, 0);
  if (!total) return [];
  return Object.entries(porTipo)
    .map(([tipo, v]) => ({ tipo, porcentaje: Math.round((v / total) * 100) }))
    .sort((a, b) => b.porcentaje - a.porcentaje);
}

/* ==================================================================== */
/* NUMEROS DEL PANEL DE ADMINISTRACION                                  */
/* ==================================================================== */

/**
 * Indicadores del panel.
 *
 * Todo sale de la base. Si un numero da cero es porque de verdad no hay ese
 * dato todavia, no porque falte conectarlo. Antes esta pantalla traia seis
 * numeros escritos a mano desde julio —$148,900 de ingresos, 2 solicitudes
 * nuevas, $45,780 por cobrar— que no correspondian a nada: el panel decia que
 * habia 2 solicitudes sin contactar y la bandeja salia vacia, con razon.
 */
export async function kpisAdmin() {
  const vacio = {
    ingresosMes: 0, ingresosMesAnterior: 0, solicitudesNuevas: 0,
    clientesActivos: 0, serviciosMes: 0, porCobrar: 0,
  };
  if (!haySupabase()) return vacio;

  const hoy = new Date();
  const primeroDeMes = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0") + "-01";

  const [clientes, cotizaciones, servicios, saldos] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("estado", "activo"),
    supabase.from("cotizaciones").select("id", { count: "exact", head: true }).eq("estado", "nueva"),
    supabase.from("solicitudes_recoleccion").select("id", { count: "exact", head: true }).gte("fecha_pedida", primeroDeMes),
    supabase.from("saldos_clientes").select("cargos, saldo"),
  ]);

  const porCobrar = (saldos.data || []).reduce((t, x) => t + Number(x.cargos || 0), 0);

  return {
    // Los ingresos del mes salen de la facturacion, que todavia no vive en el
    // sistema. Se dejan en cero en vez de inventar un numero que nadie podria
    // cuadrar contra nada.
    ingresosMes: 0,
    ingresosMesAnterior: 0,
    solicitudesNuevas: cotizaciones.count ?? 0,
    clientesActivos: clientes.count ?? 0,
    serviciosMes: servicios.count ?? 0,
    porCobrar,
  };
}

/**
 * Cobranza de los ultimos 12 meses: los depositos que Morcast YA verifico.
 *
 * No es "facturacion" —eso todavia no vive en el sistema— sino dinero que de
 * verdad entro y alguien aplico. Devuelve `hayDatos` para que la pantalla
 * pueda avisar cuando no hay nada que graficar, en vez de enseñar doce barras
 * en cero sin explicacion.
 */
export async function cobranza12Meses() {
  const hoy = new Date();
  const serie = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    serie.push({ periodo: MESES[d.getMonth()], anio: d.getFullYear(), mes: d.getMonth(), monto: 0 });
  }
  if (!haySupabase()) return { serie, hayDatos: false };

  // La fecha se arma con getFullYear/Month para no pasar por UTC: un
  // `toISOString()` sobre la medianoche local devuelve el dia anterior.
  const desde = serie[0];
  const primerDia = desde.anio + "-" + String(desde.mes + 1).padStart(2, "0") + "-01";

  const { data, error } = await supabase
    .from("movimientos_saldo")
    .select("fecha, monto, tipo, estado")
    .eq("tipo", "abono")
    .eq("estado", "aplicada")
    .gte("fecha", primerDia);

  if (error) return { serie, hayDatos: false };

  for (const m of data || []) {
    const partes = String(m.fecha).split("-").map(Number);
    const casilla = serie.find((x) => x.anio === partes[0] && x.mes === partes[1] - 1);
    if (casilla) casilla.monto += Number(m.monto || 0);
  }

  return { serie, hayDatos: (data || []).length > 0 };
}

/** Como se llama en la agenda cada estado de la base. */
const ESTATUS_AGENDA = {
  solicitada: "programado",
  confirmada: "programado",
  "en-ruta": "en-ruta",
  completada: "completado",
};

/**
 * La agenda de toda la flota, armada con las paradas reales.
 *
 * Se le pega la evidencia de `misServicios()` porque la pantalla ofrece abrir
 * el comprobante fotografico del chofer: sin esto la promesa seria falsa.
 * Se cruzan por folio, que es lo unico que comparten las dos consultas.
 */
export async function agendaServicios() {
  const [solicitudes, servicios] = await Promise.all([
    listarSolicitudesRecoleccion(),
    misServicios(),
  ]);
  const evidenciaPorFolio = Object.fromEntries(
    (servicios || []).filter((x) => x.evidencia).map((x) => [x.folio, x.evidencia])
  );
  return solicitudes
    .filter((s) => ESTATUS_AGENDA[s.estado])
    .map((s) => ({
      folio: s.folio,
      fecha: s.fechaConfirmada || s.fechaPedida,
      cliente: s.cliente,
      tipo: s.origen === "extra" ? "Recoleccion extra" : "Recoleccion de ruta",
      unidad: s.unidad || "Sin asignar",
      // El chofer de ESTA recolección (el que eligió la oficina al
      // confirmar) y, si no hay, el de la ruta: así lo arma la web desde el
      // 6-oct-2026. Va con la hora acordada, que antes no se enseñaba.
      operador: s.choferEfectivo || "Sin asignar",
      hora: s.horaConfirmada ? String(s.horaConfirmada).slice(0, 5) : "",
      estatus: ESTATUS_AGENDA[s.estado],
      evidencia: evidenciaPorFolio[s.folio] || null,
    }))
    // Se compara con </> y se devuelve 0 en el empate. Nunca restar fechas ni
    // usar un comparador que jamas devuelva 0: da un orden inestable.
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

/**
 * La empresa del cliente que tiene la sesion.
 *
 * La pantalla de perfil ensenaba una empresa de ejemplo —"Industrias del
 * Golfo", con su contacto y su RFC— entrara quien entrara. Y lo mismo iba
 * impreso en los manifiestos, las cotizaciones y los reportes.
 *
 * Se resuelve por el PERFIL del usuario que tiene la sesion, no pidiendo
 * `clientes` a secas y quedandose con la primera fila. El RLS hoy deja pasar
 * una sola —la suya— pero eso es una propiedad del permiso, no del codigo: el
 * dia que se abra para el personal de Morcast, `.limit(1)` empezaria a
 * devolver la empresa de cualquiera. Asi es la web desde la auditoria.
 *
 * Lo que la empresa todavia no ha entregado (el RFC, hoy) vuelve vacio y lo
 * pinta como raya quien lo ensena. NO se rellena con el dato del cliente de
 * ejemplo: en un manifiesto, un RFC ajeno es peor que un campo vacio.
 */
export async function miEmpresa() {
  if (!haySupabase()) return null;

  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfiles")
    .select("nombre, clientes ( folio, empresa, contacto, correo, telefono, rfc, plan )")
    .eq("id", user.id)
    .maybeSingle();

  const c = data?.clientes;
  if (!c) return null;

  return {
    id: c.folio || "",
    empresa: c.empresa || data?.nombre || "Mi empresa",
    contacto: c.contacto || data?.nombre || "",
    correo: c.correo || "",
    telefono: c.telefono || "",
    rfc: c.rfc || "",
    cuenta: c.plan || "Sin plan",
  };
}
