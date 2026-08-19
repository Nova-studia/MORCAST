# Morcast — App Android (proyecto nativo)

Versión **Android** de la app Morcast del Norte. Es el **mismo código** que `App IOS` (Expo /
React Native, SDK 54), pero con el **proyecto nativo de Android ya generado** en la carpeta
`android/` (vía `expo prebuild`). Aquí **no se incluye el APK**: se puede abrir en Android Studio o
compilar cuando se quiera.

Incluye **Portal de Clientes**, **Panel de Administración** y **modo Chofer** (escáner QR + foto
antes/después). `applicationId` = `mx.morcast.app`. Permiso de **cámara** ya configurado en el
`AndroidManifest.xml`.

## Correr en desarrollo (Expo Go)

```bash
npm install
npx expo start
```

Escanea el QR con **Expo Go**. Accesos demo:
- Cliente: `cliente@demo.com` / `0011002`
- Chofer: botón "Chofer" → `chofer@demo.com` / `0011002`
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

## Estructura

- `android/` — proyecto nativo de Android (Gradle) generado con `expo prebuild`
- `App.js`, `src/` — código de la app (compartido con iOS)
- `eas.json` — perfiles de build (preview = APK)

> Nota: para el mismo proyecto en modo "managed" (solo Expo Go, sin carpeta nativa) ver `App IOS`.
> Si se regenera con `expo prebuild`, la carpeta `android/` se sobrescribe.
