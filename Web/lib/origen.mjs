/**
 * DE QUÉ ORIGEN SE ARMAN LOS ENLACES QUE SALEN DEL SERVIDOR.
 *
 * Por qué hace falta
 * ------------------
 * Detrás de un balanceador —Vercel— el host que ve la aplicación puede ser el
 * interno de la plataforma, así que hay que mirar `x-forwarded-host`. Pero esa
 * cabecera la pone quien tenga delante, y si nadie la valida, un enlace que
 * mandamos por correo puede acabar apuntando al sitio de otro.
 *
 * Aquí importa de verdad: por aquí sale el enlace de recuperar contraseña, que
 * **viaja por correo y lleva dentro un token que da acceso a la cuenta**.
 *
 * Los cuatro agujeros que tenía la primera versión, y que esta cierra
 * -------------------------------------------------------------------
 *  1. El respaldo NO validaba nada: si `x-forwarded-host` no venía, tomaba la
 *     cabecera `Host` tal cual. Bastaba con no mandar la primera y mentir en
 *     la segunda; la lista blanca ni se tocaba.
 *  2. Validaba una cosa y concatenaba otra: `morcast.mx:@evil.com` pasaba el
 *     filtro (lo de antes de los dos puntos es `morcast.mx`) y producía una URL
 *     cuyo host real era `evil.com`, porque `morcast.mx:` quedaba como
 *     credenciales.
 *  3. Comparaba con mayúsculas y minúsculas: `Morcast.MX` es un host válido y
 *     equivalente, se rechazaba, y caía al respaldo inseguro del punto 1.
 *  4. Un `x-forwarded-proto: http` producía un enlace `http://` y el token
 *     viajaba en claro.
 *
 * La regla ahora: se construye el origen **con el host ya normalizado**, nunca
 * con lo que llegó; si no está en la lista, se usa el fijo de producción.
 * Fallar hacia morcast.mx es seguro — como mucho, un enlace inútil.
 */

/** Dominio de producción. Es el respaldo cuando no hay nada de fiar. */
export const ORIGEN_FIJO = "https://morcast.mx";

/**
 * ¿Es un host nuestro?
 * Acepta `morcast.mx`, `www.morcast.mx`, cualquier `*.vercel.app` (las vistas
 * previas) y `localhost`/`127.0.0.1` para desarrollo.
 */
export function hostPermitido(nombre) {
  const h = String(nombre || "").trim().toLowerCase().replace(/\.$/, "");
  if (!h) return false;
  return (
    h === "morcast.mx" ||
    h === "www.morcast.mx" ||
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".vercel.app")
  );
}

/**
 * Parte un valor de cabecera en `{ host, puerto }` **normalizados**, o null si
 * no sirve.
 *
 * Rechaza de plano cualquier cosa que traiga `@`, `/`, `?`, `#` o espacios:
 * son los caracteres con los que se disfraza un host ajeno. No se intenta
 * limpiarlos — lo que no tiene forma de host, no es un host.
 */
export function partirHost(valor) {
  // Las cabeceras `x-forwarded-*` son acumulativas: con varios proxies en
  // cadena llegan separadas por coma, y el primero es el original.
  const bruto = String(valor || "").split(",")[0].trim().toLowerCase();
  if (!bruto) return null;
  if (/[@/?#\s\\]/.test(bruto)) return null;

  const partes = bruto.split(":");
  if (partes.length > 2) return null;                 // ipv6 sin corchetes u otra rareza
  const host = partes[0].replace(/\.$/, "");          // el punto final es válido en DNS
  const puerto = partes[1];
  if (puerto !== undefined && !/^\d{1,5}$/.test(puerto)) return null;

  return { host, puerto };
}

/**
 * El origen con el que armar un enlace. Recibe los `headers()` de Next.
 * Devuelve siempre algo utilizable; ante la duda, `ORIGEN_FIJO`.
 */
export function origenPermitido(cabeceras) {
  const candidatos = [cabeceras.get("x-forwarded-host"), cabeceras.get("host")];

  for (const bruto of candidatos) {
    const partido = partirHost(bruto);
    if (!partido || !hostPermitido(partido.host)) continue;

    // Sólo el desarrollo local puede ir por `http`, y ahí es lo NORMAL: sin
    // esto, `npm run dev` armaría enlaces `https://localhost:3000` que no
    // abren. En cualquier otro sitio se fuerza https, pase lo que pase en la
    // cabecera: el enlace lleva un token y no viaja en claro ni por accidente.
    const local = partido.host === "localhost" || partido.host === "127.0.0.1";
    const proto = String(cabeceras.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
    const esquema = local ? (proto === "https" ? "https" : "http") : "https";

    // Se construye con el host NORMALIZADO, nunca con lo que llegó.
    return `${esquema}://${partido.host}${partido.puerto ? `:${partido.puerto}` : ""}`;
  }

  if (candidatos.some(Boolean)) {
    console.error(`[origen] host no permitido: ${JSON.stringify(candidatos)} — se usa ${ORIGEN_FIJO}`);
  }
  return ORIGEN_FIJO;
}
