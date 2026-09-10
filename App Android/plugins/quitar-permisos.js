/**
 * QUITA DEL MANIFIESTO LOS PERMISOS QUE LA APP NO USA.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO Y NO SE EDITA EL MANIFIESTO A MANO
 * ─────────────────────────────────────────────────────────────
 * El arreglo estaba escrito a mano dentro de
 * `android/app/src/main/AndroidManifest.xml`. Eso funciona hasta que alguien
 * corre `expo prebuild --clean`, que borra la carpeta `android/` entera y la
 * vuelve a generar desde `app.json`: el arreglo se pierde en silencio y los
 * permisos regresan sin que nadie se entere hasta que Google Play los anuncia
 * en la ficha. Como plugin, se vuelve a aplicar en CADA prebuild.
 *
 * QUÉ QUITA Y POR QUÉ
 * ───────────────────
 * · RECORD_AUDIO — lo declara `expo-camera` por si se graba video con sonido.
 *   Esta app nunca graba audio: la cámara sólo lee el QR del contenedor y toma
 *   fotos. Dejarlo haría que Play anunciara "micrófono" en la ficha y
 *   contradiría el aviso de morcast.mx/privacidad, que dice cámara y fotos.
 *
 * · SYSTEM_ALERT_WINDOW ("mostrar sobre otras apps") — es del menú de
 *   desarrollo de React Native. En producción no se usa, y es de las que
 *   Google revisa con lupa.
 *
 * CÓMO LO QUITA
 * ─────────────
 * `tools:node="remove"` no sólo lo borra de aquí: impide que vuelva a entrar
 * cuando Android fusiona los manifiestos de todas las librerías. Borrar la
 * línea sin más NO bastaría, porque expo-camera la reintroduce al fusionar.
 */

const { withAndroidManifest } = require("expo/config-plugins");

/** Permisos que se eliminan de la fusión final del manifiesto. */
const A_QUITAR = [
  "android.permission.RECORD_AUDIO",
  "android.permission.SYSTEM_ALERT_WINDOW",
];

module.exports = function quitarPermisos(config) {
  return withAndroidManifest(config, (config) => {
    const manifiesto = config.modResults.manifest;

    // El atributo `tools:` hay que declararlo en la etiqueta raíz o el
    // compilador no entiende `tools:node` y falla la compilación.
    manifiesto.$ = manifiesto.$ || {};
    manifiesto.$["xmlns:tools"] = "http://schemas.android.com/tools";

    manifiesto["uses-permission"] = manifiesto["uses-permission"] || [];

    for (const permiso of A_QUITAR) {
      // Si ya está declarado (lo metió otro plugin o el propio app.json), se
      // reescribe esa misma entrada; si no, se agrega una nueva.
      const existente = manifiesto["uses-permission"].find(
        (p) => p.$ && p.$["android:name"] === permiso
      );

      if (existente) {
        existente.$["tools:node"] = "remove";
      } else {
        manifiesto["uses-permission"].push({
          $: { "android:name": permiso, "tools:node": "remove" },
        });
      }
    }

    return config;
  });
};
