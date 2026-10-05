/**
 * LA SESIÓN EN EL LLAVERO DEL IPHONE, EN TROZOS — lógica pura.
 *
 * POR QUÉ
 * Hasta la 1.0 la sesión de Supabase (el token que abre la cuenta sin
 * contraseña) se guardaba en AsyncStorage: un archivo de texto sin cifrar
 * dentro de la app, que sale tal cual en un respaldo de iTunes sin
 * contraseña. Los dueños pidieron (4-oct-2026) que la información delicada
 * no se filtre; el llavero (Keychain, vía `expo-secure-store`) la cifra el
 * propio iPhone.
 *
 * EL TROPIEZO
 * SecureStore avisa que un valor de más de 2048 bytes "puede fallar", y la
 * sesión de Supabase pasa de eso (el token JWT, el de renovación y los datos
 * del usuario, fácil 3-4 KB). Por eso se parte en trozos: `llave` guarda un
 * encabezado `__trozos:N` y `llave.0`, `llave.1`… guardan el texto.
 *
 * LA MUDANZA
 * Quien actualiza de la 1.0 a la 1.1 tiene su sesión en AsyncStorage. Si se
 * cambiara de almacén sin más, la app le pediría la contraseña a todos los
 * clientes el día de la actualización. Al leer una llave que no está en el
 * llavero se busca en el almacén viejo: si está, se muda (se escribe aquí y
 * se borra allá) y se devuelve como si nada.
 *
 * Todo entra inyectado (`seguro`, `viejo`) para poder probarlo con
 * `node --test` sin un iPhone (tests/almacen-trozos.test.mjs).
 */

export const ENCABEZADO = "__trozos:";

/**
 * Caracteres por trozo. 600 caben en 2048 bytes aunque TODOS fueran de 3
 * bytes en UTF-8 ("…", "€"); acentos y eñes son de 2 y los emojis de 4 por
 * cada 2 caracteres. El token en sí es ASCII: casi siempre sobra espacio.
 */
export const TAM_TROZO = 600;

/** SecureStore solo acepta letras, números, `.`, `-` y `_` en la llave. */
export function llaveSegura(llave) {
  return String(llave || "").replace(/[^A-Za-z0-9._-]/g, "_");
}

/**
 * Parte un texto en pedazos de hasta `tam` caracteres SIN partir un emoji.
 *
 * Un emoji son dos "caracteres" de JavaScript (un par sustituto). Si el
 * corte cae entre los dos, cada trozo lleva medio emoji, el llavero no lo
 * puede guardar como UTF-8 y la sesión se corrompe. Pasa con un nombre como
 * "Panadería 🥖" en los datos del usuario.
 */
export function partir(texto, tam = TAM_TROZO) {
  const s = String(texto ?? "");
  if (tam < 2) throw new Error("El trozo tiene que ser de al menos 2 caracteres.");
  const trozos = [];
  let i = 0;
  while (i < s.length) {
    let fin = Math.min(i + tam, s.length);
    if (fin < s.length) {
      const c = s.charCodeAt(fin - 1);
      if (c >= 0xd800 && c <= 0xdbff) fin -= 1; // mitad alta de un par: se queda para el siguiente
    }
    trozos.push(s.slice(i, fin));
    i = fin;
  }
  return trozos;
}

export function cuantosTrozos(encabezado) {
  if (typeof encabezado !== "string" || !encabezado.startsWith(ENCABEZADO)) return 0;
  const n = Number(encabezado.slice(ENCABEZADO.length));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * El adaptador que espera Supabase (`getItem`, `setItem`, `removeItem`,
 * asíncronos).
 *
 * @param {object} o
 * @param {{getItem:Function,setItem:Function,removeItem:Function}} o.seguro  el llavero
 * @param {{getItem:Function,removeItem:Function}|null} o.viejo  AsyncStorage, para la mudanza
 * @param {number} [o.tam]
 */
export function crearAlmacenTrozado({ seguro, viejo = null, tam = TAM_TROZO }) {
  async function leerSeguro(llave) {
    const k = llaveSegura(llave);
    const cabeza = await seguro.getItem(k);
    if (cabeza == null) return null;
    const n = cuantosTrozos(cabeza);
    if (!n) return cabeza; // valor chico, guardado entero
    const partes = [];
    for (let i = 0; i < n; i++) {
      const p = await seguro.getItem(`${k}.${i}`);
      // Un trozo perdido (la app se cerró a media escritura) deja la sesión
      // inservible. Se contesta "no hay": lo peor que pasa es volver a
      // escribir la contraseña, nunca entrar con media sesión.
      if (p == null) return null;
      partes.push(p);
    }
    return partes.join("");
  }

  async function borrarSeguro(llave) {
    const k = llaveSegura(llave);
    const cabeza = await seguro.getItem(k);
    const n = cuantosTrozos(cabeza);
    for (let i = 0; i < n; i++) await seguro.removeItem(`${k}.${i}`);
    await seguro.removeItem(k);
  }

  async function escribirSeguro(llave, valor) {
    const k = llaveSegura(llave);
    const texto = String(valor);
    const antes = cuantosTrozos(await seguro.getItem(k));

    if (texto.length <= tam && !texto.startsWith(ENCABEZADO)) {
      await seguro.setItem(k, texto);
    } else {
      const trozos = partir(texto, tam);
      // Primero los trozos y AL FINAL el encabezado que los cuenta: así nunca
      // queda un encabezado que prometa trozos que todavía no existen. Si la
      // app se cierra justo a la mitad, lo que se lee sale revuelto, Supabase
      // no lo reconoce como sesión y pide la contraseña: molesto, no grave.
      for (let i = 0; i < trozos.length; i++) await seguro.setItem(`${k}.${i}`, trozos[i]);
      await seguro.setItem(k, `${ENCABEZADO}${trozos.length}`);
      for (let i = trozos.length; i < antes; i++) await seguro.removeItem(`${k}.${i}`);
      return;
    }
    // Pasó de trozos a valor entero: los trozos viejos sobran.
    for (let i = 0; i < antes; i++) await seguro.removeItem(`${k}.${i}`);
  }

  return {
    async getItem(llave) {
      const actual = await leerSeguro(llave);
      if (actual != null || !viejo) return actual;

      // LA MUDANZA desde AsyncStorage (la 1.0). Si escribir en el llavero
      // falla, se devuelve igual lo que había y NO se borra el original: el
      // cliente sigue dentro y se reintenta la próxima vez.
      let anterior = null;
      try {
        anterior = await viejo.getItem(llave);
      } catch {
        return null;
      }
      if (anterior == null) return null;
      try {
        await escribirSeguro(llave, anterior);
        await viejo.removeItem(llave);
      } catch {
        /* se queda en el almacén viejo hasta la próxima */
      }
      return anterior;
    },

    async setItem(llave, valor) {
      await escribirSeguro(llave, valor);
    },

    async removeItem(llave) {
      await borrarSeguro(llave);
      // Al cerrar sesión también se limpia la copia vieja, por si la mudanza
      // nunca llegó a completarse: si no, al volver a abrir la app la sesión
      // "resucitaría" desde AsyncStorage.
      if (viejo) {
        try { await viejo.removeItem(llave); } catch { /* nada que hacer */ }
      }
    },
  };
}
