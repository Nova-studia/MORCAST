import { supabase, haySupabase } from "./supabase";
import { CREDENCIALES_DEMO, CLIENTE } from "./datos";
import { ADMIN_DEMO, ADMIN_PERFIL } from "./datos-admin";
import { CHOFER_DEMO, CHOFER_PERFIL } from "./datos-chofer";
import { marcarCuentaDeMuestra, olvidarCuentaDeMuestra } from "./cuenta-muestra";
import { borrarTokenAlSalir } from "./push";
import { olvidarPase } from "./segundo-paso";

/**
 * Sesión de la app, para los tres modos.
 *
 * Es el mismo Supabase Auth que la web; lo único que cambia por modo es qué
 * rol se acepta. Un cliente no entra al panel, un chofer no entra al portal.
 *
 * Cuando no hay llaves configuradas se conservan los accesos de demostración,
 * para que la app siga navegable sin conexión a la base.
 */

const ROLES = {
  cliente: { acepta: ["cliente"], demo: CREDENCIALES_DEMO, perfil: CLIENTE },
  admin: { acepta: ["dueno", "admin"], demo: ADMIN_DEMO, perfil: ADMIN_PERFIL },
  chofer: { acepta: ["operador"], demo: CHOFER_DEMO, perfil: CHOFER_PERFIL },
};

const NOMBRE_ROL = {
  dueno: "Dueño",
  admin: "Administrador",
  operador: "Chofer / Operador",
  cliente: "Cliente",
};

/**
 * Entra en el modo indicado. Devuelve `{ ok, perfil }` o `{ ok:false, mensaje }`.
 *
 * Se distingue "no eres tú" de "esta no es tu puerta": a un cliente que entra
 * por el modo admin se le dice que use el portal, en vez de dejarlo pensando
 * que se equivocó de contraseña.
 */
export async function entrar(modo, correo, password) {
  const cfg = ROLES[modo];
  if (!cfg) return { ok: false, mensaje: "Modo desconocido." };

  // Sin correo o sin contraseña no hay nada que preguntarle al servidor:
  // antes se mandaba igual y volvía "Correo o contraseña incorrectos", que
  // suena a que la cuenta no existe.
  if (!String(correo || "").trim() || !password) {
    return { ok: false, mensaje: "Escribe tu correo y tu contraseña." };
  }

  if (!haySupabase()) {
    const ok =
      correo.trim().toLowerCase() === cfg.demo.correo && password === cfg.demo.password;
    return ok
      ? { ok: true, perfil: cfg.perfil }
      : { ok: false, mensaje: "Correo o contraseña incorrectos." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo.trim().toLowerCase(),
    password,
  });

  if (error || !data?.user) {
    return { ok: false, mensaje: "Correo o contraseña incorrectos." };
  }

  const rol = data.user.app_metadata?.rol;
  if (!cfg.acepta.includes(rol)) {
    // Credenciales buenas, puerta equivocada. Se cierra para no dejar la
    // sesión a medias.
    await supabase.auth.signOut();
    return { ok: false, mensaje: mensajePuertaEquivocada(rol) };
  }

  return { ok: true, perfil: await perfilDe(data.user, modo) };
}

function mensajePuertaEquivocada(rol) {
  if (rol === "cliente") return "Esta cuenta es de cliente. Entra por el Portal de clientes.";
  if (rol === "operador") return "Esta cuenta es de chofer. Entra por el Modo chofer.";
  if (rol === "dueno" || rol === "admin") return "Esta cuenta es de Morcast. Entra por Administración.";
  return "Esta cuenta todavía no tiene acceso.";
}

/** Arma el perfil que esperan las pantallas, según el modo. */
async function perfilDe(usuario, modo) {
  const base = {
    id: usuario.id,
    correo: usuario.email,
    nombre: usuario.user_metadata?.nombre || usuario.email,
    rol: NOMBRE_ROL[usuario.app_metadata?.rol] || usuario.app_metadata?.rol,
  };

  if (modo !== "cliente") {
    // Personal de Morcast y choferes nunca son la cuenta de muestra.
    olvidarCuentaDeMuestra();
    return base;
  }

  // El cliente necesita saber de qué empresa es: de ahí cuelga todo lo suyo.
  const { data } = await supabase
    .from("perfiles")
    .select("cliente_id, clientes ( folio, empresa, rfc, regimen, uso_cfdi, domicilio_fiscal, codigo_postal, contacto, telefono, desde )")
    .eq("id", usuario.id)
    .single();

  const c = data?.clientes;

  // La cuenta del revisor de la App Store (ver cuenta-muestra.js). Se decide
  // AQUÍ, antes de que se pinte la primera pantalla del cliente, porque
  // `enHold()` se consulta al pintar. Pasa tanto al entrar con contraseña
  // como al recuperar la sesión guardada: las dos vienen por `perfilDe`.
  marcarCuentaDeMuestra(usuario, c?.folio);

  return {
    ...base,
    id: c?.folio || base.id,
    empresa: c?.empresa || "Mi empresa",
    rfc: c?.rfc || "",
    regimen: c?.regimen || "",
    usoCfdi: c?.uso_cfdi || "",
    domicilio: c?.domicilio_fiscal || "",
    codigoPostal: c?.codigo_postal || "",
    contacto: c?.contacto || base.nombre,
    telefono: c?.telefono || "",
    desde: c?.desde || "",
    clienteUuid: data?.cliente_id || null,
  };
}

/**
 * Sesión activa del modo indicado, o null. Sirve para no volver a pedir clave.
 *
 * ⚠️ USA `getSession()`, NO `getUser()`.
 *
 * `getUser()` PREGUNTA AL SERVIDOR por la red. Como el arranque de la app
 * llama a esto tres veces seguidas (admin, chofer, cliente) y espera cada una,
 * bastaba con que la red fuera lenta o no contestara para que la app se
 * quedara para siempre en la pantalla de carga, sin login y sin error: no
 * llegaba a pintar nada.
 *
 * `getSession()` lee la sesión que ya está guardada en el teléfono. Es
 * instantáneo y no depende de la red. El rol viene dentro del propio token,
 * que es lo único que hace falta para decidir qué pantalla abrir; lo que el
 * usuario pueda ver o no lo sigue mandando el RLS de la base en cada
 * consulta, igual que antes.
 */
export async function sesionActiva(modo) {
  if (!haySupabase()) return null;

  const cfg = ROLES[modo];
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user) return null;
  if (!cfg.acepta.includes(user.app_metadata?.rol)) return null;

  return perfilDe(user, modo);
}

/**
 * Cierra la sesión. Antes de `signOut()`, mientras todavía hay sesión para
 * que la base lo acepte, se da de baja el token de push de este teléfono
 * (que no le sigan llegando a este aparato los avisos de esa cuenta) y se
 * borra el pase del segundo paso del admin (quien entre después en este
 * teléfono tiene que escribir SU código). Ninguna de las dos puede impedir
 * salir: si fallan, se sale igual, y sin señal no se espera más de 4 s
 * (un botón "Salir" que no responde es peor que un token huérfano, que el
 * servidor limpia cuando Expo le avisa que ya no existe).
 */
export async function salir() {
  olvidarCuentaDeMuestra();
  const limpieza = Promise.all([
    borrarTokenAlSalir().catch(() => {}),
    olvidarPase().catch(() => {}),
  ]);
  await Promise.race([limpieza, new Promise((listo) => setTimeout(listo, 4000))]);
  if (haySupabase()) await supabase.auth.signOut();
}
