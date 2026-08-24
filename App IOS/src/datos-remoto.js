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
 */
export async function zonasDeCobertura() {
  if (!haySupabase()) return RUTAS_SEED;

  const { data, error } = await supabase.rpc("zonas_cobertura");

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
    unidad: s.rutas?.unidad || "",
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

  if (error) {
    // La politica de la base (db/013) rechaza fechas del pasado y las
    // disparatadas. Ese rechazo llega como un error de permisos, que no le
    // dice nada a quien solo se equivoco de dia.
    const esFecha = /row-level security|violates|policy/i.test(error.message || "");
    return {
      ok: false,
      motivo: esFecha ? "Esa fecha no se puede: elige un dia de hoy en adelante." : error.message,
    };
  }
  return { ok: true, folio };
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
      operador: s.choferEfectivo || "Sin asignar",
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
