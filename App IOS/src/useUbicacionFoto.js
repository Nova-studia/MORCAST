import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { lecturaParaGuardar, mejorLectura } from "./evidencia.mjs";

/**
 * EL GPS DEL CHOFER PARA SELLAR LAS FOTOS DE LA EVIDENCIA (6-oct-2026).
 *
 * Espejo de `useUbicacion` de la web (`Web/lib/ubicacion.js`), con sus
 * mismas reglas:
 *
 *   1. NUNCA DETIENE LA FOTO. Sin permiso, sin señal o con el GPS apagado,
 *      la foto sube igual y la parada se cierra igual. Se pierde el sello, y
 *      eso se DICE ("Sin ubicación"), no se disimula.
 *   2. SE PIDE ANTES DE LA FOTO, no en el momento: el permiso se pide al
 *      identificar el contenedor (`pedir()`), para que el diálogo no se
 *      pelee con la cámara. Si ya lo había dado, empieza solo al abrir.
 *   3. SE VIGILA, NO SE PREGUNTA UNA VEZ: la primera lectura suele ser de la
 *      red (cientos de metros) y la del GPS llega segundos después. Cuando
 *      el chofer toma la foto ya hay una buena. Solo mientras esta pantalla
 *      está abierta: al salir se apaga (nunca en segundo plano).
 *
 * @returns {{ lectura: object|null, estado: string, pedir: Function, ahora: Function }}
 *   estado: "inicial" | "pidiendo" | "lista" | "negada" | "sin-senal" | "no-disponible"
 *   `ahora()` da la mejor lectura vigente en este instante (o null).
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en las dos apps; solo cambia la extensión
 * del import de `evidencia` (`.mjs` en iOS, `.js` en Android).
 */
export default function useUbicacionFoto() {
  const [lectura, setLectura] = useState(null);
  const [estado, setEstado] = useState("inicial");
  const refMejor = useRef(null);
  const refVigilante = useRef(null);
  const refReloj = useRef(null);
  const refVivo = useRef(true);

  const vigilar = useCallback(async () => {
    if (refVigilante.current) return;
    setEstado((e) => (e === "lista" ? e : "pidiendo"));
    // Sin lectura en 20 s (bajo techo de lámina, sótano): se avisa, pero se
    // sigue escuchando por si llega.
    clearTimeout(refReloj.current);
    refReloj.current = setTimeout(() => {
      if (refVivo.current && !refMejor.current) setEstado("sin-senal");
    }, 20000);
    try {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 0 },
        (pos) => {
          const nueva = lecturaParaGuardar(pos);
          if (!nueva || !refVivo.current) return;
          const mejor = mejorLectura(refMejor.current, nueva);
          if (mejor !== refMejor.current) {
            refMejor.current = mejor;
            setLectura(mejor);
          }
          setEstado("lista");
        }
      );
      if (!refVivo.current) { sub.remove(); return; }
      refVigilante.current = sub;
    } catch {
      // El GPS del teléfono está apagado o no existe.
      if (refVivo.current && !refMejor.current) setEstado("no-disponible");
    }
  }, []);

  /** Pide el permiso (si hace falta) y empieza a escuchar. Nunca lanza. */
  const pedir = useCallback(async () => {
    try {
      let permiso = await Location.getForegroundPermissionsAsync();
      if (!permiso.granted && permiso.canAskAgain !== false) {
        permiso = await Location.requestForegroundPermissionsAsync();
      }
      if (!refVivo.current) return;
      if (!permiso.granted) { setEstado("negada"); return; }
      vigilar();
    } catch {
      if (refVivo.current) setEstado("no-disponible");
    }
  }, [vigilar]);

  useEffect(() => {
    refVivo.current = true;
    // Si el permiso ya estaba dado, empieza solo; si no, se espera a
    // `pedir()` para no saltarle al chofer con un diálogo al abrir.
    Location.getForegroundPermissionsAsync()
      .then((p) => { if (p.granted && refVivo.current) vigilar(); })
      .catch(() => {});
    return () => {
      refVivo.current = false;
      clearTimeout(refReloj.current);
      refVigilante.current?.remove?.();
      refVigilante.current = null;
    };
  }, [vigilar]);

  /** La mejor lectura VIGENTE ahora mismo (una de hace minutos ya no vale). */
  const ahora = useCallback(() => vigente(refMejor.current), []);

  return { lectura, estado, pedir, ahora };
}

/** Una lectura de más de 2 minutos ya no dice dónde está el camión ahora. */
function vigente(l) {
  if (!l) return null;
  const edad = Date.now() - new Date(l.capturada).getTime();
  return Number.isFinite(edad) && edad <= 120000 ? l : null;
}
