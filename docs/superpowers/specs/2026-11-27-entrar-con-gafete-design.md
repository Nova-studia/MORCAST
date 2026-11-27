# Entrar a la app acercando el gafete (NFC) — diseño

27-nov-2026 · Pedido por Morcast, decidido con Andrei.

## Para qué

Morcast quiere que el gafete "interactúe con la app". Andrei lo aterrizó así:
en la pantalla de inicio de sesión la **primera opción** es *"Inicia sesión
acercando tu gafete"*; acercas el chip y **entras directo**. Debajo queda el
correo y contraseña (y Google/Apple) como hoy. Es comodidad para el personal:
entrar sin escribir la contraseña.

## Metas

- Personal de Morcast (dueño, administradores, choferes) entra a la app de
  Android y a la de iPhone acercando su gafete, **sin huella ni Face ID**.
- **El gafete solo abre sesión en el teléfono donde se vinculó.** Un QR
  fotografiado o un chip copiado no entran desde otro celular.
- **El administrador puede desvincular** teléfonos (robo, teléfono nuevo).
- Sirven **los chips que ya están grabados y sellados** (NTAG213 con
  `https://morcast.mx/g/<código>`): no se tiran ni se reprograman.

## No-metas

- Clientes: no entran con gafete (no tienen).
- No cambia la web (morcast.mx): ahí se sigue entrando con correo.
- No es checador de asistencia (se descartó en esta conversación).
- No se piden huella ni Face ID (decisión de Andrei).

## Anti-metas (sería un fracaso aunque "funcione")

- Que se pueda entrar con **solo el código del QR** (va impreso atrás del
  gafete y en el chip; cualquiera lo lee).
- Que el gafete de un empleado dado de baja, o una tarjeta repuesta, siga
  abriendo sesión.
- Que entrar con gafete se salte en silencio algo que hoy protege el panel
  sin que quede escrito aquí (ver "Segundo paso del admin").
- Que la app publicada se rompa para quien no usa gafete (el login con correo
  queda idéntico).

## Lo que ya existe (y en qué se apoya)

- `gafetes` (db/032): uno por tarjeta, `codigo` de 10 caracteres, `estado`
  vigente/repuesto/anulado. **No guarda la serie del chip**: la de los 4
  gafetes de hoy no se conoce (se grabaron con NFC Tools, botón «Ya lo grabé
  con otra app»; `chipGrabado` solo manda la serie a la bitácora).
- `empleados.perfil_id` **existe pero el panel no lo llena**: hoy no hay forma
  de decir "este empleado es esta cuenta".
- Sesiones creadas desde el servidor: `api/app/puente-web` ya usa
  `auth.admin.generateLink({type:"magiclink"})` → `hashed_token` → el otro
  lado hace `verifyOtp({token_hash, type:"magiclink"})`. Mismo mecanismo aquí.
- Apps: dos proyectos Expo separados (`App Android` SDK 54, `App IOS` SDK 57),
  ya con `expo-secure-store` (`almacen-seguro.js`) y `expo-dev-client`.
  Login en `src/sesion.js` (`entrar(modo, correo, password)`), modos
  `cliente` / `admin` / `chofer`. El admin además pasa un **segundo paso**
  (código por correo → pase firmado guardado en SecureStore, `segundo-paso.js`).

## Enfoques considerados

1. **Gafete + huella/Face ID**, con los chips actuales. Seguro y sencillo;
   Andrei lo descartó: quiere entrar con solo acercar el gafete.
2. **Solo el gafete, con chips nuevos NTAG 424 DNA** (código distinto en cada
   lectura, no copiables). Sin atarse al teléfono, pero hay que comprar y
   grabar chips nuevos con programa propio, y un gafete perdido entra desde
   cualquier teléfono. Descartado.
3. **✅ Elegido: gafete + teléfono vinculado**, con los chips actuales. El
   teléfono guarda un secreto propio (SecureStore) que se crea al vincular;
   el servidor exige gafete vigente + serie del chip + ese secreto. Los dos
   factores son "algo que traes": la tarjeta y tu teléfono (que ya tiene su
   propio candado de pantalla).

## Cómo funciona (lo decidido)

### Pantalla de inicio (modos admin y chofer)

```
        [logo Morcast]
        ((  gafete  ))
  Inicia sesión acercando tu gafete
     [ Acercar gafete ]        ← iPhone: hay que tocarlo (abre "Listo para escanear")
                                 Android: con la pantalla abierta basta acercarlo
  ──── o entra con tu correo ────
  Correo · Contraseña · [Entrar]
  Continuar con Google
  ¿Olvidaste tu contraseña?
```

- Si el teléfono **no tiene NFC** (o lo tiene apagado en Android), la opción
  del gafete no sale (o sale "Enciende el NFC") y queda el login de siempre.
- Al entrar con gafete, la app manda a la persona al modo de **su rol** (como
  ya hace `destinoDeUsuario`), sin importar en qué pantalla de login estaba.

### Vincular (una vez por teléfono)

1. La persona entra con su correo como hoy (el admin, con su segundo paso).
2. La app le ofrece **"¿Vincular tu gafete a este teléfono?"** (y también
   desde Mi cuenta). Acerca el gafete.
3. El servidor comprueba: gafete vigente, empleado activo, y
   **`empleados.perfil_id` = la cuenta que tiene la sesión**. Si no, explica
   por qué ("Este gafete no está ligado a tu cuenta; pídele a un
   administrador que lo ligue").
4. Si el gafete **no tiene serie guardada**, se guarda la de esta lectura (así
   entran los 4 actuales). Si ya tiene, **tiene que coincidir**.
5. Se registra el teléfono: la app genera un secreto aleatorio, lo guarda en
   SecureStore y el servidor guarda **solo su hash**, con nombre del aparato
   ("iPhone de Oscar", modelo), fecha de alta y último uso.

### Entrar

La app lee del chip el **código** (del enlace) y la **serie**, y manda
código + serie + id del teléfono + secreto. El servidor revisa, en este orden
y contestando lo mismo hacia afuera si algo falla ("Este gafete no puede
entrar en este teléfono"):
gafete vigente · empleado activo · cuenta ligada y no bloqueada · serie igual
· teléfono vinculado a ese gafete, no desvinculado · secreto correcto.
Si todo cuadra: `generateLink` magiclink → devuelve el `token_hash` → la app
hace `verifyOtp` y queda con su sesión normal. Se anota en la bitácora.

- **Cerrar sesión no desvincula**: el secreto del teléfono se queda, para
  volver a entrar con el gafete. Desvincular es una acción aparte.
- **Freno de intentos (decisión de Claude):** el código del gafete es público
  (QR), así que **nunca se bloquea un gafete** por fallos: eso dejaría que
  cualquiera con la foto del QR le impida entrar a su dueño.
- **Al 4.º intento fallido seguido en un teléfono (decisión de Andrei):** ese
  teléfono ya no deja entrar con gafete y pide **iniciar sesión con correo**
  (login normal). Se cuenta en el servidor por teléfono (+ IP); entrar con
  correo en ese teléfono reinicia la cuenta y vuelve a habilitar el gafete.
  Por gafete solo hay un retraso creciente, sin bloqueo.

### Desvincular

- **Panel web, Personal → ficha del empleado**: sección *"Teléfonos
  vinculados"* con aparato, fecha y último uso, y botón **Desvincular** (con
  confirmación). Lo puede hacer quien tiene la sección Personal.
- **La propia persona**, en Mi cuenta de la app: "Desvincular este teléfono".
- **Automático**: al dar de baja al empleado, reponer o anular el gafete, sus
  teléfonos dejan de valer (el gafete nuevo se vincula de nuevo).

### Ligar empleado ↔ cuenta (nuevo en el panel)

En la ficha del empleado, campo **"Cuenta en la app"**: elegir una cuenta del
personal (dueño/admin/operador) o ninguna. Llena `empleados.perfil_id`. Sin
esto, ese gafete no se puede vincular.

## Decisiones de Andrei tras la revisión (27-nov)

- **El admin también entra directo** con gafete + teléfono vinculado (sin
  código por correo). Andrei aceptó el riesgo de teléfono y gafete robados
  juntos: el teléfono tiene su candado y el admin lo desvincula desde el panel.
- **Si el iPhone no puede leer la serie del chip:** en iPhone se entra con
  gafete **sin comprobar la serie** (sigue atado al teléfono vinculado; una
  foto del QR no entra desde otro celular). En Android se comprueba siempre.
  Se decide con la prueba del gafete real en el iPhone de Andrei, primer paso
  del plan.

## Decisiones que tomó Claude (revisables)

- **Segundo paso del admin** (aprobado por Andrei, ver arriba): vincular exige el login completo (con el código
  por correo). Después, **entrar con gafete en el teléfono vinculado cuenta
  como segundo paso** y la app recibe su pase como si hubiera escrito el
  código. Motivo: si no, "entrar directo" no existiría para el admin (al
  cerrar sesión se borra el pase). El gafete + el teléfono ya son dos cosas
  que hay que tener a la mano.
  Ojo técnico: el pase de `segundo-paso/verificar` va atado al `session_id`
  del token, que solo existe después del `verifyOtp`. Hace falta una segunda
  llamada, ya con sesión, que vuelva a presentar la prueba del gafete
  (serie + secreto del teléfono) y emita el pase.
- **Varios gafetes en un mismo teléfono** se permiten (p. ej. un teléfono de
  unidad que comparten choferes): cada par gafete–teléfono se vincula aparte.
  Un gafete también puede tener varios teléfonos vinculados.
- La serie del chip se guarda en `gafetes` (columna nueva) la primera vez que
  se vincula, no se pide regrabar nada.
- Lo que se dice ante un fallo es el mismo texto para todo, salvo los casos
  que la persona puede arreglar (NFC apagado, gafete sin cuenta ligada al
  vincular).

## Restricciones

- **Versión nueva en las dos tiendas**: el NFC es código nativo
  (p. ej. `react-native-nfc-manager` con su plugin de Expo). No sale por
  `eas update`. Apple: la capacidad *NFC Tag Reading* en el identificador de
  la app y `NFCReaderUsageDescription`; la cuenta de revisión de Apple sigue
  entrando con correo.
- **Leer la serie en iPhone** requiere sesión de lectura de etiquetas (tag
  reader, MIFARE/NTAG), no solo NDEF. **Probarlo primero con un gafete real
  en el iPhone 16 Pro Max de Andrei** antes de construir lo demás.
- Base: tablas con RLS sin políticas, solo el servidor con la llave de
  servicio (mismo criterio que db/032). Migración nueva `db/033`.
- Repo público: ningún dato real de empleados, series ni secretos en el repo.
- Las dos apps tienen que quedar iguales (regla de paridad del proyecto).
- `git push` a `main` y la publicación en tiendas los autoriza Andrei.
- Antes de cualquier `eas update` o build: leer la nota de "apps al 100%"
  (el `.env` de las apps).

## Lo que queda al constructor

Nombres de tablas/columnas/rutas, forma exacta del límite de intentos, textos
finales (siguiendo `DESIGN.md`), cómo se arma el nombre del aparato, librería
NFC concreta y su configuración por SDK, y las pruebas.
