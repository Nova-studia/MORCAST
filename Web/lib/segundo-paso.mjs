/**
 * SEGUNDO PASO DEL PANEL — mandar y revisar el código por correo.
 *
 * Es el MISMO trámite para la web (app/acciones-segundo-paso.js, con la
 * cookie de sesión) y para la app (/api/app/segundo-paso/..., con el token
 * Bearer). Vive aquí para que las dos digan lo mismo y no haya dos copias de
 * las reglas (10 minutos, 5 intentos, 60 segundos entre envíos). El porqué de
 * todo el esquema está en lib/mfa.mjs.
 *
 * Quién llama YA comprobó que es dueño o admin activo, y le pasa aquí el
 * usuario de Auth. Lo que cambia entre web y app es qué se hace con el pase:
 * la web lo guarda en una cookie httpOnly; la app lo guarda en el
 * almacenamiento seguro del teléfono y lo presenta en
 * /api/app/segundo-paso/estado.
 *
 * LO QUE PROTEGE Y LO QUE NO (con honestidad): en la web y en la app, este
 * código cuida la PANTALLA de administración. La base de datos no lo
 * reconoce como segundo factor (la sesión sigue siendo `aal1`), así que
 * quien tenga la contraseña y una sesión puede pedirle datos a la base
 * directo con la llave pública, como ya se sabe y se aceptó para la web.
 *
 * Todo entra por parámetro (la base, el correo, la hora): sin imports de
 * Next ni de Supabase, para probarlo con piezas de mentira
 * (tests/segundo-paso.test.mjs). Nunca lanza.
 */

import {
  ESPERA_REENVIO_S,
  MAX_INTENTOS,
  VIGENCIA_CODIGO_MIN,
  VIGENCIA_PASE_S,
  firmarPase,
  generarCodigo,
  huellaCodigo,
  ocultarCorreo,
} from "./mfa.mjs";

export const MOTIVOS_2P = {
  sinSecreto: "Falta configurar el servidor. Avisa a soporte.",
  noGuardado: "No se pudo preparar tu código. Intenta de nuevo.",
  sinCorreo: "El envío de correos no está configurado. Avisa a soporte.",
  correoFallo: "No se pudo mandar el correo. Intenta de nuevo en un momento.",
  formato: "El código tiene 6 dígitos.",
  pideOtro: "Pide un código nuevo.",
  vencido: "Ese código ya venció. Pide uno nuevo.",
  agotado: "Demasiados intentos con ese código. Pide uno nuevo.",
  sinSesion: "No se pudo leer tu sesión. Vuelve a entrar.",
};

/** Solo los dígitos de lo que escribió la persona ("123 456" → "123456"). */
export const limpiarCodigo = (codigo) => String(codigo ?? "").replace(/\D/g, "");

/**
 * Manda (o no reenvía todavía) el código al correo de la cuenta.
 *
 * @param {object} p
 * @param {{ id: string, email: string }} p.usuario   el usuario de Auth
 * @param {object} p.sb             Supabase con la llave de servicio
 * @param {string|null} p.secreto   secretoPanel()
 * @param {Function} p.mandarCorreo correoCodigoPanel
 * @param {boolean} p.hayCorreo     hayResend()
 * @param {boolean} p.produccion    NODE_ENV === "production"
 * @returns {Promise<{ ok: true, correo: string, espera: number, yaEnviado?: true } | { ok: false, motivo: string }>}
 */
export async function mandarCodigo({ usuario, sb, secreto, mandarCorreo, hayCorreo, produccion, ahora = Date.now(), log = console }) {
  if (!secreto) return { ok: false, motivo: MOTIVOS_2P.sinSecreto };
  const correo = ocultarCorreo(usuario.email);

  try {
    const { data: previo } = await sb
      .from("codigos_panel").select("enviado").eq("usuario_id", usuario.id).maybeSingle();
    if (previo) {
      const pasaron = (ahora - new Date(previo.enviado).getTime()) / 1000;
      if (pasaron < ESPERA_REENVIO_S) {
        // Ya hay uno recién mandado (la pantalla se recargó, la app volvió
        // del fondo): no se manda otro, se avisa a dónde llegó.
        return { ok: true, yaEnviado: true, espera: Math.ceil(ESPERA_REENVIO_S - pasaron), correo };
      }
    }

    const codigo = generarCodigo();
    const { error: eGuardar } = await sb.from("codigos_panel").upsert({
      usuario_id: usuario.id,
      huella: await huellaCodigo(codigo, usuario.id, secreto),
      vence: new Date(ahora + VIGENCIA_CODIGO_MIN * 60 * 1000).toISOString(),
      intentos: 0,
      enviado: new Date(ahora).toISOString(),
    });
    if (eGuardar) {
      log.error("[segundo paso] no se pudo guardar el código:", eGuardar.message);
      return { ok: false, motivo: MOTIVOS_2P.noGuardado };
    }

    if (!hayCorreo) {
      // En producción sin correo no hay forma de entregar el código: se dice
      // claro en vez de dejar a la persona esperando un correo que no llega.
      if (produccion) return { ok: false, motivo: MOTIVOS_2P.sinCorreo };
      log.warn(`[segundo paso] (desarrollo, sin Resend) código de ${usuario.email}: ${codigo}`);
    } else {
      try {
        await mandarCorreo({ correo: usuario.email, codigo, minutos: VIGENCIA_CODIGO_MIN });
      } catch (e) {
        log.error("[segundo paso] no se pudo mandar el correo:", e?.message || e);
        return { ok: false, motivo: MOTIVOS_2P.correoFallo };
      }
    }
  } catch (e) {
    log.error("[segundo paso] falló al mandar:", e?.message || e);
    return { ok: false, motivo: MOTIVOS_2P.noGuardado };
  }

  return { ok: true, espera: ESPERA_REENVIO_S, correo };
}

/**
 * Revisa el código. Si es bueno lo borra (sirve una sola vez) y devuelve el
 * pase firmado de ESTA sesión, con su vencimiento en segundos Unix.
 *
 * @returns {Promise<{ ok: true, pase: string, vence: number } | { ok: false, motivo: string }>}
 */
export async function verificarCodigo({ usuario, sesion, codigo, sb, secreto, ahora = Date.now(), log = console }) {
  const limpio = limpiarCodigo(codigo);
  if (limpio.length !== 6) return { ok: false, motivo: MOTIVOS_2P.formato };
  if (!secreto) return { ok: false, motivo: MOTIVOS_2P.sinSecreto };
  if (!sesion) return { ok: false, motivo: MOTIVOS_2P.sinSesion };

  try {
    const { data: fila } = await sb
      .from("codigos_panel").select("huella, vence, intentos").eq("usuario_id", usuario.id).maybeSingle();

    if (!fila) return { ok: false, motivo: MOTIVOS_2P.pideOtro };
    if (new Date(fila.vence).getTime() < ahora) return { ok: false, motivo: MOTIVOS_2P.vencido };
    if (fila.intentos >= MAX_INTENTOS) return { ok: false, motivo: MOTIVOS_2P.agotado };

    if ((await huellaCodigo(limpio, usuario.id, secreto)) !== fila.huella) {
      await sb.from("codigos_panel").update({ intentos: fila.intentos + 1 }).eq("usuario_id", usuario.id);
      const quedan = MAX_INTENTOS - fila.intentos - 1;
      return {
        ok: false,
        motivo: quedan > 0
          ? `Código incorrecto. Te quedan ${quedan} ${quedan === 1 ? "intento" : "intentos"}.`
          : "Código incorrecto. Pide uno nuevo.",
      };
    }

    // Un código sirve una sola vez.
    await sb.from("codigos_panel").delete().eq("usuario_id", usuario.id);
  } catch (e) {
    log.error("[segundo paso] falló al verificar:", e?.message || e);
    return { ok: false, motivo: "No se pudo revisar el código. Intenta de nuevo." };
  }

  const vence = Math.floor(ahora / 1000) + VIGENCIA_PASE_S;
  const pase = await firmarPase({ uid: usuario.id, sesion, vence }, secreto);
  return { ok: true, pase, vence };
}
