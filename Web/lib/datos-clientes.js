"use client";

/**
 * Acceso a CLIENTES, SALDOS y USUARIOS del equipo.
 *
 * Como en el resto, aquí no hay reglas de seguridad: las pone el RLS dentro
 * de Postgres. Un cliente que llamara a `listarClientes()` recibiría una sola
 * fila, la suya, sin que este archivo haga nada.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { subirComprobante } from "@/lib/datos-archivos";
import { CLIENTES_ADMIN, USUARIOS_ADMIN } from "@/lib/admin-datos";

const ROLES_LEGIBLES = {
  dueno: "Dueño",
  admin: "Administrador",
  operador: "Chofer / Operador",
  cliente: "Cliente",
  pendiente: "Sin asignar",
};

/* ==================================================================== */
/* CLIENTES                                                             */
/* ==================================================================== */

/**
 * Clientes con su saldo ya calculado.
 *
 * El saldo viene de la vista `saldos_clientes`, que lo suma de los
 * movimientos. Se pide en la misma llamada que los clientes para no hacer una
 * consulta de saldo por cada fila de la tabla.
 */
export async function listarClientes() {
  if (!haySupabaseNavegador()) return CLIENTES_ADMIN;

  const supabase = supabaseNavegador();
  const [{ data: clientes, error }, { data: saldos }] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, folio, empresa, contacto, correo, telefono, plan, estado, desde, dias_credito, limite_credito, nota_interna")
      .order("empresa"),
    supabase.from("saldos_clientes").select("cliente_id, saldo, cargos, por_verificar"),
  ]);

  if (error) {
    console.error("[clientes] No se pudieron leer:", error.message);
    return [];
  }

  const porId = Object.fromEntries((saldos || []).map((s) => [s.cliente_id, s]));

  return (clientes || []).map((c) => ({
    id: c.folio,
    uuid: c.id,
    empresa: c.empresa,
    contacto: c.contacto || "—",
    correo: c.correo || "",
    telefono: c.telefono || "",
    plan: c.plan || "Sin plan",
    // `c.estado` ya trae el valor real ("activo", "pendiente-info",
    // "suspendido", "baja"): el `? "activo" : c.estado` de antes era un
    // no-op que solo disfrazaba que la pantalla no sabia pintar mas que dos
    // casos. `etiquetaEstado()` en `estado-cliente.mjs` es quien decide como
    // se ve cada uno.
    estatus: c.estado,
    notaInterna: c.nota_interna || "",
    desde: c.desde,
    saldo: Number(porId[c.id]?.saldo ?? 0),
    porPagar: Number(porId[c.id]?.cargos ?? 0),
  }));
}

/**
 * Da de alta una empresa. No crea ninguna cuenta ni contraseña: el acceso al
 * portal se manda después, por invitación, para que el cliente escoja la
 * suya. Aquí solo nace el expediente de la empresa.
 *
 * El folio se calcula a partir del más alto del año, no de cuántos clientes
 * hay: si alguno se da de baja, contar produciría un folio repetido.
 */
export async function crearCliente(datos) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const supabase = supabaseNavegador();

  // El folio lo pone la BASE (db/014). Calcularlo aquí era una carrera: entre
  // leer el más alto e insertar cabe otra alta, las dos sacan el mismo número
  // y la segunda choca contra la restricción de folio único.
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      empresa: datos.empresa,
      contacto: datos.contacto || null,
      correo: datos.correo || null,
      telefono: datos.telefono || null,
      plan: datos.plan || null,
      estado: "activo",
    })
    .select()
    .single();

  if (error) {
    console.error("[clientes] No se pudo crear:", error.message);
    return { ok: false, motivo: error.message };
  }

  return {
    ok: true,
    cliente: {
      id: data.folio,
      uuid: data.id,
      empresa: data.empresa,
      contacto: data.contacto || "—",
      correo: data.correo || "",
      telefono: data.telefono || "",
      plan: data.plan || "Sin plan",
      estatus: "activo",
      desde: data.desde,
      saldo: 0,
      porPagar: 0,
    },
  };
}

/* ==================================================================== */
/* SALDOS Y RECARGAS                                                    */
/* ==================================================================== */

/** Movimientos de saldo visibles para la sesión (todos, o los de su empresa). */
export async function listarMovimientos() {
  if (!haySupabaseNavegador()) return [];

  const { data, error } = await supabaseNavegador()
    .from("movimientos_saldo")
    .select("id, folio, tipo, concepto, monto, estado, fecha, banco, referencia, comprobante, comprobante_nombre, notas, clientes ( folio, empresa )")
    .order("fecha", { ascending: false });

  if (error) {
    console.error("[saldos] No se pudieron leer:", error.message);
    return [];
  }

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

/** El saldo de la empresa del cliente que tiene la sesión. */
export async function miSaldo() {
  if (!haySupabaseNavegador()) return null;

  const { data } = await supabaseNavegador()
    .from("saldos_clientes")
    .select("saldo, cargos, por_verificar")
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    saldoActual: Number(data.saldo),
    porPagar: Number(data.cargos),
    porVerificar: Number(data.por_verificar),
  };
}

/**
 * El cliente reporta un depósito. Nace SIEMPRE "por-verificar": nadie puede
 * aumentarse el saldo solo. La política de RLS lo obliga aunque se manipule
 * la llamada.
 */
export async function reportarDeposito({ monto, banco, referencia, archivo, notas }) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const supabase = supabaseNavegador();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "No hay sesión." };

  const { data: perfil } = await supabase
    .from("perfiles").select("cliente_id").eq("id", user.id).single();
  if (!perfil?.cliente_id) return { ok: false, motivo: "Tu cuenta no tiene empresa asignada." };

  // Un depósito repetido es dinero repetido. Antes se podía mandar el mismo
  // comprobante N veces —pasó en las pruebas: tres reportes idénticos dejaron
  // $15,000 por verificar de una transferencia de $5,000— y el panel los
  // listaba uno debajo del otro sin avisar que eran el mismo.
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
        "Ya tienes un depósito por el mismo monto y la misma referencia esperando verificación. " +
        "Si es otro pago distinto, cámbiale la referencia.",
    };
  }

  // El comprobante se SUBE. Antes solo viajaba el nombre del archivo, así que
  // la cubeta quedaba vacía y quien tenía que aprobar el dinero no veía nada.
  let comprobante = null;
  if (archivo) {
    const subida = await subirComprobante(perfil.cliente_id, archivo);
    if (!subida.ok) {
      return { ok: false, motivo: "No se pudo subir el comprobante. Vuelve a intentarlo." };
    }
    comprobante = subida.ruta;
  }

  const { data, error } = await supabase.from("movimientos_saldo").insert({
    cliente_id: perfil.cliente_id,
    tipo: "abono",
    concepto: `Depósito reportado${banco ? ` — ${banco}` : ""}`,
    monto: Number(monto),
    estado: "por-verificar",
    banco: banco || null,
    referencia: referencia || null,
    comprobante,
    comprobante_nombre: archivo?.name || null,
    notas: notas || null,
  }).select("id");

  if (error) {
    console.error("[saldos] No se pudo reportar:", error.message);
    return { ok: false, motivo: error.message };
  }
  // Un INSERT bloqueado por RLS tampoco da error: no inserta nada y responde
  // 200. Se cuentan las filas devueltas.
  if (!data?.length) {
    return { ok: false, motivo: "No se guardó nada: el permiso de la base no dejó registrar el depósito." };
  }
  return { ok: true };
}

/**
 * Morcast aplica o rechaza un depósito.
 * Aplicarlo es lo que lo convierte en dinero; por eso el RLS lo reserva al
 * dueño.
 */
export async function resolverDeposito(id, estado, notas) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { data: { user } } = await supabaseNavegador().auth.getUser();

  const { data, error } = await supabaseNavegador()
    .from("movimientos_saldo")
    .update({ estado, notas: notas || null, verificado_por: user?.id || null })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[saldos] No se pudo resolver:", error.message);
    return { ok: false, motivo: error.message };
  }
  // Un UPDATE que el RLS bloquea NO da error: cambia CERO filas y responde
  // 200. Se cuentan las filas devueltas en vez de confiar en `error`.
  if (!data?.length) {
    return { ok: false, motivo: "No se aplicó nada: el permiso de la base no te deja tocar ese movimiento." };
  }
  return { ok: true };
}

/* ==================================================================== */
/* USUARIOS DEL EQUIPO                                                  */
/* ==================================================================== */

/** Perfiles del personal de Morcast (no los clientes). */
/**
 * Los choferes, con su id REAL.
 *
 * `listarUsuarios()` no sirve para esto: devuelve un id de pantalla
 * ("U-001") para la tabla de Usuarios, y para asignar una parada hace falta
 * el uuid con el que la base amarra las cosas.
 */
export async function listarOperadores() {
  if (!haySupabaseNavegador()) return [];

  const { data, error } = await supabaseNavegador()
    .from("perfiles")
    .select("id, nombre")
    .eq("rol", "operador")
    .eq("activo", true)
    .order("nombre");

  if (error) {
    console.error("[usuarios] No se pudieron leer los choferes:", error.message);
    return [];
  }
  return data || [];
}

export async function listarUsuarios() {
  if (!haySupabaseNavegador()) return USUARIOS_ADMIN;

  const { data, error } = await supabaseNavegador()
    .from("perfiles")
    .select("id, nombre, rol, activo, creado, telefono")
    // ⚠️ `pendiente` NO va aquí. Esta pantalla es el PERSONAL de Morcast —el
    // dueño, los administradores y los choferes—, y `pendiente` era un estado
    // teórico hasta que se abrió el registro con Google: hoy es todo el que
    // pulse "Continuar con Google". Se colarían entre el personal como
    // "Sin nombre / — / Sin asignar", incluidos los que se registran y cierran
    // la pestaña sin llenar el formulario. Los registrados se trabajan en
    // /admin/altas, que es la pantalla hecha para eso.
    .in("rol", ["dueno", "admin", "operador"])
    .order("creado");

  if (error) {
    console.error("[usuarios] No se pudieron leer:", error.message);
    return [];
  }

  return (data || []).map((p, i) => ({
    id: `U-${String(i + 1).padStart(3, "0")}`,
    nombre: p.nombre || "Sin nombre",
    // El correo vive en auth.users, que no es consultable desde el navegador
    // por seguridad. Se muestra el teléfono, que sí es del perfil.
    correo: p.telefono || "—",
    rol: ROLES_LEGIBLES[p.rol] || p.rol,
    estatus: p.activo ? "activo" : "inactivo",
    ultimo: (p.creado || "").slice(0, 10),
  }));
}
