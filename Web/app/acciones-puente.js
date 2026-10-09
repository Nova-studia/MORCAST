"use server";

import { cookies } from "next/headers";
import { supabaseSesion } from "@/lib/supabase-sesion";
import { registrar } from "@/lib/bitacora";
import { COOKIE_PASE, VIGENCIA_PASE_S, firmarPase, verificarPase, secretoPanel, sesionDelToken } from "@/lib/mfa.mjs";
import { destinoPanel } from "@/lib/app-acciones-mapa.mjs";

/**
 * EL PUENTE DE LA APP AL PANEL WEB (9-oct-2026, "apps al 100%").
 *
 * La app ya pasó el segundo paso; para no pedir otro código por correo, la
 * ruta `puente-admin` le dio un pase de UN SOLO USO (2 minutos, firmado, con
 * sesión "puente": no sirve como pase normal). Aquí, ya con la sesión nueva
 * del navegador, se cambia por el pase de ESTA sesión, para el mismo usuario.
 */
export async function canjearPuenteAdmin({ pp, destino } = {}) {
  const sb = await supabaseSesion();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, motivo: "No se pudo abrir tu sesión." };
  const rol = user.app_metadata?.rol;
  if (rol !== "dueno" && rol !== "admin") return { ok: false, motivo: "Esta cuenta no entra al panel." };
  if (!(await verificarPase(pp, { uid: user.id, sesion: "puente" }, secretoPanel()))) {
    return { ok: false, motivo: "El enlace ya caducó. Vuelve a abrirlo desde la app." };
  }
  const { data: { session } } = await sb.auth.getSession();
  const sesion = sesionDelToken(session?.access_token);
  if (!sesion) return { ok: false, motivo: "No se pudo abrir tu sesión." };
  const pase = await firmarPase({ uid: user.id, sesion, vence: Math.floor(Date.now() / 1000) + VIGENCIA_PASE_S }, secretoPanel());
  (await cookies()).set(COOKIE_PASE, pase, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VIGENCIA_PASE_S,
  });
  await registrar({ accion: "entrar_panel", tabla: "perfiles", registroId: user.id, detalle: { metodo: "puente_app" } });
  return { ok: true, destino: destinoPanel(destino) };
}
