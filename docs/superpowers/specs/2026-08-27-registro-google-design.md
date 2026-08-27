# Registro con Google y activación por la empresa — diseño

**Fecha:** 27 de agosto de 2026
**Proyecto:** Morcast del Norte (web)
**Estado:** diseño aprobado, pendiente de plan de implementación

---

## 1. Qué problema resuelve

Hoy **no existe forma de que alguien se registre solo** en morcast.mx. La única
puerta al portal de clientes es una cuenta que Morcast crea a mano desde el panel
(`activarCuentaCliente`, arreglada el 21-ago-2026 justo porque el botón anterior
pintaba "cuenta activada" sin crear nada).

Eso significa que un prospecto que llega a la página no puede dejar más rastro que
un formulario de cotización. No hay identidad, no hay cuenta, no hay nada que
Morcast pueda "activar" después: hay que teclearlo todo de cero.

Este trabajo abre el registro **sin abrir el acceso**. Cualquiera puede crear su
identidad con un clic usando Google; eso **no le da acceso a nada**. La empresa lo
contacta, decide, y al activarlo se le abre el portal.

## 2. El punto de partida es mejor de lo que parece

La puerta ya está cerrada por diseño, y conviene dejarlo escrito porque es lo que
hace que este trabajo sea barato:

- El portal deja entrar sólo si `app_metadata.rol === "cliente"`, y **`app_metadata`
  únicamente se puede escribir con la llave de servicio**, o sea desde el servidor de
  Morcast. Un usuario de Google llega sin ese sello.
- Todo lo que ve un cliente en la base filtra por `mi_cliente()`, que lee
  `perfiles.cliente_id`. En un registrado nuevo es nulo: **cero filas**, en tablas y
  en Storage.
- El disparador `perfil_sin_escalar()` (002-rls) ya impide que nadie se cambie su
  propio rol, su empresa ni su estado.

No estamos abriendo un hueco. Le estamos dando una pantalla decente a un estado que
ya existía y que hoy sólo produce un rebote sin explicación.

### El hallazgo que obliga a tocar el guardia

`proxy.js` tiene una suposición que **falla abierto**:

```js
const rol = user.app_metadata?.rol ?? "cliente";
```

Quien llega sin sello queda bautizado `cliente`, y el guardia **lo deja pasar a
`/portal`**. Adentro `PortalShell` sí lo rebota, porque ahí la comparación es
estricta, así que hoy el resultado sería un rebote al login con la sesión abierta.
No es explotable en este momento, pero es una puerta que se abre sola en cuanto
llegue alguien sin rol — que es justo lo que este trabajo empieza a producir.

**Se quita el `?? "cliente"`.**

## 3. Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Qué se le pide al registrarse | **Empresa y teléfono, en una pantalla corta** | Google sólo entrega nombre y correo. Sin teléfono, Morcast no puede contactarlo por WhatsApp, que es como trabaja. Es el menor roce que sigue sirviendo para activar. |
| Dónde se representa el estado | **Rol `pendiente` explícito en la base** | El estado tiene nombre, así que **falla cerrado**: una política futura escrita para "cliente" no lo alcanza. La alternativa (deducirlo de `cliente_id` nulo) deja la regla escrita en la cabeza, y este proyecto ya se quemó cuatro veces con reglas que vivían en un solo lado. |
| Dónde lo trabaja Morcast | **La bandeja `/admin/altas` que ya existe** | Una sola bandeja que revisar. El flujo de aprobar/rechazar/contactar ya está hecho y probado. Se distingue con una columna `origen`. |
| Dónde se guardan los datos capturados | **`solicitudes_alta`, con tres columnas nuevas** | Es la misma bandeja de "alguien quiere ser cliente". Una tabla aparte la duplicaría campo por campo. |
| Alcance de plataformas | **Sólo web** | Agregar OAuth a Expo (AuthSession, esquema de URL, dos registros más en Google Cloud) triplica el trabajo y no se puede probar en aparato desde esta laptop. |
| Cómo entra ese cliente a las apps | **Al activarlo, Morcast le pone contraseña** | Las apps entran sólo con correo y contraseña. Sin esto, un cliente activado se topa con una puerta cerrada en la app sin entender por qué, y esa llamada la contesta Morcast. |
| Registro por correo y contraseña | **No** | El acceso por contraseña se conserva para las cuentas que Morcast crea (y para el revisor de Google Play), pero no se abre al público: sería una segunda puerta que mantener y verificar. |
| La contraseña en el correo de activación | **No va** | Se enseña una sola vez en el panel para mandarla por WhatsApp, como Morcast ya trabaja. Una contraseña dentro de un correo se queda ahí para siempre. |
| Qué ve alguien a quien rechazan | **La pantalla no cambia; Morcast lo contacta** | Un "fuiste rechazado" automático, sin motivo y sin quién dé la cara, hace más daño que bien. |

## 4. Alcance

**Dentro:**
- Botón "Continuar con Google" en `/portal/login`
- Ruta de retorno de OAuth y decisión de a dónde mandar a cada quien
- Pantalla de captura mínima (empresa y teléfono)
- Pantalla de "cuenta registrada, en espera de activación" con los medios de contacto
- Estado `pendiente` en la base y disparador que deja de suponer
- Guardia del servidor sin la suposición que falla abierto
- Activación desde `/admin/altas`, con su acción de servidor propia
- Correos de registro y de activación

**Fuera, a propósito:**
- OAuth en las apps de iPhone y Android
- Registro público con correo y contraseña
- Otros proveedores de identidad (Facebook, Apple)
- Que el cliente edite sus propios datos fiscales — los captura Morcast, porque de
  ahí salen las facturas
- El ciclo de cobranza mensual, que sigue detenido esperando la lista de precios

## 5. Base de datos — migración `017`

Tres cambios, ninguno destructivo:

1. **`perfiles.rol` acepta `'pendiente'`.** Se reescribe el candado a
   `check (rol in ('dueno','admin','operador','cliente','pendiente'))` y se **quita el
   default `'cliente'`** de la columna.
2. **`nuevo_usuario()` deja de suponer.** Hoy hace
   `coalesce(new.raw_app_meta_data ->> 'rol', 'cliente')`; pasa a `'pendiente'`. Quien
   nace sin sello, nace pendiente.
3. **`solicitudes_alta` gana tres columnas:**
   - `origen text not null default 'formulario' check (origen in ('formulario','google'))`
   - `usuario_id uuid references auth.users(id) on delete set null`
   - `correo_verificado boolean not null default false`

**Lo que NO cambia:** `mi_rol()`, `mi_cliente()`, `es_personal()`, `es_dueno()` y
todas las políticas siguen igual. `pendiente` simplemente no cae en ninguna, y como
`mi_cliente()` es nulo, no ve una sola fila. Ese es el punto de elegir un estado
explícito.

**Quitar el default es seguro, y está verificado:** los tres `insert` que existen
sobre `perfiles` (001, 003 y `acciones-alta-cliente.js`) escriben `rol` a mano, y en
todo el código **el único sitio que crea usuarios** es `activarCuentaCliente`, que
siempre manda `app_metadata: { rol: "cliente" }`.

> **Nota de operación.** Los choferes y administradores se crean a mano desde el
> tablero de Supabase. A partir de la 017, uno creado ahí **sin `app_metadata.rol`
> queda como `pendiente`** y no entra a ningún lado. Antes quedaba como `cliente`,
> que estaba igual de mal pero fallaba abierto. Al crear personal hay que escribir
> el rol en `app_metadata` — nunca en `user_metadata`, que lo edita el propio
> usuario.

> **La migración se aplica ANTES de desplegar el código.** Si sale el código
> primero, el disparador viejo sigue sellando como `'cliente'` a todo el que se
> registre, y habría que repararlos a mano.

> Las cuentas que ya existen no se tocan: todas tienen su rol escrito. El cambio
> del default sólo afecta a los que nazcan de aquí en adelante.

## 6. Pantallas y flujo

```
/portal/login  ──"Continuar con Google"──>  Google  ──>  /auth/callback
                                                              │
                    ┌─────────────────────────────────────────┤
                    │                     │                   │
              tiene sello           sin sello,           sin sello,
             rol = cliente        sin solicitud        ya capturó
                    │                     │                   │
                /portal          /portal/registro      /portal/pendiente
```

- **`/portal/login`** — el botón de Google arriba, con una línea divisoria. **El
  formulario de correo y contraseña no se toca**: es el de los clientes que Morcast ya
  dio de alta y el del revisor de Google Play.
- **`/auth/callback`** *(nuevo, `route.js`)* — cambia el código de OAuth por sesión y
  aplica la decisión del diagrama. `/auth` ya está en la lista de rutas abiertas de
  `proxy.js`.
  **Trampa:** para saber si ya hay solicitud tiene que consultar `solicitudes_alta`
  **con la llave de servicio**. Esa tabla sólo se la entrega el RLS al personal
  (`solicitudes_alta_lee_personal`), así que con la sesión del recién registrado la
  consulta devuelve cero filas y lo mandaría a capturar sus datos otra vez, cada vez.
  Es un `route.js`, o sea servidor, así que puede hacerlo.
- **`/portal/registro`** *(nuevo)* — empresa y teléfono/WhatsApp. Nombre y correo
  vienen de Google, rellenos y en gris. Al enviar escribe la solicitud y manda a
  la pantalla de espera.
- **`/portal/pendiente`** *(nuevo)* — el aviso, con los dos teléfonos, el botón de
  WhatsApp y los correos **leídos de `EMPRESA` en `lib/datos.js`**, nunca escritos a
  mano: esos correos son temporales y se cambian por los buzones `@morcast.mx` cuando
  se los entreguen. Lleva "Cerrar sesión", para no dejar a nadie atrapado.
- **`proxy.js`** — sin el `?? "cliente"`. Sin rol o con `pendiente`, la casa es
  `/portal/pendiente`, y esa ruta entra a las abiertas.
- **`app/(portal)/layout.js`** — `/portal/registro` y `/portal/pendiente` se muestran
  **fuera del shell protegido**, como ya se hace con `/portal/login` y `/portal/alta`:
  el shell exige una sesión de cliente que estas dos pantallas justamente no tienen.

### Correo que ya pertenece a un cliente activado

Supabase **enlaza las dos identidades** cuando el correo viene verificado, y el de
Google siempre lo viene. Resultado: es la misma persona, conserva su `rol: cliente` y
**entra directo al portal**. Se acepta a propósito — es un cliente real usando otra
llave de la misma puerta.

## 7. La activación

Camino nuevo, porque el que existe no sirve: `activarCuentaCliente` **crea** el
usuario, y aquí el usuario ya existe y es de esa persona.

**`activarCuentaRegistrada({ solicitudId })`** en `app/acciones-alta-cliente.js`,
reusando su guardia `exigirPersonal()` (exige dueño o admin **leyéndolo de la
sesión**, no de lo que diga el navegador):

1. Lee la solicitud con la llave de servicio; saca `usuario_id`, empresa, teléfono,
   correo.
2. Crea la fila en `clientes`. **El folio lo asigna la base** (disparador de la 014,
   con `pg_advisory_xact_lock`): calcularlo aquí es una carrera.
3. Pone el sello:
   `auth.admin.updateUserById(uid, { app_metadata: { rol: "cliente", cliente_id } })`.
   Esto dispara solo `sincronizar_perfil()` (003), que acomoda `perfiles`. Se
   completan además nombre y teléfono, que ese disparador no toca.
4. **Le pone contraseña**, para que pueda entrar también por las apps. La genera la
   pantalla del panel y viaja como argumento de la acción, igual que hoy en
   `/admin/solicitudes`. La misma llamada del paso 3 la escribe, así que no hay un
   viaje extra ni un momento en que la cuenta quede a medias.
5. Marca la solicitud como `aprobada` y escribe en bitácora — **sin la contraseña**.

> **Deshacer NO es igual que en el alta normal.** Si algo truena a media faena,
> `activarCuentaCliente` **borra el usuario**. Aquí eso sería destruir la cuenta de
> Google de una persona real. El deshacer correcto es: borrar la empresa recién
> creada, devolver el perfil a `pendiente` y **vaciar el sello** de `app_metadata`.
> **El usuario nunca se toca.**

> **Un `update` que no encuentra fila no da error**: responde 200 y cambia cero.
> Se cuentan las filas devueltas en cada paso, como ya se hace en `cambiarEstadoAlta`.

### El token no se refresca solo

Poner el sello **no cambia el token que el cliente ya tiene en el navegador**. Quien
esté parado en `/portal/pendiente` seguiría viendo el aviso hasta que su token caduque
(alrededor de una hora). Por eso esa pantalla lleva un botón **"Ya me activaron —
revisar"** que llama a `refreshSession()`: Supabase reemite el token con el sello
nuevo y entra en el momento.

Sin esto, la entrega parece rota justo en el minuto en que la empresa activa a alguien
y se lo dice por teléfono.

### En el panel

En `/admin/altas`, las de origen `google` salen con su distintivo y su filtro, y el
botón dice **"Activar cuenta"** en vez de "Aprobar", porque hace algo distinto. La
contraseña generada se enseña **una sola vez**, para mandarla por WhatsApp.

## 8. Correos

`lib/correo.js` ya tiene `correoAvisoAlta` y `correoAcuseAlta`, y Resend ya está
probado en producción.

| Momento | Quién lo recibe | Qué dice |
|---|---|---|
| Se registra | Morcast | Llegó un registro nuevo, con empresa, contacto y teléfono |
| Se registra | Quien se registró | Lo recibimos; te avisamos al activarte |
| Se activa | El cliente | Ya puedes entrar; tu cuenta de Google sirve. **Sin contraseña adentro** |

Los avisos **no tumban la operación** si Resend falla, pero el fallo **se anota** con
`console.error`. Es la lección del mes que morcast.mx estuvo sin mandar correos sin
que nadie se enterara.

## 9. Cómo se prueba

**El proveedor de Google apagado no bloquea las pruebas.** Un registro de Google no es
más que *un usuario sin `rol` en `app_metadata`*, y eso se crea con la Admin API. Todo
el circuito —guardia, pantalla de espera, activación, refresco del token, RLS— se
prueba completo hoy. Lo único que queda sin probar hasta encender el proveedor es el
brinco a Google y de vuelta.

- **Lógica pura con `node` y datos fijos:** `decidirDestino(rol, tieneSolicitud)` vive
  en su propio archivo y se prueba sin navegador, como se hizo con los vencimientos el
  26-ago.
- **RLS:** hacerse pasar por el pendiente con
  `set_config('request.jwt.claims', …)` + `set local role authenticated` dentro de un
  `begin; … rollback;`, y comprobar **cero filas** en `clientes`,
  `solicitudes_recoleccion`, `movimientos_saldo` y `storage.objects`. Consultar como
  `postgres` no prueba nada: se salta todo el RLS.
- **Escalada:** que el pendiente no pueda ponerse `rol` ni `cliente_id` a sí mismo
  (lo bloquea `perfil_sin_escalar()`, pero se comprueba).
- **`npm run build`** limpio antes de subir.
- **Verificación en vivo** después de desplegar: `/portal/login` en 200,
  `/portal/pendiente` sin sesión rebota, y un usuario de prueba sin sello **no** entra
  a `/portal`.
- El usuario de prueba se borra al terminar, con la cuenta de filas antes y después,
  como en el QA del 21-ago.

## 10. Riesgos y dependencias

**Bloqueos que no dependen de mí:**

1. **Cliente OAuth en Google Cloud Console** y **proveedor Google activado en
   Supabase** — es el proyecto del socio.
2. **URL de retorno** registradas en Supabase: `https://morcast.mx/auth/callback`,
   `http://localhost:3000/auth/callback` y el comodín de las vistas previas de Vercel.

**Riesgos:**

| Riesgo | Cómo se atiende |
|---|---|
| Desplegar el código antes que la migración | La 017 se aplica primero, por `psql`, y se verifica el `check` antes de subir nada |
| Registros basura de cualquiera con cuenta de Google | Un registro no da acceso a nada y no cuesta nada guardarlo. Si algún día molesta, se limita por correo repetido o se pide un dato más |
| El cliente activado no puede entrar a la app | Por eso la activación le pone contraseña |
| Alguien queda atrapado en la pantalla de espera | Lleva "Cerrar sesión" y el botón de revisar |
| Cerrar permisos rompe pantallas de la APP | Aquí **no se cierra** ningún permiso existente: sólo se agrega un estado que no tiene ninguno. La app no lee `perfiles.rol` para decidir nada que hoy funcione |

**Nada de esto se despliega sin autorización de Luis.** En Vercel, `git push` a `main`
es el despliegue; el trabajo va en la rama `registro-google`.

## 11. Archivos

**Nuevos:** `Web/db/017-registro-abierto.sql` · `Web/app/auth/callback/route.js` ·
`Web/app/(portal)/portal/registro/page.js` · `Web/app/(portal)/portal/pendiente/page.js` ·
`Web/lib/destino-sesion.js` (la función pura) · `Web/tests/destino-sesion.test.mjs`

**Modificados:** `Web/proxy.js` · `Web/app/(portal)/layout.js` ·
`Web/app/(portal)/portal/login/page.js` · `Web/app/acciones-alta-cliente.js` ·
`Web/app/acciones-alta.js` · `Web/lib/datos-altas.js` · `Web/lib/correo.js` ·
`Web/app/(admin)/admin/altas/page.js`
