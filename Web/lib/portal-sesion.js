"use client";

/**
 * Sesión del PORTAL DE CLIENTES.
 *
 * Va contra Supabase Auth, con la sesión en cookies (no en localStorage) para
 * que `proxy.js` pueda proteger las páginas desde el servidor.
 *
 * MODO DEMOSTRACIÓN: mientras no existan las variables de Supabase se
 * conserva el acceso de ejemplo, para que el sitio siga navegable.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { CREDENCIALES_DEMO, CLIENTE } from "@/lib/portal-datos";

const LLAVE_DEMO = "morcast_portal_sesion";

/* ------------------------------------------------------------------ */
/* Modo demostración (sin Supabase)                                    */
/* ------------------------------------------------------------------ */

function entrarDemo(correo, password) {
  const ok =
    correo.trim().toLowerCase() === CREDENCIALES_DEMO.correo &&
    password === CREDENCIALES_DEMO.password;
  if (!ok) return { ok: false, mensaje: "Correo o contraseña incorrectos." };

  const sesion = {
    correo: CREDENCIALES_DEMO.correo,
    clienteId: CLIENTE.id,
    empresa: CLIENTE.empresa,
    cuenta: CLIENTE.cuenta,
    cliente: CLIENTE,
    demo: true,
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(LLAVE_DEMO, JSON.stringify(sesion));
  }
  return { ok: true, sesion };
}

function leerDemo() {
  if (typeof window === "undefined") return null;
  try {
    const crudo = localStorage.getItem(LLAVE_DEMO);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

/**
 * Trae el perfil del cliente con el expediente completo de su empresa.
 * El RLS se encarga de que solo pueda ver la suya: la consulta no lleva
 * ningún filtro de seguridad porque no hace falta, va en la base de datos.
 *
 * Se piden TODOS los campos fiscales porque de aquí salen los PDF que el
 * cliente descarga (manifiesto, constancia, cotización, reporte). Antes se
 * pedían solo folio y empresa, y los PDF acababan llevando el RFC y el
 * domicilio del cliente de ejemplo.
 */
async function perfilDelCliente(supabase, id) {
  const { data } = await supabase
    .from("perfiles")
    .select(
      "nombre, cliente_id, clientes ( folio, empresa, contacto, correo, telefono," +
      " rfc, regimen, uso_cfdi, domicilio_fiscal, codigo_postal, plan, desde )"
    )
    .eq("id", id)
    .single();
  return data || null;
}

/**
 * Arma el expediente del cliente con la MISMA forma que `CLIENTE`, el de
 * ejemplo, para que las funciones que generan PDF no tengan que cambiar.
 *
 * Lo que la empresa todavía no ha entregado (RFC, régimen, domicilio fiscal)
 * se deja como raya, NO se rellena con el dato del cliente de ejemplo: en un
 * manifiesto, un RFC ajeno es peor que un campo vacío.
 */
function expediente(perfil) {
  const c = perfil?.clientes || {};
  return {
    id: c.folio || "",
    empresa: c.empresa || perfil?.nombre || "Mi empresa",
    contacto: c.contacto || perfil?.nombre || "",
    correo: c.correo || "",
    telefono: c.telefono || "",
    rfc: c.rfc || "—",
    regimen: c.regimen || "—",
    usoCfdi: c.uso_cfdi || "—",
    domicilio: c.domicilio_fiscal || "—",
    codigoPostal: c.codigo_postal || "",
    cuenta: c.plan || "Cliente",
    desde: c.desde || "",
  };
}

/**
 * El expediente ya resuelto, para no volver a pedirlo en cada pantalla.
 *
 * Lo llena `obtenerSesion()` al entrar. Sin esto, cada PDF que descarga el
 * cliente (manifiesto, constancia, cotización, reporte) repetía el viaje a
 * `perfiles` con su join a `clientes`.
 */
let expedienteEnMemoria = null;   // { usuarioId, datos }

/** El expediente del cliente que tiene la sesión, o el de ejemplo sin Supabase. */
export async function clienteActual() {
  if (!haySupabaseNavegador()) return CLIENTE;

  const supabase = supabaseNavegador();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (expedienteEnMemoria?.usuarioId === user.id) return expedienteEnMemoria.datos;

  const datos = expediente(await perfilDelCliente(supabase, user.id));
  expedienteEnMemoria = { usuarioId: user.id, datos };
  return datos;
}

/** Inicia sesión. Devuelve `{ ok: true, sesion }` o `{ ok: false, mensaje }`. */
export async function iniciarSesion(correo, password) {
  if (!haySupabaseNavegador()) return entrarDemo(correo, password);

  const supabase = supabaseNavegador();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo.trim().toLowerCase(),
    password,
  });

  if (error || !data?.user) {
    return { ok: false, mensaje: "Correo o contraseña incorrectos." };
  }

  const rol = data.user.app_metadata?.rol;
  if (rol !== "cliente") {
    await supabase.auth.signOut();
    return {
      ok: false,
      mensaje:
        rol === "dueno" || rol === "admin"
          ? "Esta cuenta es de Morcast. Entra por el panel de administración."
          : "Esta cuenta todavía no está activada como cliente.",
    };
  }

  const cliente = expediente(await perfilDelCliente(supabase, data.user.id));
  return {
    ok: true,
    sesion: {
      correo: data.user.email,
      clienteId: cliente.id,
      empresa: cliente.empresa,
      cuenta: cliente.cuenta,
      cliente,
    },
  };
}

/**
 * Sesión activa del portal, o null.
 *
 * ⚡ Las dos consultas salen A LA VEZ, no una detrás de otra. Antes esto era
 * `getUser()` y DESPUÉS `perfiles`, y como el marco del portal no pinta nada
 * hasta que termina, el panel no empezaba a pedir SUS datos hasta pasados
 * ~200 ms. Medido: la primera carga no tenía ni un dato en pantalla antes de
 * los 400 ms.
 *
 * El id para lanzar la consulta temprano sale de `getSession()`, que lee la
 * cookie sin salir a la red. **Eso NO relaja la seguridad**: quien decide si
 * hay sesión sigue siendo `getUser()`, que la comprueba contra el servidor, y
 * la consulta va protegida por el RLS. Con una cookie falsa, la consulta no
 * devolvería nada y `getUser()` fallaría igual. Solo se dejan de encadenar
 * dos viajes.
 */
export async function obtenerSesion() {
  if (!haySupabaseNavegador()) return leerDemo();

  const supabase = supabaseNavegador();

  const { data: { session } } = await supabase.auth.getSession();
  const idProbable = session?.user?.id ?? null;

  const [{ data: { user } }, perfilAdelantado] = await Promise.all([
    supabase.auth.getUser(),
    idProbable ? perfilDelCliente(supabase, idProbable) : Promise.resolve(null),
  ]);

  if (!user) return null;
  if (user.app_metadata?.rol !== "cliente") return null;

  // Si el id de la cookie no era el del usuario de verdad, se descarta lo
  // adelantado y se pide el bueno.
  const perfil = idProbable === user.id ? perfilAdelantado : await perfilDelCliente(supabase, user.id);
  const cliente = expediente(perfil);
  expedienteEnMemoria = { usuarioId: user.id, datos: cliente };

  return {
    correo: user.email,
    clienteId: cliente.id,
    empresa: cliente.empresa,
    cuenta: cliente.cuenta,
    cliente,
  };
}

/** Cierra la sesión. */
export async function cerrarSesion() {
  // Lo primero: tirar el expediente. Si se quedara, el siguiente que entrara
  // en la misma pestaña vería los datos del anterior mientras carga.
  expedienteEnMemoria = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(LLAVE_DEMO);
  }
  if (haySupabaseNavegador()) {
    await supabaseNavegador().auth.signOut();
  }
}
