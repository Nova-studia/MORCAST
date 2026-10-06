/**
 * ENTRAR CON GOOGLE O CON APPLE — la lógica pura (sin red, sin React).
 *
 * Aquí sólo lo que se puede probar con `node --test`: a dónde va cada quien
 * según su rol, cuándo se puede ofrecer el botón de Google, qué se le dice a
 * la persona cuando algo falla y qué textos lleva la sala de espera. La parte
 * que habla con Google, Apple y Supabase vive en `entrar-social.js` y
 * `entrar-apple.js`.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO: `App IOS/src/entrada-social.mjs` y
 * `App Android/src/entrada-social.js` llevan el mismo contenido. Al tocar uno,
 * tocar el otro (las dos apps no comparten código).
 */

/**
 * El modo de la app que le toca a un rol. Espejo de `casaDe()` de
 * `Web/lib/destino-sesion.mjs`, con los nombres de modo de la app.
 *
 * REGLA DE ORO (la misma de la web): quien no trae un rol CONOCIDO en
 * `app_metadata` no entra a nada; es "pendiente". Un `"Cliente"` con
 * mayúscula tecleado a mano en el tablero de Supabase tampoco es un sello.
 */
export function modoDeRol(rol) {
  if (rol === "dueno" || rol === "admin") return "admin";
  if (rol === "operador") return "chofer";
  if (rol === "cliente") return "cliente";
  return "pendiente";
}

/**
 * El esquema de URL que iOS necesita para volver de Google, sacado del ID del
 * cliente de iOS: "123-abc.apps.googleusercontent.com" →
 * "com.googleusercontent.apps.123-abc". Null si el ID no tiene esa forma.
 */
export function esquemaIosDe(iosClientId) {
  const id = String(iosClientId || "").trim();
  const m = id.match(/^(.+)\.apps\.googleusercontent\.com$/);
  return m ? `com.googleusercontent.apps.${m[1]}` : null;
}

/**
 * Los `iosUrlScheme` que trae el plugin de Google en `app.json`.
 * Null si la configuración no viene (no se puede saber), [] si viene sin él.
 */
export function esquemasDelPlugin(plugins) {
  if (!Array.isArray(plugins)) return null;
  const esquemas = [];
  for (const p of plugins) {
    if (Array.isArray(p) && p[0] === "@react-native-google-signin/google-signin" && p[1]?.iosUrlScheme) {
      esquemas.push(String(p[1].iosUrlScheme));
    }
  }
  return esquemas;
}

/**
 * ¿Se puede ofrecer "Continuar con Google" en este teléfono?
 * Devuelve `{ ok: true }` o `{ ok: false, motivo }` (el motivo va a la
 * consola, no a la pantalla: a la persona simplemente no se le enseña el
 * botón y le queda su correo y contraseña).
 *
 * 🔴 Lo del esquema de iOS NO es cosmético: si el Info.plist no trae el
 * esquema del ID de iOS, el SDK de Google CIERRA LA APP de golpe al tocar el
 * botón (excepción nativa, no un error que JavaScript pueda atrapar). Por eso
 * si `app.json` sigue con el `PENDIENTE-IOS` o con otro ID, el botón no sale.
 */
export function configGoogle({ plataforma, enExpoGo, webClientId, iosClientId, esquemasIos } = {}) {
  if (enExpoGo) return { ok: false, motivo: "Expo Go no trae el módulo nativo de Google." };
  if (plataforma !== "ios" && plataforma !== "android") return { ok: false, motivo: `Plataforma sin Google: ${plataforma}.` };
  if (!String(webClientId || "").trim()) return { ok: false, motivo: "Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID." };
  if (plataforma === "ios") {
    const esperado = esquemaIosDe(iosClientId);
    if (!esperado) return { ok: false, motivo: "Falta (o no se entiende) EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID." };
    if (Array.isArray(esquemasIos) && !esquemasIos.includes(esperado)) {
      return {
        ok: false,
        motivo: `El iosUrlScheme de app.json no es ${esperado} (¿sigue el PENDIENTE-IOS?). Sin él Google cierra la app.`,
      };
    }
  }
  return { ok: true };
}

/** Un error que es de la señal y no de la cuenta. */
export function esErrorDeRed(error) {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  // 7 = NETWORK_ERROR de los servicios de Google en Android.
  if (String(error.code ?? "") === "7") return true;
  const texto = `${error.message || ""}`.toLowerCase();
  return /network|internet|offline|timed out|timeout|failed to fetch|network request failed|conexi/.test(texto);
}

const MENSAJE_SIN_RED = "No hay conexión. Revisa tu señal e inténtalo otra vez.";

/**
 * Lo que se le dice a la persona cuando Google o Apple no la dejan entrar.
 * Devuelve NULL cuando ella misma canceló: cerrar la ventana de Google no es
 * un error y no merece un aviso rojo.
 *
 * `codigos` son los `statusCodes` de la librería de Google (sus valores
 * cambian entre Android e iOS, por eso se reciben y no se escriben aquí).
 */
export function mensajeDeError(error, { proveedor = "Google", codigos = {} } = {}) {
  const code = String(error?.code ?? "");
  const cancelado =
    code === "ERR_REQUEST_CANCELED" ||
    code === "ERR_CANCELED" ||
    (codigos.SIGN_IN_CANCELLED != null && code === String(codigos.SIGN_IN_CANCELLED));
  if (cancelado) return null;

  if (codigos.IN_PROGRESS != null && code === String(codigos.IN_PROGRESS)) {
    return `Ya se está abriendo ${proveedor}. Espera un momento.`;
  }
  if (code === "PLAY_SERVICES_NOT_AVAILABLE" || (codigos.PLAY_SERVICES_NOT_AVAILABLE != null && code === String(codigos.PLAY_SERVICES_NOT_AVAILABLE))) {
    return "Este teléfono no tiene los servicios de Google Play al día. Actualízalos o entra con tu correo y contraseña.";
  }
  if (esErrorDeRed(error)) return MENSAJE_SIN_RED;
  return `No se pudo entrar con ${proveedor}. Inténtalo de nuevo o entra con tu correo y contraseña.`;
}

/**
 * El nombre que Apple entrega (SÓLO la primera vez que la persona entra con
 * Apple en esta app; las siguientes llega vacío). "" si no vino.
 */
export function nombreDeApple(fullName) {
  if (!fullName) return "";
  return [fullName.givenName, fullName.middleName, fullName.familyName]
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Los datos que se guardan en `user_metadata` con el nombre de Apple, o null
 * si no hay nada que guardar. Nunca se pisa un nombre que ya estaba.
 *   · `nombre`: el que leen la app y el panel (`perfilDe`, admin-sesion).
 *   · `full_name`: el que usa la web para llenar el alta de quien llega de
 *     Google o Apple (`/portal/registro`).
 */
export function nombreParaGuardar(usuario, nombre) {
  const limpio = String(nombre || "").trim();
  if (!limpio) return null;
  const meta = usuario?.user_metadata || {};
  if (meta.nombre || meta.full_name || meta.name) return null;
  return { nombre: limpio, full_name: limpio };
}

/**
 * Qué pasó al tocar "Ya me activaron — revisar" (después de pedirle a
 * Supabase un token nuevo con `refreshSession()`). Espejo de `revisar()` de
 * `Web/app/(portal)/portal/pendiente/page.js`:
 *   · `activo`: el token nuevo ya trae el sello → se entra al modo.
 *   · `sin-red`: no se pudo preguntar. NO es lo mismo que "todavía no".
 *   · `sesion-cerrada`: al activar, el panel le pone contraseña a la cuenta y
 *     eso CIERRA todas sus sesiones, ésta incluida. Toca volver a entrar.
 *   · `sin-novedad`: todavía no la activan.
 */
export function resultadoDeRevision({ usuario, sesion, error } = {}) {
  const modo = modoDeRol(usuario?.app_metadata?.rol);
  if (modo !== "pendiente" && sesion) return { tipo: "activo", modo };
  if (error && esErrorDeRed(error)) return { tipo: "sin-red" };
  if (error || !sesion) return { tipo: "sesion-cerrada" };
  return { tipo: "sin-novedad" };
}

/**
 * Los textos de la sala de espera.
 *
 * ⚠️ La app casi nunca puede saber si ya hay un alta capturada: la tabla
 * `solicitudes_alta` sólo la lee el personal de Morcast (política
 * `solicitudes_alta_lee_personal`, db/010). La web lo pregunta con la llave
 * de servicio; la app no la tiene. Por eso el texto sin solicitud también le
 * habla a quien ya la llenó.
 */
export function textoPendiente(solicitud) {
  if (solicitud) {
    return {
      titulo: "Tu alta está en revisión",
      cuerpo:
        "Tu cuenta ya está registrada, pero todavía no está activada. Por favor espera mientras la empresa la revisa y la activa. Te avisamos por correo en cuanto quede lista.",
      folio: solicitud.folio || "",
      pedirAlta: false,
    };
  }
  return {
    titulo: "Falta tu alta",
    cuerpo:
      "Tu cuenta ya quedó registrada. Para usar Morcast falta tu alta: complétala en morcast.mx con esta misma cuenta (mapa de tu domicilio y firma). Cuando Morcast la active, entra aquí.",
    nota: "Si ya la completaste, Morcast la está revisando: te avisamos por correo en cuanto quede activa.",
    folio: "",
    pedirAlta: true,
  };
}
