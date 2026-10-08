import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { postApp } from "./api-web";

/**
 * PRECIOS DESDE LA WEB (8-oct-2026).
 *
 * La app ya no trae precios, IVA ni Hold escritos en el código: los pide a
 * /api/app/precios (la misma regla que la web) y guarda la última respuesta
 * buena por si no hay señal. Sin respuesta ni copia → `null` → la app se
 * queda en Hold (ver `decidirHold` en precios-logica): nunca enseña montos
 * inventados a un cliente real.
 */
const LLAVE = "morcast:precios:v1";
let actual = null;
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f(actual));

/** Lo último que contestó la web (o la copia guardada), o null. */
export function respuestaPrecios() {
  return actual;
}

/** Al abrir la app: la copia guardada, mientras contesta el servidor. */
export async function iniciarPrecios() {
  try {
    const guardado = await AsyncStorage.getItem(LLAVE);
    if (guardado && !actual) {
      actual = JSON.parse(guardado);
      avisar();
    }
  } catch {
    /* sin copia: se queda en Hold hasta que conteste el servidor */
  }
}

/** Pide los precios a la web. Si falla, se queda con lo que tenía. */
export async function cargarPrecios() {
  const r = await postApp("precios", {});
  if (!r?.ok || !Array.isArray(r.conceptos)) return;
  actual = {
    hold: r.hold === true,
    iva: r.iva,
    requiereFactura: Boolean(r.requiereFactura),
    conceptos: r.conceptos,
  };
  avisar();
  try {
    await AsyncStorage.setItem(LLAVE, JSON.stringify(actual));
  } catch {
    /* la memoria basta */
  }
}

/** Al cerrar sesión: los precios de una cuenta no se le quedan a la siguiente. */
export async function olvidarPrecios() {
  actual = null;
  avisar();
  try {
    await AsyncStorage.removeItem(LLAVE);
  } catch {
    /* nada */
  }
}

/** Hook: se vuelve a pintar cuando llegan precios nuevos. */
export function usePrecios() {
  const [valor, setValor] = useState(actual);
  useEffect(() => {
    oyentes.add(setValor);
    setValor(actual);
    return () => {
      oyentes.delete(setValor);
    };
  }, []);
  return valor;
}
