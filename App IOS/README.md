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
- Cliente: `cliente@demo.com` / `0011002`
- Chofer: botón **"Chofer"** → `chofer@demo.com` / `0011002`
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

## Estructura

- `App.js` — navegación (3 sesiones: cliente / admin / chofer) y tema
- `src/tema.js`, `src/datos.js`, `src/datos-admin.js`, `src/datos-chofer.js` — paleta y datos demo
- `src/pdf.js` — generación de PDF (expo-print + expo-sharing)
- `src/ui.js` — componentes reutilizables
- `src/pantallas/` — cliente · `src/pantallas/admin/` · `src/pantallas/chofer/`

> Los datos que se muestran son de demostración. La conexión a datos reales y las cuentas
> de la empresa se configuran aparte, fuera del repositorio.
