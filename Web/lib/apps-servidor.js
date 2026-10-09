import { createClient } from "@supabase/supabase-js";
import { hayResend, correoContrasenaCambiada, correoCambioSolicitudCliente } from "./correo";
import { enviarPush, tokensDeUsuarios, usuariosOficina } from "./push.mjs";
import { mensajePushParada } from "./oficina-recolecciones.mjs";
import { cambiarEstadoSolicitudComo } from "./recolecciones-oficina";
import { usuariosDeClienteCon, conteosClienteCon } from "./clientes-servidor";
import { puedeEliminarCliente, permisosDeEstado } from "./estado-cliente.mjs";
import { validarDatosCliente } from "./cuenta-cliente.mjs";
import { cambiarContrasenaCon, validarCambioContrasena } from "./mi-cuenta.mjs";
import { validarRecoleccionOficina } from "./recoleccion-nueva.mjs";
import { cambiarSolicitudClienteCon } from "./solicitud-cliente-servidor.mjs";
import { hoyMatamoros } from "./avisos.mjs";
import { TIPOS_RESIDUO } from "./cotizar-whatsapp";

/**
 * LO QUE COMPARTEN LA WEB Y LAS APPS (9-oct-2026, "apps al 100%").
 *
 * Vivía dentro de las acciones de la web (app/acciones-*.js). Se movió aquí
 * para que la ruta de las apps (/api/app/accion/[nombre]) use EXACTAMENTE lo
 * mismo. Quien llama ya decidió QUIÉN es (sesión de la web o token de la app)
 * y si tiene permiso; aquí está el trabajo.
 */

/* ------------------------------------------------------------------ ficha del cliente */

export async function fichaClienteCon(sb, { clienteId, rol, permisos }) {
  const [cli, doms, sols, movs] = await Promise.all([
    sb.from("clientes").select("*").eq("id", clienteId).maybeSingle(),
    sb.from("domicilios")
      .select("id, alias, calle, colonia, cp, referencias, lat, lng, suscripciones ( id, estado, frecuencia, servicios_por_mes, por_llamada, rutas ( id, nombre ) )")
      .eq("cliente_id", clienteId).order("alias"),
    sb.from("solicitudes_recoleccion").select("id, folio, estado, fecha_pedida, fecha_confirmada").eq("cliente_id", clienteId)
      .order("fecha_pedida", { ascending: false }).limit(8),
    sb.from("movimientos_saldo").select("id, folio, tipo, concepto, monto, estado, fecha").eq("cliente_id", clienteId)
      .order("fecha", { ascending: false }).limit(8),
  ]);
  if (cli.error || !cli.data) return { ok: false, motivo: "No encontré ese cliente." };
  const usuarios = await usuariosDeClienteCon({ sb }, { clienteId });
  const conteos = await conteosClienteCon({ sb }, { clienteId });
  return {
    ok: true,
    cliente: cli.data,
    puntos: doms.data || [],
    solicitudes: sols.data || [],
    movimientos: movs.data || [],
    usuarios: usuarios.ok ? usuarios.usuarios : [],
    conteos,
    puedeEliminar: puedeEliminarCliente({ rol, permisos: permisos || [] }),
  };
}

/* ------------------------------------------------------------------ mi cuenta del cliente */

export async function cuentaClienteCon(sb, clienteId) {
  const [c, d] = await Promise.all([
    sb.from("clientes").select("folio, empresa, contacto, telefono, correo, rfc, estado").eq("id", clienteId).maybeSingle(),
    sb.from("domicilios")
      .select("id, alias, calle, colonia, cp, suscripciones ( estado, rutas ( nombre, dias ) )")
      .eq("cliente_id", clienteId)
      .order("alias"),
  ]);
  if (c.error || !c.data) return { ok: false, motivo: "No se pudieron leer los datos de tu empresa." };
  const puntos = (d.data || []).map((p) => {
    const s = (p.suscripciones || []).find((x) => x.estado === "activa") || (p.suscripciones || []).find((x) => x.estado === "pausada");
    return {
      id: p.id,
      alias: p.alias || "Punto",
      direccion: [p.calle, p.colonia, p.cp].filter(Boolean).join(", "),
      ruta: s?.rutas?.nombre || "",
      dias: s?.rutas?.dias || [],
      pausado: s?.estado === "pausada",
    };
  });
  return { ok: true, empresa: c.data, puntos };
}

export async function guardarDatosClienteCon({ sb, anotar }, { clienteId }, datos) {
  // Suspendida = solo ver y agregar saldo (db/028).
  const { data: empresa } = await sb.from("clientes").select("estado").eq("id", clienteId).maybeSingle();
  if (!permisosDeEstado(empresa?.estado || "baja").puedeOperar) {
    return { ok: false, motivo: "Tu cuenta está suspendida: por ahora no puedes cambiar estos datos. Contáctanos." };
  }
  const v = validarDatosCliente(datos || {});
  if (!v.ok) return v;
  const { data, error } = await sb.from("clientes").update(v.limpio).eq("id", clienteId).select("id");
  if (error || !data?.length) return { ok: false, motivo: `No se guardó: ${error?.message || "ninguna fila"}` };
  await anotar({ accion: "cliente_edita_contacto", tabla: "clientes", registroId: clienteId, detalle: v.limpio });
  return { ok: true };
}

/* ------------------------------------------------------------------ contraseña */

/**
 * Cambiar MI contraseña con la actual. `token` = el de ESTA sesión (para
 * cerrar las demás y no esta). El freno lo pone quien llama.
 */
export async function cambiarContrasenaServidor({ sbServicio, uid, correo, token, anotar }, { actual, nueva, repetir } = {}) {
  const v = validarCambioContrasena({ actual, nueva, repetir });
  if (!v.ok) return v;
  const r = await cambiarContrasenaCon(
    {
      comprobar: async (c, clave) => {
        const prueba = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await prueba.auth.signInWithPassword({ email: c, password: clave });
        if (error) return false;
        // La sesión de prueba se cierra siempre.
        await prueba.auth.signOut({ scope: "local" });
        return data?.user?.id === uid;
      },
      guardar: async (id, clave) => {
        const { error } = await sbServicio.auth.admin.updateUserById(id, { password: clave });
        if (error) throw new Error(error.message);
      },
      avisar: async () => {
        try { await correoContrasenaCambiada({ correo }); } catch (e) {
          console.error("[mi-cuenta] no se pudo avisar:", e?.message);
        }
      },
    },
    { correo, uid, actual, nueva, repetir }
  );
  if (!r.ok) return r;
  await anotar({ accion: "mi_contrasena", tabla: "perfiles", registroId: uid, detalle: {} });
  // Las sesiones de OTROS aparatos se cierran; esta sigue.
  try {
    if (token) await sbServicio.auth.admin.signOut(token, "others");
  } catch (e) {
    console.error("[mi-cuenta] no se cerraron las otras sesiones:", e?.message);
  }
  return r;
}

/* ------------------------------------------------------------------ recolección de la oficina */

/**
 * `sb` escribe (la sesión de la web, bajo RLS; o la llave de servicio desde
 * la app, que ya pasó el permiso de Recolecciones).
 */
export async function crearRecoleccionOficinaCon({ sb, sbServicio, actor, anotar }, datos = {}) {
  const v = validarRecoleccionOficina(datos, { hoy: hoyMatamoros(), tipos: TIPOS_RESIDUO });
  if (!v.ok) return v;
  const l = v.limpio;
  const { data: punto } = await sb
    .from("domicilios")
    .select("id, cliente_id, clientes ( estado, empresa ), suscripciones ( estado, ruta_id )")
    .eq("id", l.domicilioId)
    .maybeSingle();
  if (!punto || punto.cliente_id !== l.clienteId) return { ok: false, motivo: "Ese punto no es de ese cliente." };
  if (punto.clientes?.estado === "baja") return { ok: false, motivo: "Ese cliente está dado de baja." };
  // La ruta de su servicio activo (o pausado); nunca la de uno cancelado.
  const subs = punto.suscripciones || [];
  const servicio = subs.find((s) => s.estado === "activa") || subs.find((s) => s.estado === "pausada");

  const { data: creada, error } = await sb
    .from("solicitudes_recoleccion")
    .insert({
      folio: null,
      cliente_id: l.clienteId,
      domicilio_id: l.domicilioId,
      ruta_id: servicio?.ruta_id || null,
      origen: l.origen,
      fecha_pedida: l.fecha,
      estado: "solicitada",
      nota: l.nota,
      tipo_residuo: l.tipoResiduo,
      creada_por: actor.id,
    })
    .select("id, folio")
    .single();
  if (error || !creada) return { ok: false, motivo: `No se pudo crear: ${error?.message || "sin respuesta"}` };

  await anotar({
    accion: "crear_recoleccion_oficina",
    tabla: "solicitudes_recoleccion",
    registroId: creada.id,
    detalle: { folio: creada.folio, cliente: punto.clientes?.empresa, fecha: l.fecha, confirmar: l.confirmar },
  });
  if (!l.confirmar) return { ok: true, folio: creada.folio, estado: "solicitada" };

  const r = await cambiarEstadoSolicitudComo({
    sb,
    sbServicio,
    actor,
    id: creada.id,
    cambios: { estado: "confirmada", fecha_confirmada: l.fecha, hora_confirmada: l.hora, chofer_id: l.choferId },
    accion: "confirmar_recoleccion",
  });
  return r.ok
    ? { ok: true, folio: creada.folio, estado: "confirmada" }
    : { ok: true, folio: creada.folio, estado: "solicitada", motivo: `Se creó, pero no se pudo confirmar: ${r.motivo}` };
}

/* ------------------------------------------------------------------ el cliente cancela o reagenda */

export async function cambiarSolicitudDeClienteCon({ sb, quien, anotar, origen }, datos = {}) {
  // El estado de la EMPRESA: suspendida o de baja no cambia nada (db/028).
  const { data: empresa } = await sb.from("clientes").select("estado").eq("id", quien.cliente_id).maybeSingle();
  return cambiarSolicitudClienteCon(
    {
      sb,
      quien: { ...quien, estadoCliente: empresa?.estado || "baja" },
      anotar,
      avisarOficina: async (e) => {
        // ?folio= enseña esa solicitud con cualquier estado.
        const enlace = `${origen}/admin/recolecciones?folio=${encodeURIComponent(e.folio)}`;
        const tareas = [];
        if (hayResend()) tareas.push(correoCambioSolicitudCliente({ ...e, enlace }));
        tareas.push((async () => {
          const tokens = await tokensDeUsuarios(sb, await usuariosOficina(sb));
          if (!tokens.length) return;
          await enviarPush(tokens, {
            titulo: e.accion === "cancelar" ? "Recolección cancelada por el cliente" : "Un cliente cambió la fecha",
            cuerpo: `${e.empresa || "Un cliente"} · ${e.folio}${e.accion === "reagendar" ? ` → ${e.despues}` : ""}`,
            datos: { tipo: "solicitud", id: e.id, folio: e.folio },
          }, { sb });
        })());
        await Promise.allSettled(tareas);
      },
      avisarChofer: async ({ uid, parada }) => {
        const tokens = await tokensDeUsuarios(sb, [uid]);
        if (tokens.length) await enviarPush(tokens, mensajePushParada("quitada", parada), { sb });
      },
    },
    { ...datos, hoy: hoyMatamoros() }
  );
}
