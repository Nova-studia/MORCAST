/**
 * CLIENTES EN EL SERVIDOR — estados con efecto real, edición, usuarios,
 * puntos y borrado definitivo (Entrega 1, 8-oct-2026).
 *
 * Reciben `sb` = cliente de Supabase con la LLAVE DE SERVICIO: son
 * operaciones de varias tablas y de Auth que el RLS no podría hacer de una
 * pieza. Por eso el PERMISO se revisa ANTES, en app/acciones-clientes.js, y
 * aquí solo se ejecuta y se anota. Sin imports de Next: se prueba con un
 * Supabase falso (tests/clientes-servidor.test.mjs).
 *
 * Ver docs/superpowers/specs/2026-10-08-entregas-1-4-design.md §Entrega 1.
 */
import { validarCambioEstado, estadoPorCompletitud } from "./estado-cliente.mjs";

const BLOQUEO = "876000h"; // igual que lib/equipo-servidor.js (100 años)
const SIN_BLOQUEO = "none";
const hoyISO = () => new Date().toISOString().slice(0, 10);

const fallo = (que, error) => ({ ok: false, motivo: `${que}: ${error?.message || error}` });

async function leerCliente(sb, clienteId) {
  const { data, error } = await sb
    .from("clientes")
    .select("id, folio, empresa, contacto, correo, telefono, estado")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) return { error };
  return { cliente: data };
}

async function idsDe(sb, tabla, columna, valor) {
  const { data, error } = await sb.from(tabla).select("id").eq(columna, valor);
  if (error) throw new Error(`leer ${tabla}: ${error.message}`);
  return (data || []).map((x) => x.id);
}

/** Bloquea o desbloquea en Auth y marca el perfil. */
async function accesoDeUsuarios(sb, ids, activo) {
  for (const id of ids) {
    const { error } = await sb.auth.admin.updateUserById(id, { ban_duration: activo ? SIN_BLOQUEO : BLOQUEO });
    if (error) throw new Error(`${activo ? "desbloquear" : "bloquear"} usuario: ${error.message}`);
  }
  if (ids.length) {
    const { error } = await sb.from("perfiles").update({ activo }).in("id", ids).select("id");
    if (error) throw new Error(`perfiles: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ estado */

export async function cambiarEstadoClienteCon({ sb, anotar, actor }, { clienteId, estado, motivo }) {
  const { cliente, error } = await leerCliente(sb, clienteId);
  if (error) return fallo("No se pudo leer el cliente", error);
  if (!cliente) return { ok: false, motivo: "No encontré ese cliente." };

  const v = validarCambioEstado({ actual: cliente.estado, nuevo: estado, motivo });
  if (!v.ok) return v;

  try {
    const { error: e1 } = await sb
      .from("clientes")
      .update({ estado, estado_motivo: String(motivo || "").trim() || null, estado_fecha: new Date().toISOString(), estado_por: actor?.id || null })
      .eq("id", clienteId)
      .select("id");
    if (e1) throw new Error(`estado: ${e1.message}`);

    const usuarios = await idsDe(sb, "perfiles", "cliente_id", clienteId);

    if (estado === "suspendido") {
      // Solo lectura: sus usuarios siguen entrando (la base ya no les deja
      // agendar). Los servicios se pausan; las paradas las decide la oficina.
      await sb.from("suscripciones").update({ estado: "pausada" }).eq("cliente_id", clienteId).eq("estado", "activa").select("id");
    }

    if (estado === "baja") {
      await accesoDeUsuarios(sb, usuarios, false);
      await sb.from("suscripciones").update({ estado: "cancelada" }).eq("cliente_id", clienteId).neq("estado", "cancelada").select("id");
      await sb
        .from("solicitudes_recoleccion")
        .update({ estado: "rechazada", motivo_rechazo: "Cliente dado de baja" })
        .eq("cliente_id", clienteId)
        .in("estado", ["solicitada", "confirmada"])
        .gte("fecha_pedida", hoyISO())
        .select("id");
      const domicilios = await idsDe(sb, "domicilios", "cliente_id", clienteId);
      if (domicilios.length) {
        await sb.from("contenedores").update({ domicilio_id: null, estado: "en-bodega" }).in("domicilio_id", domicilios).select("id");
      }
      if (usuarios.length) await sb.from("push_tokens").delete().in("usuario_id", usuarios);
    }

    if (estado === "activo") {
      // Reactivar: vuelven a entrar; sus servicios regresan PAUSADOS para que
      // la oficina los revise antes de mandar camiones.
      await accesoDeUsuarios(sb, usuarios, true);
      await sb.from("suscripciones").update({ estado: "pausada" }).eq("cliente_id", clienteId).neq("estado", "activa").select("id");
    }
  } catch (e) {
    return fallo("No se completó el cambio", e);
  }

  await anotar({
    accion: `cliente_${estado}`,
    tabla: "clientes",
    registroId: clienteId,
    detalle: { folio: cliente.folio, empresa: cliente.empresa, antes: cliente.estado, despues: estado, motivo: motivo || null },
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ editar */

const EDITABLES = ["empresa", "contacto", "correo", "telefono", "plan", "dias_credito", "limite_credito", "nota_interna", "rfc"];

export async function editarClienteCon({ sb, anotar, actor }, { clienteId, cambios }) {
  const permitido = {};
  for (const k of EDITABLES) if (k in (cambios || {})) permitido[k] = typeof cambios[k] === "string" ? cambios[k].trim() : cambios[k];
  if (!Object.keys(permitido).length) return { ok: false, motivo: "No hay nada que guardar." };

  const { data: actual, error } = await sb
    .from("clientes")
    .select("id, folio, empresa, contacto, correo, telefono, estado")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) return fallo("No se pudo leer el cliente", error);
  if (!actual) return { ok: false, motivo: "No encontré ese cliente." };

  // Si le faltaba un dato y ya lo tiene, sale de "pendiente por información".
  if (actual.estado === "pendiente-info" && estadoPorCompletitud({ ...actual, ...permitido }) === "activo") {
    permitido.estado = "activo";
  }

  const { data, error: e2 } = await sb.from("clientes").update(permitido).eq("id", clienteId).select("id");
  if (e2) {
    if (/clientes_empresa_key|duplicate/i.test(e2.message)) return { ok: false, motivo: "Ya existe otro cliente con ese nombre." };
    return fallo("No se guardó", e2);
  }
  if (!data?.length) return { ok: false, motivo: "No se guardó." };
  await anotar({ accion: "cliente_editado", tabla: "clientes", registroId: clienteId, detalle: { folio: actual.folio, cambios: permitido, por: actor?.correo } });
  return { ok: true, cambios: permitido };
}

/* ------------------------------------------------------------------ borrar */

export async function conteosClienteCon({ sb }, { clienteId }) {
  const contar = async (tabla, col = "cliente_id") => {
    const { data } = await sb.from(tabla).select("id").eq(col, clienteId);
    return (data || []).length;
  };
  const solicitudes = await idsDe(sb, "solicitudes_recoleccion", "cliente_id", clienteId).catch(() => []);
  let recolecciones = 0;
  if (solicitudes.length) {
    const { data } = await sb.from("recolecciones").select("id").in("solicitud_id", solicitudes);
    recolecciones = (data || []).length;
  }
  const { data: movs } = await sb.from("movimientos_saldo").select("monto").eq("cliente_id", clienteId);
  return {
    solicitudes: solicitudes.length,
    recolecciones,
    movimientos: (movs || []).length,
    montoMovimientos: (movs || []).reduce((t, m) => t + Number(m.monto || 0), 0),
    precios: await contar("precios"),
    puntos: await contar("domicilios"),
    usuarios: await contar("perfiles"),
  };
}

async function vaciarCarpeta(sb, cubeta, carpeta) {
  const { data, error } = await sb.storage.from(cubeta).list(carpeta, { limit: 1000 });
  if (error || !data?.length) return 0;
  const rutas = data.filter((x) => x.id).map((x) => `${carpeta}/${x.name}`);
  for (let i = 0; i < rutas.length; i += 100) await sb.storage.from(cubeta).remove(rutas.slice(i, i + 100));
  return rutas.length;
}

const normal = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * ELIMINAR DEFINITIVAMENTE. Se permite con historial (Luis, 8-oct: "aún
 * estamos en prueba"), pero en orden y a la vista: la base ya no deja que se
 * vaya en cascada (028). `confirmacion` = el nombre de la empresa.
 */
export async function eliminarClienteCon({ sb, anotar, actor }, { clienteId, confirmacion }) {
  const { cliente, error } = await leerCliente(sb, clienteId);
  if (error) return fallo("No se pudo leer el cliente", error);
  if (!cliente) return { ok: false, motivo: "No encontré ese cliente." };
  if (normal(confirmacion) !== normal(cliente.empresa)) {
    return { ok: false, motivo: `Escribe el nombre exacto de la empresa (${cliente.empresa}) para confirmar.` };
  }

  const conteos = await conteosClienteCon({ sb }, { clienteId });
  // La foto ANTES de borrar: después ya no hay nada que fotografiar.
  await anotar({ accion: "cliente_eliminado", tabla: "clientes", registroId: clienteId, detalle: { ...cliente, conteos, por: actor?.correo } });

  try {
    const solicitudes = await idsDe(sb, "solicitudes_recoleccion", "cliente_id", clienteId);
    const usuarios = await idsDe(sb, "perfiles", "cliente_id", clienteId);

    for (const s of solicitudes) await vaciarCarpeta(sb, "evidencias", s);
    await vaciarCarpeta(sb, "comprobantes", clienteId);

    const borrar = async (tabla, col, valor, varios = false) => {
      let q = sb.from(tabla).delete();
      q = varios ? q.in(col, valor) : q.eq(col, valor);
      const { error: e } = await q;
      if (e) throw new Error(`borrar ${tabla}: ${e.message}`);
    };
    if (solicitudes.length) await borrar("recolecciones", "solicitud_id", solicitudes, true);
    await borrar("solicitudes_recoleccion", "cliente_id", clienteId);
    await borrar("movimientos_saldo", "cliente_id", clienteId);
    await borrar("precios", "cliente_id", clienteId);
    await borrar("avisos", "cliente_id", clienteId);
    await borrar("domicilios", "cliente_id", clienteId); // suscripciones en cascada
    for (const u of usuarios) {
      const { error: e } = await sb.auth.admin.deleteUser(u); // perfiles en cascada
      if (e && !/not found/i.test(e.message)) throw new Error(`borrar usuario: ${e.message}`);
    }
    await borrar("clientes", "id", clienteId);
  } catch (e) {
    return fallo("No se terminó de borrar (lo que alcanzó a borrarse ya no está)", e);
  }
  return { ok: true, conteos };
}

/* ------------------------------------------------------------------ usuarios */

export async function usuariosDeClienteCon({ sb }, { clienteId }) {
  const { data, error } = await sb.from("perfiles").select("id, nombre, activo, creado").eq("cliente_id", clienteId);
  if (error) return fallo("No se pudieron leer los usuarios", error);
  const usuarios = [];
  for (const p of data || []) {
    const { data: u } = await sb.auth.admin.getUserById(p.id);
    usuarios.push({
      id: p.id,
      nombre: p.nombre || "",
      activo: p.activo,
      correo: u?.user?.email || "",
      ultimoAcceso: u?.user?.last_sign_in_at || null,
      proveedor: u?.user?.app_metadata?.provider || "",
    });
  }
  return { ok: true, usuarios };
}

export async function quitarAccesoClienteCon({ sb, anotar }, { clienteId, perfilId, activo }) {
  const { data: p } = await sb.from("perfiles").select("id, cliente_id, rol").eq("id", perfilId).maybeSingle();
  if (!p || p.cliente_id !== clienteId || p.rol !== "cliente") return { ok: false, motivo: "Ese usuario no es de este cliente." };
  try {
    await accesoDeUsuarios(sb, [perfilId], Boolean(activo));
  } catch (e) {
    return fallo("No se cambió el acceso", e);
  }
  await anotar({ accion: activo ? "reactivar_usuario" : "desactivar_usuario", tabla: "perfiles", registroId: perfilId, detalle: { clienteId } });
  return { ok: true };
}

/** Manda otra vez el enlace para crear contraseña (el mismo que "Dar acceso"). */
export async function reenviarAccesoClienteCon({ sb, anotar, origen, enviarCorreo }, { clienteId, perfilId }) {
  const { data: p } = await sb.from("perfiles").select("id, cliente_id").eq("id", perfilId).maybeSingle();
  if (!p || p.cliente_id !== clienteId) return { ok: false, motivo: "Ese usuario no es de este cliente." };
  const { data: u } = await sb.auth.admin.getUserById(perfilId);
  const correo = u?.user?.email;
  if (!correo) return { ok: false, motivo: "Ese usuario no tiene correo." };
  const { cliente } = await leerCliente(sb, clienteId);
  const { data: link, error } = await sb.auth.admin.generateLink({ type: "recovery", email: correo });
  if (error || !link?.properties?.hashed_token) return fallo("No se pudo generar el enlace", error || "sin token");
  const enlace = `${origen}/portal/nueva-clave?token=${encodeURIComponent(link.properties.hashed_token)}`;
  try {
    await enviarCorreo({ correo, contacto: cliente?.contacto || cliente?.empresa, empresa: cliente?.empresa, folio: cliente?.folio, enlace });
  } catch (e) {
    return fallo("No se pudo mandar el correo", e);
  }
  await anotar({ accion: "reenviar_acceso", tabla: "perfiles", registroId: perfilId, detalle: { clienteId, correo } });
  return { ok: true, correo };
}

/* ------------------------------------------------------------------ puntos */

export async function agregarPuntoCon({ sb, anotar }, { clienteId, punto }) {
  const alias = String(punto?.alias || "").trim();
  const calle = String(punto?.calle || "").trim();
  if (!alias || !calle) return { ok: false, motivo: "Escribe un nombre para el punto y su calle." };
  const fila = {
    cliente_id: clienteId, alias, calle,
    colonia: String(punto.colonia || "").trim() || null,
    cp: String(punto.cp || "").trim() || null,
    referencias: String(punto.referencias || "").trim() || null,
    lat: Number.isFinite(Number(punto.lat)) && punto.lat !== "" ? Number(punto.lat) : null,
    lng: Number.isFinite(Number(punto.lng)) && punto.lng !== "" ? Number(punto.lng) : null,
  };
  const { data, error } = await sb.from("domicilios").insert(fila).select("id");
  if (error) return fallo("No se agregó el punto", error);
  await anotar({ accion: "punto_agregado", tabla: "domicilios", registroId: data?.[0]?.id, detalle: { clienteId, alias } });
  return { ok: true, id: data?.[0]?.id };
}

/** Con historial se cancela su servicio (el domicilio queda para el historial); sin historial se borra. */
export async function quitarPuntoCon({ sb, anotar }, { clienteId, domicilioId }) {
  const { data: d } = await sb.from("domicilios").select("id, cliente_id, alias").eq("id", domicilioId).maybeSingle();
  if (!d || d.cliente_id !== clienteId) return { ok: false, motivo: "Ese punto no es de este cliente." };
  const { data: usos } = await sb.from("solicitudes_recoleccion").select("id").eq("domicilio_id", domicilioId).limit(1);
  if ((usos || []).length) {
    await sb.from("suscripciones").update({ estado: "cancelada" }).eq("domicilio_id", domicilioId).select("id");
    await sb.from("contenedores").update({ domicilio_id: null, estado: "en-bodega" }).eq("domicilio_id", domicilioId).select("id");
    await anotar({ accion: "punto_cancelado", tabla: "domicilios", registroId: domicilioId, detalle: { clienteId, alias: d.alias } });
    return { ok: true, cancelado: true };
  }
  await sb.from("contenedores").update({ domicilio_id: null, estado: "en-bodega" }).eq("domicilio_id", domicilioId).select("id");
  const { error } = await sb.from("domicilios").delete().eq("id", domicilioId);
  if (error) return fallo("No se quitó el punto", error);
  await anotar({ accion: "punto_eliminado", tabla: "domicilios", registroId: domicilioId, detalle: { clienteId, alias: d.alias } });
  return { ok: true, borrado: true };
}

export async function cambiarServicioCon({ sb, anotar }, { clienteId, suscripcionId, estado }) {
  if (!["activa", "pausada", "cancelada"].includes(estado)) return { ok: false, motivo: "Estado de servicio no válido." };
  const { data, error } = await sb.from("suscripciones").update({ estado }).eq("id", suscripcionId).eq("cliente_id", clienteId).select("id");
  if (error) return fallo("No se cambió el servicio", error);
  if (!data?.length) return { ok: false, motivo: "Ese servicio no es de este cliente." };
  await anotar({ accion: "servicio_cambiado", tabla: "suscripciones", registroId: suscripcionId, detalle: { clienteId, estado } });
  return { ok: true };
}
