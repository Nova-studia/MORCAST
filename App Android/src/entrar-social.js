import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { supabase, haySupabase } from "./supabase";
import { destinoDeUsuario } from "./sesion";
import { configGoogle, esquemasDelPlugin, mensajeDeError, resultadoDeRevision } from "./entrada-social.js";

/**
 * "CONTINUAR CON GOOGLE" EN LA APP — y la sala de espera de quien todavía no
 * tiene alta.
 *
 * Igual que la web (`Web/components/BotonGoogle.js`): Google entrega un
 * `idToken` AQUÍ, en la app, y se canjea con
 * `supabase.auth.signInWithIdToken({ provider: "google" })`. No hay salto al
 * dominio de Supabase, así que la pantalla de Google dice Morcast.
 *
 * LO QUE NECESITA PARA FUNCIONAR (si falta algo el botón NO sale y se avisa
 * en la consola; la app nunca truena por esto):
 *   · EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID — el ID "web" del proyecto de Google
 *     Cloud (el mismo de `Web/lib/google-datos.mjs`). Es el que va de
 *     `aud` en el token, y el que Supabase reconoce.
 *   · EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID — sólo iPhone: el ID del cliente OAuth
 *     de tipo iOS (bundle mx.morcast.app). Su esquema invertido va en
 *     `app.json` (plugin de Google, `iosUrlScheme`).
 *   · Una compilación propia (EAS o `expo run`): Expo Go no trae el módulo
 *     nativo de Google.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en las dos apps; sólo cambia la extensión
 * del import de la lógica pura (`.mjs` en iOS, `.js` en Android).
 */

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";

/** ¿Corre dentro de Expo Go (la app de pruebas de Expo) y no en la nuestra? */
export function enExpoGo() {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === "expo"
  );
}

// undefined = sin revisar todavía; null = no se puede ofrecer.
let moduloGoogle;

/**
 * La librería de Google, ya configurada, o null.
 *
 * Se pide con `require` y DENTRO de un try: en Expo Go, o en una compilación
 * vieja sin el módulo nativo, importarla arriba del archivo tumbaría la app
 * entera al abrir. Así lo peor que pasa es que el botón no aparece.
 */
function google() {
  if (moduloGoogle !== undefined) return moduloGoogle;
  moduloGoogle = null;

  const revision = configGoogle({
    plataforma: Platform.OS,
    enExpoGo: enExpoGo(),
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    esquemasIos: esquemasDelPlugin(Constants.expoConfig?.plugins),
  });
  if (!revision.ok) {
    console.warn(`[google] Sin botón de Google: ${revision.motivo}`);
    return null;
  }

  try {
    const m = require("@react-native-google-signin/google-signin");
    m.GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      ...(Platform.OS === "ios" ? { iosClientId: IOS_CLIENT_ID } : {}),
    });
    moduloGoogle = m;
  } catch (e) {
    console.warn("[google] El módulo nativo de Google no está en esta compilación:", e?.message || e);
  }
  return moduloGoogle;
}

/** ¿Se enseña "Continuar con Google"? Sin base (modo demostración), no. */
export function googleDisponible() {
  return haySupabase() && Boolean(google());
}

/**
 * Entra con Google. Devuelve SIEMPRE un objeto y nunca lanza:
 *   · `{ ok: true, modo, perfil }` — modo "cliente", "admin", "chofer" o "pendiente".
 *   · `{ ok: false, cancelado: true }` — la persona cerró la ventana de Google.
 *   · `{ ok: false, mensaje }` — algo falló; el mensaje ya va en español.
 */
export async function entrarConGoogle() {
  const m = google();
  if (!m || !haySupabase()) {
    return { ok: false, mensaje: "Entrar con Google no está disponible en esta versión de la app." };
  }
  const { GoogleSignin, statusCodes } = m;
  const falla = (e) => {
    const mensaje = mensajeDeError(e, { proveedor: "Google", codigos: statusCodes });
    return mensaje ? { ok: false, mensaje } : { ok: false, cancelado: true };
  };

  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const respuesta = await GoogleSignin.signIn();
    if (respuesta?.type === "cancelled") return { ok: false, cancelado: true };

    const idToken = respuesta?.data?.idToken;
    // La sesión de MORCAST es la de Supabase; la de Google en el teléfono ya
    // no sirve. Se suelta para que la próxima vez Google deje ELEGIR cuenta
    // en vez de entrar callado con la última.
    GoogleSignin.signOut().catch(() => {});

    if (!idToken) {
      console.warn("[google] Google no entregó idToken (¿webClientId equivocado?).");
      return falla(new Error("sin idToken"));
    }

    const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
    if (error || !data?.user) {
      // El caso típico: falta el ID del cliente de iOS en "Client IDs" del
      // proveedor Google de Supabase, o el "Skip nonce check" (ver README).
      console.warn("[google] Supabase no aceptó el token:", error?.message);
      return falla(error || new Error("sin usuario"));
    }

    return { ok: true, ...(await destinoDeUsuario(data.user)) };
  } catch (e) {
    console.warn("[google] No se pudo entrar:", e?.code, e?.message);
    return falla(e);
  }
}

/* ------------------------------------------------------------------------ */
/* La sala de espera (cuenta sin alta activada)                              */
/* ------------------------------------------------------------------------ */

/**
 * La solicitud de alta de esta cuenta, si la base deja leerla; si no, null.
 *
 * ⚠️ Hoy la base NO la deja: `solicitudes_alta` sólo la lee el personal
 * (db/010) y la web la consulta con la llave de servicio. Con la sesión del
 * cliente la respuesta es vacía, y la sala de espera usa el texto que sirve
 * para los dos casos. Si algún día se abre una política "lee la tuya" o un
 * `/api/app/...`, esta función es el único lugar que hay que cambiar.
 */
export async function miSolicitud(usuarioId) {
  if (!haySupabase() || !usuarioId) return null;
  try {
    const { data, error } = await supabase
      .from("solicitudes_alta")
      .select("folio, estado")
      .eq("usuario_id", usuarioId)
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

/**
 * "Ya me activaron — revisar". Pide un token NUEVO (el que trae el teléfono
 * no se entera del sello hasta que caduca, como una hora) y decide.
 * Devuelve `{ tipo, modo?, perfil? }`; ver `resultadoDeRevision`.
 */
export async function revisarAlta() {
  if (!haySupabase()) return { tipo: "sin-novedad" };
  try {
    const { data, error } = await supabase.auth.refreshSession();
    const r = resultadoDeRevision({ usuario: data?.user, sesion: data?.session, error });
    if (r.tipo !== "activo") return r;
    return { tipo: "activo", ...(await destinoDeUsuario(data.user)) };
  } catch (e) {
    return resultadoDeRevision({ error: e });
  }
}
