# Entregas 1 a 4: clientes, roles, operación urgente y portal — diseño

**Fecha:** 8-oct-2026 · **Pedido por:** Luis ("dale a la 1, 2, 3 y 4") · **Rama:** `entregas-1-4`
(sale de `app-1.1.1` = `main` + la auditoría). **Base:** `docs/auditoria-web-2026-10-08.md`.

Cada entrega se programa, se prueba y se sube **por separado**, en orden. Luis da el visto bueno
antes de cada push a `main`. Migraciones nuevas: `028` (clientes), `029` (roles), `030` (operación).
Las corre Luis o se corren con su OK, siempre **antes** del push que las usa.

Las apps (iOS y Android 1.1.1) están en revisión. Lo del modo administración de las apps se cubre
**del lado del servidor** en estas entregas. Lo visual de las apps (menús, pantallas) va después, por
EAS Update o en la 1.1.2.

---

## Entrega 1 — Clientes completo

**Lo que Luis quiere:** dar de baja o eliminar una cuenta (por ejemplo "Prueba real") y manejar
clientes sin SQL.

### Estados y qué hace cada uno (con efecto real)

| Estado | Para qué | Efecto |
|---|---|---|
| `pendiente-info` | Le falta un dato | Opera normal (como hoy) |
| `activo` | Normal | — |
| `suspendido` | Temporal (adeudo, pausa) | Sus usuarios **sí entran**, pero en **solo lectura**: ven todo, con un **aviso ROJO fijo hasta arriba de toda pantalla** (web y app): "Tu cuenta está suspendida. Contáctanos para restablecerla." con botones de WhatsApp y llamada (Luis, 8-oct). **Lo único que pueden hacer es Agregar saldo** (reportar un depósito), porque la causa típica es la falta de pago. **No pueden** agendar, cancelar, reagendar ni cambiar datos (también en la base). Sus servicios se **pausan**. Las paradas futuras **no** se tocan; la oficina decide. (Decisión de Luis, 8-oct.) |
| `baja` | Dejó de ser cliente | Sus usuarios **no entran** (ven "Tu cuenta fue dada de baja, comunícate con Morcast"). Además: servicios **cancelados**, solicitudes futuras **canceladas** (con aviso al chofer si ya estaban asignadas), contenedores **liberados**, tokens de notificaciones borrados. Sale de las listas de operación (rutas, agenda, puntos). Su historial **se conserva**. |
| Reactivar | Volver a `activo` | Le regresa el acceso. Sus servicios vuelven como **pausados** para que la oficina los revise. |

- Cada cambio pide **motivo** y guarda fecha y quién (columnas `estado_motivo`, `estado_fecha`,
  `estado_por`). Queda en la bitácora.
- **Quién:** el dueño y los admins con el permiso `clientes` (Entrega 2). Hasta que exista la
  Entrega 2, el dueño y los admins.

### Eliminar definitivamente

- **El dueño, y a quien el dueño le dé el permiso `eliminar_clientes`** (decisión de Luis, 8-oct),
  con el código por correo y escribiendo el nombre de la empresa para confirmar.
- **Se puede eliminar aunque tenga historial** (Luis, 8-oct: "aún estamos en prueba"). Antes de
  confirmar, la pantalla enseña **todo lo que se va a borrar** (N recolecciones, N movimientos por $X,
  N precios especiales, N puntos, N usuarios) y recomienda "Dar de baja" cuando hay historial, por la
  retención ambiental y fiscal.
- **Qué borra, en orden y desde el servidor:** sus recolecciones y solicitudes, sus movimientos de
  saldo, sus precios especiales, sus avisos, sus usuarios (Auth y perfiles), sus archivos (comprobantes y
  evidencias), sus puntos y servicios, y la empresa. Antes guarda una **foto** en la bitácora.
- **En la base (028):**
  - El `DELETE` de `clientes` queda **solo para el dueño**: se parte la política `clientes_personal`.
  - Las llaves de `movimientos_saldo`, `precios` y `solicitudes_recoleccion` pasan a **`restrict`**: la
    base ya no puede borrar dinero ni precios en cascada.
  - Por eso el borrado definitivo lo hace el servidor, en orden. El `restrict` NO impide borrar: impide
    que un borrado **accidental** (o por API) se lleve el dinero sin que nadie lo vea.

### Ficha del cliente (`/admin/clientes/[id]`)

- **Datos:** empresa, contacto, correo, teléfono, plan, días y límite de crédito, nota interna, RFC.
  Se pueden editar; si se completan, pasa de `pendiente-info` a `activo`.
- **Estado:** botones Suspender, Dar de baja, Reactivar y Eliminar (con las reglas de arriba).
- **Puntos:** lista de sus domicilios y servicios.
  - **Agregar punto** (dirección + pin en el mapa) y **quitar punto**.
  - Quitar con historial lo cancela; sin historial lo borra.
  - **Pausar, reanudar o cancelar** un servicio; asignar ruta, que ya existe.
- **Usuarios del cliente:**
  - quién tiene acceso (correo, último acceso);
  - **Quitar acceso** (lo desactiva y bloquea);
  - **Reenviar acceso** (enlace de contraseña nueva);
  - Dar acceso (ya existe).
- **Historial corto:** últimas recolecciones y movimientos, con enlace a cada pantalla.
- La lista de Clientes gana **búsqueda** (empresa, folio, contacto), filtro por estado, los
  errores visibles y "Cargando…" de verdad.

### En la base (028)

- `mi_cliente_activo()`: devuelve `true` si la empresa de la sesión está `activo` o `pendiente-info`.
- Las políticas con las que el cliente **escribe** (pedir y cambiar solicitudes, cambiar sus datos)
  exigen `mi_cliente_activo()`. **Reportar un depósito** (`movimientos_saldo` abono por verificar) se
  permite también `suspendido`.
- `usuarioActual()` (web) y `autenticarApp()` (apps) rechazan solo a un cliente **dado de baja**, con el
  motivo "Tu cuenta fue dada de baja. Comunícate con Morcast al 868 384 9478." Al suspendido lo dejan
  entrar y marcan la sesión `suspendido: true` para que las pantallas muestren el aviso y escondan los
  botones.
- `filaClienteNuevo` respeta `pendiente-info` cuando faltan datos, como dice su comentario.

---

## Entrega 2 — Roles personalizados y usuarios

**Lo que Luis quiere:** agregar roles nuevos y que el dueño decida a qué tiene acceso cada uno,
mientras llega el organigrama.

### Modelo

- **Tabla `roles`:** `id`, `nombre` (único), `descripcion`, `permisos text[]`, `creado`, `creado_por`.
- **`perfiles.rol_id`** apunta al rol personalizado del personal. `perfiles.rol` sigue siendo `dueno`,
  `admin` u `operador`, porque el login y las apps dependen de ese valor. Quien tiene un rol personalizado
  es `admin` con `rol_id`.
- **Permisos = secciones del panel:** `panel`, `rutas`, `recolecciones`, `incidentes`, `avisos`,
  `unidades`, `contenedores`, `zonas`, `solicitudes`, `altas`, `empleo`, `clientes`, `saldos`, `precios`,
  `servicios`, `reportes`, `usuarios`, `bitacora`.
  - `eliminar_clientes`: borrar un cliente definitivamente (Entrega 1).
  - `saldos` deja **registrar** depósitos; **aplicarlos** sigue siendo solo del dueño, como hoy.
- `tiene_permiso(p)`:
  - el dueño, siempre;
  - un admin si `p` está en los permisos de su rol o en `perfiles.permisos` (lo de `precios` sigue
    funcionando).
- **Roles iniciales (029):**
  - **"Administrador completo"**, con todo menos `usuarios`. Se asigna a los admins que ya existen,
    así nadie pierde nada.
  - **"Chofer"** no es un rol de esta tabla: el chofer sigue siendo `operador`.

### Dónde se aplica

1. **Páginas:** `proxy.js` relaciona cada ruta `/admin/<sección>` con su permiso. Sin el permiso,
   lleva al Panel con un aviso.
2. **Menú:** cada renglón lleva su `permiso`.
3. **Acciones de servidor:** un solo `exigirPermiso("<sección>")` (en `lib/permisos-servidor.js`)
   reemplaza los `PERSONAL = ["dueno","admin"]` repetidos.
4. **API de las apps:** `entrarAppAdmin(peticion, { permiso })` en cada ruta de administración.
5. **Base:**
   - las **escrituras** de cada tabla exigen `tiene_permiso('<sección>')`;
   - las **lecturas** se quedan en `es_personal()`, porque muchas pantallas cruzan datos (por ejemplo,
     Recolecciones lee clientes y rutas);
   - el riesgo que queda es que un admin vea por API datos de una sección que no tiene. Es menor que
     el de escribirlos y se documenta.

### Pantallas

- **Usuarios y roles → pestaña Roles** (solo el dueño): crear, editar o renombrar, y borrar un rol
  (si no lo usa nadie). Cada rol trae casillas por sección con su descripción.
- **Usuarios:**
  - **Editar** nombre, teléfono y rol (personalizado, admin u operador). Solo el dueño cambia roles.
  - **Ver correo** y **último acceso**.
  - **Reenviar invitación** y **Restablecer contraseña** (enlace por correo).
  - **Eliminar** (solo el dueño): borra el acceso y conserva su nombre en el historial (las llaves ya
    son `set null`).
  - Desactivar y reactivar, que ya existe.
- **Mi cuenta** (`/admin/cuenta`, `/chofer/cuenta`): nombre, teléfono y **cambiar contraseña** (pide la
  actual). El correo no se cambia aquí: lo cambia el dueño desde Usuarios.
- **"¿Olvidaste tu contraseña?"** en el login del panel y en el del chofer (`/portal/recuperar` ya
  sirve para cualquier rol).

---

## Entrega 3 — Arreglos urgentes de operación

1. **Elegir punto al agendar:**
   - En el portal, si el cliente tiene más de un punto, primero elige cuál; si tiene uno, como hoy.
   - La solicitud guarda ese `domicilio_id` y la ruta de **ese** servicio.
   - El folio lo da la base (secuencia `030`), no el navegador.
2. **Documentos sin "demostración":**
   - El **manifiesto** usa el residuo que declaró el cliente, el peso, el chofer real y la fecha y hora
     real. Quita la palabra "demostración" y deja **marcado "Pendiente"** donde falte el permiso o el
     destino final (dato de la empresa).
   - La **constancia fiscal** generada se **esconde** del portal hasta que se suba el PDF real del SAT.
3. **Recolecciones (panel):**
   - **búsqueda** por cliente o folio;
   - **rango de fechas** (por defecto, los últimos 30 días más lo futuro);
   - **paginación en el servidor**, sin el corte silencioso a 1,000.
4. **Crear una recolección desde la oficina:** cliente → punto → fecha → tipo y nota. Nace
   `confirmada` o `solicitada`, como elija la oficina, y queda en la bitácora.
5. **Chofer de la ruta:** el campo de texto pasa a ser una **lista de choferes** que llena
   `rutas.chofer_id`; el texto queda solo como nombre a mostrar.
6. **Chofer (web):**
   - **GPS:** `Permissions-Policy` permite la ubicación en el propio sitio.
   - **Hora real de cada foto**, guardada en el momento de tomarla.
   - **Sin evidencia duplicada:** `unique(solicitud_id)` en `recolecciones` (030) y cierre idempotente.
   - **Error con "Reintentar"** en lugar de "Sin paradas para hoy" cuando falla la red.
   - **"En camino"** solo dice que avisó cuando de verdad avisó (usa la acción con aviso).

---

## Entrega 4 — Portal del cliente

1. **Mi cuenta** (`/portal/cuenta`):
   - datos de contacto (nombre, teléfono y correo para avisos) y sus puntos (solo lectura);
   - **cambiar contraseña**;
   - **eliminar mi cuenta** con el mismo trámite que la app (`lib/eliminar-cuenta.mjs`);
   - el avatar del menú lleva a esta pantalla;
   - cambiar la razón social o el RFC se **pide** a Morcast con un botón de WhatsApp o correo, no se
     edita directo.
2. **Cancelar y reagendar:**
   - el cliente **cancela** una solicitud `solicitada` o `confirmada` mientras el chofer no esté
     `en-ruta`, y **reagenda** (cambia la fecha) mientras siga `solicitada`;
   - la oficina recibe un aviso; queda en la bitácora.
3. **Soporte:** una tarjeta fija en el portal (WhatsApp, teléfono y correo de Morcast), y en las
   solicitudes vencidas un botón "Contáctanos".
4. **Errores en vez de pantallas vacías:** si falla la red o la base, se dice y se ofrece "Reintentar",
   en Inicio, Agendar, Historial y Documentos.
5. **Detalles:**
   - el login respeta `?volver=`;
   - los filtros vacíos del historial se quitan;
   - no hay zoom de iPhone en los campos (letra de 16 px);
   - se quita "Fase 2";
   - el texto del login no promete saldo en tiempo real mientras haya Hold.

---

## Pruebas (todas las entregas)

- **`test:db`** con una sección por migración:
  - el admin sin permiso no escribe;
  - el dueño sí borra;
  - las FK `restrict`;
  - un cliente suspendido no pide recolecciones;
  - `tiene_permiso` con roles;
  - `unique(solicitud_id)`.
- **`npm test`:** lógica pura de cada regla (qué estado permite qué, mapa ruta→permiso, reglas de
  cancelar y reagendar, armado del manifiesto, elegir punto).
- **Revisión visual** en local de cada pantalla nueva (escritorio y teléfono) y una revisión
  independiente de cada entrega antes de pedir el push.

## Fuera de estas entregas

- Las pantallas de las apps para todo esto (después, por EAS Update o en la 1.1.2).
- El código por correo dentro de la base, el monitoreo de errores y la seguridad de la Entrega 5.
- Facturación CFDI.
- Lo que depende de la información de la empresa.
