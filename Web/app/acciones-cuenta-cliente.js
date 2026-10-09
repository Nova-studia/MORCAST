"use server";

import { usuarioActual, supabaseSesion } from "@/lib/supabase-sesion";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { pasarFreno } from "@/lib/freno";
import { confirmaEliminar } from "@/lib/cuenta-cliente.mjs";
import { eliminarCuenta } from "@/lib/eliminar-cuenta.mjs";
import { cuentaClienteCon, guardarDatosClienteCon } from "@/lib/apps-servidor";

/**
 * MI CUENTA DEL CLIENTE (Entrega 4, 9-oct-2026).
 *
 * El cliente no puede editar su ficha en la base (db/002, a propósito): estos
 * cambios van por el servidor con la llave de servicio, SIEMPRE sobre la
 * empresa de la sesión (`quien.cliente_id`) y solo en tres campos. Nombre,
 * teléfono y contraseña del usuario van por app/acciones-cuenta.js.
 */

async function soyCliente() {
  const quien = await usuarioActual();
  if (!quien) return { error: "Tu sesión se venció. Vuelve a entrar." };
  if (quien.rol !== "cliente" || !quien.cliente_id) return { error: "Esta pantalla es para clientes." };
  return { quien };
}

export async function cuentaClienteAccion() {
  if (!haySupabase()) {
    return { ok: true, demo: true, empresa: { empresa: "Empresa de demostración", folio: "MOR-DEMO", contacto: "", telefono: "", correo: "demo@morcast.mx", rfc: "" }, puntos: [] };
  }
  const { quien, error } = await soyCliente();
  if (error) return { ok: false, motivo: error };
  return cuentaClienteCon(supabaseServidor(), quien.cliente_id);
}

export async function guardarDatosClienteAccion(datos) {
  if (!haySupabase()) return { ok: true, demo: true };
  const { quien, error } = await soyCliente();
  if (error) return { ok: false, motivo: error };
  return guardarDatosClienteCon({ sb: supabaseServidor(), anotar: registrar }, { clienteId: quien.cliente_id }, datos);
}

/**
 * Eliminar MI cuenta desde la web: el mismo trámite que la app
 * (lib/eliminar-cuenta.mjs): borra a ESTE usuario, nunca a la empresa ni su
 * historial. El navegador cierra la sesión después.
 */
export async function eliminarMiCuentaAccion({ confirmacion } = {}) {
  if (!haySupabase()) return { ok: true, demo: true };
  const { quien, error } = await soyCliente();
  if (error) return { ok: false, motivo: error };
  if (!confirmaEliminar(confirmacion)) return { ok: false, motivo: "Escribe ELIMINAR para confirmar." };
  if (!(await pasarFreno(`eliminar-cuenta:${quien.id}`, { maximo: 3, minutos: 15, porIp: false }))) {
    return { ok: false, motivo: "Demasiados intentos. Espera unos minutos." };
  }
  const { data: { session } } = await (await supabaseSesion()).auth.getSession();
  const r = await eliminarCuenta({ token: session?.access_token, sb: supabaseServidor(), origen: "web" });
  return r.status === 200 ? { ok: true } : { ok: false, motivo: r.cuerpo?.mensaje || "No se pudo eliminar la cuenta." };
}
