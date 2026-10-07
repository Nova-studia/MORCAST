# Precios reales: lista general, precio por cliente y permiso — diseño

**Fecha:** 7-oct-2026 · **Pedido por:** Luis · **Rama:** `precios` (sale de `origin/main` `129c4d5`)

## Lo que se quiere (palabras de Luis y de la empresa)

- "Poner precios, pero también tener la opción de cambiar los precios, hasta por cliente y todo."
- Lista general + poder mover el precio por cliente.
- Cambiar precios lo puede hacer el dueño y los administradores a los que se les **asigne** (el
  organigrama con todos los puestos viene después).
- Un cambio vale **de ahí en adelante**; lo anterior conserva su precio.
- La empresa: *"Unos son por recolección, otros por mes, otros por semana; unos se facturan, otros
  son dinero en efectivo."* · *"Sí, 16 % a los que facturan."*
- Por cliente: **"¿Requiere factura? Sí/No"**; con Sí se le suma el 16 %.
- Los reportes y totales tienen que quedar **en 0** (la operación de prueba ya se borró el 7-oct;
  lo que queda es de las cuentas de revisión MOR-DEMO).

**Éxito:** el dueño captura la lista real, ajusta el precio de un cliente, el cotizador del portal y su
PDF dan el número correcto (con IVA solo si factura), todo queda en historial y bitácora, y las apps
pueden leer los mismos precios del servidor (las consume la 1.1.1).

## Fuera de este proyecto

- **Cargar a cada cliente lo que se le recolecta, corte de mes y avisos de pago** → proyecto 3
  ("ciclo de saldo mensual"). Este diseño deja lista la pieza que le falta: *qué precio le toca a un
  cliente en una fecha*.
- **App 1.1.1** (arreglo de Sign in with Apple, EAS Update, leer precios/Hold del servidor) → proyecto 2.
- **Apagar el modo Hold**: se hace el día que los precios reales estén capturados, junto con Luis, en
  el mismo commit (regla vigente). Este proyecto no lo apaga.

## 1. Datos (migración `db/027-precios.sql`)

### `conceptos` — lo que se cobra
| columna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `clave` | text único | estable, para código y apps (`contenedor-3m3-recoleccion`) |
| `nombre` | text | lo que ve la gente |
| `unidad` | text | "por recolección", "por tonelada", "mensual"… |
| `modalidad` | text | `por-recoleccion` · `semanal` · `mensual` · `por-tonelada` (mismos valores que `suscripciones.modalidad`, db/023) |
| `orden` | int | orden en listas |
| `activo` | bool | un concepto nunca se borra, se desactiva |
| `creado` | timestamptz | |

Arranca **vacía**: los 12 conceptos de prueba de `CATALOGO_COTIZADOR` NO se migran (son inventados).

### `precios` — historial único, nunca se edita ni se borra
| columna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `concepto_id` | uuid → conceptos | |
| `cliente_id` | uuid → clientes, **nullable** | null = precio de lista; con valor = precio especial |
| `precio` | numeric(12,2) ≥ 0 | **sin IVA**; null solo cuando `quitado` |
| `vale_desde` | timestamptz | default `now()`; no se aceptan fechas pasadas (cambios solo hacia adelante) |
| `quitado` | bool default false | renglón que **quita** el precio especial (el cliente vuelve a lista); solo con `cliente_id` |
| `creado_por` | uuid → perfiles | |
| `creado` | timestamptz | |

Candados: `update` y `delete` prohibidos para todos (trigger), incluso para el dueño; los errores se
corrigen con un renglón nuevo.

### `clientes.requiere_factura` — bool not null default false
"¿Requiere factura?" Sí/No. Cambiarlo cuenta como cambio de precio (mismo permiso, misma bitácora).

### `clientes.es_prueba` — bool not null default false
Marca las cuentas de revisión de las tiendas. La migración la pone en `true` para los folios
`MOR-DEMO-%`. Ver sección 5.

### `perfiles.permisos` — text[] not null default '{}'
Permisos finos además del rol. Por ahora un solo valor válido: `precios` (check contra una lista).
El dueño los tiene todos sin marcarlos. Solo el dueño puede cambiar `permisos` (se extiende el trigger
anti-escalada de db/022).

### Funciones SQL
- `tiene_permiso(p text) → bool`: dueño activo, o admin activo con `p = any(permisos)`.
- `precio_de(cliente uuid, concepto uuid, en timestamptz default now()) → numeric`: el último renglón
  especial del cliente con `vale_desde <= en`; si no hay o el último es `quitado`, el último de lista
  con `vale_desde <= en`; si no hay ninguno, `null` (concepto sin precio).
- `precio_con_iva(cliente, concepto, en)`: `precio_de × 1.16` si `requiere_factura`, si no igual.
  El 16 % vive en UN solo lugar (constante SQL) y la web lo lee de ahí o de `IVA` en `portal-datos.js`
  (que pasa a ser la única copia en la web).

### Quién ve qué (RLS)
- `conceptos`: lectura para personal y clientes (activos); escritura solo `tiene_permiso('precios')`.
- `precios`: el personal lee todo; un cliente lee los de lista y **solo sus** especiales; insertar
  solo `tiene_permiso('precios')`, con `creado_por = auth.uid()` forzado.
- Escrituras reales por **acciones de servidor auditadas** (patrón de `acciones-auditadas.js`): exigen
  el segundo paso (código por correo) y escriben `bitacora` con el antes y el después.

## 2. Panel: sección "Precios" (`/admin/precios`)

Visible en el menú solo si `tiene_permiso('precios')` (o el rol es dueño).

- **Lista general:** tabla de conceptos (nombre, unidad, modalidad, precio actual sin IVA). Acciones:
  *Nuevo concepto*, *Cambiar precio*, *Desactivar*, *Historial* (cajón con cada renglón: precio, desde,
  quién). Un concepto sin precio se marca "Sin precio" en ámbar.
- **Por cliente:** buscador de cliente → cajón con:
  - interruptor **"¿Requiere factura?" Sí/No** (con Sí, debajo: "Se le suma 16 % de IVA");
  - por concepto: "Lista: $X" o "Especial: $Y", con *Poner precio especial* / *Cambiar* /
    *Volver a lista* e historial propio.
  - El mismo cajón se abre desde un botón **Precios** en cada renglón de `/admin/clientes`.
- **Confirmación:** cada cambio muestra "De $A a $B, vale desde ahora. Lo ya cobrado no cambia." y
  pide el código por correo si el pase del segundo paso no está vigente.
- **Permisos:** en `/admin/usuarios`, junto a cada administrador, casilla **"Puede cambiar precios"**
  que solo el dueño puede marcar.

## 3. Cotizador del portal y PDFs

- `portal/cotizador` y `descargarCotizacion` (`lib/portal-pdf.js`) leen conceptos y precios de la base
  con `precio_de` para el cliente que entró; el IVA se suma **solo si `requiere_factura`** (hoy se suma
  siempre). Mientras el Hold esté activo se sigue viendo `CotizadorEnEspera` (sin cambio).
- `CATALOGO_COTIZADOR` deja de usarse con base real; se conserva solo para el modo demostración sin
  Supabase (desarrollo local), marcado como tal.
- Aviso "los precios pueden tener modificaciones" (`AvisoPrecios`) junto a todo precio nuevo: panel de
  precios, cajón del cliente, cotizador y PDF.
- **Hueco a cerrar:** `descargarReportePDF` (`portal-pdf.js:419-438`) imprime "Monto" sin revisar
  `enHold()`.

## 4. Servicio para las apps — `POST /api/app/precios`

Patrón `entrarApp` de `lib/app-ruta.js`. Devuelve `{ hold, iva, conceptos: [{clave, nombre, unidad,
modalidad, precio, precioConIva, especial}], requiereFactura }` calculado para el cliente de la sesión
(personal: lista general). Sin caché. Con Hold activo, los precios vienen en `null` y `hold: true`.
La 1.1.1 lo consume; las apps actuales no se tocan en este proyecto.

## 5. Las cuentas de revisión no cuentan

Con `clientes.es_prueba = true` se excluyen de: KPIs del panel (`kpisAdmin`, `cobranza12Meses`),
reportes del panel y sus series (`datos-reportes.js`), listas de solicitudes/recolecciones/servicios del
panel, saldos de clientes y el contador de clientes. En `/admin/clientes` siguen apareciendo con la
etiqueta **"Cuenta de revisión"** (para poder entrar a verlas) pero fuera de los totales.
Las apps y el portal de esas cuentas siguen funcionando igual (Apple y Google las usan).

## 6. Pruebas

- `test:db` (PGlite): `precio_de` (lista, especial, quitado, fechas), candados (cliente no ve
  especiales ajenos, admin sin permiso no inserta, nadie edita ni borra `precios`, solo el dueño cambia
  `permisos`), `requiere_factura` y `es_prueba`; la 027 se agrega a la lista de idempotencia.
- `npm test`: cálculo de IVA por cliente, armado del cotizador y del PDF con precios de la base,
  respuesta de `/api/app/precios` (con y sin Hold), filtro de cuentas de revisión en KPIs y reportes.
- Revisión visual del panel de precios en local (escritorio y teléfono) antes de pedir el push.

## 7. Lista "que no se nos pase nada"

- [ ] Migración 027 corrida en producción (la corre Luis o con su OK) y probada contra `test:db`.
- [ ] Dueño ve "Precios"; admin sin permiso NO; admin con permiso SÍ.
- [ ] "¿Requiere factura?" en el cajón del cliente; con Sí el cotizador suma 16 %, con No no.
- [ ] Historial y bitácora de cada cambio (precio, factura, permisos).
- [ ] Cotizador del portal + PDF con precios reales y aviso de precios.
- [ ] PDF de reportes respeta el Hold.
- [ ] Cuentas MOR-DEMO fuera de KPIs, reportes y totales; etiquetadas en Clientes.
- [ ] `/api/app/precios` listo para la 1.1.1.
- [ ] Manuales y presentaciones de `docs/` actualizados (regla: si cambia el sistema, se actualizan).
- [ ] Captura de la lista real cuando la empresa la mande → día de apagar el Hold (con Luis).
- [ ] Push a `main` solo con el visto bueno de Luis (lo empuja él).
