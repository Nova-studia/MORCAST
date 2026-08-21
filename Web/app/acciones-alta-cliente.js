"use server";

import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { usuarioActual } from "@/lib/supabase-sesion";
import { registrar } from "@/lib/bitacora";

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
