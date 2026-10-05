import { Linking, Alert } from "react-native";
import * as Location from "expo-location";

/**
 * GPS del chofer: para fijar la ubicación de un punto la primera vez que lo
 * visita, y para que un incidente diga DÓNDE pasó.
 *
 * Solo "mientras se usa la app": nunca en segundo plano. No se sigue al
 * chofer; se lee una vez, cuando él toca el botón.
 */

/**
 * Lee la ubicación una vez. Devuelve `{ ok, lectura }` o `{ ok:false, motivo, sinPermiso? }`.
 *
 * `getCurrentPositionAsync` puede tardar mucho bajo techo de lámina (naves
 * industriales): se corta a los `espera` ms para no dejar al chofer viendo
 * un reloj. Mejor un "sal a la entrada y vuelve a intentar".
 */
export async function leerUbicacion({ alta = true, espera = 20000 } = {}) {
  let permiso;
  try {
    permiso = await Location.getForegroundPermissionsAsync();
    if (!permiso.granted && permiso.canAskAgain !== false) {
      permiso = await Location.requestForegroundPermissionsAsync();
    }
  } catch {
    return { ok: false, motivo: "No se pudo pedir el permiso de ubicación." };
  }
  if (!permiso?.granted) {
    return {
      ok: false,
      sinPermiso: true,
      motivo: "Morcast no tiene permiso de usar tu ubicación. Actívalo en Ajustes › Morcast › Ubicación.",
    };
  }

  let reloj;
  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: alta ? Location.Accuracy.Highest : Location.Accuracy.Balanced,
      }),
      new Promise((_, no) => { reloj = setTimeout(() => no(new Error("tiempo")), espera); }),
    ]);
    return {
      ok: true,
      lectura: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        precision_m: pos.coords.accuracy ?? null,
        capturada: new Date(pos.timestamp || Date.now()).toISOString(),
      },
    };
  } catch {
    return { ok: false, motivo: "El GPS no respondió. Sal al aire libre, a la entrada del punto, y vuelve a intentarlo." };
  } finally {
    clearTimeout(reloj);
  }
}

/** Avisa que falta el permiso y ofrece abrir Ajustes. */
export function avisarSinPermiso(motivo) {
  Alert.alert("Permiso de ubicación", motivo, [
    { text: "Ahora no", style: "cancel" },
    { text: "Abrir Ajustes", onPress: () => Linking.openSettings().catch(() => {}) },
  ]);
}
