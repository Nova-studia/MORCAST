# Morcast — App Android (proyecto nativo)

Versión **Android** de la app Morcast del Norte. Es el **mismo código** que `App IOS` (Expo /
React Native, SDK 54), pero con el **proyecto nativo de Android ya generado** en la carpeta
`android/` (vía `expo prebuild`). Aquí **no se incluye el APK**: se puede abrir en Android Studio o
compilar cuando se quiera.

Incluye **Portal de Clientes**, **Panel de Administración** y **modo Chofer** (escáner QR + foto
antes/después). `applicationId` = `mx.morcast.app`. Permisos: **cámara**, **notificaciones** y **ubicación**
(solo mientras se usa la app, para el modo chofer). `android:allowBackup="false"`: la sesión no
viaja en los respaldos de Google.

## Correr en desarrollo (Expo Go)

```bash
npm install
npx expo start
```

Escanea el QR con **Expo Go**. Accesos demo:
- Cliente: `cliente@demo.com` (contraseña aparte)
- Chofer: botón "Chofer" → `chofer@demo.com` (contraseña aparte)
- Admin: botón "Administración" → `morcastmx@gmail.com`, contraseña **aparte**
  (no se documenta; ver `ACCESO-DUENO.txt`, que no va a git)

Necesita el archivo `.env` con las llaves de Supabase. Sin él la app no entra
a ningún lado.

## Generar el APK

**Opción A — local (requiere Android Studio / SDK + JDK 17):**
```bash
npm install
cd android
./gradlew assembleRelease      # APK en android/app/build/outputs/apk/release/
# o ./gradlew assembleDebug    # APK de depuración
```

**Opción B — nube con EAS (no requiere instalar nada):**
```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview     # perfil "preview" = APK (ver eas.json)
```

## Pruebas

```bash
npm test        # node --test sobre tests/*.test.mjs (lógica pura, sin teléfono)
```

`tests/espejos-web.test.mjs` compara las copias de la app con `Web/lib/` (aviso de precios,
tipos de residuo, motivos de "No procedió", tipos de incidente, enlaces de Google Maps): si
alguien cambia el texto en la web, esa prueba truena y avisa que falta copiarlo aquí.

## Subir la versión

La versión vive en `app.json` (`expo.version` y `android.versionCode`) **y** en
`android/app/build.gradle` (`versionName` / `versionCode`): esta app tiene carpeta `android/`
versionada, así que EAS **no** corre prebuild y lo que manda es el `build.gradle`. Se cambian
los dos (o se corre `npx expo prebuild --platform android --no-install`, que los alinea).
Ojo: `eas.json` tiene `appVersionSource: "remote"` con `autoIncrement`, así que en un build de
EAS el versionCode lo pone EAS (el 1.0.0 de Play fue el 4; el siguiente debe ser 5 o mayor).

## Notificaciones push (Firebase) — paso pendiente de Luis

Android entrega las notificaciones por **Firebase Cloud Messaging**. La app ya está lista
(canal "Avisos de Morcast", explicación antes del permiso, registro del token con
`registrar_push_token`, baja con `borrar_push_token` al salir, y abrir Inicio o el Panel al
tocar). Lo que falta es el archivo de Firebase. **Sin él la app compila y funciona igual;
simplemente no recibe push** (el registro del token falla en silencio).

1. En <https://console.firebase.google.com> crear (o abrir) el proyecto de Morcast y agregar
   una app **Android** con el paquete `mx.morcast.app`. Descargar `google-services.json`.
2. **No subirlo a git** (el repo es público; ya está en `.gitignore`). Guardarlo en
   `App Android/google-services.json` para compilar en la PC.
3. Para EAS, subirlo como variable de tipo archivo:
   `eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production`
   (y `preview` si se usa). El gancho `eas-build-post-install` (`scripts/copiar-google-services.js`)
   lo copia a `android/app/` antes de Gradle; `android/app/build.gradle` aplica el plugin de
   Google **solo si** el archivo está.
4. Para que Expo pueda mandar a Android: en la consola de Firebase → Configuración del proyecto →
   Cuentas de servicio → generar una llave privada (JSON) y subirla en
   `eas credentials -p android` → "Google Service Account Key for Push Notifications (FCM V1)".
5. Probar: entrar como cliente en un Android real, aceptar "Sí, avísenme" y mandar un aviso
   desde `/admin/avisos`.

El token que se registra es el de Expo (`ExponentPushToken[…]`); el servidor manda por el
servicio de Expo con `channelId: "avisos"` y `data: { tipo: "aviso" | "incidente", id }`.

## Entrar con Google (1.1)

En el login de clientes, debajo del correo y la contraseña: "o", **Continuar con Google**.
Igual que la web: el token se canjea con `supabase.auth.signInWithIdToken`, así que la pantalla
de Google dice Morcast. A dónde va cada quien lo decide `modoDeRol` (espejo de `casaDe()` de la
web): cliente → portal, dueño/admin → panel (con su código por correo), operador → chofer, y
**sin rol → sala de espera** (`src/pantallas/AltaPendiente.js`), que manda a completar el alta en
morcast.mx con la misma cuenta y tiene "Ya me activaron — revisar".

Archivos: `src/entrada-social.js` (lógica pura, con pruebas), `src/entrar-social.js` (Google y sala de
espera), `src/entrar-apple.js` (de mentiras: en Android no hay Apple), `src/BotonesSociales.js`, `src/OlvideClave.js`
("¿Olvidaste tu contraseña? / Crear mi contraseña", abre morcast.mx/portal/recuperar).

**Lo que hay que poner (si falta, el botón de Google simplemente NO sale; nunca truena):**

- En `.env` (no se versiona) **y** en EAS (`eas env:create`, entornos preview y production):
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — el ID **web** de Google Cloud (el de `Web/lib/google-datos.mjs`).
  - (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` no se usa en Android.)
- En Google Cloud: un cliente OAuth de tipo **Android** con paquete `mx.morcast.app` y la huella
  **SHA-1** de la llave con que se firma (la de subida y la de Play App Signing, de
  Play Console → Integridad de la app). Sin eso Google responde `DEVELOPER_ERROR`.
- **No se tocó `android/`**: la librería se enlaza sola (autolinking de Gradle) y entrar con
  Google **no** necesita `google-services.json` (el `webClientId` va en JavaScript). Por eso
  su plugin **no** va en `app.json`: sin opciones activaría el modo Firebase en un prebuild.
- En Supabase → Auth → Providers → **Google**: en "Client IDs" deben estar el ID web.
- Expo Go **no** trae el módulo de Google: ahí el botón no sale. Se prueba con una
  compilación propia.

## Estructura

- `android/` — proyecto nativo de Android (Gradle) generado con `expo prebuild`
- `App.js`, `src/` — código de la app (compartido con iOS)
- `eas.json` — perfiles de build (preview = APK)

> Nota: para el mismo proyecto en modo "managed" (solo Expo Go, sin carpeta nativa) ver `App IOS`.
> `npx expo prebuild --platform android --no-install` (SIN `--clean`) aplica los plugins de
> `app.json` sobre la carpeta existente y respeta lo hecho a mano (el Firebase condicional de
> `build.gradle`). Con `--clean` se borra `android/` entera: lo de `plugins/quitar-permisos.js`
> se vuelve a aplicar solo, pero el bloque condicional de Firebase hay que volver a ponerlo.
