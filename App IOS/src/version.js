import config from "../app.json";

/**
 * La versión que se enseña al pie de "Más".
 *
 * Sale de `app.json`, el mismo número que se sube al sacar una versión nueva.
 * Antes estaba escrita a mano ("v1.0") y se iba a quedar vieja con la primera
 * actualización.
 */
export const VERSION_APP = config.expo.version;
