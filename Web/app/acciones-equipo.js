"use server";

import { headers } from "next/headers";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { exigirSeccion } from "@/lib/permisos-servidor";
import { registrar } from "@/lib/bitacora";
import { origenPermitido } from "@/lib/origen.mjs";
import { invitarUsuarioEquipoCon, cambiarActivoUsuarioCon } from "@/lib/equipo-servidor";
import {
  editarUsuarioEquipoCon,
  mandarEnlaceEquipoCon,
  eliminarUsuarioEquipoCon,
  detalleEquipoCon,
} from "@/lib/equipo-cuentas.mjs";
import { correoInvitacionEquipo } from "@/lib/correo";

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
 *
 * El trabajo vive en `lib/equipo-servidor.js` desde el 6-oct-2026: es el
 * MISMO que usa la app (`/api/app/usuarios/*`). Aquí queda la puerta de la
 * web (la sesión, con su segundo paso) y la bitácora a nombre de la cookie.
 */

/** Invita a alguien al equipo como administrador o chofer. */
export async function invitarUsuarioEquipo(datos) {
  if (!haySupabase()) return { ok: true, demo: true };

  // Rol con la sección Usuarios (lib/permisos-servidor.js); el dueño, siempre.
  const { quien, error } = await exigirSeccion("usuarios");
  if (error) return { ok: false, motivo: error };

  return invitarUsuarioEquipoCon(
    { sb: supabaseServidor(), quien, anotar: registrar, origen: origenPermitido(await headers()) },
    datos || {}
  );
}

/** Desactiva o reactiva a alguien del equipo (ver lib/equipo-servidor.js). */
export async function cambiarActivoUsuario(datos) {
  if (!haySupabase()) return { ok: true, demo: true };

  // Rol con la sección Usuarios (lib/permisos-servidor.js); el dueño, siempre.
  const { quien, error } = await exigirSeccion("usuarios");
  if (error) return { ok: false, motivo: error };

  return cambiarActivoUsuarioCon({ sb: supabaseServidor(), quien, anotar: registrar }, datos || {});
}

// ---- Entrega 2 (9-oct-2026): editar, enlace de contraseña, eliminar ----

const ctx = (quien) => ({ sb: supabaseServidor(), quien, anotar: registrar });

/** Correo y último acceso del personal (Auth solo se lee con la llave de servicio). */
export async function detalleEquipoAccion() {
  if (!haySupabase()) return { ok: true, porId: {} };
  const { error } = await exigirSeccion("usuarios");
  if (error) return { ok: false, motivo: error };
  const sb = supabaseServidor();
  const r = await detalleEquipoCon({ sb });
  if (!r.ok) return r;
  // Solo el personal: los correos de los clientes no tienen por qué salir aquí.
  const { data: equipo } = await sb.from("perfiles").select("id").in("rol", ["dueno", "admin", "operador"]);
  const porId = {};
  for (const { id } of equipo || []) if (r.porId[id]) porId[id] = r.porId[id];
  return { ok: true, porId };
}

export async function editarUsuarioAccion(datos) {
  if (!haySupabase()) return { ok: true, demo: true };
  const { quien, error } = await exigirSeccion("usuarios");
  if (error) return { ok: false, motivo: error };
  return editarUsuarioEquipoCon(ctx(quien), datos || {});
}

/** Reenviar la invitación / restablecer la contraseña (mismo enlace). */
export async function mandarEnlaceAccion(datos) {
  if (!haySupabase()) return { ok: true, demo: true };
  const { quien, error } = await exigirSeccion("usuarios");
  if (error) return { ok: false, motivo: error };
  return mandarEnlaceEquipoCon(
    { ...ctx(quien), origen: origenPermitido(await headers()), enviarCorreo: correoInvitacionEquipo },
    datos || {}
  );
}

export async function eliminarUsuarioAccion(datos) {
  if (!haySupabase()) return { ok: true, demo: true };
  const { quien, error } = await exigirSeccion("usuarios");
  if (error) return { ok: false, motivo: error };
  return eliminarUsuarioEquipoCon(ctx(quien), datos || {});
}
