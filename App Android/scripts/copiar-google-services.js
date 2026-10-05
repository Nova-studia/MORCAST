/**
 * Copia `google-services.json` (Firebase) a `android/app/`, donde lo busca
 * el plugin de Gradle.
 *
 * POR QUÉ: esta app tiene la carpeta `android/` versionada, así que EAS NO
 * corre `expo prebuild` y nadie copia el archivo por nosotros. Corre solo en
 * EAS como gancho `eas-build-post-install` (ver package.json), y a mano en la
 * PC con `npm run google-services`.
 *
 * De dónde lo toma, en este orden:
 *   1. `GOOGLE_SERVICES_JSON`: la ruta que pone EAS cuando el archivo se sube
 *      como variable de tipo archivo:
 *        eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production
 *   2. `./google-services.json` en la raíz de App Android.
 *
 * Si no hay archivo NO falla: avisa y sale con 0. La app compila igual, solo
 * que sin notificaciones push (ver `android/app/build.gradle`).
 */
const fs = require("fs");
const path = require("path");

const raiz = path.resolve(__dirname, "..");
const origen = process.env.GOOGLE_SERVICES_JSON
  ? path.resolve(raiz, process.env.GOOGLE_SERVICES_JSON)
  : path.join(raiz, "google-services.json");
const destino = path.join(raiz, "android", "app", "google-services.json");

if (!fs.existsSync(origen)) {
  console.warn(`[google-services] No hay ${origen}: el build sale SIN notificaciones push.`);
  process.exit(0);
}

// Un JSON roto haría fallar a Gradle con un error críptico a mitad del
// build; mejor decirlo aquí con todas sus letras.
try {
  const datos = JSON.parse(fs.readFileSync(origen, "utf8"));
  const paquetes = (datos.client || []).map((c) => c?.client_info?.android_client_info?.package_name);
  if (!paquetes.includes("mx.morcast.app")) {
    console.error("[google-services] El archivo no trae la app mx.morcast.app. ¿Es el del proyecto correcto?");
    process.exit(1);
  }
} catch (e) {
  console.error("[google-services] google-services.json no es un JSON válido:", e.message);
  process.exit(1);
}

fs.copyFileSync(origen, destino);
console.log(`[google-services] Copiado a ${path.relative(raiz, destino)}.`);
