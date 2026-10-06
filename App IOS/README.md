# Morcast — App móvil (Fase 3)

App nativa de Morcast del Norte hecha con **Expo / React Native (SDK 54)**. Un solo código para
**Android e iPhone**. Incluye **Portal de Clientes**, **Panel de Administración** y **modo Chofer**.

## Cómo correrla (Expo Go)

```bash
npm install
npx expo start
```

Abre **Expo Go** en tu teléfono (misma Wi-Fi) y escanea el QR, o entra a `exp://<IP-de-tu-PC>:8081`.

**Accesos demo:**
- Cliente: `cliente@demo.com` (contraseña aparte)
- Chofer: botón **"Chofer"** → `chofer@demo.com` (contraseña aparte)
- Admin: botón **"Administración"** → `morcastmx@gmail.com`, contraseña **aparte**
  (no se documenta; ver `ACCESO-DUENO.txt`, que no va a git)

Necesita el archivo `.env` con las llaves de Supabase. Sin él la app no entra
a ningún lado.

## Generar el APK de Android (EAS Build, en la nube)

No hace falta instalar Android Studio. Con una cuenta de Expo (gratis):

```bash
npm install -g eas-cli      # si no lo tienes
eas login                   # inicia sesión con tu cuenta Expo
eas init                    # crea/enlaza el proyecto (una sola vez)
eas build -p android --profile preview
```

El perfil **preview** (ya configurado en `eas.json`) genera un **APK** instalable. Al terminar, EAS da
un enlace para descargar el `.apk`. Para iPhone: `eas build -p ios --profile preview` (requiere cuenta
Apple Developer). `android.package` / `ios.bundleIdentifier` = `mx.morcast.app`.

> Build local (alternativa): requiere JDK 17 + Android SDK. `npx expo prebuild -p android` y luego
> `cd android && ./gradlew assembleRelease`.

## Funciones

**Cliente:** Inicio (saldo/KPIs), Historial (manifiesto PDF), Agregar saldo (comprobante con cámara/galería),
Reportes (PDF), Documentos (PDF), Cotizador (PDF).
**Admin:** Panel, Solicitudes (activar cuenta de cliente), Saldos (verificar comprobante con visor),
Servicios (evidencia antes/después), Clientes, Reportes, Usuarios y roles.
**Chofer:** Ruta del día, **escanear QR del contenedor** (cámara), **foto antes/después** de la
recolección, ver sus servicios completados con las fotos.

## Entrar con Google y con Apple (1.1)

En el login de clientes, debajo del correo y la contraseña: "o", **Continuar con Google** y
**Continuar con Apple** (obligatorio en la App Store en cuanto hay Google, guía 4.8).
Igual que la web: el token se canjea con `supabase.auth.signInWithIdToken`, así que la pantalla
de Google dice Morcast. A dónde va cada quien lo decide `modoDeRol` (espejo de `casaDe()` de la
web): cliente → portal, dueño/admin → panel (con su código por correo), operador → chofer, y
**sin rol → sala de espera** (`src/pantallas/AltaPendiente.js`), que manda a completar el alta en
morcast.mx con la misma cuenta y tiene "Ya me activaron — revisar".

Archivos: `src/entrada-social.mjs` (lógica pura, con pruebas), `src/entrar-social.js` (Google y sala de
espera), `src/entrar-apple.js` (Apple), `src/BotonesSociales.js`, `src/OlvideClave.js`
("¿Olvidaste tu contraseña? / Crear mi contraseña", abre morcast.mx/portal/recuperar).

**Lo que hay que poner (si falta, el botón de Google simplemente NO sale; nunca truena):**

- En `.env` (no se versiona) **y** en EAS (`eas env:create`, entornos preview y production):
  - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — el ID **web** de Google Cloud (el de `Web/lib/google-datos.mjs`).
  - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — un cliente OAuth de tipo **iOS** con bundle `mx.morcast.app`.
- En `app.json`, plugin `@react-native-google-signin/google-signin`: cambiar
  `com.googleusercontent.apps.PENDIENTE-IOS` por el ID de iOS **invertido**
  (`com.googleusercontent.apps.<lo que va antes de .apps.googleusercontent.com>`). 🔴 Si no
  coincide, Google cierra la app al tocar el botón; por eso la app lo compara y, si no
  coincide, esconde el botón.
- Apple: `ios.usesAppleSignIn` ya está en `app.json`; en developer.apple.com el App ID
  `mx.morcast.app` debe tener "Sign in with Apple" (EAS lo activa al compilar). En Supabase →
  Auth → Providers → **Apple**: encenderlo y poner `mx.morcast.app` en Client IDs (y
  `host.exp.Exponent` para probar en Expo Go).
- En Supabase → Auth → Providers → **Google**: en "Client IDs" deben estar el ID web **y** el de iOS
  (separados por coma). Si el iPhone falla con un error de *nonce*, encender "Skip nonce check"
  (el SDK de Google para iOS mete un nonce propio que la versión gratuita no deja leer).
- Expo Go **no** trae el módulo de Google: ahí el botón no sale (Apple sí funciona). Se prueba con una
  compilación propia.

## Estructura

- `App.js` — navegación (3 sesiones: cliente / admin / chofer) y tema
- `src/tema.js`, `src/datos.js`, `src/datos-admin.js`, `src/datos-chofer.js` — paleta y datos demo
- `src/pdf.js` — generación de PDF (expo-print + expo-sharing)
- `src/ui.js` — componentes reutilizables
- `src/pantallas/` — cliente · `src/pantallas/admin/` · `src/pantallas/chofer/`

> Los datos que se muestran son de demostración. La conexión a datos reales y las cuentas
> de la empresa se configuran aparte, fuera del repositorio.
