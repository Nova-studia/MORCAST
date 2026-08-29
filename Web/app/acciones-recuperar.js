"use server";

import { headers } from "next/headers";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { correoRecuperacion } from "@/lib/correo";
import { puedePedirEnlace } from "@/lib/enfriamiento.mjs";

/**
 * RECUPERAR LA CONTRASEÑA.
 *
 * Por qué el correo lo manda Resend y no Supabase
 * -----------------------------------------------
 * `resetPasswordForEmail` de Supabase sería una línea, pero manda el correo
 * con SU remitente y SU plantilla, y en el plan gratuito está limitado a unos
 * pocos por hora: con varios clientes recuperando a la vez se bloquea, y nadie
 * se entera de por qué. `admin.generateLink` **genera el enlace sin enviarlo**,
 * y lo mandamos nosotros por Resend, con la misma imagen que los otros seis
 * correos del sistema y sin ese tope.
 *
 * Por qué la respuesta es siempre la misma
 * ----------------------------------------
 * Si contestara "ese correo no existe", cualquiera podría averiguar quiénes
 * son los clientes de Morcast probando direcciones. Se contesta lo mismo haya
 * cuenta o no. El único caso en que se dice algo distinto es el enfriamiento, y
 * ahí no se filtra nada: sólo que hay que esperar.
 */

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lo mismo que ve quien tiene cuenta y quien no. */
const ACUSE =
  "Si ese correo tiene una cuenta en Morcast, te acabamos de mandar un enlace para crear tu contraseña nueva. Revisa también la carpeta de no deseados.";

/**
 * El origen real de la petición, para armar el enlace del correo.
 *
 * Se prefiere `x-forwarded-host` por lo mismo que en `/auth/callback`: detrás
 * de Vercel el host que ve la aplicación puede ser el interno de la
 * plataforma. Y por lo mismo va con lista blanca — si no, alguien podría
 * mandar esa cabecera y hacer que el enlace de recuperación de un cliente
 * apunte a un sitio suyo. Aquí importa MÁS que en el callback, porque este
 * enlace viaja por correo y da acceso a la cuenta.
 */
function origenSeguro(cabeceras) {
  const PERMITIDOS = ["morcast.mx", "www.morcast.mx", "localhost", "127.0.0.1"];
  const crudo = (cabeceras.get("x-forwarded-host") || "").split(",")[0].trim();
  const proto = (cabeceras.get("x-forwarded-proto") || "").split(",")[0].trim();

  if (crudo) {
    const sinPuerto = crudo.split(":")[0];
    if (PERMITIDOS.includes(sinPuerto)) {
      const esquema = proto === "http" || proto === "https" ? proto : "https";
      return `${esquema}://${crudo}`;
    }
    console.error(`[recuperar] host no permitido en x-forwarded-host: ${crudo}`);
  }
  // Respaldo: el host de la propia petición.
  const host = cabeceras.get("host");
  return host ? `https://${host}` : "https://morcast.mx";
}

/**
 * Pide un enlace para crear una contraseña nueva.
 * Devuelve SIEMPRE `{ ok: true, mensaje }` salvo que el correo esté mal escrito
 * o haya que esperar.
 */
export async function pedirRecuperacion(correo) {
  const limpio = String(correo || "").trim().toLowerCase().slice(0, 160);
  if (!CORREO_RE.test(limpio)) {
    return { ok: false, motivo: "Escribe un correo válido." };
  }

  if (!haySupabase()) return { ok: true, demo: true, mensaje: ACUSE };

  const sb = supabaseServidor();

  // ¿Existe? Se busca por correo. Si no existe, se contesta el mismo acuse y
  // no se manda nada: quien prueba direcciones ajenas no aprende nada.
  const { data: lista, error: errBusca } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (errBusca) {
    console.error("[recuperar] no se pudo consultar usuarios:", errBusca.message);
    return { ok: false, motivo: "No se pudo procesar tu solicitud. Inténtalo en un momento." };
  }
  const usuario = lista?.users?.find((u) => (u.email || "").toLowerCase() === limpio);
  if (!usuario) return { ok: true, mensaje: ACUSE };

  // Enfriamiento. `recovery_sent_at` la mantiene Supabase sola; sin esto, esta
  // pantalla es un botón para bombardear el buzón de cualquier cliente.
  const { puede, faltanSegundos } = puedePedirEnlace(usuario.recovery_sent_at, new Date());
  if (!puede) {
    return {
      ok: false,
      motivo: `Ya te mandamos un enlace hace un momento. Espera ${faltanSegundos} segundos y vuelve a intentarlo.`,
    };
  }

  const origen = origenSeguro(await headers());

  // `generateLink` NO envía nada: sólo devuelve el material del enlace.
  const { data, error } = await sb.auth.admin.generateLink({
    type: "recovery",
    email: limpio,
  });

  if (error || !data?.properties?.hashed_token) {
    console.error("[recuperar] no se pudo generar el enlace:", error?.message);
    return { ok: false, motivo: "No se pudo procesar tu solicitud. Inténtalo en un momento." };
  }

  // Se arma NUESTRO enlace con el token, en vez de usar `action_link`. Así
  // apunta a nuestra pantalla y la sesión se crea ahí con `verifyOtp`, sin
  // pasar por el flujo con código, que aquí no aporta nada y complica.
  const enlace = `${origen}/portal/nueva-clave?token=${encodeURIComponent(
    data.properties.hashed_token
  )}`;

  try {
    await correoRecuperacion({ correo: limpio, enlace });
  } catch (e) {
    // Aquí SÍ importa el fallo: si el correo no sale, la persona se queda
    // esperando un enlace que no llega y el acuse le miente.
    console.error("[recuperar] el correo NO salió:", e?.message);
    return { ok: false, motivo: "No se pudo enviar el correo. Inténtalo en un momento." };
  }

  return { ok: true, mensaje: ACUSE };
}
