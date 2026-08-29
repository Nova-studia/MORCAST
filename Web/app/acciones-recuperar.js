"use server";

import { headers } from "next/headers";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { correoRecuperacion } from "@/lib/correo";
import { origenPermitido } from "@/lib/origen.mjs";

/**
 * RECUPERAR LA CONTRASEÑA.
 *
 * Por qué el correo lo manda Resend y no Supabase
 * -----------------------------------------------
 * `resetPasswordForEmail` sería una línea, pero manda el correo con SU
 * remitente y SU plantilla, y en el plan gratuito está limitado a unos pocos
 * por hora: con varios clientes recuperando a la vez se bloquea y nadie se
 * entera. `admin.generateLink` **genera el enlace sin enviarlo**, y lo mandamos
 * nosotros con la misma imagen que los otros correos del sistema.
 *
 * 🔴 LA REGLA QUE MANDA AQUÍ: UNA SOLA RESPUESTA
 * ----------------------------------------------
 * Esta pantalla es pública y contesta a cualquiera. Si la respuesta cambiara
 * según lo que pasa por dentro, sería una herramienta para averiguar quiénes
 * son los clientes de Morcast probando correos.
 *
 * Por eso **todos** los caminos devuelven exactamente el mismo acuse: la cuenta
 * no existe, la cuenta existe, el freno la paró, Supabase falló, Resend falló.
 * Todos. Lo que pasó de verdad va al registro con `console.error`, que lo lee
 * quien opera el sitio y nadie más.
 *
 * La primera versión de este archivo fallaba justo aquí: contestaba "espera 47
 * segundos" cuando la cuenta existía y estaba en enfriamiento, y el acuse
 * genérico cuando no existía. Dos envíos seguidos y ya sabías si un correo
 * estaba registrado.
 */

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lo único que se contesta, pase lo que pase por dentro. */
const ACUSE =
  "Si ese correo tiene una cuenta en Morcast, te acabamos de mandar un enlace para crear tu contraseña nueva. Revisa también la carpeta de no deseados.";

/** El acuse, siempre. Se centraliza para que no haya forma de contestar otra cosa. */
const acuse = () => ({ ok: true, mensaje: ACUSE });

export async function pedirRecuperacion(correo) {
  const limpio = String(correo || "").trim().toLowerCase().slice(0, 160);

  // Lo ÚNICO que se responde distinto: que el correo esté mal escrito. Eso no
  // filtra nada —no depende de si existe la cuenta— y sin ello la persona se
  // queda mirando un acuse que nunca se va a cumplir por una errata.
  if (!CORREO_RE.test(limpio)) {
    return { ok: false, motivo: "Escribe un correo válido." };
  }

  if (!haySupabase()) return { ...acuse(), demo: true };

  const sb = supabaseServidor();

  // 1) El freno. Va PRIMERO y se anota exista la cuenta o no: si sólo se
  //    frenaran los correos con cuenta, el propio freno delataría cuáles son.
  //    La decisión se toma en una sola sentencia dentro de la base (db/018),
  //    así que dos peticiones a la vez no pueden pasar las dos.
  const { data: puede, error: errFreno } = await sb.rpc("puede_pedir_recuperacion", {
    p_correo: limpio,
  });

  if (errFreno) {
    console.error("[recuperar] no se pudo consultar el freno:", errFreno.message);
    return acuse();
  }
  if (!puede) {
    console.error(`[recuperar] frenado por repetido: ${limpio}`);
    return acuse();
  }

  // 2) El enlace. `generateLink` NO envía nada; devuelve el material.
  //    Si el correo no tiene cuenta, responde error — y ese error es
  //    justamente lo que NO se puede dejar salir hacia afuera.
  //
  //    Antes esto se resolvía con `listUsers({perPage: 200})`, que sólo miraba
  //    la primera página: pasados los 200 usuarios, a los clientes MÁS
  //    ANTIGUOS se les decía "te mandamos un enlace" y no les llegaba nunca,
  //    sin un renglón en el registro. Preguntándole directo a `generateLink`
  //    ese techo desaparece.
  const { data, error } = await sb.auth.admin.generateLink({
    type: "recovery",
    email: limpio,
  });

  if (error || !data?.properties?.hashed_token) {
    console.error(`[recuperar] sin enlace para ${limpio}: ${error?.message || "sin token"}`);
    return acuse();
  }

  // 3) El correo.
  const origen = origenPermitido(await headers());
  const enlace = `${origen}/portal/nueva-clave?token=${encodeURIComponent(
    data.properties.hashed_token
  )}`;

  try {
    await correoRecuperacion({ correo: limpio, enlace });
  } catch (e) {
    // Que falle el envío NO cambia la respuesta: decir "no se pudo enviar"
    // sólo es alcanzable si la cuenta existe, así que sería otra fuga. Queda
    // en el registro con un prefijo buscable, que es donde tiene que verse.
    console.error(`[recuperar] EL CORREO NO SALIO para ${limpio}: ${e?.message}`);
  }

  return acuse();
}
