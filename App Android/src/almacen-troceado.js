/**
 * ALMACÉN TROCEADO: guarda textos largos en un almacén que solo acepta
 * valores chicos, y muda lo viejo sin cerrarle la sesión a nadie.
 *
 * POR QUÉ
 * ───────
 * La sesión de Supabase (el token con el que la app entra a la base) vivía en
 * AsyncStorage, que en Android es un archivo SIN cifrar dentro de la app. En
 * un teléfono con root, o en un respaldo, ese token se puede copiar y usar.
 * Ahora vive en `expo-secure-store` (Keystore de Android, cifrado).
 *
 * Pero SecureStore tiene un límite: más de ~2 KB por valor y puede fallar o
 * quejarse, y la sesión de Supabase pesa entre 2 y 4 KB (trae el token, el de
 * renovación y los datos del usuario). Por eso se parte en TROZOS de bytes
 * (no de letras: "Ramón" pesa más bytes que letras) y se guarda un índice.
 *
 * MIGRACIÓN SUAVE
 * ───────────────
 * Quien actualice de la 1.0 a la 1.1 ya tiene su sesión en AsyncStorage. Si
 * se ignorara, la actualización lo sacaría y le pediría la contraseña. Así
 * que la primera vez que se pide una llave que no está en el almacén seguro,
 * se busca en el viejo, se copia al seguro y se BORRA del viejo (no debe
 * quedar una copia sin cifrar).
 *
 * Lógica pura: recibe los dos almacenes como parámetros para poder probarla
 * con almacenes de mentira (tests/almacen-troceado.test.mjs). La conexión con
 * los de verdad está en `almacen-seguro.js`.
 */

/** Tope de bytes por trozo. Debajo de los 2048 que aguanta SecureStore, con margen. */
export const BYTES_POR_TROZO = 1800;

/** Marca del índice: "trozos:3" quiere decir que el valor está en 3 pedazos. */
const MARCA = "trozos:";

/** Cuántos bytes ocupa un carácter (un punto de código) en UTF-8. */
function bytesDe(puntoDeCodigo) {
  if (puntoDeCodigo < 0x80) return 1;
  if (puntoDeCodigo < 0x800) return 2;
  if (puntoDeCodigo < 0x10000) return 3;
  return 4;
}

/**
 * Parte un texto en pedazos de hasta `tope` bytes UTF-8 sin cortar nunca un
 * carácter a la mitad (`for…of` recorre por punto de código, así que un
 * emoji o una letra con acento no se parte).
 */
export function trocear(texto, tope = BYTES_POR_TROZO) {
  const trozos = [];
  let actual = "";
  let bytes = 0;
  for (const caracter of String(texto)) {
    const b = bytesDe(caracter.codePointAt(0));
    if (bytes + b > tope && actual) {
      trozos.push(actual);
      actual = "";
      bytes = 0;
    }
    actual += caracter;
    bytes += b;
  }
  if (actual || !trozos.length) trozos.push(actual);
  return trozos;
}

/** Bytes UTF-8 de un texto. */
export function bytesUtf8(texto) {
  let n = 0;
  for (const c of String(texto)) n += bytesDe(c.codePointAt(0));
  return n;
}

const llaveTrozo = (llave, i) => `${llave}__${i}`;

function cuantosTrozos(indice) {
  if (typeof indice !== "string" || !indice.startsWith(MARCA)) return 0;
  const n = Number(indice.slice(MARCA.length));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * @param {{
 *   seguro: { getItem(k): Promise<string|null>, setItem(k, v): Promise<void>, removeItem(k): Promise<void> },
 *   viejo?: { getItem(k): Promise<string|null>, setItem(k, v): Promise<void>, removeItem(k): Promise<void> },
 *   aviso?: (mensaje: string, error?: unknown) => void,
 * }} almacenes
 * @returns la interfaz que espera Supabase: `getItem`, `setItem`, `removeItem`.
 */
export function crearAlmacenTroceado({ seguro, viejo = null, aviso = () => {} }) {
  async function leerSeguro(llave) {
    const indice = await seguro.getItem(llave);
    if (indice == null) return null;
    const n = cuantosTrozos(indice);
    if (!n) return indice; // valor corto, guardado tal cual
    const partes = [];
    for (let i = 0; i < n; i++) {
      const p = await seguro.getItem(llaveTrozo(llave, i));
      // Un trozo perdido deja la sesión inservible: mejor "no hay sesión"
      // (el usuario vuelve a entrar) que un JSON roto que tumbe la app.
      if (p == null) return null;
      partes.push(p);
    }
    return partes.join("");
  }

  async function borrarTrozos(llave, desde = 0) {
    const n = cuantosTrozos(await seguro.getItem(llave));
    for (let i = desde; i < n; i++) await seguro.removeItem(llaveTrozo(llave, i));
  }

  async function escribirSeguro(llave, valor) {
    const texto = String(valor);
    const viejos = cuantosTrozos(await seguro.getItem(llave));
    // Un valor corto que no parezca índice va directo, sin trozos.
    if (bytesUtf8(texto) <= BYTES_POR_TROZO && !texto.startsWith(MARCA)) {
      await seguro.setItem(llave, texto);
      for (let i = 0; i < viejos; i++) await seguro.removeItem(llaveTrozo(llave, i));
      return;
    }
    const trozos = trocear(texto);
    // Primero los trozos y AL FINAL el índice: si la app se cierra a la
    // mitad, el índice viejo sigue apuntando a algo completo o a nada.
    for (let i = 0; i < trozos.length; i++) await seguro.setItem(llaveTrozo(llave, i), trozos[i]);
    await seguro.setItem(llave, `${MARCA}${trozos.length}`);
    for (let i = trozos.length; i < viejos; i++) await seguro.removeItem(llaveTrozo(llave, i));
  }

  return {
    async getItem(llave) {
      try {
        const valor = await leerSeguro(llave);
        if (valor != null) return valor;
      } catch (e) {
        aviso("No se pudo leer del almacén seguro", e);
      }

      if (!viejo) return null;
      // Migración: lo que dejó la 1.0 en AsyncStorage.
      let antiguo = null;
      try {
        antiguo = await viejo.getItem(llave);
      } catch {
        return null;
      }
      if (antiguo == null) return null;
      try {
        await escribirSeguro(llave, antiguo);
        await viejo.removeItem(llave);
      } catch (e) {
        // Si el almacén seguro no sirve en este teléfono, la copia vieja se
        // queda donde estaba: perder la sesión sería peor que no mudarla.
        aviso("No se pudo mudar la sesión al almacén seguro", e);
      }
      return antiguo;
    },

    async setItem(llave, valor) {
      try {
        await escribirSeguro(llave, valor);
        // Si quedaba una copia vieja sin cifrar, se va.
        if (viejo) await viejo.removeItem(llave).catch(() => {});
      } catch (e) {
        // Algunos Android con el Keystore dañado fallan aquí. Sin almacén la
        // persona no podría entrar nunca; se guarda en el viejo y se avisa.
        aviso("El almacén seguro falló; la sesión se guardó en el almacén normal", e);
        if (viejo) await viejo.setItem(llave, String(valor));
        else throw e;
      }
    },

    async removeItem(llave) {
      try {
        await borrarTrozos(llave);
        await seguro.removeItem(llave);
      } catch (e) {
        aviso("No se pudo borrar del almacén seguro", e);
      }
      if (viejo) await viejo.removeItem(llave).catch(() => {});
    },
  };
}
