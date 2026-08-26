"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * LA UBICACIÓN DEL CHOFER, PARA SELLAR LA EVIDENCIA
 * ---------------------------------------------------------------------------
 * El comprobante enseñaba un sello "GPS" que no tenía nada atrás. Esto es lo
 * que le pone algo atrás.
 *
 * LAS REGLAS QUE MANDAN AQUÍ
 *
 * 1. LA UBICACIÓN NUNCA DETIENE LA FOTO. El trabajo del chofer es vaciar el
 *    contenedor, no pelearse con un permiso del navegador parado en la calle.
 *    Si no hay señal, si negó el permiso, o si el teléfono tarda: la foto sube
 *    igual y la recolección se cierra igual. Lo que se pierde es el sello, y
 *    esa pérdida se ENSEÑA, no se disimula.
 *
 * 2. SE PIDE TEMPRANO, NO EN EL MOMENTO DE LA FOTO. El permiso se solicita al
 *    abrir la parada, mientras el chofer teclea el código del contenedor. Si
 *    se pidiera al tomar la foto, el diálogo del navegador competiría con la
 *    cámara abriéndose — dos cosas peleando por la pantalla en el peor
 *    momento.
 *
 * 3. SE VIGILA, NO SE PREGUNTA UNA VEZ. `watchPosition` deja que la lectura
 *    mejore sola: el primer dato del teléfono suele venir de la red (cientos
 *    de metros) y el del GPS llega unos segundos después con metros. Como el
 *    chofer tarda en llegar a la foto, para entonces ya hay una lectura buena.
 *
 * 4. LA PRECISIÓN VIAJA CON EL DATO. Una lectura con dos kilómetros de error
 *    no prueba que el camión estuvo en el domicilio: prueba que estuvo en la
 *    ciudad. Sin el margen, un dato malo se ve igual de firme que uno bueno.
 */

/** Más de esto y la lectura ya no respalda "estuvo en el domicilio". */
export const PRECISION_ACEPTABLE_M = 100;

const OPCIONES = {
  // Usa el GPS del aparato, no sólo la red. Gasta más batería y tarda más,
  // pero es la diferencia entre "en esta colonia" y "en esta puerta".
  enableHighAccuracy: true,
  // El chofer no puede esperar más que esto parado junto al camión.
  timeout: 15000,
  // Una lectura de hace medio minuto sirve: no se ha movido de la parada.
  maximumAge: 30000,
};

/** El objeto que se guarda en la base. Se arma en un solo lugar. */
export function aLectura(pos) {
  return {
    lat: Number(pos.coords.latitude.toFixed(6)),   // ~11 cm: de sobra
    lng: Number(pos.coords.longitude.toFixed(6)),
    precision_m: Math.round(pos.coords.accuracy),
    capturada: new Date(pos.timestamp).toISOString(),
  };
}

/** "25.869300, -97.502300" — el formato que se copia y se pega en un mapa. */
export function comoTexto(lectura) {
  if (!lectura || typeof lectura.lat !== "number") return null;
  return `${lectura.lat.toFixed(6)}, ${lectura.lng.toFixed(6)}`;
}

/** Enlace a Google Maps. Sirve para que la oficina compruebe en un clic. */
export function comoEnlaceMapa(lectura) {
  if (!lectura || typeof lectura.lat !== "number") return null;
  return `https://www.google.com/maps?q=${lectura.lat},${lectura.lng}`;
}

/** ¿Esta lectura respalda que el camión estuvo AHÍ, o sólo por la zona? */
export function esConfiable(lectura) {
  return Boolean(
    lectura &&
      typeof lectura.precision_m === "number" &&
      lectura.precision_m <= PRECISION_ACEPTABLE_M
  );
}

/**
 * @returns {{lectura: object|null, estado: string, motivo: string, pedir: Function}}
 *   estado: "inicial" | "pidiendo" | "lista" | "negada" | "sin-senal" | "no-disponible"
 */
export default function useUbicacion({ automatico = true } = {}) {
  const [lectura, setLectura] = useState(null);
  const [estado, setEstado] = useState("inicial");
  const [motivo, setMotivo] = useState("");
  const refVigilante = useRef(null);
  // Se guarda la mejor lectura, no la última: el teléfono a veces empeora.
  const refMejor = useRef(null);

  const pedir = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setEstado("no-disponible");
      setMotivo("Este teléfono no comparte ubicación.");
      return;
    }
    // La API sólo existe en contextos seguros. En morcast.mx (https) y en
    // localhost sí; en una IP de la red local por http, no — y ahí el
    // navegador falla de formas poco claras, así que se dice a las claras.
    if (!window.isSecureContext) {
      setEstado("no-disponible");
      setMotivo("La ubicación sólo funciona sobre una conexión segura (https).");
      return;
    }

    setEstado((e) => (e === "lista" ? e : "pidiendo"));

    if (refVigilante.current !== null) return; // ya está vigilando

    refVigilante.current = navigator.geolocation.watchPosition(
      (pos) => {
        const nueva = aLectura(pos);
        const mejor = refMejor.current;
        // Sólo se reemplaza si mejora de verdad. Sin esto, una lectura peor
        // que llega después degradaría el sello sin motivo.
        if (!mejor || nueva.precision_m < mejor.precision_m) {
          refMejor.current = nueva;
          setLectura(nueva);
        }
        setEstado("lista");
        setMotivo("");
      },
      (err) => {
        // Si ya se tenía una lectura buena, un error posterior no la borra:
        // el dato viejo sigue siendo válido para esta parada.
        if (refMejor.current) return;
        if (err.code === 1) {
          setEstado("negada");
          setMotivo("No diste permiso de ubicación. La foto se guarda igual, pero sin sello.");
        } else {
          setEstado("sin-senal");
          setMotivo("No se pudo tomar la ubicación. La foto se guarda igual, pero sin sello.");
        }
      },
      OPCIONES
    );
  }, []);

  useEffect(() => {
    if (automatico) pedir();
    return () => {
      if (refVigilante.current !== null) {
        navigator.geolocation.clearWatch(refVigilante.current);
        refVigilante.current = null;
      }
    };
  }, [automatico, pedir]);

  return { lectura, estado, motivo, pedir };
}
