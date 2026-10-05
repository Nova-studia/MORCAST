"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { usuarioActual } from "@/lib/supabase-sesion";
import { registrar } from "@/lib/bitacora";
import { correoInvitacionEquipo } from "@/lib/correo";
import { origenPermitido } from "@/lib/origen.mjs";
import {
  ROLES_INVITABLES,
  validarInvitacion,
  puedeInvitar,
  puedeDarRol,
  puedeCambiarActivo,
} from "@/lib/equipo.mjs";

/**
 * EL EQUIPO DE MORCAST: invitar y desactivar cuentas del personal.
 *
 * Por qué va en el servidor
 * -------------------------
 * Crear un usuario o bloquearlo exige la llave de servicio, que salta todas
 * las políticas de la base y no puede pisar el navegador. Por eso, lo primero
 * que hace cada acción es leer de la SESIÓN quién la llama (no lo que diga el
 * navegador) y pedir que sea dueño o administrador. Las reglas en sí viven en
 * lib/equipo.mjs, con pruebas.
 *
 * Mismo camino que "Dar acceso" a un cliente (acciones-alta-cliente.js): el
 * usuario se crea con una contraseña que nadie ve, y le llega un correo con un
 * enlace para escoger la suya. Si algo truena a media faena, se deshace solo
 * lo que creó esta acción.
 */

/** Una contraseña que nadie va a usar: la persona la cambia con el enlace. */
function passwordQueNadieVe() {
  return randomBytes(24).toString("base64url");
}

/** Bloqueo de inicio de sesión "para siempre" (100 años) y su contrario. */
const BLOQUEO = "876000h";
const SIN_BLOQUEO = "none";

/** Invita a alguien al equipo como administrador o chofer. */
export async function invitarUsuarioEquipo({ nombre, correo, rol }) {
  if (!haySupabase()) return { ok: true, demo: true };

  const quien = await usuarioActual();
  if (!quien) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
  if (!puedeInvitar(quien)) return { ok: false, motivo: "No tienes permiso para invitar al equipo." };

  const v = validarInvitacion({ nombre, correo, rol });
  if (!v.ok) return { ok: false, motivo: v.motivo };
  const { limpio } = v;
  if (!puedeDarRol(quien, limpio.rol)) {
    return { ok: false, motivo: "Solo el dueño puede dar acceso de administrador." };
  }
  const sb = supabaseServidor();

  // 1) ¿Ya existe ese correo? `generateLink({type:"recovery"})` NO crea al
  //    usuario: contesta error si no existe (ver darAccesoACliente). Aquí, a
  //    diferencia del acceso de cliente, NUNCA se reutiliza una cuenta: si el
  //    correo ya es de alguien (un cliente, alguien registrado con Google o
  //    personal), cambiarle el rol a escondidas le daría el panel a quien no
  //    debe. Se para y se dice, para que lo vea una persona.
  const existe = await sb.auth.admin.generateLink({ type: "recovery", email: limpio.correo });
  if (!existe.error && existe.data?.user) {
    const { data: perfil } = await sb
      .from("perfiles").select("nombre, rol").eq("id", existe.data.user.id).maybeSingle();
    return {
      ok: false,
      motivo:
        `El correo ${limpio.correo} ya tiene una cuenta` +
        (perfil?.rol ? ` (${perfil.nombre || "sin nombre"}, rol: ${perfil.rol})` : "") +
        ". Usa otro correo o revísalo a mano.",
    };
  }

  // 2) El usuario, con el rol en app_metadata: es lo que lee el guardia
  //    (proxy.js) para mandarlo a /admin o a /chofer, y lo que el disparador
  //    `sincronizar_perfil()` (db/003) copia al perfil.
  const { data: creado, error: errUsuario } = await sb.auth.admin.createUser({
    email: limpio.correo,
    password: passwordQueNadieVe(),
    email_confirm: true,
    app_metadata: { rol: limpio.rol, cliente_id: null },
    user_metadata: { nombre: limpio.nombre },
  });
  if (errUsuario || !creado?.user) {
    return { ok: false, motivo: `No se pudo crear la cuenta: ${errUsuario?.message || "error desconocido"}` };
  }
  const uid = creado.user.id;

  // La cuenta la creó ESTA acción, así que deshacer es borrarla completa: no
  // puede quedar un usuario de personal sin perfil ni forma de entrar.
  const deshacer = async () => {
    try { await sb.auth.admin.deleteUser(uid); } catch { /* se reporta el error de origen */ }
  };

  // 3) El perfil. El disparador ya lo suele dejar hecho; esto pone el nombre y
  //    asegura el rol por si no hubiera corrido. Un UPDATE que no encuentra
  //    fila no da error, por eso se cuentan las filas.
  const { data: perfilExistente } = await sb
    .from("perfiles").select("id").eq("id", uid).maybeSingle();
  const datosPerfil = { nombre: limpio.nombre, rol: limpio.rol, cliente_id: null, activo: true };
  const { data: perfil, error: errPerfil } = perfilExistente
    ? await sb.from("perfiles").update(datosPerfil).eq("id", uid).select("id")
    : await sb.from("perfiles").insert({ id: uid, ...datosPerfil }).select("id");
  if (errPerfil || !perfil?.length) {
    await deshacer();
    return { ok: false, motivo: `No se pudo guardar el perfil: ${errPerfil?.message || "no se guardó ninguna fila"}` };
  }

  // 4) El enlace para que escoja su contraseña. Sin él nadie podría entrar
  //    nunca con esta cuenta, así que si falla se deshace todo.
  const { data: linkData, error: errLink } = await sb.auth.admin.generateLink({
    type: "recovery",
    email: limpio.correo,
  });
  if (errLink || !linkData?.properties?.hashed_token) {
    await deshacer();
    return { ok: false, motivo: `No se pudo generar el enlace: ${errLink?.message || "sin token"}` };
  }
  const origen = origenPermitido(await headers());
  // /portal/nueva-clave está abierta (proxy.js → ABIERTAS) y, al terminar,
  // manda a "/portal"; el guardia ve el rol y lo regresa a /admin o /chofer.
  const enlace = `${origen}/portal/nueva-clave?token=${encodeURIComponent(linkData.properties.hashed_token)}`;

  // 5) El correo. Es la única forma de que se entere, así que si falla se
  //    deshace todo en vez de dejar una cuenta que nadie sabe que existe.
  try {
    await correoInvitacionEquipo({
      correo: limpio.correo,
      nombre: limpio.nombre,
      rolLegible: ROLES_INVITABLES[limpio.rol],
      enlace,
      invitadoPor: quien.nombre || null,
    });
  } catch (e) {
    await deshacer();
    return { ok: false, motivo: `No se pudo mandar el correo de invitación: ${e?.message || "error desconocido"}` };
  }

  await registrar({
    accion: "invitar_equipo",
    tabla: "perfiles",
    registroId: uid,
    detalle: { correo: limpio.correo, nombre: limpio.nombre, rol: limpio.rol },
  });

  return { ok: true, correo: limpio.correo, rol: limpio.rol };
}

/**
 * Desactiva o reactiva a alguien del equipo.
 *
 * Dos candados a la vez: `perfiles.activo = false` (las políticas de la base y
 * `usuarioActual()` ya ignoran a un perfil inactivo) y el bloqueo en Auth, que
 * le impide iniciar sesión y renovar la que tenga abierta. Con uno solo quedaba
 * un hueco: sin el bloqueo podía seguir entrando a pantallas vacías; sin el
 * `activo`, la base le seguía enseñando datos hasta que venciera su sesión.
 */
export async function cambiarActivoUsuario({ id, activo }) {
  if (!haySupabase()) return { ok: true, demo: true };

  const quien = await usuarioActual();
  if (!quien) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };

  const sb = supabaseServidor();
  const { data: objetivo } = await sb
    .from("perfiles").select("id, nombre, rol, activo").eq("id", id).maybeSingle();

  const evaluado = puedeCambiarActivo({ quien, objetivo });
  if (!evaluado.puede) return { ok: false, motivo: evaluado.motivo };

  const quiereActivo = Boolean(activo);
  const { error: errBan } = await sb.auth.admin.updateUserById(id, {
    ban_duration: quiereActivo ? SIN_BLOQUEO : BLOQUEO,
  });
  if (errBan) return { ok: false, motivo: `No se pudo cambiar el acceso: ${errBan.message}` };

  const { data: cambiado, error: errPerfil } = await sb
    .from("perfiles").update({ activo: quiereActivo }).eq("id", id).select("id");
  if (errPerfil || !cambiado?.length) {
    // Se regresa el bloqueo a como estaba, para no dejar las dos cosas
    // diciendo distinto.
    try {
      await sb.auth.admin.updateUserById(id, { ban_duration: objetivo.activo ? SIN_BLOQUEO : BLOQUEO });
    } catch { /* se reporta el error de origen */ }
    return { ok: false, motivo: `No se pudo guardar el cambio: ${errPerfil?.message || "no se cambió ninguna fila"}` };
  }

  await registrar({
    accion: quiereActivo ? "reactivar_usuario" : "desactivar_usuario",
    tabla: "perfiles",
    registroId: id,
    detalle: { nombre: objetivo.nombre, rol: objetivo.rol },
  });

  return { ok: true, activo: quiereActivo };
}
