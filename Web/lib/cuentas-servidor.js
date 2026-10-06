import { randomBytes } from "node:crypto";
import { correoCuentaActivada, correoAccesoCliente } from "./correo";
import { puedeRecibirAcceso, puedeSellarUsuarioExistente } from "./estado-cliente.mjs";

/**
 * LAS CUENTAS DE LOS CLIENTES, DEL LADO DEL SERVIDOR (6-oct-2026).
 *
 * Esto vivía dentro de `app/acciones-alta-cliente.js`. Se sacó aquí, tal
 * cual, cuando la app empezó a hacer lo mismo que el panel (activar, dar
 * acceso, bajar el PDF del alta): la acción de la web y la ruta
 * `/api/app/...` llaman a ESTE código, así que la bitácora, el conteo de
 * filas, los correos y el deshacer no pueden decir cosas distintas según
 * desde dónde se pulsó el botón.
 *
 * Lo que NO vive aquí, a propósito, es quién llama: cada puerta comprueba a
 * su manera que sea dueño o administrador (la web con la cookie y su pase,
 * la app con el token y su pase) y luego entra con:
 *   · `sb`     cliente de Supabase con la llave de SERVICIO (crear usuarios
 *              y firmar enlaces la necesitan);
 *   · `anotar` cómo se escribe la bitácora a nombre de quien llamó
 *              (`registrar` en la web, `anotarBitacora` en la app);
 *   · `origen` (sólo dar acceso) el origen ya validado para el enlace del
 *              correo (`origenPermitido`).
 *
 * Ninguna recibe ni devuelve la contraseña hacia la bitácora: la bitácora la
 * leen varias personas.
 */

/** Correo válido, a secas. La validación de verdad la hace Supabase Auth. */
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
export async function activarCuentaClienteCon({ sb, anotar }, {
  cotizacionId,
  empresa,
  contacto,
  telefono,
  correo,
  password,
}) {
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

  await anotar({
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
  };
}

/**
 * ¿Ya hay una cuenta con este correo?
 *
 * La usa la pantalla para saber si una solicitud ya está activada, en vez de
 * fiarse de un estado en memoria que se pierde al recargar.
 */
export async function existeCuentaCon(sb, correo) {
  const buscado = String(correo || "").trim().toLowerCase();
  if (!buscado) return { ok: true, existe: false };

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
export async function activarCuentaRegistradaCon({ sb, anotar }, { solicitudId, password }) {
  if (!password || String(password).length < 8) {
    return { ok: false, motivo: "La contraseña debe tener al menos 8 caracteres." };
  }

  const { data: solicitud, error: errSolicitud } = await sb
    .from("solicitudes_alta")
    .select("id, folio, empresa, contacto, telefono, correo, usuario_id, origen, alias, calle, colonia, cp, referencias, lat, lng")
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

  // 4) Su punto de recolección, con el pin que el cliente puso en el mapa al
  //    darse de alta (6-oct-2026). Antes la activación creaba la empresa sin
  //    ningún domicilio: el pin se quedaba en la solicitud, la recolección
  //    que pedía el cliente salía sin dirección y el chofer no tenía «Cómo
  //    llegar». Que falle NO deshace la activación —la cuenta ya sirve—: se
  //    avisa en la respuesta para que el punto se ponga desde el panel.
  const punto = await crearPuntoDelAlta(sb, cliente.id, solicitud);

  // 5) La solicitud queda trabajada. Que esto falle no invalida la activación.
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

  await anotar({
    accion: "activar_cuenta_registrada",
    tabla: "clientes",
    registroId: cliente.id,
    detalle: {
      folio: cliente.folio,
      empresa: cliente.empresa,
      correo: solicitud.correo,
      solicitud: solicitud.folio,
      punto: punto.ok ? punto.id : null,
      // La contraseña NO se registra. La bitácora la leen varias personas.
    },
  });

  return {
    ok: true,
    cliente: { id: cliente.id, folio: cliente.folio, empresa: cliente.empresa },
    correo: solicitud.correo,
    avisoPunto: punto.ok ? "" : punto.motivo,
    // Para el botón "Asignarle su ruta" de Altas: el punto recién creado.
    puntoId: punto.ok ? punto.id : null,
  };
}

/**
 * El domicilio (punto de recolección) que nace de un alta: alias, dirección,
 * referencias y el pin del mapa. El sector lo calcula la base con los
 * límites que haya hoy (`sector_de_punto`, db/023); sin límites queda vacío
 * y se acomoda solo cuando se dibujen, igual que los demás puntos.
 *
 * `ubicacion_origen` se deja vacío a propósito: la base solo acepta 'panel'
 * o 'chofer', y este pin no lo puso ninguno de los dos.
 */
async function crearPuntoDelAlta(sb, clienteId, a) {
  const hayPin = Number.isFinite(a.lat) && Number.isFinite(a.lng);
  let sectorId = null;
  if (hayPin) {
    const { data } = await sb.rpc("sector_de_punto", { p_lat: a.lat, p_lng: a.lng });
    sectorId = data || null;
  }
  const { data, error } = await sb
    .from("domicilios")
    .insert({
      cliente_id: clienteId,
      alias: (a.alias || "").trim() || "Principal",
      calle: a.calle || null,
      colonia: a.colonia || null,
      cp: a.cp || null,
      referencias: a.referencias || null,
      lat: hayPin ? a.lat : null,
      lng: hayPin ? a.lng : null,
      ubicacion_fecha: hayPin ? new Date().toISOString() : null,
      sector_id: sectorId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[activar] no se pudo crear el punto del alta:", error?.message);
    return {
      ok: false,
      motivo:
        "La cuenta quedó activa, pero no se pudo crear su punto de recolección " +
        `(${error?.message || "error desconocido"}). Sus recolecciones saldrán sin dirección hasta que se agregue.`,
    };
  }
  return { ok: true, id: data.id };
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
export async function darAccesoAClienteCon({ sb, anotar, origen }, { clienteId }) {
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

  // GUARDIA. Antes de sellar a un usuario que YA existía hay que mirar QUÉ
  // era. Sin esto, si el correo de un cliente coincidiera con el de alguien
  // ya ligado a OTRA empresa, o con personal de Morcast (dueño, admin,
  // operador), se le sobrescribiría el rol y la empresa sin decir nada — es
  // exactamente el daño silencioso que `scripts/cuaderno/limpiar.mjs` ya
  // frena con su guardia de "no toco a un `dueno` ni a un `operador`". Aquí
  // no se arregla solo: se para y se dice, para que lo mire una persona.
  //
  // La decisión ("¿para o sigue?") vive en `puedeSellarUsuarioExistente()`
  // (estado-cliente.mjs), pura y con pruebas propias; aquí solo se junta lo
  // que esa función necesita mirar y se arma el mensaje, que sí necesita ir
  // a la base a buscar el nombre de la otra empresa.
  if (yaExistia) {
    const { data: perfilAjeno } = await sb
      .from("perfiles")
      .select("nombre, rol, cliente_id")
      .eq("id", uid)
      .maybeSingle();

    const evaluadoSello = puedeSellarUsuarioExistente(perfilAjeno, cliente.id);

    if (!evaluadoSello.puede && evaluadoSello.motivo === "es-personal") {
      return {
        ok: false,
        motivo:
          `El correo ${correo} ya es de una cuenta de personal de Morcast ` +
          `(${perfilAjeno?.nombre || "sin nombre"}, rol: ${evaluadoSello.rol}). ` +
          `No se puede convertir en cliente desde aquí — revísalo a mano.`,
      };
    }

    if (!evaluadoSello.puede && evaluadoSello.motivo === "otra-empresa") {
      const { data: otraEmpresa } = await sb
        .from("clientes")
        .select("folio, empresa")
        .eq("id", evaluadoSello.clienteIdAjeno)
        .maybeSingle();
      return {
        ok: false,
        motivo:
          `El correo ${correo} ya tiene una cuenta ligada a otra empresa` +
          (otraEmpresa ? ` (${otraEmpresa.empresa}, ${otraEmpresa.folio})` : "") +
          `. Revísalo a mano antes de continuar.`,
      };
    }
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

    // Un UPDATE que no encuentra fila NO da error: responde 200 y cambia
    // cero. Sin contar las filas, un fallo aquí se traga en silencio y una
    // persona real queda ligada a una empresa que no es la suya, sin
    // registro y sin que nadie se entere — el error que ve el admin es el de
    // la falla ORIGINAL, no el de este deshacer. Mismo patrón que el
    // deshacer de `activarCuentaRegistrada`, unas líneas más abajo.
    try {
      const { data: soltado, error: errSoltar } = await sb
        .from("perfiles")
        .update({ rol: "pendiente", cliente_id: null })
        .eq("id", uid)
        .select("id");
      if (errSoltar || !soltado?.length) {
        console.error(
          `[dar-acceso] no se pudo desenganchar el perfil ${uid}: ${errSoltar?.message || "no se cambió ninguna fila"}`
        );
      }
    } catch (e) {
      console.error(`[dar-acceso] no se pudo desenganchar el perfil ${uid}: ${e?.message}`);
    }
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

  await anotar({
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

  return { ok: true, correo, folio: cliente.folio };
}

/**
 * ENLACES DE DESCARGA DE UN ALTA FIRMADA: el PDF vigente y la constancia.
 *
 * La cubeta `altas` es PRIVADA (db/025): sin enlace firmado no se abre nada.
 * El enlace lo firma el SERVIDOR con la llave de servicio, y sólo después de
 * que quien llama comprobó que pide un dueño o administrador (la acción de la
 * web con la sesión; la ruta de la app con el token y el pase). Vence en 5 minutos: sirve para
 * descargarlo ahora, no para pegarlo en un chat y que siga abriendo.
 *
 * Recibe sólo el id del alta; las rutas salen de la base, nunca del
 * navegador, así que nadie puede pedir "firma este otro archivo".
 */
const MINUTOS_ENLACE_ALTA = 5;

export async function enlacesArchivosAltaCon(sb, solicitudId) {
  if (typeof solicitudId !== "string" || !/^[0-9a-f-]{36}$/i.test(solicitudId)) {
    return { ok: false, motivo: "Esa solicitud no existe." };
  }

  const { data: fila, error } = await sb
    .from("solicitudes_alta")
    .select("id, folio, pdf_ruta, constancia_ruta")
    .eq("id", solicitudId)
    .maybeSingle();
  if (error || !fila) return { ok: false, motivo: "No se encontró esa solicitud." };

  const firmar = async (ruta, nombre) => {
    if (!ruta) return null;
    const { data, error: errFirma } = await sb.storage
      .from("altas")
      .createSignedUrl(ruta, MINUTOS_ENLACE_ALTA * 60, { download: nombre });
    if (errFirma) {
      console.error("[altas] no se pudo firmar el enlace:", ruta, errFirma.message);
      return null;
    }
    return data?.signedUrl || null;
  };

  const extension = (fila.constancia_ruta || "").split(".").pop() || "pdf";
  return {
    ok: true,
    pdf: await firmar(fila.pdf_ruta, (fila.pdf_ruta || "").split("/").pop() || `solicitud-${fila.folio}.pdf`),
    constancia: await firmar(fila.constancia_ruta, `constancia-${fila.folio}.${extension}`),
  };
}
