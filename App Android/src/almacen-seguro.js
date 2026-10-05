import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { crearAlmacenTroceado } from "./almacen-troceado.js";

/**
 * DÓNDE VIVE LA SESIÓN DE SUPABASE: en el almacén cifrado del teléfono.
 *
 * Hasta la 1.0 vivía en AsyncStorage, un archivo sin cifrar. Ahora va a
 * `expo-secure-store` (Keystore de Android), troceada porque no cabe en un
 * solo valor, y la de quien actualiza se muda sola la primera vez (ver
 * `almacen-troceado.js`, ahí está el porqué de cada decisión).
 *
 * Lo mismo sirve para cualquier secreto chico de la app: el pase del segundo
 * paso del admin (`segundo-paso.js`) va aquí también.
 */

/** SecureStore con la forma de AsyncStorage (getItem/setItem/removeItem). */
const secureStore = {
  getItem: (llave) => SecureStore.getItemAsync(llave),
  setItem: (llave, valor) => SecureStore.setItemAsync(llave, valor),
  removeItem: (llave) => SecureStore.deleteItemAsync(llave),
};

export const almacenSesion = crearAlmacenTroceado({
  seguro: secureStore,
  viejo: AsyncStorage,
  aviso: (mensaje, error) => console.warn(`[almacén seguro] ${mensaje}:`, error?.message || error || ""),
});

/** Para secretos que nunca estuvieron en AsyncStorage: sin migración. */
export const almacenSecreto = crearAlmacenTroceado({
  seguro: secureStore,
  aviso: (mensaje, error) => console.warn(`[almacén seguro] ${mensaje}:`, error?.message || error || ""),
});
