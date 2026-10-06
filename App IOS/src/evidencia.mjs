/**
 * EVIDENCIA DE LA RECOLECCIÓN — lógica pura (sin React, sin Supabase).
 *
 * El sello de ubicación de las fotos (6-oct-2026). La web ya guardaba DÓNDE
 * se tomó cada foto (`Web/lib/ubicacion.js` + db/016, columna
 * `recolecciones.ubicacion = { antes, despues }`); las apps no, y el
 * comprobante del cliente decía "Sin ubicación registrada" en TODOS los
 * servicios hechos desde el teléfono. Aquí está la forma del dato (idéntica a
 * la web) y cómo se dice en pantalla.
 *
 * LAS REGLAS (las mismas de la web):
 *   · La ubicación NUNCA detiene la foto ni el cierre. Sin señal o sin
 *     permiso, la foto sube igual; lo que se pierde es el sello, y se DICE.
 *   · La precisión viaja con el dato: una lectura de ±2 km prueba que el
 *     camión estaba en la ciudad, no en el domicilio. Más de 100 m se enseña
 *     como "señal débil", no se esconde.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en las dos apps (`evidencia.mjs` en iOS,
 * `evidencia.js` en Android). Mismo contenido.
 */

/** Más de esto y la lectura ya no respalda "estuvo en el domicilio" (igual que la web). */
export const PRECISION_ACEPTABLE_M = 100;

/**
 * Lo que entrega expo-location (o una lectura ya armada) → lo que se guarda:
 * `{ lat, lng, precision_m, capturada }`, con 6 decimales (~11 cm) como
 * `aLectura` de la web. `null` si no trae coordenadas.
 */
export function lecturaParaGuardar(entrada) {
  if (!entrada) return null;
  const c = entrada.coords || entrada;
  const lat = Number(c.latitude ?? c.lat);
  const lng = Number(c.longitude ?? c.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const p = Number(c.accuracy ?? c.precision_m);
  const t = entrada.timestamp ?? entrada.capturada;
  const fecha = t != null && !Number.isNaN(new Date(t).getTime()) ? new Date(t) : new Date();
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    precision_m: Number.isFinite(p) ? Math.round(p) : null,
    capturada: fecha.toISOString(),
  };
}

/** ¿Esta lectura respalda que el camión estuvo AHÍ, o solo por la zona? */
export function esConfiable(lectura) {
  return Boolean(
    lectura &&
      typeof lectura.precision_m === "number" &&
      lectura.precision_m <= PRECISION_ACEPTABLE_M
  );
}

/**
 * Se guarda la MEJOR lectura, no la última: el teléfono a veces empeora (la
 * primera suele venir de la red, a cientos de metros; la del GPS llega
 * después con metros). Pero una lectura vieja no vale por buena: si el
 * chofer abrió la parada antes de llegar, la de hace 5 minutos es de otra
 * calle. Pasados `vigenciaMs` manda la nueva aunque sea peor.
 */
export function mejorLectura(actual, nueva, { vigenciaMs = 120000, ahora = Date.now() } = {}) {
  if (!nueva) return actual || null;
  if (!actual) return nueva;
  const edad = ahora - new Date(actual.capturada).getTime();
  if (!Number.isFinite(edad) || edad > vigenciaMs) return nueva;
  const pa = typeof actual.precision_m === "number" ? actual.precision_m : Infinity;
  const pn = typeof nueva.precision_m === "number" ? nueva.precision_m : Infinity;
  return pn < pa ? nueva : actual;
}

/**
 * El sello de UNA foto: `{ estado: "ok" | "debil" | "sin", texto }`.
 * Mismas tres situaciones que el comprobante web (EvidenciaServicio.js).
 */
export function selloFoto(lectura) {
  if (!lectura || typeof lectura.lat !== "number") return { estado: "sin", texto: "Sin ubicación" };
  const m = typeof lectura.precision_m === "number" ? `±${lectura.precision_m} m` : "precisión desconocida";
  if (esConfiable(lectura)) return { estado: "ok", texto: m };
  return { estado: "debil", texto: `Señal débil · ${m}` };
}

/** "25.869300, -97.502300" — lo que se copia y se pega en un mapa. */
export function comoTexto(lectura) {
  if (!lectura || typeof lectura.lat !== "number" || typeof lectura.lng !== "number") return null;
  return `${lectura.lat.toFixed(6)}, ${lectura.lng.toFixed(6)}`;
}

/** Enlace a Google Maps, para comprobarlo en un toque. */
export function enlaceMapa(lectura) {
  if (!lectura || typeof lectura.lat !== "number" || typeof lectura.lng !== "number") return null;
  return `https://www.google.com/maps?q=${lectura.lat},${lectura.lng}`;
}

/**
 * La ubicación DEL SERVICIO, en una línea. Manda la del DESPUÉS: es la que
 * prueba que el contenedor se vació ahí (la del antes solo prueba que
 * llegó). "Sin ubicación registrada" SOLO cuando de verdad no hay ninguna.
 */
export function textoUbicacionServicio(ubicacion) {
  const u = ubicacion?.despues || ubicacion?.antes || null;
  const texto = comoTexto(u);
  if (!texto) return "Sin ubicación registrada";
  const m = typeof u.precision_m === "number" ? ` · ±${u.precision_m} m` : "";
  return `${texto}${m}${esConfiable(u) ? "" : " (señal débil)"}`;
}

/** Lo que va a la columna `recolecciones.ubicacion`: null si no hay ninguna (como la web). */
export function ubicacionParaGuardar(antes, despues) {
  const a = lecturaParaGuardar(antes);
  const d = lecturaParaGuardar(despues);
  return a || d ? { antes: a, despues: d } : null;
}

/** "08:14" en la hora del teléfono, o "—". */
export function horaCorta(instante) {
  if (!instante) return "—";
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * La fila de `recolecciones` → lo que enseña el chofer al abrir una parada
 * completada. Antes la app pasaba la fila tal cual (`{ id, qr, peso_kg }`,
 * sin las fotos) y la pantalla buscaba `evidencia.antes`, que no existía:
 * las fotos nunca cargaban (Luis, iPhone, 6-oct-2026). Aquí van las RUTAS de
 * las fotos; los enlaces firmados se piden al abrir el comprobante porque
 * caducan.
 */
export function evidenciaDeParada(ev) {
  if (!ev) return null;
  return {
    qr: ev.qr || "",
    peso_kg: ev.peso_kg ?? null,
    peso: ev.peso_kg ? `${ev.peso_kg} kg` : "",
    horaAntes: ev.hora_antes ? horaCorta(ev.hora_antes) : "",
    horaDespues: ev.hora_despues ? horaCorta(ev.hora_despues) : "",
    rutaAntes: ev.foto_antes || null,
    rutaDespues: ev.foto_despues || null,
    // Sin foto local: la de la base se baja con enlace firmado.
    antes: null,
    despues: null,
    ubicacion: ev.ubicacion || null,
  };
}
