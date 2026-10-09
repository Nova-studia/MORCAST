"use server";

import { usuarioActual, supabaseSesion } from "@/lib/supabase-sesion";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { pasarFreno } from "@/lib/freno";
import { validarDatosCliente, confirmaEliminar } from "@/lib/cuenta-cliente.mjs";
import { eliminarCuenta } from "@/lib/eliminar-cuenta.mjs";

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
  const sb = supabaseServidor();
  const [c, d] = await Promise.all([
    sb.from("clientes").select("folio, empresa, contacto, telefono, correo, rfc").eq("id", quien.cliente_id).maybeSingle(),
    sb.from("domicilios")
      .select("id, alias, calle, colonia, cp, suscripciones ( estado, rutas ( nombre, dias ) )")
      .eq("cliente_id", quien.cliente_id)
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

export async function guardarDatosClienteAccion(datos) {
  if (!haySupabase()) return { ok: true, demo: true };
  const { quien, error } = await soyCliente();
  if (error) return { ok: false, motivo: error };
  const v = validarDatosCliente(datos || {});
  if (!v.ok) return v;
  const { data, error: e } = await supabaseServidor()
    .from("clientes")
    .update(v.limpio)
    .eq("id", quien.cliente_id)
    .select("id");
  if (e || !data?.length) return { ok: false, motivo: `No se guardó: ${e?.message || "ninguna fila"}` };
  await registrar({ accion: "cliente_edita_contacto", tabla: "clientes", registroId: quien.cliente_id, detalle: v.limpio });
  return { ok: true };
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
