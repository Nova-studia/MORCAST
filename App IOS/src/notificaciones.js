import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import config from "../app.json";
import { supabase, haySupabase } from "./supabase";
import { llaveroApp } from "./almacen-seguro";
import { esCuentaDeMuestra } from "./cuenta-muestra";

/**
 * NOTIFICACIONES PUSH (1.1).
 *
 * Para qué: que el cliente se entere de un aviso de Morcast ("hoy la ruta va
 * tarde") sin abrir la app, y que la oficina se entere al momento de un
 * incidente del chofer. El servidor las manda por el servicio de push de
 * Expo, con el token que se registra aquí (`registrar_push_token`, db/026).
 *
 * El orden importa, y es el que pide Apple:
 *   1. La app EXPLICA primero para qué quiere avisar (PermisoNotificaciones).
 *   2. Solo si la persona dice que sí, se pide el permiso del sistema. iOS lo
 *      pregunta UNA vez en la vida de la app: si se pide en frío y dicen que
 *      no, ya no hay manera de volver a preguntar desde la app.
 *   3. Con permiso, se saca el token y se registra a nombre de la sesión.
 *   4. Al cerrar sesión se BORRA (antes de cerrar la sesión: el borrado
 *      necesita la sesión para saber de quién es). Si no, el siguiente que
 *      entrara en ese iPhone recibiría los avisos del anterior.
 */

const LLAVE_TOKEN = "morcast_push_token";      // en el llavero: dice a quién se manda
const LLAVE_POSPUESTO = "morcast_push_pospuesto"; // en AsyncStorage: no es delicado
const DIAS_SIN_INSISTIR = 7;

// Con la app abierta, el aviso también se enseña arriba (por omisión iOS lo
// calla si la app está en primer plano, y el cliente no se enteraría).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** 'granted' | 'denied' | 'undetermined' (o 'no-disponible' en web). */
export async function estadoPermiso() {
  if (Platform.OS === "web") return "no-disponible";
  try {
    const p = await Notifications.getPermissionsAsync();
    // `provisional` (iOS) también deja llegar los avisos, en silencio.
    if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return "granted";
    return p.canAskAgain === false || p.status === "denied" ? "denied" : "undetermined";
  } catch {
    return "no-disponible";
  }
}

/**
 * ¿Toca enseñar la explicación? Solo si el sistema todavía no ha preguntado
 * y la persona no dijo "Ahora no" en la última semana: insistir en cada
 * apertura es la forma más rápida de que digan que no.
 */
export async function convieneExplicar() {
  if ((await estadoPermiso()) !== "undetermined") return false;
  try {
    const hasta = Number(await AsyncStorage.getItem(LLAVE_POSPUESTO));
    if (Number.isFinite(hasta) && hasta > Date.now()) return false;
  } catch { /* sin almacenamiento, se explica */ }
  return true;
}

export async function posponerExplicacion() {
  try {
    await AsyncStorage.setItem(LLAVE_POSPUESTO, String(Date.now() + DIAS_SIN_INSISTIR * 24 * 60 * 60 * 1000));
  } catch { /* volverá a salir la próxima vez; no pasa nada */ }
}

/** Pide el permiso del sistema y, si lo dan, registra el token. */
export async function pedirPermisoYRegistrar() {
  let concedido = false;
  try {
    const r = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    concedido = r.granted || r.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    concedido = false;
  }
  if (!concedido) return { ok: false, concedido: false };
  return { ...(await registrarToken()), concedido: true };
}

/**
 * Saca el token de Expo y lo registra a nombre de quien tiene la sesión.
 * Se llama al entrar si ya había permiso: el token puede cambiar (al
 * reinstalar o restaurar el iPhone) y la función de la base lo reasigna.
 * Nunca lanza: sin push la app funciona igual.
 */
export async function registrarToken() {
  if (!haySupabase() || Platform.OS === "web") return { ok: false };
  // La cuenta del revisor de Apple no escribe en la base (cuenta-muestra.js).
  if (esCuentaDeMuestra()) return { ok: true, simulado: true };
  if ((await estadoPermiso()) !== "granted") return { ok: false };

  let token = null;
  try {
    const projectId = config?.expo?.extra?.eas?.projectId;
    token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined))?.data || null;
  } catch (e) {
    // Sin red, en el simulador o sin la llave de APNs en EAS: no hay token.
    console.warn("No se pudo obtener el token de notificaciones:", e?.message || e);
    return { ok: false };
  }
  if (!token) return { ok: false };

  const { error } = await supabase.rpc("registrar_push_token", { p_token: token, p_plataforma: "ios" });
  if (error) {
    console.warn("No se pudo registrar el token de notificaciones:", error.message);
    return { ok: false };
  }
  try { await llaveroApp.setItem(LLAVE_TOKEN, token); } catch { /* solo sirve para borrarlo al salir */ }
  return { ok: true, token };
}

/**
 * Al cerrar sesión: que este iPhone deje de recibir los avisos de esta
 * cuenta. Se llama ANTES de `signOut()`. Si falla (sin señal), se borra de
 * todos modos la copia local; el servidor descarta los tokens que Expo
 * reporta como inválidos.
 */
export async function borrarTokenAlSalir() {
  let token = null;
  try { token = await llaveroApp.getItem(LLAVE_TOKEN); } catch { /* nada guardado */ }
  if (!token) return;
  if (haySupabase()) {
    try {
      await supabase.rpc("borrar_push_token", { p_token: token });
    } catch { /* se intentó */ }
  }
  try { await llaveroApp.removeItem(LLAVE_TOKEN); } catch { /* ya no está */ }
}

/** Los `data` de la notificación que abrió la app en frío, si la hubo. */
export function datosDeLaUltimaNotificacion() {
  try {
    const datos = Notifications.getLastNotificationResponse()?.notification?.request?.content?.data || null;
    // Se consume: si no, al cerrar sesión y volver a entrar llevaría otra vez
    // a la misma pantalla por un toque de hace horas.
    if (datos) Notifications.clearLastNotificationResponse();
    return datos;
  } catch {
    return null;
  }
}

/** Escucha los toques a una notificación con la app viva. Devuelve cómo dejar de escuchar. */
export function alTocarNotificacion(fn) {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    fn(r?.notification?.request?.content?.data || null);
  });
  return () => sub.remove();
}
