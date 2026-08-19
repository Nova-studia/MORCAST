import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para la app.
 *
 * Diferencias con la web, que son las que importan:
 *  · La sesión se guarda en AsyncStorage, no en cookies. En un teléfono no
 *    hay navegador que las administre.
 *  · `detectSessionInUrl: false` porque aquí no hay direcciones web de las
 *    que sacar una sesión.
 *  · `processLock` evita que dos partes de la app renueven el token a la vez
 *    y se pisen.
 *
 * Las llaves entran por `EXPO_PUBLIC_*`, que es como Expo expone variables al
 * código de la app. La llave anónima es pública por diseño: quien decide qué
 * ve cada quien es el RLS dentro de la base, igual que en la web.
 */

const URL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const LLAVE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function haySupabase() {
  return Boolean(URL_SUPABASE && LLAVE_ANON);
}

export const supabase = haySupabase()
  ? createClient(URL_SUPABASE, LLAVE_ANON, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;

/**
 * Renovar el token solo mientras la app está en primer plano.
 *
 * Si se deja corriendo en segundo plano, el teléfono lo despierta cada rato
 * para nada y se come la batería del chofer, que es justo quien menos puede
 * quedarse sin pila a media jornada.
 */
if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (estado) => {
    if (estado === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
