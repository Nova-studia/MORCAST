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

/**
 * El llavero de iOS NO se borra al desinstalar la app (AsyncStorage sí). Sin
 * esto, quien borra la app y la vuelve a instalar entraría solo, sin
 * contraseña. Una marca en AsyncStorage dice "esta instalación ya corrió":
 * si no está, lo que haya en el llavero es de una instalación anterior y se
 * tira. OJO: solo se limpia el LLAVERO; la copia vieja de AsyncStorage (la
 * sesión de quien viene de la 1.0) se respeta para que la mudanza funcione.
 */
const MARCA_INSTALACION = "morcast_llavero_instalacion";
const soloLlavero = crearAlmacenTrozado({ seguro: llavero, viejo: null });
let revision = null;
let limpiarLlavero = false;
const limpiadas = new Set();

function revisarInstalacion() {
  if (!revision) {
    revision = (async () => {
      try {
        if (!(await AsyncStorage.getItem(MARCA_INSTALACION))) {
          limpiarLlavero = true;
          await AsyncStorage.setItem(MARCA_INSTALACION, "1");
        }
      } catch {
        // Si AsyncStorage falla no se limpia nada: mejor una sesión de más
        // que sacar a todos.
      }
    })();
  }
  return revision;
}

async function antesDeTocar(k) {
  await revisarInstalacion();
  if (limpiarLlavero && !limpiadas.has(k)) {
    limpiadas.add(k);
    await soloLlavero.removeItem(k).catch(() => {});
  }
}

function conRevision(almacen) {
  return {
    getItem: async (k) => { await antesDeTocar(k); return almacen.getItem(k); },
    setItem: async (k, v) => { await antesDeTocar(k); return almacen.setItem(k, v); },
    removeItem: async (k) => { await antesDeTocar(k); return almacen.removeItem(k); },
  };
}

export const almacenSesion =
  Platform.OS === "web"
    ? AsyncStorage
    : conRevision(crearAlmacenTrozado({ seguro: llavero, viejo: AsyncStorage }));

/**
 * Para guardar cosas sueltas en el llavero (el pase del segundo paso de la
 * administración). Mismo adaptador, así un valor largo tampoco truena.
 */
export const llaveroApp =
  Platform.OS === "web" ? AsyncStorage : crearAlmacenTrozado({ seguro: llavero, viejo: null });
