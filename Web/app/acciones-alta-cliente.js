"use server";

import { headers } from "next/headers";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { usuarioActual } from "@/lib/supabase-sesion";
import { registrar } from "@/lib/bitacora";
import { origenPermitido } from "@/lib/origen.mjs";
import {
  activarCuentaClienteCon,
  existeCuentaCon,
  activarCuentaRegistradaCon,
  darAccesoAClienteCon,
  enlacesArchivosAltaCon,
} from "@/lib/cuentas-servidor";

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
 *
 * Dónde está el trabajo (6-oct-2026)
 * ----------------------------------
 * En `lib/cuentas-servidor.js`, que es el MISMO código que usa la app
 * (`app/api/app/altas|clientes|solicitudes/...`). Aquí sólo queda la puerta
 * de la web: sesión, rol y segundo paso (`usuarioActual()`), y la bitácora a
 * nombre de quien tiene la cookie (`registrar`).
 */

const PERSONAL = ["dueno", "admin"];

async function exigirPersonal() {
  const quien = await usuarioActual();
  if (!quien) return { error: "Tu sesión se venció. Vuelve a entrar." };
  if (!PERSONAL.includes(quien.rol)) return { error: "No tienes permiso para dar de alta clientes." };
  return { quien };
}

/** Da de alta la empresa y su primer acceso al portal (ver lib/cuentas-servidor.js). */
export async function activarCuentaCliente(datos) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { quien, error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const r = await activarCuentaClienteCon({ sb: supabaseServidor(), anotar: registrar }, datos || {});
  return r.ok ? { ...r, creadaPor: quien.correo } : r;
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

  return existeCuentaCon(supabaseServidor(), correo);
}

/** Activa a alguien que se registró solo con Google (ver lib/cuentas-servidor.js). */
export async function activarCuentaRegistrada(datos) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { quien, error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const r = await activarCuentaRegistradaCon({ sb: supabaseServidor(), anotar: registrar }, datos || {});
  return r.ok ? { ...r, creadaPor: quien.correo } : r;
}

/** Da acceso al portal a un cliente que ya está en la base (ver lib/cuentas-servidor.js). */
export async function darAccesoACliente(datos) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { quien, error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const r = await darAccesoAClienteCon(
    { sb: supabaseServidor(), anotar: registrar, origen: origenPermitido(await headers()) },
    datos || {}
  );
  return r.ok ? { ...r, creadaPor: quien.correo } : r;
}

/** Enlaces firmados de 5 minutos al PDF del alta y a la constancia. */
export async function enlacesArchivosAlta(solicitudId) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  return enlacesArchivosAltaCon(supabaseServidor(), solicitudId);
}
