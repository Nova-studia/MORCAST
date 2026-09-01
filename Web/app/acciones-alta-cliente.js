"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { usuarioActual } from "@/lib/supabase-sesion";
import { registrar } from "@/lib/bitacora";
import { correoCuentaActivada, correoAccesoCliente } from "@/lib/correo";
import { origenPermitido } from "@/lib/origen.mjs";
import { puedeRecibirAcceso } from "@/lib/estado-cliente.mjs";

/**
 * ALTA DE UN CLIENTE CON SU ACCESO AL PORTAL.
 *
 * Por qué esto existe
 * -------------------
 * El botón "Activar cuenta de cliente" de /admin/solicitudes NO creaba nada.
 * Guardaba `{activada: true}` en un `useState`, pintaba una palomita verde que
 * decía "Cuenta de cliente activada" y ofrecía mandar las credenciales por
 * WhatsApp. Al recargar la página desaparecía todo, y en la base no había ni
 * usuario, ni perfil, ni cliente. Morcast le mandaba al cliente un correo y una
 * contraseña que NO FUNCIONABAN, y se enteraba cuando el cliente llamaba.
 *
 * De hecho no había forma de dar de alta a un cliente desde la interfaz: en
 * todo el proyecto no existía una sola llamada que creara usuarios.
 *
 * Por qué va en el servidor
 * -------------------------
 * Crear un usuario exige la llave de servicio, que salta todas las políticas
 * de la base. Esa llave no puede pisar el navegador. Y como esta acción es un
 * endpoint abierto al mundo en cuanto existe, lo primero que hace es exigir
 * que quien la llama sea dueño o administrador, leyéndolo de la SESIÓN y no de
 * lo que diga el navegador.
 */

const PERSONAL = ["dueno", "admin"];

/** Correo válido, a secas. La validación de verdad la hace Supabase Auth. */
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function exigirPersonal() {
  const quien = await usuarioActual();
  if (!quien) return { error: "Tu sesión se venció. Vuelve a entrar." };
  if (!PERSONAL.includes(quien.rol)) return { error: "No tienes permiso para dar de alta clientes." };
  return { quien };
}

/**
 * Da de alta la empresa y su primer acceso al portal.
 *
 * Deja las cosas en este orden, y el orden importa:
 *   1. el usuario de acceso  (si el correo ya existe, no se toca nada más)
 *   2. la empresa
 *   3. el perfil, que amarra al usuario con su empresa
 *
 * Si algo truena a media faena se deshace lo ya creado, para no dejar una
 * empresa sin acceso o un usuario colgando sin empresa.
 */
export async function activarCuentaCliente({
  cotizacionId,
  empresa,
  contacto,
  telefono,
  correo,
  password,
}) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { quien, error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const limpio = {
    empresa: String(empresa || "").trim(),
    contacto: String(contacto || "").trim(),
    telefono: String(telefono || "").trim(),
    correo: String(correo || "").trim().toLowerCase(),
  };

  if (!limpio.empresa) return { ok: false, motivo: "Falta el nombre de la empresa." };
  if (!CORREO_RE.test(limpio.correo)) return { ok: false, motivo: "El correo no es válido." };
  if (!password || String(password).length < 8) {
    return { ok: false, motivo: "La contraseña debe tener al menos 8 caracteres." };
  }

  const sb = supabaseServidor();

  // ¿Ya existe ese correo? Crearlo dos veces no truena de forma legible, y
  // peor: dejaría a la empresa duplicada.
  const { data: existentes } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (existentes?.users?.some((u) => (u.email || "").toLowerCase() === limpio.correo)) {
    return {
      ok: false,
      motivo: `Ya hay una cuenta con el correo ${limpio.correo}. Usa otro correo o revisa en Usuarios y roles.`,
    };
  }

  // 1) El usuario. `email_confirm: true` porque lo da de alta Morcast: no se
  //    le pide al cliente que confirme un correo que él no pidió.
  const { data: creado, error: errUsuario } = await sb.auth.admin.createUser({
    email: limpio.correo,
    password: String(password),
    email_confirm: true,
    // El rol va en app_metadata, NUNCA en user_metadata: user_metadata lo
    // puede editar el propio usuario desde su navegador, y entonces
    // cualquiera se haría admin.
    app_metadata: { rol: "cliente" },
    user_metadata: { nombre: limpio.contacto || limpio.empresa },
  });

  if (errUsuario || !creado?.user) {
    return { ok: false, motivo: `No se pudo crear el acceso: ${errUsuario?.message || "error desconocido"}` };
  }
  const uid = creado.user.id;

  const deshacerUsuario = async () => {
    try { await sb.auth.admin.deleteUser(uid); } catch { /* se reporta el error de origen */ }
  };

  // 2) La empresa. El folio lo asigna la base (db/014), con un candado que
  //    serializa la asignación: calcularlo aquí era una carrera.
  const { data: cliente, error: errCliente } = await sb
    .from("clientes")
    .insert({
      empresa: limpio.empresa,
      contacto: limpio.contacto || null,
      correo: limpio.correo,
      telefono: limpio.telefono || null,
      estado: "activo",
    })
    .select("id, folio, empresa")
    .single();

  if (errCliente || !cliente) {
    await deshacerUsuario();
    // 23505 = unique_violation. Desde db/020 hay un indice unico en
    // `clientes.empresa` (lo usa `scripts/cuaderno/cargar.mjs` para no
    // duplicar al recargar el cuaderno). Antes de esto, dar de alta a una
    // empresa que ya estaba en la base tronaba con
    // "duplicate key value violates unique constraint clientes_empresa_key",
    // que no le dice a quien administra que hacer. Se detecta por el CODIGO
    // de Postgres, no por el texto del mensaje: el texto puede cambiar de
    // idioma o de version sin que el codigo cambie.
    if (errCliente?.code === "23505") {
      return {
        ok: false,
        motivo: "Ya existe un cliente con ese nombre. Dale acceso desde la pantalla de Clientes.",
      };
    }
    return { ok: false, motivo: `No se pudo crear la empresa: ${errCliente?.message || "error desconocido"}` };
  }

  // 3) El perfil. Hay un disparador en la base que lo crea al nacer el
  //    usuario, con rol cliente y `cliente_id` nulo. Se completa; y si por lo
  //    que sea no existiera, se crea.
  const { data: perfilExistente } = await sb
    .from("perfiles").select("id").eq("id", uid).maybeSingle();

  const datosPerfil = {
    nombre: limpio.contacto || limpio.empresa,
    rol: "cliente",
    cliente_id: cliente.id,
    telefono: limpio.telefono || null,
    activo: true,
  };

  const { data: perfil, error: errPerfil } = perfilExistente
    ? await sb.from("perfiles").update(datosPerfil).eq("id", uid).select("id")
    : await sb.from("perfiles").insert({ id: uid, ...datosPerfil }).select("id");

  // Un UPDATE que no encuentra fila NO da error: responde 200 y cambia cero.
  // Si el perfil no quedó amarrado a la empresa, el cliente entra y ve un
  // portal vacío con "Tu cuenta no tiene empresa asignada".
  if (errPerfil || !perfil?.length) {
    await sb.from("clientes").delete().eq("id", cliente.id);
    await deshacerUsuario();
    return {
      ok: false,
      motivo: `No se pudo ligar la cuenta con la empresa: ${errPerfil?.message || "no se guardó ninguna fila"}`,
    };
  }

  // 4) Si vino de una solicitud del formulario, se marca como ganada. Que no
  //    se pueda no invalida el alta, que es lo importante.
  if (cotizacionId) {
    await sb.from("cotizaciones").update({ estado: "ganada" }).eq("id", cotizacionId);
  }

  await registrar({
    accion: "alta_cliente",
    tabla: "clientes",
    registroId: cliente.id,
    detalle: {
      folio: cliente.folio,
      empresa: cliente.empresa,
      correo: limpio.correo,
      cotizacion_id: cotizacionId || null,
      // La contraseña NO se registra. La bitácora la leen varias personas.
    },
  });

  return {
    ok: true,
    cliente: { id: cliente.id, folio: cliente.folio, empresa: cliente.empresa },
    correo: limpio.correo,
    creadaPor: quien.correo,
  };
}

/**
 * ¿Ya hay una cuenta con este correo?
 *
 * La usa la pantalla para saber si una solicitud ya está activada, en vez de
 * fiarse de un estado en memoria que se pierde al recargar.
 */
export async function existeCuenta(correo) {
  if (!haySupabase()) return { ok: true, existe: false, demo: true };

  const { error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const buscado = String(correo || "").trim().toLowerCase();
  if (!buscado) return { ok: true, existe: false };

  const sb = supabaseServidor();
  const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  return { ok: true, existe: Boolean(data?.users?.some((u) => (u.email || "").toLowerCase() === buscado)) };
}

/**
 * ACTIVAR A ALGUIEN QUE YA EXISTE (se registró solo con Google).
 *
 * Es un camino aparte de `activarCuentaCliente`, y la diferencia importa:
 * aquella CREA el usuario; aquí el usuario ya existe y es de esa persona.
 *
 * 🔴 POR ESO EL DESHACER ES DISTINTO. Si algo truena a media faena,
 * `activarCuentaCliente` borra el usuario. Hacer eso aquí sería destruir la
 * cuenta de Google de alguien real. Aquí se deshace lo que NOSOTROS creamos
 * —la empresa y el sello— y el usuario no se toca nunca.
 */
export async function activarCuentaRegistrada({ solicitudId, password }) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { quien, error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  if (!password || String(password).length < 8) {
    return { ok: false, motivo: "La contraseña debe tener al menos 8 caracteres." };
  }

  const sb = supabaseServidor();

  const { data: solicitud, error: errSolicitud } = await sb
    .from("solicitudes_alta")
    .select("id, folio, empresa, contacto, telefono, correo, usuario_id, origen")
    .eq("id", solicitudId)
    .single();

  if (errSolicitud || !solicitud) {
    return { ok: false, motivo: "No se encontró esa solicitud." };
  }
  if (!solicitud.usuario_id) {
    return {
      ok: false,
      motivo: "Esta solicitud no tiene cuenta ligada. Se activa con el alta normal, no por aquí.",
    };
  }

  const uid = solicitud.usuario_id;

  // ¿Ya estaba activada? Volver a hacerlo crearía una empresa duplicada.
  const { data: perfilPrevio } = await sb
    .from("perfiles").select("rol, cliente_id").eq("id", uid).maybeSingle();
  if (perfilPrevio?.cliente_id) {
    return { ok: false, motivo: "Esa cuenta ya está activada y ligada a una empresa." };
  }

  // 1) La empresa. El folio lo asigna la base (db/014), con su candado
  //    contra carreras: calcularlo aquí sería leer el máximo y luego escribir.
  const { data: cliente, error: errCliente } = await sb
    .from("clientes")
    .insert({
      empresa: solicitud.empresa,
      contacto: solicitud.contacto || null,
      correo: solicitud.correo,
      telefono: solicitud.telefono || null,
      estado: "activo",
    })
    .select("id, folio, empresa")
    .single();

  if (errCliente || !cliente) {
    return { ok: false, motivo: `No se pudo crear la empresa: ${errCliente?.message || "error desconocido"}` };
  }

  // Deshacer: SOLO lo que creamos nosotros. El usuario NO se toca.
  //
  // 🔴 Y aquí el orden no basta: hay que COMPROBAR. `perfiles.cliente_id`
  // apunta a `clientes(id)` con ON DELETE CASCADE
  // (`perfiles_cliente_id_fkey`). Si se borrara la empresa con el perfil
  // todavía enganchado a ella, la cascada se llevaría por delante la fila de
  // `perfiles` de una persona real. Y eso no se arregla: `usuarioActual()` le
  // devolvería null para siempre, y volver a activarla tampoco la repondría.
  // Es además el escenario correlacionado, porque este deshacer se dispara
  // justo cuando un update sobre `perfiles` acaba de fallar.
  //
  // Por eso: primero se desengancha el perfil, se cuentan las filas, y sólo
  // si quedó desenganchado de verdad se borra la empresa. Si no, la empresa
  // se deja huérfana a propósito. Una empresa huérfana se limpia desde el
  // panel; un perfil borrado, no.
  const deshacer = async () => {
    try {
      await sb.auth.admin.updateUserById(uid, { app_metadata: { rol: null, cliente_id: null } });
    } catch { /* se reporta el error de origen */ }

    // Ojo: vaciar el `app_metadata` de arriba NO limpia `perfiles.cliente_id`,
    // porque el disparador `sincronizar_perfil()` se sale temprano cuando el
    // rol viene nulo. Lo único que desengancha el perfil es este update.
    let desenganchado = false;
    try {
      const { data: soltado, error: errSoltar } = await sb
        .from("perfiles")
        .update({ rol: "pendiente", cliente_id: null })
        .eq("id", uid)
        .select("id");
      // Un UPDATE que no encuentra fila NO da error: responde 200 y cambia cero.
      desenganchado = !errSoltar && Boolean(soltado?.length);
      if (!desenganchado) {
        console.error(
          `[activar] no se pudo desenganchar el perfil ${uid}: ${errSoltar?.message || "no se cambió ninguna fila"}`
        );
      }
    } catch (e) {
      console.error(`[activar] no se pudo desenganchar el perfil ${uid}: ${e?.message}`);
    }

    if (!desenganchado) {
      console.error(
        `[activar] la empresa ${cliente.folio} (${cliente.id}) se queda HUÉRFANA a propósito: ` +
          `borrarla con el perfil ${uid} todavía enganchado se lo llevaría por cascada. ` +
          `Hay que borrarla a mano desde el panel.`
      );
      return;
    }

    try {
      await sb.from("clientes").delete().eq("id", cliente.id);
    } catch (e) {
      console.error(`[activar] no se pudo borrar la empresa ${cliente.id}: ${e?.message}`);
    }
  };

  // 2) El sello y la contraseña, en una sola llamada. El disparador
  //    `sincronizar_perfil()` (db/003) ve cambiar el app_metadata y acomoda
  //    `perfiles` solo. Va DESPUÉS de crear la empresa porque ese disparador
  //    ignora un rol 'cliente' sin `cliente_id`: sería incoherente.
  const { error: errSello } = await sb.auth.admin.updateUserById(uid, {
    password: String(password),
    app_metadata: { rol: "cliente", cliente_id: cliente.id },
  });

  if (errSello) {
    await deshacer();
    return { ok: false, motivo: `No se pudo activar el acceso: ${errSello.message}` };
  }

  // 3) Completar lo que el disparador no toca (nombre y teléfono), y
  //    asegurar el amarre por si el disparador no hubiera corrido.
  const { data: perfil, error: errPerfil } = await sb
    .from("perfiles")
    .update({
      nombre: solicitud.contacto || solicitud.empresa,
      rol: "cliente",
      cliente_id: cliente.id,
      telefono: solicitud.telefono || null,
      activo: true,
    })
    .eq("id", uid)
    .select("id");

  // Un UPDATE que no encuentra fila NO da error: responde 200 y cambia cero.
  if (errPerfil || !perfil?.length) {
    await deshacer();
    return {
      ok: false,
      motivo: `No se pudo ligar la cuenta con la empresa: ${errPerfil?.message || "no se guardó ninguna fila"}`,
    };
  }

  // 4) La solicitud queda trabajada. Que esto falle no invalida la activación.
  await sb.from("solicitudes_alta").update({ estado: "aprobada" }).eq("id", solicitud.id);

  try {
    await correoCuentaActivada({
      correo: solicitud.correo,
      contacto: solicitud.contacto || solicitud.empresa,
      empresa: cliente.empresa,
      folio: cliente.folio,
    });
  } catch (e) {
    console.error("[activar] aviso al cliente falló:", e?.message);
  }

  await registrar({
    accion: "activar_cuenta_registrada",
    tabla: "clientes",
    registroId: cliente.id,
    detalle: {
      folio: cliente.folio,
      empresa: cliente.empresa,
      correo: solicitud.correo,
      solicitud: solicitud.folio,
      // La contraseña NO se registra. La bitácora la leen varias personas.
    },
  });

  return {
    ok: true,
    cliente: { id: cliente.id, folio: cliente.folio, empresa: cliente.empresa },
    correo: solicitud.correo,
    creadaPor: quien.correo,
  };
}

/** Contraseña que nadie va a ver. Solo existe para que Supabase acepte crear
 *  el usuario; el cliente la pisa en cuanto abre el enlace de acceso. */
function passwordQueNadieVe() {
  return randomBytes(24).toString("base64url");
}

/**
 * DAR ACCESO AL PORTAL A UN CLIENTE QUE YA ESTÁ EN LA BASE.
 *
 * Por qué esto existe
 * --------------------
 * Los 43 clientes reales cargados el 27-ago-2026 no tienen acceso, y no
 * había forma de dárselo: `activarCuentaCliente` y `activarCuentaRegistrada`
 * siempre hacen `insert` en `clientes` porque se escribieron para "llega un
 * prospecto de la nada". Intentarlo con ellas para un cliente que ya existe
 * truena contra el índice único `clientes_empresa_key` (db/020) con
 * "duplicate key value violates unique constraint", que no le dice a nadie
 * qué hacer.
 *
 * Esta acción es la contraria en lo esencial: NUNCA hace `insert` en
 * `clientes`. Parte de un cliente que ya está y solo crea (o liga) el acceso.
 *
 * Cómo se resuelve "¿ya existe un usuario con este correo?"
 * -----------------------------------------------------------
 * `listUsers()` solo mira la primera página (ver el bug que se cuenta en
 * `acciones-recuperar.js`), así que no sirve para preguntar por un correo.
 * En vez de eso se usa `generateLink({type:"recovery", ...})`: a diferencia
 * de `signup`/`invite`/`magiclink`, para `recovery` Supabase NO crea al
 * usuario — contesta con error si no existe. Una sola llamada resuelve
 * "¿existe?" y, cuando existe, de una vez trae el material del enlace que
 * hay que mandar.
 *
 * Si ya existe (alguien que se registró solo con Google), ESE usuario se
 * liga y no se toca su contraseña. Y si algo truena a media faena, el
 * deshacer NUNCA lo borra ni toca el `cliente` (que es de la operación real):
 * solo revierte lo que esta acción misma acaba de poner. Es la misma
 * distinción que ya documenta `activarCuentaRegistrada` — léela si algo aquí
 * no cuadra.
 */
export async function darAccesoACliente({ clienteId }) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { quien, error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const sb = supabaseServidor();

  const { data: cliente, error: errCliente } = await sb
    .from("clientes")
    .select("id, folio, empresa, contacto, correo, telefono")
    .eq("id", clienteId)
    .maybeSingle();

  if (errCliente || !cliente) {
    return { ok: false, motivo: "No se encontró ese cliente." };
  }

  // ¿Ya hay un perfil ligado a ESTE cliente? Es la misma pregunta que hace
  // /admin/clientes para deshabilitar el botón — aquí se repite porque la
  // pantalla puede tener datos viejos (otra pestaña lo pudo haber activado
  // hace un segundo) y esta es la comprobación que de verdad cuenta.
  const { data: perfilLigado } = await sb
    .from("perfiles")
    .select("id")
    .eq("cliente_id", cliente.id)
    .maybeSingle();

  // La regla vive en un solo lugar (estado-cliente.mjs): aquí solo se arma lo
  // que esa regla necesita mirar.
  const evaluado = puedeRecibirAcceso({ correo: cliente.correo, tieneAcceso: Boolean(perfilLigado) });
  if (!evaluado.puede) {
    return {
      ok: false,
      motivo:
        evaluado.motivo === "ya-tiene-acceso"
          ? "Ese cliente ya tiene acceso al portal."
          : "Este cliente no tiene correo registrado. Agrégaselo antes de darle acceso.",
    };
  }

  const correo = String(cliente.correo).trim().toLowerCase();

  // 1) ¿Ya existe un usuario de Supabase con ese correo? Ver el porqué de
  //    `generateLink` (en vez de `listUsers`) en el comentario de arriba.
  let uid = null;
  let yaExistia = false;
  let materialEnlace = null;

  const intento = await sb.auth.admin.generateLink({ type: "recovery", email: correo });
  if (!intento.error && intento.data?.user) {
    uid = intento.data.user.id;
    yaExistia = true;
    materialEnlace = intento.data.properties;
  }

  // Deshacer: SOLO lo que creó esta acción.
  //
  // 🔴 Si el usuario ya existía, NUNCA se borra — sería destruir la cuenta de
  // una persona real. Se revierte nada más el sello que le pusimos (rol y
  // empresa), y se desengancha el perfil por si ya se había ligado, para no
  // dejarlo a medias entre "cliente de esta empresa" y "sin empresa".
  //
  // Si el usuario lo creó esta acción, sí se borra completo: no puede quedar
  // un usuario colgando sin ningún cliente al que sirva, y el `cliente` en sí
  // JAMÁS se toca aquí — es de la operación real, no algo que esta acción
  // haya creado.
  const deshacer = async () => {
    if (!yaExistia) {
      try { await sb.auth.admin.deleteUser(uid); } catch { /* se reporta el error de origen */ }
      return;
    }
    try {
      await sb.auth.admin.updateUserById(uid, { app_metadata: { rol: null, cliente_id: null } });
    } catch { /* se reporta el error de origen */ }
    try {
      await sb.from("perfiles").update({ rol: "pendiente", cliente_id: null }).eq("id", uid);
    } catch { /* se reporta el error de origen */ }
  };

  if (!uid) {
    // 2) No existe: se crea con una contraseña que nadie ve. El `cliente_id`
    //    va desde ya en el alta —a diferencia de `activarCuentaCliente`, aquí
    //    la empresa YA EXISTE, así que no hace falta el paso aparte de sellar
    //    el rol después de crear la empresa.
    const { data: creado, error: errUsuario } = await sb.auth.admin.createUser({
      email: correo,
      password: passwordQueNadieVe(),
      email_confirm: true,
      app_metadata: { rol: "cliente", cliente_id: cliente.id },
      user_metadata: { nombre: cliente.contacto || cliente.empresa },
    });
    if (errUsuario || !creado?.user) {
      return { ok: false, motivo: `No se pudo crear el acceso: ${errUsuario?.message || "error desconocido"}` };
    }
    uid = creado.user.id;
  } else {
    // El usuario ya existía: se liga a esta empresa, pero su contraseña NO
    // se toca — no es nuestra para cambiarla.
    const { error: errSello } = await sb.auth.admin.updateUserById(uid, {
      app_metadata: { rol: "cliente", cliente_id: cliente.id },
    });
    if (errSello) {
      return { ok: false, motivo: `No se pudo ligar el acceso: ${errSello.message}` };
    }
  }

  // 3) El perfil. El disparador `nuevo_usuario()`/`sincronizar_perfil()`
  //    (db/003) ya deja `rol` y `cliente_id` acomodados con el paso de
  //    arriba; esto completa lo que el disparador no toca (nombre, teléfono)
  //    y asegura el amarre por si el disparador no hubiera corrido.
  const { data: perfilExistente } = await sb
    .from("perfiles").select("id").eq("id", uid).maybeSingle();

  const datosPerfil = {
    nombre: cliente.contacto || cliente.empresa,
    rol: "cliente",
    cliente_id: cliente.id,
    telefono: cliente.telefono || null,
    activo: true,
  };

  const { data: perfil, error: errPerfil } = perfilExistente
    ? await sb.from("perfiles").update(datosPerfil).eq("id", uid).select("id")
    : await sb.from("perfiles").insert({ id: uid, ...datosPerfil }).select("id");

  // Un UPDATE que no encuentra fila NO da error: responde 200 y cambia cero.
  if (errPerfil || !perfil?.length) {
    await deshacer();
    return {
      ok: false,
      motivo: `No se pudo ligar la cuenta con la empresa: ${errPerfil?.message || "no se guardó ninguna fila"}`,
    };
  }

  // 4) El enlace para que elija su contraseña. Si el usuario ya existía, el
  //    material del paso 1 sirve tal cual — no hay que volver a pedirlo. Si
  //    se acaba de crear, en el paso 1 el correo todavía no existía y
  //    `generateLink` respondió error, así que se pide aquí, ya que sí existe.
  if (!materialEnlace) {
    const { data: linkData, error: errLink } = await sb.auth.admin.generateLink({
      type: "recovery",
      email: correo,
    });
    if (errLink || !linkData?.properties?.hashed_token) {
      // Sin enlace no hay forma de que el cliente entre nunca: la contraseña
      // que se le puso es aleatoria y nadie la sabe. Dejar el acceso a medias
      // sería peor que no haberlo creado, así que se deshace.
      await deshacer();
      return { ok: false, motivo: `No se pudo generar el enlace de acceso: ${errLink?.message || "sin token"}` };
    }
    materialEnlace = linkData.properties;
  }

  const origen = origenPermitido(await headers());
  const enlace = `${origen}/portal/nueva-clave?token=${encodeURIComponent(materialEnlace.hashed_token)}`;

  // 5) El correo. Sin él el cliente no tiene forma de enterarse de que ya
  //    tiene acceso —no hay contraseña que enseñarle en pantalla, a
  //    propósito— así que si Resend falla, se deshace todo.
  try {
    await correoAccesoCliente({
      correo,
      contacto: cliente.contacto || cliente.empresa,
      empresa: cliente.empresa,
      folio: cliente.folio,
      enlace,
    });
  } catch (e) {
    await deshacer();
    return { ok: false, motivo: `No se pudo mandar el correo de acceso: ${e?.message || "error desconocido"}` };
  }

  await registrar({
    accion: "invitar_cliente",
    tabla: "clientes",
    registroId: cliente.id,
    detalle: {
      folio: cliente.folio,
      empresa: cliente.empresa,
      correo,
      usuario_ya_existia: yaExistia,
    },
  });

  return { ok: true, correo, folio: cliente.folio, creadaPor: quien.correo };
}
