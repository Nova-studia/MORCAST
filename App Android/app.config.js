/**
 * CONFIGURACIÓN DINÁMICA: lo mismo que `app.json` + el archivo de Firebase
 * SOLO si existe.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ───────────────────────────
 * Las notificaciones push de Android viajan por Firebase (FCM), y para eso la
 * app necesita `google-services.json`. Ese archivo todavía NO existe (Luis
 * tiene que crear el proyecto en Firebase) y además no se versiona: este repo
 * es público y el archivo trae los identificadores del proyecto.
 *
 * Si `app.json` dijera `"googleServicesFile": "./google-services.json"` a
 * secas, `npx expo prebuild` se cae con "Cannot copy google-services.json"
 * mientras el archivo no esté, y nadie podría regenerar la carpeta `android/`.
 * Aquí se agrega la línea solo cuando el archivo está; si no, se avisa y todo
 * lo demás sigue igual (la app compila y funciona, simplemente no recibe push).
 *
 * De dónde sale el archivo, en este orden:
 *   1. `GOOGLE_SERVICES_JSON`: ruta que da EAS cuando el archivo se sube como
 *      variable de tipo "archivo" (`eas env:create --type file`).
 *   2. `./google-services.json` junto a este archivo (para compilar en la PC).
 *
 * ⚠️ OJO: como esta app TIENE carpeta `android/` versionada, EAS NO corre
 * prebuild y lo de aquí no llega solo al build de la tienda. Para el build
 * real el archivo lo copia `scripts/copiar-google-services.js` (gancho
 * `eas-build-post-install` de package.json) a `android/app/`, y el plugin de
 * Gradle se aplica solo si lo encuentra (ver `android/app/build.gradle`).
 *
 * `version.js` sigue leyendo `app.json`: la versión vive ahí y solo ahí.
 */
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const candidato = process.env.GOOGLE_SERVICES_JSON || "./google-services.json";
  const existe = fs.existsSync(path.resolve(__dirname, candidato));

  if (!existe) {
    // Aviso y no error: sin Firebase la app sirve para todo menos el push.
    // Una sola vez por proceso: Expo lee esta configuración varias veces.
    if (globalThis.__morcastAvisoFirebase) return config;
    globalThis.__morcastAvisoFirebase = true;
    console.warn(
      "[app.config] No está google-services.json: se compila SIN notificaciones push. " +
        "Ver README de App Android, sección «Notificaciones push»."
    );
    return config;
  }

  return {
    ...config,
    android: { ...config.android, googleServicesFile: candidato },
  };
};
