import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { crearAlmacenTrozado } from "./almacen-trozos.mjs";

/**
 * Dónde guarda Supabase la sesión: el LLAVERO del iPhone (desde la 1.1).
 *
 * La lógica (trozos de ≤2048 bytes y la mudanza desde AsyncStorage, que es
 * donde la guardaba la 1.0) vive en `almacen-trozos.mjs`, con sus pruebas.
 * Aquí solo se conectan las dos piezas reales.
 *
 * En web (`expo start --web`) no hay llavero: se queda AsyncStorage, que
 * allá es el localStorage del navegador. La app publicada nunca pasa por ahí.
 */

const llavero = {
  // WHEN_UNLOCKED (lo que trae por omisión) es el más estricto que sirve:
  // la sesión solo se lee con el teléfono desbloqueado, y la app solo
  // renueva el token en primer plano (ver supabase.js), o sea desbloqueado.
  getItem: (k) => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v),
  removeItem: (k) => SecureStore.deleteItemAsync(k),
};

export const almacenSesion =
  Platform.OS === "web"
    ? AsyncStorage
    : crearAlmacenTrozado({ seguro: llavero, viejo: AsyncStorage });

/**
 * Para guardar cosas sueltas en el llavero (el pase del segundo paso de la
 * administración). Mismo adaptador, así un valor largo tampoco truena.
 */
export const llaveroApp =
  Platform.OS === "web" ? AsyncStorage : crearAlmacenTrozado({ seguro: llavero, viejo: null });
