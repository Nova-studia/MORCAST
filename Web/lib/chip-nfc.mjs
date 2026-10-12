/**
 * GRABAR EL CHIP NFC DE UN GAFETE — la lógica, sin React.
 *
 * El chip va dentro de la tarjeta de PVC y lleva lo mismo que el QR: el
 * enlace `https://morcast.mx/g/<código>`. Se graba desde el panel con Web
 * NFC, que hoy solo existe en Chrome para Android: se acerca la tarjeta a la
 * parte de atrás del teléfono, se escribe el enlace y el chip se SELLA
 * (`makeReadOnly`) para que nadie lo regrabe con otra dirección. Sellar no
 * se puede deshacer.
 *
 * Todo cuelga de las lecturas del teléfono ("llegó una tarjeta"): ahí mismo
 * se ve qué trae el chip, se graba si hace falta y se sella. Por eso nunca
 * se sella un chip sin haber comprobado antes que trae el enlace correcto,
 * y una tarjeta que se retiró a medias se termina con solo volver a
 * acercarla.
 *
 * El lector (`NDEFReader`) entra por parámetro para que `node --test` lo
 * cambie por uno de mentiras (tests/chip-nfc.test.mjs).
 */

import { codigoDeEnlace } from "./gafetes.mjs";

/** Cuánto se espera a que una grabación o un sello terminen. */
const ESPERA_MS = 8000;

/** ¿Este navegador puede grabar chips? Si no, por qué. */
export function soporteNfc(ventana = globalThis) {
  if (ventana?.isSecureContext === false) return { ok: false, motivo: "sin-https" };
  if (typeof ventana?.NDEFReader !== "function") return { ok: false, motivo: "sin-nfc" };
  return { ok: true, motivo: null };
}

/** El enlace que trae un chip, o null si está vacío o trae otra cosa. */
export function enlaceDelChip(mensaje) {
  const registro = (mensaje?.records || []).find((r) => r.recordType === "url" || r.recordType === "absolute-url");
  if (!registro?.data) return null;
  try {
    return new TextDecoder().decode(registro.data);
  } catch {
    return null;
  }
}

/**
 * ¿El número de serie delata un chip que NO conviene para el gafete?
 *
 * Los chips buenos (NTAG213/215/216, MIFARE Ultralight) traen un número de
 * serie de 7 bytes. Uno de 4 bytes es casi siempre un MIFARE Classic: el
 * chip barato de las tarjetas de acceso. Algunos Android lo graban, pero no
 * es NFC estándar y la mayoría de los teléfonos (todos los iPhone) después
 * NO lo leen: la tarjeta parecería servir en el teléfono que la grabó y
 * fallaría en el del guardia. Sin número de serie no se opina.
 */
export function chipDudoso(serie) {
  const bytes = String(serie || "").split(/[:\s-]/).filter(Boolean);
  return bytes.length === 4;
}

/**
 * Lo que se le dice a la persona cuando Chrome rechaza un paso
 * (`iniciar`, `grabar` o `sellar`). Chrome avisa con el NOMBRE del error.
 */
export function textoDeError(error, paso) {
  const nombre = error?.name || "";
  if (nombre === "AbortError") return "Se acabó el tiempo. Deja la tarjeta quieta sobre la parte de atrás del teléfono.";
  if (nombre === "NetworkError") return "La tarjeta se movió a medias. Acércala otra vez y déjala quieta.";
  if (nombre === "NotReadableError") return "El NFC del teléfono está apagado. Enciéndelo en Ajustes › Conexiones › NFC.";
  if (paso === "iniciar") {
    if (nombre === "NotAllowedError") return "Chrome no tiene permiso para usar el NFC. Toca el candado junto a la dirección y permite «NFC».";
    if (nombre === "NotSupportedError") return "Este teléfono no tiene NFC.";
    return `No se pudo encender el lector de NFC (${nombre || "error"}).`;
  }
  if (paso === "sellar") {
    if (nombre === "NotSupportedError") return "Este chip no se dejó sellar: o ya estaba sellado, o no es de un tipo que se pueda sellar.";
    return `No se pudo sellar el chip (${nombre || "error"}).`;
  }
  if (nombre === "NotAllowedError") return "Chrome no dejó grabar este chip. Lo más común es que ya esté sellado y no admita cambios.";
  if (nombre === "NotSupportedError") return "Este chip no sirve para el gafete: tiene que ser NTAG213, NTAG215 o NTAG216 (NFC de 13.56 MHz).";
  return `No se pudo grabar el chip (${nombre || "error"}).`;
}

/**
 * Un grabador para UNA tarjeta. `alEstado({ paso, … })` recibe cada cambio:
 *
 * - `pidiendo`      Chrome está pidiendo el permiso de NFC.
 * - `esperando`     listo: falta acercar la tarjeta.
 * - `grabando` / `sellando`
 * - `otro-gafete`   el chip ya trae el enlace de OTRO gafete (`codigo`); no
 *                   se tocó. `grabarEncima()` lo autoriza para el siguiente
 *                   acercamiento.
 * - `chip-dudoso`   por su número de serie parece un chip que otros
 *                   teléfonos no van a leer (`chipDudoso`); no se tocó.
 *                   `grabarAunque()` lo autoriza.
 * - `reintenta`     falló un paso (`motivo`); basta volver a acercarla.
 * - `falta-sellar`  el enlace quedó grabado pero el chip sigue abierto.
 * - `hecho`         terminado (`sellado`, `yaEstaba`, `serie`).
 * - `error`         no se pudo ni empezar (`motivo`).
 */
export function crearGrabador({ Lector, enlace, sellar = true, alEstado, esperaMs = ESPERA_MS }) {
  let lector = null;
  let corte = null;
  let ocupado = false;
  let encima = false;
  let aunque = false;
  let terminado = false;

  const detenido = () => !corte || corte.signal.aborted;
  const avisa = (paso, extra = {}) => {
    if (!detenido()) alEstado?.({ paso, ...extra });
  };

  /** Corre un paso del lector con límite de tiempo; al detener, se corta. */
  async function conLimite(paso) {
    const limite = new AbortController();
    const cortar = () => limite.abort();
    const reloj = setTimeout(cortar, esperaMs);
    corte.signal.addEventListener("abort", cortar);
    try {
      return await paso(limite.signal);
    } finally {
      clearTimeout(reloj);
      corte.signal.removeEventListener("abort", cortar);
    }
  }

  async function alLeer(evento) {
    // Terminada la tarjeta, el lector sigue encendido solo para que Android
    // no abra el enlace si la vuelven a acercar.
    if (ocupado || terminado || detenido()) return;
    ocupado = true;
    try {
      // Antes que nada: ¿es un chip de los que sirven? Se pregunta también si
      // ya trae el enlace, porque lo que sigue (sellarlo) no se deshace.
      if (chipDudoso(evento?.serialNumber) && !aunque) {
        avisa("chip-dudoso", { serie: evento.serialNumber });
        return;
      }
      const actual = enlaceDelChip(evento?.message);
      const yaEstaba = actual === enlace;

      if (!yaEstaba) {
        const otro = codigoDeEnlace(actual);
        if (otro && !encima) {
          avisa("otro-gafete", { codigo: otro });
          return;
        }
        avisa("grabando");
        try {
          await conLimite((signal) =>
            lector.write({ records: [{ recordType: "url", data: enlace }] }, { overwrite: true, signal })
          );
        } catch (e) {
          avisa("reintenta", { motivo: textoDeError(e, "grabar") });
          return;
        }
      }

      if (sellar) {
        avisa("sellando");
        try {
          await conLimite((signal) => lector.makeReadOnly({ signal }));
        } catch (e) {
          avisa("falta-sellar", { motivo: textoDeError(e, "sellar") });
          return;
        }
      }

      terminado = true;
      avisa("hecho", { sellado: sellar, yaEstaba, serie: evento?.serialNumber || "" });
    } finally {
      ocupado = false;
    }
  }

  return {
    /** Enciende el lector. Hay que llamarlo desde un toque (Chrome pide permiso). */
    async iniciar() {
      corte = new AbortController();
      avisa("pidiendo");
      try {
        lector = new Lector();
        lector.onreading = alLeer;
        lector.onreadingerror = () => {
          if (!ocupado && !terminado) {
            avisa("reintenta", { motivo: "No se pudo leer este chip. Tiene que ser NTAG213, NTAG215 o NTAG216 (NFC de 13.56 MHz)." });
          }
        };
        await lector.scan({ signal: corte.signal });
        avisa("esperando");
        return true;
      } catch (e) {
        avisa("error", { motivo: textoDeError(e, "iniciar") });
        corte.abort();
        return false;
      }
    },

    /** Autoriza regrabar un chip que ya trae otro gafete. */
    grabarEncima() {
      encima = true;
      avisa("esperando");
    },

    /** Autoriza grabar un chip que parece de un tipo que no conviene. */
    grabarAunque() {
      aunque = true;
      avisa("esperando");
    },

    /** Apaga el lector y corta lo que esté a medias. */
    detener() {
      corte?.abort();
    },
  };
}
