import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import config from "../app.json";
import { supabase, haySupabase } from "./supabase";

/**
 * NOTIFICACIONES PUSH: permiso, registro del token, canal y toques.
 *
 * Para qué (pedido de los dueños, 4-oct-2026): que el cliente se entere en
 * su teléfono cuando su recolección se retrasa o se reagenda (los avisos de
 * /admin/avisos), y que la oficina se entere de un incidente del chofer.
 *
 * Contrato con el servidor (db/026):
 *   · al entrar (y con permiso): `rpc('registrar_push_token', { p_token, p_plataforma: 'android' })`
 *   · al salir:                  `rpc('borrar_push_token', { p_token })`
 *   · cada push trae `data: { tipo: 'aviso' | 'incidente' | 'recoleccion', id }` (ver `push-destino.js`).
 * El token es el de Expo (`ExponentPushToken[…]`): el servidor manda por el
 * servicio de Expo, que a su vez usa Firebase en Android.
 *
 * ⚠️ SIN `google-services.json` (Firebase) Android no entrega token: pedirlo
 * lanza "Default FirebaseApp is not initialized". Aquí se atrapa y
 * simplemente no se registra; la app sigue igual. Ver README.
 */

/** El canal de Android. El servidor lo nombra en cada push (`channelId`). */
export const CANAL_AVISOS = "avisos";

const LLAVE_TOKEN = "morcast_push_token";
const LLAVE_PREGUNTA = "morcast_push_pregunta";
/** Si dijo "Ahora no", no se le vuelve a preguntar en 30 días. */
const DIAS_SIN_PREGUNTAR = 30;

let preparado = false;

/**
 * Se llama UNA vez al arrancar. Crea el canal ANTES de pedir permiso: en
 * Android 13+ el sistema no enseña el diálogo de permiso si la app todavía
 * no tiene ningún canal.
 */
export async function prepararNotificaciones() {
  if (preparado) return;
  preparado = true;
  try {
    // Con la app abierta también se enseña: un "tu ruta va tarde" que llega
    // mientras el cliente mira la app no debe perderse en silencio.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CANAL_AVISOS, {
        name: "Avisos de Morcast",
        description: "Retrasos y cambios de fecha de tus recolecciones, y avisos de la oficina.",
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: "#2a6a99",
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  } catch (e) {
    console.warn("[push] No se pudo preparar:", e?.message || e);
  }
}

/** "granted" | "denied" | "undetermined". */
export async function estadoPermiso() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return "undetermined";
  }
}

/**
 * ¿Hay que enseñar la explicación previa? Solo si el sistema todavía no ha
 * preguntado y la persona no dijo "Ahora no" hace poco. Si ya negó el
 * permiso en el sistema, no se insiste: Android no volvería a enseñar el
 * diálogo y la tarjeta solo estorbaría.
 */
export async function hayQuePreguntar() {
  if (!haySupabase()) return false;
  if ((await estadoPermiso()) !== "undetermined") return false;
  try {
    const r = await AsyncStorage.getItem(LLAVE_PREGUNTA);
    if (!r) return true;
    const cuando = Date.parse(r.replace(/^no:/, ""));
    return !Number.isFinite(cuando) || Date.now() - cuando > DIAS_SIN_PREGUNTAR * 864e5;
  } catch {
    return true;
  }
}

/** Dijo "Ahora no": se guarda la fecha para no volver a molestar pronto. */
export async function recordarAhoraNo() {
  try {
    await AsyncStorage.setItem(LLAVE_PREGUNTA, `no:${new Date().toISOString()}`);
  } catch {
    /* si no se guarda, a lo sumo se le vuelve a preguntar */
  }
}

/** Dijo "Sí": ahora sí se le pide el permiso al sistema y se registra. */
export async function pedirPermisoYRegistrar() {
  try {
    await prepararNotificaciones();
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return { ok: false, permiso: status };
    return registrarToken();
  } catch (e) {
    return { ok: false, motivo: e?.message || String(e) };
  }
}

/** Si ya dio permiso antes (o en otra sesión), se registra sin preguntar. */
export async function registrarSiHayPermiso() {
  if (!haySupabase()) return { ok: false };
  if ((await estadoPermiso()) !== "granted") return { ok: false };
  return registrarToken();
}

async function registrarToken() {
  let token = null;
  try {
    const projectId = config.expo?.extra?.eas?.projectId;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (e) {
    // El caso esperado mientras no exista google-services.json. No es un
    // error para el usuario: solo no habrá push en este teléfono.
    console.warn("[push] Sin token (¿falta Firebase / google-services.json?):", e?.message || e);
    return { ok: false, sinToken: true };
  }
  if (!token) return { ok: false, sinToken: true };

  try {
    const { error } = await supabase.rpc("registrar_push_token", {
      p_token: token,
      p_plataforma: Platform.OS === "ios" ? "ios" : "android",
    });
    if (error) {
      console.warn("[push] La base no aceptó el token:", error.message);
      return { ok: false, motivo: error.message };
    }
    await AsyncStorage.setItem(LLAVE_TOKEN, token);
    return { ok: true, token };
  } catch (e) {
    return { ok: false, motivo: e?.message || String(e) };
  }
}

/**
 * Al cerrar sesión: que este teléfono deje de recibir los avisos de esa
 * cuenta. Se llama ANTES de `signOut()`, mientras todavía hay sesión para
 * que la base acepte el borrado. Nunca detiene el cierre de sesión.
 */
export async function borrarTokenAlSalir() {
  let token = null;
  try {
    token = await AsyncStorage.getItem(LLAVE_TOKEN);
  } catch {
    return;
  }
  if (!token) return;
  try {
    if (haySupabase()) {
      const { error } = await supabase.rpc("borrar_push_token", { p_token: token });
      if (error) console.warn("[push] No se pudo borrar el token:", error.message);
    }
  } catch {
    /* sin señal: el servidor lo limpiará cuando Expo le diga que ya no existe */
  }
  try {
    await AsyncStorage.removeItem(LLAVE_TOKEN);
  } catch {
    /* nada que hacer */
  }
}

/**
 * Escucha los toques en notificaciones, también el que ABRIÓ la app desde
 * cerrada. `alTocar(data)` recibe el `data` del push. Devuelve la función
 * para dejar de escuchar.
 */
export function escucharToques(alTocar) {
  let vivo = true;
  const atendidas = new Set();
  const atender = (respuesta) => {
    const id = respuesta?.notification?.request?.identifier;
    if (!respuesta || (id && atendidas.has(id))) return;
    if (id) atendidas.add(id);
    // Solo el toque normal; las acciones con botones no existen en esta app.
    if (respuesta.actionIdentifier && respuesta.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    alTocar(respuesta.notification.request.content.data || {});
  };

  let sub = null;
  try {
    sub = Notifications.addNotificationResponseReceivedListener(atender);
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (vivo && r) {
          atender(r);
          // Que la misma notificación no vuelva a abrir Inicio en el
          // siguiente arranque.
          try {
            Notifications.clearLastNotificationResponse();
          } catch {
            /* versión sin esta función: a lo sumo se repite una vez */
          }
        }
      })
      .catch(() => {});
  } catch (e) {
    console.warn("[push] No se pueden escuchar los toques:", e?.message || e);
  }

  return () => {
    vivo = false;
    sub?.remove?.();
  };
}
