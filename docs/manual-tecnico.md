# Manual técnico
## Morcast del Norte — cómo está armado y cómo se opera

Corte: 14 de agosto de 2026

Este documento es para quien mantiene el sistema, no para el cliente. Da por hecho
que sabes usar una terminal. Está escrito para que alguien que llega nuevo —o tú
mismo dentro de seis meses— pueda operar esto sin adivinar.

---

## 1. Las piezas y dónde viven

| Pieza | Qué es | Dónde |
|---|---|---|
| Sitio y paneles | Next.js 16 (App Router) + Bootstrap 5 | `Web/` |
| App de Android | Expo / React Native, proyecto nativo | `App Android/` |
| App de iPhone | Expo / React Native, se prueba con Expo Go | `App IOS/` |
| Base de datos, cuentas y archivos | Supabase (PostgreSQL) | nube, región `ca-central-1` |
| Correos | Resend, dominio `morcast.mx` verificado | nube |
| Alojamiento del sitio | **Vercel**, proyecto `morcast` (equipo del socio) | nube |
| Dominio y DNS | GoDaddy (`ns29`/`ns30.domaincontrol.com`) | `morcast.mx` |
| Servidor viejo | Droplet de DigitalOcean, **apagado desde el 20-ago-2026** | `161.35.0.140` |

**Repositorio:** `github.com/Nova-studia/MORCAST`, rama `main`. Es del socio y es
**PÚBLICO** desde el 20-ago-2026.

> ⚠️ **Público quiere decir público.** Cualquiera lee este repositorio, y este manual
> está dentro. Antes de escribir aquí una llave, una contraseña o una IP nueva,
> piénsalo dos veces. Las contraseñas de las cuentas de demostración (`cliente@demo.com`
> y `chofer@demo.com`) están publicadas en el README por decisión de Luis y su socio,
> avisados de que funcionan contra el sistema real.

> 📌 **Cambió el 19-ago-2026.** El repo anterior, `jsamuelglz00/morcast`, queda
> **congelado** con la historia completa hasta el commit `fae6cbd`: el nuevo empieza
> con todo aplastado en un solo commit, así que el registro de quién hizo qué solo
> vive en el viejo. No se borra por eso.

> ⚠️ Luis tiene **dos cuentas de GitHub**: `Flixnetapp` (para FlixNet) y
> `jsamuelglz00` (dueño de este repo). Si al hacer `push` sale *"Repository not
> found"*, no es que el repo desapareció: es que está activa la cuenta equivocada.
> El repo local ya trae un `credential.helper` propio que siempre pide el token de
> `jsamuelglz00`, así que no debería volver a pasar.

### En Vercel

El proyecto apunta a la carpeta **`Web`** del repositorio (*Root Directory*), no a la
raíz: el repo trae también las dos apps, `docs/` y `respaldo/`. Vercel compila con
`next build` y el certificado HTTPS lo emite y renueva él solo.

Las llaves viven en **Project → Settings → Environment Variables**. Son las mismas
seis que en `Web/.env.local`, marcadas para `Production` y `Preview`.

> 🚨 **Las vistas previas escriben en la base de VERDAD.** Solo hay un proyecto de
> Supabase, así que el despliegue de cualquier rama toca los datos reales de los
> clientes. Se mira, no se ensucia; y lo que se cree probando, se borra.

### El DNS

`morcast.mx` está en GoDaddy y su registro `A` apunta a Vercel.

> 🚨 **Nunca pasar los nameservers a Vercel.** Esa zona de DNS trae mucho más que el
> sitio: el `MX` del correo de la empresa (`contacto@morcast.mx`), su SPF, el DMARC y
> **los registros de Resend** (`resend._domainkey` y el subdominio `send.morcast.mx`).
> Si se mueven los nameservers, se cae el correo de Morcast **y** el del sistema. Para
> cambiar de alojamiento se toca el registro `A` y nada más.

### El servidor viejo

Sigue existiendo, apagado, como red de seguridad por si hubiera que volver atrás. Ya
**no sirve el sitio** y su `deploy.sh` apunta al repositorio VIEJO: si alguien lo
enciende y lo corre, publica código de agosto. Para revivirlo habría que apuntar el
registro `A` de vuelta a `161.35.0.140`.

**Entrar (si hiciera falta):** `ssh -i ~/.ssh/morcast_deploy root@161.35.0.140`

---

## 2. Publicar cambios

### Lo normal: `git push`

Desde el 19-ago-2026 **empujar a `main` ES publicar**. Vercel compila y publica solo,
en menos de un minuto. No hay un segundo paso que sirva de freno.

```bash
git push origin main
```

> 🚨 **Por eso se compila y se prueba ANTES de empujar.** Antes, con el droplet, subir
> a GitHub y desplegar eran dos actos separados y quedaba un hueco para revisar. Ese
> hueco ya no existe: lo que se empuja lo ven los clientes en un minuto.

**Saber si se publicó, sin entrar a Vercel:**

```bash
gh api repos/Nova-studia/MORCAST/commits/<sha>/status
```

Devuelve el contexto `Vercel` con su estado y su descripción. Distingue dos cosas que
se arreglan muy distinto:

| Lo que dice | Qué pasó |
|---|---|
| `success · Deployment has completed` | Publicado |
| `pending · Vercel is deploying your app` | Compilando, espera |
| `failure · Deployment was blocked` | **No es el código.** Vercel rechazó el despliegue por permisos: la cuenta que empujó no está autorizada en el proyecto |
| `failure` con error de compilación | Ahí sí, es el código |

**Volver atrás:** en Vercel, *Deployments* → el último que sirvió → *Promote to
Production*. Es instantáneo y no requiere tocar el repositorio.

> Un despliegue que falla **no tumba el sitio**: Vercel sigue sirviendo la versión
> buena anterior. Ya pasó el 20-ago y morcast.mx no se movió.

### Cambios en la base de datos

Las migraciones están en `Web/db/`, numeradas (`001-esquema.sql`, `002-rls.sql`, …).
Se corren **en orden** y una sola vez.

Desde que existe la contraseña de Postgres en `Web/.env.db-password` se pueden
correr directo, sin pegarlas a mano:

```bash
cd Web
PGPASSWORD=$(cat .env.db-password) \
"/c/Program Files/PostgreSQL/17/bin/psql.exe" \
  -h aws-0-ca-central-1.pooler.supabase.com -p 5432 \
  -U postgres.mbdmulygpupahocpylze -d postgres \
  -v ON_ERROR_STOP=1 -f db/010-alta-de-clientes.sql
```

`ON_ERROR_STOP=1` importa: sin eso, psql sigue ejecutando después de un error y
deja la base a medias. Conviene añadir `--single-transaction`: o entra la migración
completa, o no entra nada.

**Las que hay hoy, y de qué va cada una:**

| Migración | Qué hace |
|---|---|
| `001`–`010` | Esquema, RLS, storage, altas, saldos |
| `011` | El chofer ve a quién visita y dónde |
| `012` | La evidencia no se borra: `for all` incluía DELETE |
| `013` | Fecha válida, hora de la visita y chofer por parada |
| `014` | Detalles: saldos fuera del chofer, rutas acotadas, folio sin carrera |
| `015` | La cobertura completa |
| `016` | `recolecciones.ubicacion` (jsonb): la lectura de GPS por foto |

**Saca un respaldo antes de cualquier migración que borre o cambie datos**
(`node respaldo/respaldar.mjs`). Las que solo agregan columnas o tablas son
seguras, pero cuesta 30 segundos y quita el susto.

> El SQL Editor del tablero de Supabase sigue funcionando y es igual de válido;
> psql solo evita el copiar y pegar.

**Si no hay psql instalado**, se puede correr desde Node con el cliente `pg`, que es
como se aplicó la `016`:

```bash
cd Web
npm install --no-save pg     # no se guarda en package.json: es sólo para migrar
# conexión directa: postgresql://postgres:<.env.db-password>@db.mbdmulygpupahocpylze.supabase.co:5432/postgres
# con ssl: { rejectUnauthorized: false }, y el SQL dentro de begin/commit
```

Envolverlo en `begin` / `commit` es lo mismo que `--single-transaction`: si algo
falla, se hace `rollback` y la base no queda a medias.

⚠️ **Y al agregar una columna, revisa las CONSULTAS que la van a leer.** Al meter
`ubicacion` en la `016`, las dos consultas que leen `recolecciones` seguían pidiendo
sólo las columnas viejas: el dato se habría guardado y **no se habría leído nunca**.
Un `select` de Supabase con columnas enumeradas no se entera de las nuevas.

---

## 3. Respaldos

```bash
node respaldo/respaldar.mjs            # saca el respaldo
node respaldo/probar-restauracion.mjs  # comprueba que se puede recuperar
```

Hay una **tarea programada de Windows** que corre el primero todos los días a las
20:00, y el segundo los lunes. Se llama *Morcast - Respaldo diario*.

Los respaldos van a `..\Respaldos Morcast\`, **dentro de la carpeta que Syncthing
replica**, así que cada uno queda en dos computadoras sin hacer nada. Se guardan los
14 últimos.

**La prueba de restauración no es opcional.** Un respaldo que nunca se restauró no es
un respaldo, es una suposición. El script levanta un PostgreSQL temporal aparte,
restaura ahí el volcado y **cuenta las filas contra el manifiesto**; solo aprueba si
además vuelven las cuentas de acceso, porque una base restaurada donde nadie puede
entrar no sirve de nada.

### Cosas que cuestan de redescubrir

- El acceso directo a la base (`db.<ref>.supabase.co`) **ya solo tiene IPv6**. Desde
  una red IPv4 no resuelve. Hay que entrar por el *session pooler*
  (`aws-0-ca-central-1.pooler.supabase.com`, puerto **5432**). El pooler de
  transacciones (6543) **no sirve** para `pg_dump`.
- Sin `--no-owner --no-privileges`, el volcado arrastra roles que solo existen dentro
  de Supabase y no se puede restaurar en ningún otro PostgreSQL.
- Al restaurar hay que **crear antes** los roles `anon`, `authenticated`,
  `service_role` y compañía. Si no, cada política de seguridad que diga
  `TO authenticated` falla.
- El respaldo de la base **no incluye las fotos**. Storage y base de datos son dos
  sistemas distintos; por eso el script hace las dos cosas.

---

## 4. Seguridad: cómo está pensada

**La regla de fondo: quién ve qué lo decide PostgreSQL, no la aplicación.** Cada tabla
tiene RLS (seguridad por fila) y las pantallas consultan con la sesión del usuario. Si
mañana alguien escribe una pantalla nueva y se le olvida filtrar, la base lo filtra
igual.

- El **rol se lee de `app_metadata`, nunca de `user_metadata`.** El segundo lo puede
  editar el propio usuario desde su navegador: si el rol saliera de ahí, cualquiera se
  nombraría administrador. `app_metadata` solo se escribe con la llave de servicio.
- Las funciones de RLS van como `SECURITY DEFINER` con `search_path` fijo. Sin eso,
  una política sobre `perfiles` tendría que leer `perfiles` para poder leer
  `perfiles`: recursión infinita.
- `getUser()` siempre, nunca `getSession()`. El segundo confía en la cookie tal cual;
  el primero va a comprobar que el token sea de verdad. Para decidir permisos solo
  sirve el primero.
- El guardia de rutas vive en `Web/proxy.js`. **Next 16 renombró `middleware.js` a
  `proxy.js`.** Con el nombre viejo el archivo **se ignora en silencio**: parecería
  protegido sin estarlo.
- Las cabeceras de seguridad están en `next.config.mjs`. La **CSP está en modo
  solo-reporte** a propósito: para encenderla de verdad, cambiar la llave
  `Content-Security-Policy-Report-Only` por `Content-Security-Policy`.

### 🚨 Lo que la prueba de punta a punta enseñó (21-ago-2026)

Se recorrió el circuito entero con las sesiones reales de los tres roles. Salieron
nueve fallos con severidad, y **ninguno lo caza el compilador**. El patrón se repite:

> **Una pantalla que dice "listo" sin haber hecho nada.** El botón "Activar cuenta de
> cliente" pintaba una palomita verde y no creaba usuario; el comprobante de pago
> mandaba solo el nombre del archivo y la cubeta quedaba vacía; y el sitio pasó un mes
> sin mandar un solo correo porque el error se tragaba en silencio.

De ahí salen dos reglas que conviene no olvidar:

1. **Ninguna pantalla dice "listo" sin comprobar el efecto real.** Si dice "cuenta
   activada", que haya usuario en la base. Si dice "comprobante enviado", que haya
   archivo en la cubeta.
2. **Al abrir un camino de permisos nuevo, revisar también `storage.objects`.** Al
   permitir paradas asignadas a un chofer fuera de su ruta, se actualizaron las
   políticas de las tablas y se olvidaron las de archivos: el chofer veía la parada y
   podía cerrarla, pero la foto no subía. Media función es peor que ninguna.

Y una de método: **`/browse` se muere seguido**. Dos veces se dio un paso por fallido
y en realidad se había ejecutado (de ahí salieron tres depósitos duplicados que, de
rebote, destaparon un bug real). **Antes de dar algo por fallido, mira la base.**

### 🚨 El error que más caro salió, y que se va a repetir

**Un UPDATE bloqueado por RLS no da error.** PostgreSQL no encuentra ninguna fila que
le toque a ese usuario, actualiza **cero**, y responde **200, todo bien**.

Pasó así: el chofer cerraba una recolección, las fotos y el peso sí se guardaban, y el
servicio se quedaba en "confirmada" **sin ningún error en pantalla**. Después
aparecieron dos casos más: aplicar un saldo y confirmar una recolección.

**Regla para toda escritura con RLS: contar las filas devueltas**, con `.select()`
después del update, y tratar el cero como fallo. No basta con revisar que no haya
error.

### La cobertura tiene una sola fuente

Las zonas viven en la tabla `rutas`, columna `zona` (arreglo de pares
`[lat, lng]`). Se dibujan en `/admin/rutas` y de ahí las leen las tres pantallas
que hablan de cobertura.

⚠️ **`RUTAS_SEED` en `lib/rutas-datos.js` NO es la fuente.** Son zonas escritas a
mano que quedan solo como respaldo para cuando no hay base configurada. Durante un
tiempo `/portal/alta` las usaba de verdad, y el resultado era que redibujar una
zona en el panel no cambiaba nada en la página pública: el formulario seguía
contestando con las viejas, y de ahí salía el `en_cobertura` que se guarda y se
manda por correo. Si alguna pantalla nueva necesita zonas, que las pida a la base.

La tabla `rutas` solo se le entrega a quien tiene sesión (`to authenticated`), y
`/portal/alta` es pública. Por eso las zonas del alta van por la acción de
servidor `zonasDeCobertura()`, que devuelve **solo** clave, nombre, tipo, días y
polígono — el chofer asignado y la unidad no salen al público.

**El punto del mapa llega como arreglo `[lat, lng]`, no como objeto.** Es lo que
entrega `MapaZonas` en su callback de clic. Tratarlo como `{lat, lng}` no truena:
guarda `undefined` en las dos coordenadas y el alta queda sin ubicación.

### Cosas que escribe el público

`/portal/alta` es pública: la usa quien todavía no tiene cuenta. Escribe en
`solicitudes_alta` a través de la acción de servidor `registrarAlta`
(`app/acciones-alta.js`), **con la llave de servicio**.

Esa tabla **no tiene política de INSERT** a propósito. Si se abriera al público
para que el navegador escribiera directo, cualquiera podría llenarla de basura
sin pasar por la pantalla. Lo mismo que la bitácora: si el dato importa, lo
escribe el servidor.

La acción **no confía en nada** de lo que manda el navegador: recorta cada campo
a su largo, valida el correo, y exige que las recolecciones al mes sean un entero
entre 1 y 200. Los dos correos (aviso interno y acuse) van dentro de `try`: si
Resend falla, el alta **ya quedó guardada** y no se pierde por un problema de
correo.

### La bitácora

`/admin/bitacora`. Se escribe **desde el servidor con la llave de servicio**, y el
actor sale de la sesión, nunca de lo que mande el navegador. La tabla **no tiene
política de INSERT** a propósito: una bitácora que el interesado puede escribir no
prueba nada.

Registra por ahora: aplicar y rechazar depósitos, confirmar y rechazar recolecciones.
Las acciones auditadas están en `Web/app/acciones-auditadas.js`.

> ⚠️ **No dejes escritas acciones de servidor que nadie llama.** Una acción de
> servidor es un endpoint accesible desde fuera, aunque ninguna pantalla la use.

---

## 5. Las apps

Las dos son el mismo código, con la misma capa de datos que la web. **La app no hace
nada que la página no haga.**

```bash
cd "App IOS"      # o "App Android"
npx expo start    # y se escanea con Expo Go
```

- **SDK 54.** Es hasta donde llega el Expo Go instalado; si se sube de versión, deja
  de abrir.
- Las llaves entran por `EXPO_PUBLIC_*` desde el archivo `.env` de cada app. Ese
  archivo **no va a git** (sí viaja por Syncthing).
- La sesión se guarda en `AsyncStorage`, no en cookies: en un teléfono no hay
  navegador que las administre.

### Diferencias reales entre iOS y Android

| Tema | Android | iOS |
|---|---|---|
| Teclado | `softwareKeyboardLayoutMode: "resize"` en `app.json` (solo Android) | `KeyboardAvoidingView` con `behavior="padding"`, y `automaticallyAdjustKeyboardInsets` en los ScrollView |
| Pantalla con encabezado | no aplica | hace falta `keyboardVerticalOffset={useHeaderHeight()}`, si no el campo queda tapado justo por lo que mide el encabezado |
| Scripts | `expo run:android` | **`expo start`** — es la de Expo Go; `run:ios` exige Mac con Xcode |

### Trampas de React Native que ya nos costaron

- **`expo export` NO detecta variables ni componentes inexistentes**, solo errores de
  sintaxis. Un `View` sin importar compila y deja la pantalla en blanco al abrir. Hay
  que revisarlo aparte.
- **No anidar dos `<Modal>`.** Android deja una capa invisible que se traga todos los
  toques. Para un visor encima de otro, usa una `View` absoluta dentro del mismo
  Modal.
- **Para subir una foto**, `fetch(uri).arrayBuffer()` o el objeto del ImagePicker
  suben **0 bytes sin dar error**. Lo correcto es `File(uri).bytes()` de
  `expo-file-system`.
- Si `expo-doctor` se queja del peer `expo-font`, es el mismo caso de siempre:
  `npx expo install expo-font`.

### Publicar en las tiendas

Todo el material está en **`docs/tiendas/`**, y la guía de arriba a abajo es
`docs/tiendas/SUBIR-A-PLAY-paso-a-paso.md`.

**Android.** El `.aab` ya está compilado y revisado. Se genera con EAS Build:

```bash
cd "App Android"
eas build --platform android --profile production
```

El `.easignore` de la raíz es lo que hace viable la subida: sin él se mandan
1023 MB (`Web/`, `App IOS/` y los `node_modules`); con él, 11.8 MB.

⚠️ **Revisa siempre los permisos del `.aab` antes de subirlo.** Las librerías
meten permisos por su cuenta a través de sus propios manifiestos. La primera
compilación declaraba `RECORD_AUDIO` y `SYSTEM_ALERT_WINDOW`, que **contradecían
el aviso de privacidad publicado**. Se quitan con `tools:node="remove"` en
`android/app/src/main/AndroidManifest.xml` — borrar la línea no basta, porque el
manifiesto de la librería la vuelve a meter al fusionar.

Para verificar qué declara de verdad el archivo que vas a subir:

```bash
unzip -p MORCAST-v1.0.0-vc3.aab base/manifest/AndroidManifest.xml | strings | grep permission
```

Hoy debe salir solo: `CAMERA`, `READ/WRITE_EXTERNAL_STORAGE`, `INTERNET`,
`ACCESS_NETWORK_STATE`, `VIBRATE`, más `BIND_JOB_SERVICE` y `DUMP` (internos de
Expo, el sistema no se los concede a una app de tienda).

**Capturas.** Google rechaza proporciones mayores a 2:1. Las de un teléfono
normal salen a 1080 × 2408, que es 248 px de más. Recortar corta la interfaz;
lo que funciona es **rellenar** hasta 1204 × 2408 con el color de fondo de la
propia app.

**iPhone.** Sin empezar. Necesita cuenta de Apple Developer (99 USD al año) y
una Mac con Xcode para compilar.

---

## 6. Qué revisar cuando algo falla

| Síntoma | Dónde mirar |
|---|---|
| El sitio no carga | Vercel → *Deployments* → el ultimo → *Runtime Logs* |
| Va lentísimo | Vercel → *Observability*. Ya no hay servidor propio que se quede sin memoria |
| Guardó y no guardó | Casi siempre es RLS bloqueando en silencio (ver arriba) |
| No deja entrar | Las variables en Vercel, y que la cuenta esté activa en `perfiles` |
| Empujé y no se ve el cambio | `gh api repos/Nova-studia/MORCAST/commits/<sha>/status`: distingue "no compiló" de "no lo dejaron correr" |
| No llega ningún correo | Resend → *Emails*. Si está vacío, falta `RESEND_API_KEY` en Vercel: el código no manda nada sin ella y **no truena** |
| Errores raros al hacer clic tras un deploy | Pestañas abiertas con la versión anterior. Se curan recargando |

> ⚠️ **`Failed to find Server Action …` en los logs es normal después de cada
> despliegue.** Son navegadores con la página vieja abierta. Compara la fecha del log
> con la hora del despliegue antes de asustarte.

---

## 7. Lo que falta

1. **Ambiente de pruebas.** Hoy los cambios se estrenan directo en el sitio del
   cliente. Hace falta **antes** de darle acceso a Morcast.

1b. **El ciclo de cobranza mensual.** Está detenido, y no por código: **no existe un
   precio por cliente en la base.** `suscripciones` guarda frecuencia y equipo pero
   ningún campo de precio, y el catálogo de `lib/portal-datos.js` está escrito a mano
   con su propia nota de "sustituir cuando la empresa entregue su lista". Sin eso no
   se puede hacer que cada recolección completada sume al monto a pagar, que es la
   base de todo lo demás (avisos antes del corte, estado de cobranza, ingresos del
   mes). Falta también confirmar con Morcast la regla del corte.
2. **Encender la CSP de verdad** (hoy está en modo solo-reporte).
3. **Cambio de rol desde `/admin/usuarios`**: la pantalla sigue en modo demostración.
   Usa nombres como "Administrador" mientras la base usa `dueno/admin/operador`.
4. **Datos que faltan de Morcast**: lista de precios real, RFC y constancia fiscal,
   datos bancarios, y sobre todo **por dónde pasan de verdad las rutas** — las tres
   del mapa están dibujadas aproximadas.
5. **Subir la app a Google Play.** Todo el material está listo en `docs/tiendas/`
   y el `.aab` compilado y revisado. **Está detenido esperando que Google apruebe
   la cuenta de desarrollador de la empresa** (Morcast está mandando su papelería).

   Al retomarlo, lo primero es ver si la cuenta quedó como **Organización** o
   como **Personal**: una cuenta personal obliga a 12 probadores durante 14 días
   de prueba cerrada antes de dejar publicar, y eso cambia el plan por completo.

6. **La app de iPhone.** El código está listo y conectado, pero **nunca se ha
   probado en un iPhone de verdad** ni se ha compilado para iOS. Hace falta
   cuenta de Apple Developer y una Mac.

7. **Cosa cosmética:** en el panel, "Solicitudes recientes" muestra el UUID
   crudo en lugar del folio.
